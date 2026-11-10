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
  let testScrum = null;
  let activeTask = null;
  let inactiveTask = null;

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

    // Seed a Scrum with zero active sprints + 1 active Task + 1 inactive Task
    testScrum = await prisma.scrum.create({
      data: {
        name: "WS Test Scrum",
        isActive: true,
        members: {
          create: [{ userId: memberUser.id }, { userId: nonMemberUser.id }],
        },
      },
    });

    activeTask = await prisma.task.create({
      data: {
        scrumId: testScrum.id,
        name: "Active Scrum Task",
        points: 5,
        isActive: true,
        members: {
          create: [{ userId: memberUser.id, assignedById: superAdminUser.id }],
        },
      },
    });

    inactiveTask = await prisma.task.create({
      data: {
        scrumId: testScrum.id,
        name: "Inactive Scrum Task",
        points: 3,
        isActive: false,
        members: {
          create: [{ userId: memberUser.id, assignedById: superAdminUser.id }],
        },
      },
    });
  });

  after(async () => {
    const userIds = [memberUser?.id, nonMemberUser?.id, superAdminUser?.id].filter(Boolean);
    const projectIds = [activeProject?.id, inactiveProject?.id].filter(Boolean);
    const taskIds = [activeTask?.id, inactiveTask?.id].filter(Boolean);

    await prisma.workSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.attendance.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.taskMember.deleteMany({ where: { taskId: { in: taskIds } } });
    await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
    if (testScrum?.id) {
      await prisma.scrumMember.deleteMany({ where: { scrumId: testScrum.id } });
      await prisma.scrum.deleteMany({ where: { id: testScrum.id } });
    }
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

  test("Idempotency: duplicate clientRequestId returns existing record without creating a second row", async () => {
    const testNow = new Date("2026-08-10T12:00:00.000Z");
    const testDate = todayDate(testNow);
    const clientReqId = "a1b2c3d4-e5f6-4a7b-8c9d-0123456789ab";

    const att = await prisma.attendance.create({
      data: {
        userId: memberUser.id,
        date: testDate,
        status: "PRESENT",
        approval: "PENDING",
        source: "USER",
      },
    });

    const first = await logWorkSession(
      {
        userId: memberUser.id,
        projectId: activeProject.id,
        durationSeconds: 1200,
        startedAt: testNow.toISOString(),
        clientRequestId: clientReqId,
      },
      testNow
    );

    assert.ok(first.id);
    assert.equal(first.durationSeconds, 1200);
    assert.equal(first.clientRequestId, clientReqId);

    // Call again with the exact same clientRequestId
    const second = await logWorkSession(
      {
        userId: memberUser.id,
        projectId: activeProject.id,
        durationSeconds: 1200,
        startedAt: testNow.toISOString(),
        clientRequestId: clientReqId,
      },
      testNow
    );

    assert.equal(second.id, first.id, "Must return the exact same session record");

    const totalSessions = await prisma.workSession.count({
      where: { userId: memberUser.id, clientRequestId: clientReqId },
    });
    assert.equal(totalSessions, 1, "Exactly one row must exist in the database");

    await prisma.workSession.deleteMany({ where: { attendanceId: att.id } });
    await prisma.attendance.delete({ where: { id: att.id } });
  });

  test("Rejects startedAt in the future beyond 15 minutes clock skew (400)", async () => {
    const testNow = new Date();
    const futureStartedAt = new Date(testNow.getTime() + 20 * 60 * 1000); // 20 minutes ahead

    await assert.rejects(
      async () => {
        await logWorkSession(
          {
            userId: memberUser.id,
            projectId: activeProject.id,
            durationSeconds: 300,
            startedAt: futureStartedAt.toISOString(),
            clientRequestId: "b2c3d4e5-f6a7-4b8c-9d0e-123456789abc",
          },
          testNow
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /future/);
        return true;
      }
    );
  });

  test("Rejects startedAt older than 2 days (400)", async () => {
    const testNow = new Date();
    const oldStartedAt = new Date(testNow.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago

    await assert.rejects(
      async () => {
        await logWorkSession(
          {
            userId: memberUser.id,
            projectId: activeProject.id,
            durationSeconds: 300,
            startedAt: oldStartedAt.toISOString(),
            clientRequestId: "c3d4e5f6-a7b8-4c9d-0e1f-23456789abcd",
          },
          testNow
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /older than 2 days/);
        return true;
      }
    );
  });

  test("Rejects invalid durationSeconds (non-integer, <= 0, or > 86400) (400)", async () => {
    const testNow = new Date();

    // Zero
    await assert.rejects(
      async () => {
        await logWorkSession(
          {
            userId: memberUser.id,
            projectId: activeProject.id,
            durationSeconds: 0,
            startedAt: testNow.toISOString(),
            clientRequestId: "d4e5f6a7-b8c9-4d0e-1f2a-3456789abcde",
          },
          testNow
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );

    // Float
    await assert.rejects(
      async () => {
        await logWorkSession(
          {
            userId: memberUser.id,
            projectId: activeProject.id,
            durationSeconds: 15.5,
            startedAt: testNow.toISOString(),
            clientRequestId: "e5f6a7b8-c9d0-4e1f-2a3b-456789abcdef",
          },
          testNow
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );

    // Greater than MAX (86400)
    await assert.rejects(
      async () => {
        await logWorkSession(
          {
            userId: memberUser.id,
            projectId: activeProject.id,
            durationSeconds: 86401,
            startedAt: testNow.toISOString(),
            clientRequestId: "f6a7b8c9-d0e1-4f2a-3b4c-56789abcdef0",
          },
          testNow
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  test("Logs WorkSession against active Scrum Task even with zero active sprints", async () => {
    const testNow = new Date("2026-09-01T11:00:00.000Z");
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

    const session = await logWorkSession(
      {
        userId: memberUser.id,
        taskId: activeTask.id,
        durationSeconds: 1200,
        startedAt: testNow.toISOString(),
        clientRequestId: "a9b8c7d6-e5f4-4a3b-8c2d-1234567890ef",
      },
      testNow
    );

    assert.ok(session.id);
    assert.equal(session.taskId, activeTask.id);
    assert.equal(session.projectId, null);

    await prisma.workSession.delete({ where: { id: session.id } });
    await prisma.attendance.delete({ where: { id: att.id } });
  });

  test("Refuses logging on Task when user is unassigned (403) or Task is inactive (400)", async () => {
    const testNow = new Date("2026-09-02T11:00:00.000Z");

    await assert.rejects(
      async () => {
        await logWorkSession(
          {
            userId: nonMemberUser.id,
            taskId: activeTask.id,
            durationSeconds: 600,
          },
          testNow
        );
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await logWorkSession(
          {
            userId: memberUser.id,
            taskId: inactiveTask.id,
            durationSeconds: 600,
          },
          testNow
        );
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  test("DB-level CHECK constraint enforces XOR between projectId and taskId", async () => {
    const testNow = new Date("2026-09-03T10:00:00.000Z");
    const att = await prisma.attendance.create({
      data: {
        userId: memberUser.id,
        date: todayDate(testNow),
        status: "PRESENT",
        approval: "PENDING",
        source: "USER",
      },
    });

    await assert.rejects(
      async () => {
        await prisma.$executeRaw`
          INSERT INTO "WorkSession" ("userId", "projectId", "taskId", "attendanceId", "durationSeconds", "createdAt")
          VALUES (${memberUser.id}, ${activeProject.id}, ${activeTask.id}, ${att.id}, 600, NOW())
        `;
      },
      /WorkSession_project_or_task_check/
    );

    await prisma.attendance.delete({ where: { id: att.id } });
  });

  test("Deleting a Task cascade-deletes its WorkSessions without deleting Attendance", async () => {
    const testNow = new Date("2026-09-04T10:00:00.000Z");
    const att = await prisma.attendance.create({
      data: {
        userId: memberUser.id,
        date: todayDate(testNow),
        status: "PRESENT",
        approval: "PENDING",
        source: "USER",
      },
    });

    const tempTask = await prisma.task.create({
      data: {
        scrumId: testScrum.id,
        name: "Cascade Delete Task",
        points: 2,
        isActive: true,
        members: {
          create: [{ userId: memberUser.id, assignedById: superAdminUser.id }],
        },
      },
    });

    const session = await logWorkSession(
      {
        userId: memberUser.id,
        taskId: tempTask.id,
        durationSeconds: 900,
        startedAt: testNow.toISOString(),
        clientRequestId: "12345678-1234-4234-8234-1234567890ab",
      },
      testNow
    );

    assert.ok(session.id);

    await prisma.task.delete({ where: { id: tempTask.id } });

    const remainingSessions = await prisma.workSession.count({
      where: { id: session.id },
    });
    const remainingAttendance = await prisma.attendance.findUnique({
      where: { id: att.id },
    });

    assert.equal(remainingSessions, 0, "WorkSession must be cascade-deleted when Task is deleted");
    assert.ok(remainingAttendance, "Attendance must remain intact after Task deletion");

    await prisma.attendance.delete({ where: { id: att.id } });
  });
});
