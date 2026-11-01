import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import prisma from "../config/prisma.js";
import {
  declareTodayAttendance,
  decideAttendanceRecord,
} from "../Modules/Attendance/attendanceService.js";
import { todayDate } from "../Utils/date.js";

describe("Attendance State Machine Tests", () => {
  let regularUser = null;
  let adminUser = null;
  let superAdminUser = null;
  let project = null;

  before(async () => {
    regularUser = await prisma.user.create({
      data: {
        code: `test_reg_${Date.now()}`,
        name: "Regular Test User",
        role: "USER",
      },
    });

    adminUser = await prisma.user.create({
      data: {
        code: `test_admin_${Date.now()}`,
        name: "Admin Test User",
        role: "ADMIN",
      },
    });

    superAdminUser = await prisma.user.create({
      data: {
        code: `test_super_${Date.now()}`,
        name: "SuperAdmin Test User",
        role: "SUPER_ADMIN",
      },
    });

    project = await prisma.project.create({
      data: {
        name: "Test Attendance Project",
        createdById: superAdminUser.id,
      },
    });
  });

  after(async () => {
    const userIds = [regularUser?.id, adminUser?.id, superAdminUser?.id].filter(Boolean);
    await prisma.workSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.attendance.deleteMany({ where: { userId: { in: userIds } } });
    if (project) await prisma.project.delete({ where: { id: project.id } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  test("Double declaration on the same day fails with 409", async () => {
    const rec1 = await declareTodayAttendance(regularUser.id, "PRESENT");
    assert.equal(rec1.status, "PRESENT");
    assert.equal(rec1.approval, "PENDING");

    await assert.rejects(
      async () => {
        await declareTodayAttendance(regularUser.id, "ABSENT");
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        return true;
      }
    );
  });

  test("Nobody may decide their own record (403)", async () => {
    // Admin declares attendance
    const adminAttendance = await declareTodayAttendance(adminUser.id, "PRESENT");

    await assert.rejects(
      async () => {
        await decideAttendanceRecord(adminAttendance.id, "APPROVED", adminUser);
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /cannot review your own/);
        return true;
      }
    );
  });

  test("Admin may not decide SuperAdmin's record (403)", async () => {
    const superAttendance = await declareTodayAttendance(superAdminUser.id, "PRESENT");

    await assert.rejects(
      async () => {
        await decideAttendanceRecord(superAttendance.id, "APPROVED", adminUser);
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /cannot review a Super Admin/);
        return true;
      }
    );
  });

  test("Decisions on ABSENT records return 409", async () => {
    // Create an absent record for a test date
    const absentRec = await prisma.attendance.create({
      data: {
        userId: regularUser.id,
        date: new Date("2026-01-10T00:00:00.000Z"),
        status: "ABSENT",
        approval: "APPROVED",
        source: "USER",
      },
    });

    await assert.rejects(
      async () => {
        await decideAttendanceRecord(absentRec.id, "REJECTED", adminUser);
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.match(err.message, /ABSENT attendance records/);
        return true;
      }
    );
  });

  test("Rejection transaction cascades: deleting sessions and preventing further decisions", async () => {
    // Get regular user's today attendance (created in test 1)
    const today = todayDate();
    const att = await prisma.attendance.findUnique({
      where: { userId_date: { userId: regularUser.id, date: today } },
    });

    // Create a work session linked to this attendance
    const session = await prisma.workSession.create({
      data: {
        userId: regularUser.id,
        projectId: project.id,
        attendanceId: att.id,
        durationSeconds: 1200,
      },
    });
    assert.ok(session.id);

    // SuperAdmin rejects regular user's attendance
    const rejected = await decideAttendanceRecord(att.id, "REJECTED", superAdminUser);
    assert.equal(rejected.approval, "REJECTED");
    assert.equal(rejected.effectiveStatus, "ABSENT");

    // Verify session was deleted
    const sessionAfter = await prisma.workSession.findUnique({
      where: { id: session.id },
    });
    assert.equal(sessionAfter, null, "WorkSession must be deleted when attendance is rejected");

    // Guard: REJECTED is final (subsequent decision attempt -> 409)
    await assert.rejects(
      async () => {
        await decideAttendanceRecord(att.id, "APPROVED", superAdminUser);
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.match(err.message, /Rejected attendance records cannot be changed/);
        return true;
      }
    );
  });
});
