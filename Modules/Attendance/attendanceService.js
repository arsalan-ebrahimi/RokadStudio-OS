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

export const declareTodayAttendance = async (userId, declaredStatus, now = new Date()) => {
  const date = todayDate(now);

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

  // Guard: REJECTED is final
  if (attendance.approval === "REJECTED") {
    throw new HandleERROR("Rejected attendance records cannot be changed", 409);
  }

  // State machine checks:
  // Allowed: PENDING -> APPROVED, PENDING -> REJECTED, APPROVED -> REJECTED
  if (decision === "APPROVED") {
    if (attendance.approval !== "PENDING") {
      throw new HandleERROR(`Cannot approve an attendance record that is currently ${attendance.approval}`, 409);
    }

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
