import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import prisma from "../config/prisma.js";
import { logWorkSession } from "../Modules/WorkSession/workSessionService.js";
import { todayDate, addDays } from "../Utils/date.js";

describe("WorkSession Business Rules & Database Integrity Tests", () => {
  let memberUser = null;
  let nonMemberUser = null;
  let superAdminUser = null;
  let activeProject = null;
  let inactiveProject = null;

  before(async () => {
    superAdminUser = await prisma.user.create({
      data: {
        code: `test_ws_admin_${Date.now()}`,
        name: "WS SuperAdmin",
        role: "SUPER_ADMIN",
      },
    });

    memberUser = await prisma.user.create({
      data: {
        code: `test_ws_member_${Date.now()}`,
        name: "WS Member User",
        role: "USER",
      },
    });

    nonMemberUser = await prisma.user.create({
      data: {
        code: `test_ws_nonmember_${Date.now()}`,
        name: "WS NonMember User",
        role: "USER",
      },
    });

    activeProject = await prisma.project.create({
      data: {
        name: "Active Test Project",
        isActive: true,
        createdById: superAdminUser.id,
      },
    });

    inactiveProject = await prisma.project.create({
      data: {
        name: "Inactive Test Project",
        isActive: false,
        createdById: superAdminUser.id,
      },
    });

    // Add memberUser to activeProject
    await prisma.projectMember.create({
      data: {
        projectId: activeProject.id,
        userId: memberUser.id,
      },
    });
  });

  after(async () => {
    const userIds = [memberUser?.id, nonMemberUser?.id, superAdminUser?.id].filter(Boolean);
    const projectIds = [activeProject?.id, inactiveProject?.id].filter(Boolean);

    await prisma.workSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.attendance.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.projectMember.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  test("Refuses logging when user is not a member of project (403)", async () => {
    // Create today attendance
    await prisma.attendance.create({
      data: {
        userId: nonMemberUser.id,
        date: todayDate(),
        status: "PRESENT",
        approval: "PENDING",
        source: "USER",
      },
    });

    await assert.rejects(
      async () => {
        await logWorkSession({
          userId: nonMemberUser.id,
          projectId: activeProject.id,
          durationSeconds: 800,
        });
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /not an assigned member/);
        return true;
      }
    );
  });

  test("Refuses logging when project is inactive (400)", async () => {
    // Assign member to inactive project
    await prisma.projectMember.create({
      data: {
        projectId: inactiveProject.id,
        userId: memberUser.id,
      },
    });

    await assert.rejects(
      async () => {
        await logWorkSession({
          userId: memberUser.id,
          projectId: inactiveProject.id,
          durationSeconds: 800,
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Project not found or inactive/);
        return true;
      }
    );
  });

  test("Refuses logging when attendance is ABSENT or REJECTED", async () => {
    const testNow = new Date("2026-06-15T10:00:00.000Z");
    const testDate = todayDate(testNow);

    // Create an ABSENT attendance
    const absentAtt = await prisma.attendance.create({
      data: {
        userId: memberUser.id,
        date: testDate,
        status: "ABSENT",
        approval: "APPROVED",
        source: "USER",
      },
    });

    await assert.rejects(
      async () => {
        await logWorkSession(
          {
            userId: memberUser.id,
            projectId: activeProject.id,
            durationSeconds: 900,
          },
          testNow
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /must be PRESENT/);
        return true;
      }
    );

    // Clean up test attendance
    await prisma.attendance.delete({ where: { id: absentAtt.id } });
  });

  test("Midnight grace fallback: logs against yesterday's attendance when within grace period", async () => {
    // Simulated time: 00:15 in Asia/Tehran
    // 2026-06-16 00:15:00 Tehran = 2026-06-15 20:45:00 UTC
    const graceNow = new Date("2026-06-15T20:45:00.000Z");
    const today = todayDate(graceNow); // 2026-06-16
    const yesterday = addDays(today, -1); // 2026-06-15

    // No attendance exists for 2026-06-16 yet, but 2026-06-15 exists
    const yesterdayAtt = await prisma.attendance.create({
      data: {
        userId: memberUser.id,
        date: yesterday,
        status: "PRESENT",
        approval: "PENDING",
        source: "USER",
      },
    });

    const session = await logWorkSession(
      {
        userId: memberUser.id,
        projectId: activeProject.id,
        durationSeconds: 1500,
      },
      graceNow
    );

    assert.ok(session.id);
    assert.equal(session.attendanceId, yesterdayAtt.id, "Session should link to yesterday's attendance");

    await prisma.workSession.delete({ where: { id: session.id } });
    await prisma.attendance.delete({ where: { id: yesterdayAtt.id } });
  });

  test("Two sessions for the same user and project are both successfully stored", async () => {
    const testNow = new Date("2026-07-20T14:00:00.000Z");
    const testDate = todayDate(testNow);

    const att = await prisma.attendance.create({
      data: {
        userId: memberUser.id,
        date: testDate,
        status: "PRESENT",
        approval: "PENDING",
        source: "USER",
      },
    });

    const s1 = await logWorkSession(
      { userId: memberUser.id, projectId: activeProject.id, durationSeconds: 600 },
      testNow
    );
    const s2 = await logWorkSession(
      { userId: memberUser.id, projectId: activeProject.id, durationSeconds: 900 },
      testNow
    );

    assert.ok(s1.id);
    assert.ok(s2.id);
    assert.notEqual(s1.id, s2.id);

    const allSessions = await prisma.workSession.findMany({
      where: { attendanceId: att.id },
    });
    assert.equal(allSessions.length, 2, "Both sessions must be stored");

    await prisma.workSession.deleteMany({ where: { attendanceId: att.id } });
    await prisma.attendance.delete({ where: { id: att.id } });
  });

  test("DB-level CHECK constraint rejects durationSeconds <= 0", async () => {
    const testNow = new Date("2026-08-01T10:00:00.000Z");
    const testDate = todayDate(testNow);

    const att = await prisma.attendance.create({
      data: {
        userId: memberUser.id,
        date: testDate,
        status: "PRESENT",
        approval: "PENDING",
        source: "USER",
      },
    });

    // Attempt direct SQL insertion with durationSeconds = 0
    await assert.rejects(
      async () => {
        await prisma.$executeRaw`
          INSERT INTO "WorkSession" ("userId", "projectId", "attendanceId", "durationSeconds", "createdAt")
          VALUES (${memberUser.id}, ${activeProject.id}, ${att.id}, 0, NOW())
        `;
      },
      /WorkSession_durationSeconds_check/
    );

    await prisma.attendance.delete({ where: { id: att.id } });
  });
});
