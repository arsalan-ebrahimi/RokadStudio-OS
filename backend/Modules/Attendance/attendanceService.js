import { HandleERROR } from "vanta-api";
import prisma from "../../config/prisma.js";
import { todayDate } from "../../Utils/date.js";
import { mapPrismaError } from "../../Utils/prismaErrors.js";

export const computeEffectiveStatus = (status, approval) => {
  if (approval === "REJECTED") {
    return "ABSENT";
  }
  return status;
};

export const declareTodayAttendance = async (userId, declaredStatus, reasonOrNow = null, maybeNow = new Date()) => {
  let reason = null;
  let now = maybeNow;

  if (reasonOrNow instanceof Date) {
    now = reasonOrNow;
  } else if (typeof reasonOrNow === "string") {
    reason = reasonOrNow;
  }

  const date = todayDate(now);

  const existing = await prisma.attendance.findUnique({
    where: {
      userId_date: {
        userId,
        date,
      },
    },
  });

  if (existing) {
    // If user previously declared ABSENT and now wants to declare PRESENT ("امروز هم می‌آم!")
    if (existing.status === "ABSENT" && declaredStatus === "PRESENT") {
      const updated = await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          status: "PRESENT",
          approval: "PENDING",
          source: "USER",
          reason: null,
          decidedById: null,
          decidedAt: null,
        },
      });

      const sessionAgg = await prisma.workSession.aggregate({
        where: { attendanceId: updated.id },
        _count: { id: true },
        _sum: { durationSeconds: true },
      });

      return {
        ...updated,
        effectiveStatus: computeEffectiveStatus(updated.status, updated.approval),
        sessionsCount: sessionAgg._count.id,
        totalSeconds: sessionAgg._sum.durationSeconds || 0,
      };
    }

    throw new HandleERROR("Attendance already declared for today", 409);
  }

  const approval = declaredStatus === "PRESENT" ? "PENDING" : "APPROVED";
  const source = "USER";

  try {
    const record = await prisma.attendance.create({
      data: {
        userId,
        date,
        status: declaredStatus,
        approval,
        source,
        reason: declaredStatus === "ABSENT" ? reason : null,
      },
    });

    return {
      ...record,
      effectiveStatus: computeEffectiveStatus(record.status, record.approval),
      sessionsCount: 0,
      totalSeconds: 0,
    };
  } catch (err) {
    if (err.code === "P2002") {
      throw new HandleERROR("Attendance already declared for today", 409);
    }
    const mapped = mapPrismaError(err);
    if (mapped) throw mapped;
    throw err;
  }
};

export const decideAttendanceRecord = async (attendanceId, decision, adminUser, now = new Date()) => {
  const attendance = await prisma.attendance.findUnique({
    where: { id: attendanceId },
    include: {
      user: {
        select: {
          id: true,
          role: true,
        },
      },
    },
  });

  if (!attendance) {
    throw new HandleERROR("Attendance record not found", 404);
  }

  // Guard: Nobody may decide their own record
  if (attendance.userId === adminUser.id) {
    throw new HandleERROR("You cannot review your own attendance record", 403);
  }

  // Guard: ADMIN may not decide a SUPER_ADMIN's record
  if (adminUser.role === "ADMIN" && attendance.user.role === "SUPER_ADMIN") {
    throw new HandleERROR("Admins cannot review a Super Admin's attendance", 403);
  }

  // Guard: Decisions on ABSENT records are forbidden
  if (attendance.status === "ABSENT") {
    throw new HandleERROR("Decisions cannot be made on ABSENT attendance records", 409);
  }

  // Admin can decide or change status to APPROVED or REJECTED at any time
  if (decision === "APPROVED") {
    const updated = await prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        approval: "APPROVED",
        source: "ADMIN",
        decidedById: adminUser.id,
        decidedAt: now,
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
        decidedBy: { select: { id: true, name: true } },
      },
    });

    return {
      ...updated,
      effectiveStatus: computeEffectiveStatus(updated.status, updated.approval),
    };
  }

  if (decision === "REJECTED") {
    // Rejection transaction: update attendance + deleteMany work sessions
    const { updated, deletedSessionsCount } = await prisma.$transaction(async (tx) => {
      const updatedRecord = await tx.attendance.update({
        where: { id: attendanceId },
        data: {
          approval: "REJECTED",
          source: "ADMIN",
          decidedById: adminUser.id,
          decidedAt: now,
        },
        include: {
          user: { select: { id: true, name: true, role: true } },
          decidedBy: { select: { id: true, name: true } },
        },
      });

      const deleteResult = await tx.workSession.deleteMany({
        where: { attendanceId },
      });

      return { updated: updatedRecord, deletedSessionsCount: deleteResult.count };
    });

    return {
      ...updated,
      effectiveStatus: computeEffectiveStatus(updated.status, updated.approval),
      deletedSessionsCount,
    };
  }

  throw new HandleERROR("Invalid decision value", 400);
};
