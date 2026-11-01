import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import prisma from "../config/prisma.js";
import { runDailyClose } from "../Jobs/dailyClose.js";
import { todayDate, addDays, formatDate } from "../Utils/date.js";

describe("DailyClose Job Tests", () => {
  let testUser = null;
  const fixedNow = new Date("2026-11-15T12:00:00.000Z");
  const T = todayDate(fixedNow);

  before(async () => {
    // Create an active user created on T - 5
    const createdDate = addDays(T, -5);
    testUser = await prisma.user.create({
      data: {
        code: `test_dailyclose_${Date.now()}`,
        name: "DailyClose Test User",
        role: "USER",
        isActive: true,
        createdAt: createdDate,
      },
    });
  });

  after(async () => {
    if (testUser) {
      await prisma.attendance.deleteMany({ where: { userId: testUser.id } });
      await prisma.user.delete({ where: { id: testUser.id } });
    }
  });

  test("fills absences for active users in [T - catchupDays, T - 1] and auto-approves T-2 but not T-1", async () => {
    // Create attendance on T - 2 with PRESENT, PENDING
    const dateTMinus2 = addDays(T, -2);
    const recTMinus2 = await prisma.attendance.create({
      data: {
        userId: testUser.id,
        date: dateTMinus2,
        status: "PRESENT",
        approval: "PENDING",
        source: "USER",
      },
    });

    // Create attendance on T - 1 with PRESENT, PENDING
    const dateTMinus1 = addDays(T, -1);
    const recTMinus1 = await prisma.attendance.create({
      data: {
        userId: testUser.id,
        date: dateTMinus1,
        status: "PRESENT",
        approval: "PENDING",
        source: "USER",
      },
    });

    // Run daily close
    const firstRun = await runDailyClose(fixedNow);
    assert.ok(firstRun.filledAbsencesCount >= 1, "Should have filled at least 1 missing absence");
    assert.ok(firstRun.autoApprovedCount >= 1, "Should have auto-approved at least 1 record");

    // Check T - 2: MUST be APPROVED by SYSTEM
    const updatedTMinus2 = await prisma.attendance.findUnique({
      where: { id: recTMinus2.id },
    });
    assert.equal(updatedTMinus2.approval, "APPROVED");
    assert.equal(updatedTMinus2.source, "SYSTEM");

    // Check T - 1: MUST REMAINS PENDING (review window is open through next day)
    const updatedTMinus1 = await prisma.attendance.findUnique({
      where: { id: recTMinus1.id },
    });
    assert.equal(updatedTMinus1.approval, "PENDING");
    assert.equal(updatedTMinus1.source, "USER");

    // Check that missing date T - 3 was filled with ABSENT, APPROVED, SYSTEM
    const dateTMinus3 = addDays(T, -3);
    const filledTMinus3 = await prisma.attendance.findUnique({
      where: {
        userId_date: {
          userId: testUser.id,
          date: dateTMinus3,
        },
      },
    });
    assert.ok(filledTMinus3, "Absence for T - 3 should have been filled");
    assert.equal(filledTMinus3.status, "ABSENT");
    assert.equal(filledTMinus3.approval, "APPROVED");
    assert.equal(filledTMinus3.source, "SYSTEM");

    // Test Idempotency on second run with exact same now
    const secondRun = await runDailyClose(fixedNow);
    assert.equal(secondRun.filledAbsencesCount, 0, "Second run should fill 0 absences");
    assert.equal(secondRun.autoApprovedCount, 0, "Second run should auto-approve 0 records");
  });
});
