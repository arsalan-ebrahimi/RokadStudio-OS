import prisma from "../config/prisma.js";
import {
  todayDate,
  addDays,
  datesBetween,
  toDateOnly,
  formatDate,
} from "../Utils/date.js";
import { invalidateAllProjectsCache } from "../Utils/cache.js";

/**
 * Pure, idempotent core function for the daily close job.
 * Fills absences for missed days in [T - catchupDays, T - 1] and auto-approves pending attendances with date <= T - 2.
 */
export const runDailyClose = async (now = new Date(), prismaClient = prisma) => {
  const T = todayDate(now);
  const catchupDays = parseInt(process.env.ATTENDANCE_CATCHUP_DAYS || "7", 10);
  const startDate = addDays(T, -catchupDays);
  const endDate = addDays(T, -1);

  let filledAbsencesCount = 0;

  if (startDate.getTime() <= endDate.getTime()) {
    const dates = datesBetween(startDate, endDate);

    // Fetch all active users
    const activeUsers = await prismaClient.user.findMany({
      where: { isActive: true },
      select: { id: true, createdAt: true },
    });

    // Fetch all existing attendance records in this date range
    const existingRecords = await prismaClient.attendance.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        userId: true,
        date: true,
      },
    });

    const existingKeySet = new Set(
      existingRecords.map((r) => `${r.userId}_${formatDate(r.date)}`)
    );

    const rowsToInsert = [];

    for (const d of dates) {
      const dStr = formatDate(d);
      for (const u of activeUsers) {
        const userCreatedDate = toDateOnly(u.createdAt);
        // Only fill if user was created on or before date D
        if (userCreatedDate.getTime() <= d.getTime()) {
          const key = `${u.id}_${dStr}`;
          if (!existingKeySet.has(key)) {
            rowsToInsert.push({
              userId: u.id,
              date: d,
              status: "ABSENT",
              approval: "APPROVED",
              source: "SYSTEM",
            });
            existingKeySet.add(key); // prevent duplicate in-batch
          }
        }
      }
    }

    if (rowsToInsert.length > 0) {
      const result = await prismaClient.attendance.createMany({
        data: rowsToInsert,
        skipDuplicates: true,
      });
      filledAbsencesCount = result.count;
    }
  }

  // 2. Auto-approve: status=PRESENT, approval=PENDING with date <= T - 2
  const autoApproveCutoff = addDays(T, -2);
  const autoApproveResult = await prismaClient.attendance.updateMany({
    where: {
      status: "PRESENT",
      approval: "PENDING",
      date: {
        lte: autoApproveCutoff,
      },
    },
    data: {
      approval: "APPROVED",
      source: "SYSTEM",
      decidedAt: now,
    },
  });

  const autoApprovedCount = autoApproveResult.count;

  // Auto-approve pending work sessions with workDate <= autoApproveCutoff
  const autoApproveSessionsResult = await prismaClient.workSession.updateMany({
    where: {
      approval: "PENDING",
      workDate: {
        lte: autoApproveCutoff,
      },
    },
    data: {
      approval: "APPROVED",
      source: "SYSTEM",
      decidedAt: now,
    },
  });

  const autoApprovedSessionsCount = autoApproveSessionsResult.count;

  // Invalidate any cached project/auth summaries if needed
  await invalidateAllProjectsCache();

  // One-line summary log (counts only - never codes)
  console.log(
    `[DailyClose] Processed: ${filledAbsencesCount} absences filled, ${autoApprovedCount} attendances auto-approved, ${autoApprovedSessionsCount} work sessions auto-approved.`
  );

  return {
    filledAbsencesCount,
    autoApprovedCount,
    autoApprovedSessionsCount,
  };
};
