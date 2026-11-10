import { HandleERROR } from "vanta-api";
import prisma from "../../config/prisma.js";
import { todayDate, addDays, formatDate, minutesSinceMidnight } from "../../Utils/date.js";
import { mapPrismaError } from "../../Utils/prismaErrors.js";
import { SCRUM_ADMIN_CAN_DECIDE_ATTENDANCE } from "../Scrum/scrumScope.js";

export const computeEffectiveStatus = (status, approval) => {
  if (approval === "REJECTED") {
    return "ABSENT";
  }
  return status;
};

/**
 * Resolves the target Attendance record for session logging or work-note updates,
 * applying the same Tehran calendar day + midnight grace window rule.
 */
export const resolveTargetAttendanceForAction = async (userId, now = new Date(), db = prisma) => {
  const today = todayDate(now);

  let targetAttendance = await db.attendance.findUnique({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
  });

  if (!targetAttendance) {
    const minutes = minutesSinceMidnight(now);
    const graceMinutes = parseInt(process.env.MIDNIGHT_GRACE_MINUTES || "30", 10);

    if (minutes <= graceMinutes) {
      const yesterday = addDays(today, -1);
      targetAttendance = await db.attendance.findUnique({
        where: {
          userId_date: {
            userId,
            date: yesterday,
          },
        },
      });
    }
  }

  return { targetAttendance, today };
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
    // 1. Idempotent: If user already has the requested status for today, return gracefully
    if (existing.status === declaredStatus) {
      const sessionAgg = await prisma.workSession.aggregate({
        where: { attendanceId: existing.id },
        _count: { id: true },
        _sum: { durationSeconds: true },
      });

      return {
        ...existing,
        effectiveStatus: computeEffectiveStatus(existing.status, existing.approval),
        sessionsCount: sessionAgg._count.id,
        totalSeconds: sessionAgg._sum.durationSeconds || 0,
      };
    }

    // 2. If user previously declared ABSENT and now wants to declare PRESENT ("امروز هم می‌آم!")
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

    // 3. If user previously declared PRESENT and now declares ABSENT (and hasn't logged sessions yet)
    if (existing.status === "PRESENT" && declaredStatus === "ABSENT") {
      const sessionCount = await prisma.workSession.count({
        where: { attendanceId: existing.id },
      });

      if (sessionCount > 0) {
        throw new HandleERROR("نمی‌توانید پس از ثبت فعالیت کاری، وضعیت را به عدم حضور تغییر دهید", 400);
      }

      const updated = await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          status: "ABSENT",
          approval: "APPROVED",
          source: "USER",
          reason: reason || "اعلام عدم حضور توسط کاربر",
          decidedById: null,
          decidedAt: null,
        },
      });

      return {
        ...updated,
        effectiveStatus: "ABSENT",
        sessionsCount: 0,
        totalSeconds: 0,
      };
    }

    // Fallback: return existing state
    const sessionAgg = await prisma.workSession.aggregate({
      where: { attendanceId: existing.id },
      _count: { id: true },
      _sum: { durationSeconds: true },
    });

    return {
      ...existing,
      effectiveStatus: computeEffectiveStatus(existing.status, existing.approval),
      sessionsCount: sessionAgg._count.id,
      totalSeconds: sessionAgg._sum.durationSeconds || 0,
    };
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
      // Race protection: concurrent request created attendance, fetch and return it
      const freshlyCreated = await prisma.attendance.findUnique({
        where: {
          userId_date: {
            userId,
            date,
          },
        },
      });

      if (freshlyCreated) {
        const sessionAgg = await prisma.workSession.aggregate({
          where: { attendanceId: freshlyCreated.id },
          _count: { id: true },
          _sum: { durationSeconds: true },
        });

        return {
          ...freshlyCreated,
          effectiveStatus: computeEffectiveStatus(freshlyCreated.status, freshlyCreated.approval),
          sessionsCount: sessionAgg._count.id,
          totalSeconds: sessionAgg._sum.durationSeconds || 0,
        };
      }
    }
    const mapped = mapPrismaError(err);
    if (mapped) throw mapped;
    throw err;
  }
};

export const saveWorkNoteService = async (
  userId,
  { text, skipped } = {},
  now = new Date(),
  db = prisma
) => {
  const { targetAttendance, today } = await resolveTargetAttendanceForAction(userId, now, db);

  if (!targetAttendance) {
    throw new HandleERROR("رکورد حضور فعالی برای ثبت یادداشت یافت نشد", 409);
  }

  if (targetAttendance.approval === "REJECTED") {
    throw new HandleERROR("امکان ثبت یادداشت برای رکورد حضور ردشده وجود ندارد", 409);
  }

  if (targetAttendance.status !== "PRESENT") {
    throw new HandleERROR("امکان ثبت یادداشت برای وضعیت عدم حضور وجود ندارد", 409);
  }

  if (skipped) {
    if (targetAttendance.workNotePromptedAt) {
      return {
        ...targetAttendance,
        workNotePrompted: true,
      };
    }

    const updated = await db.attendance.update({
      where: { id: targetAttendance.id },
      data: {
        workNotePromptedAt: now,
      },
    });

    return {
      ...updated,
      workNotePrompted: Boolean(updated.workNotePromptedAt || updated.workNote !== null),
    };
  }

  const trimmedText = typeof text === "string" ? text.trim() : "";

  // Idempotent repeat save with the exact same note text
  if (targetAttendance.workNote === trimmedText) {
    if (!targetAttendance.workNotePromptedAt) {
      const updated = await db.attendance.update({
        where: { id: targetAttendance.id },
        data: {
          workNotePromptedAt: now,
        },
      });
      return {
        ...updated,
        workNotePrompted: true,
      };
    }
    return {
      ...targetAttendance,
      workNotePrompted: true,
    };
  }

  // Overwriting an existing non-null note is only permitted on the same Tehran day as that attendance
  const isSameDayAsAttendance = formatDate(targetAttendance.date) === formatDate(today);
  if (targetAttendance.workNote !== null && !isSameDayAsAttendance) {
    throw new HandleERROR("مهلت ویرایش یادداشت پایان کار برای این روز به پایان رسیده است", 409);
  }

  const updated = await db.attendance.update({
    where: { id: targetAttendance.id },
    data: {
      workNote: trimmedText,
      workNoteAt: now,
      ...(targetAttendance.workNotePromptedAt ? {} : { workNotePromptedAt: now }),
    },
  });

  return {
    ...updated,
    workNotePrompted: Boolean(updated.workNotePromptedAt || updated.workNote !== null),
  };
};

export const decideAttendanceRecord = async (attendanceId, decision, adminUser, now = new Date()) => {
  if (adminUser.role === "SCRUM_ADMIN" && !SCRUM_ADMIN_CAN_DECIDE_ATTENDANCE) {
    throw new HandleERROR("ادمین اسکرام اجازه تایید یا رد حضور و غیاب استودیو را ندارد", 403);
  }

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

  // Guard: Non-SUPER_ADMIN may not decide a SUPER_ADMIN's record
  if (adminUser.role !== "SUPER_ADMIN" && attendance.user.role === "SUPER_ADMIN") {
    throw new HandleERROR("Admins cannot review a Super Admin's attendance", 403);
  }

  if (adminUser.role === "SCRUM_ADMIN") {
    if (attendance.user.role === "ADMIN") {
      throw new HandleERROR("ادمین اسکرام مجاز به بررسی حضور و غیاب مدیر حضور و غیاب نیست", 403);
    }

    const managedMembership = await prisma.scrumMember.findFirst({
      where: {
        userId: attendance.userId,
        scrum: {
          admins: {
            some: { userId: adminUser.id },
          },
        },
      },
      select: { scrumId: true },
    });

    if (!managedMembership) {
      throw new HandleERROR(
        "شما فقط مجاز به بررسی حضور و غیاب اعضای اسکرام‌های تحت مدیریت خود هستید",
        403
      );
    }
  }

  // Guard: Decisions on ABSENT records are forbidden
  if (attendance.status === "ABSENT") {
    throw new HandleERROR("Decisions cannot be made on ABSENT attendance records", 409);
  }

  const userSelect =
    adminUser.role === "SCRUM_ADMIN"
      ? { id: true, name: true }
      : { id: true, name: true, role: true };

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
        user: { select: userSelect },
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
          user: { select: userSelect },
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

export const getAttendanceImpactService = async (attendanceId, db = prisma) => {
  const attendance = await db.attendance.findUnique({
    where: { id: attendanceId },
    select: { id: true, approval: true },
  });

  if (!attendance) {
    throw new HandleERROR("Attendance record not found", 404);
  }

  const [taskAgg, projectAgg] = await Promise.all([
    db.workSession.aggregate({
      where: { attendanceId, taskId: { not: null } },
      _count: { id: true },
      _sum: { durationSeconds: true },
    }),
    db.workSession.aggregate({
      where: { attendanceId, projectId: { not: null } },
      _count: { id: true },
      _sum: { durationSeconds: true },
    }),
  ]);

  const taskSessionCount = Number(taskAgg._count?.id || 0);
  const projectSessionCount = Number(projectAgg._count?.id || 0);
  const totalSeconds =
    Number(taskAgg._sum?.durationSeconds || 0) + Number(projectAgg._sum?.durationSeconds || 0);

  return {
    sessionCount: taskSessionCount + projectSessionCount,
    totalSeconds,
    taskSessionCount,
    projectSessionCount,
    alreadyRejected: attendance.approval === "REJECTED",
  };
};
