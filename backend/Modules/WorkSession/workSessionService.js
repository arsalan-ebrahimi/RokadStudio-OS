import { HandleERROR } from "vanta-api";
import prisma from "../../config/prisma.js";
import {
  todayDate,
  addDays,
  minutesSinceMidnight,
  toDateOnly,
} from "../../Utils/date.js";

export const logWorkSession = async (
  { userId, projectId, durationSeconds, startedAt, clientRequestId },
  now = new Date()
) => {
  // Idempotency: return existing session if clientRequestId already processed
  if (clientRequestId) {
    const existing = await prisma.workSession.findUnique({
      where: {
        userId_clientRequestId: {
          userId,
          clientRequestId,
        },
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
    });
    if (existing) {
      return existing;
    }
  }

  // 1. Duration validation
  const maxSeconds = parseInt(process.env.MAX_SESSION_SECONDS || "86400", 10);
  if (
    typeof durationSeconds !== "number" ||
    !Number.isInteger(durationSeconds) ||
    durationSeconds < 1 ||
    durationSeconds > maxSeconds
  ) {
    throw new HandleERROR(
      `durationSeconds must be an integer between 1 and ${maxSeconds}`,
      400
    );
  }

  // 2. startedAt validation and derivation
  const startDate = startedAt ? new Date(startedAt) : now;
  if (isNaN(startDate.getTime())) {
    throw new HandleERROR("Invalid startedAt timestamp", 400);
  }
  const nowTime = now.getTime();
  const maxFuture = nowTime + 15 * 60 * 1000; // 15 minutes clock skew allowed
  const minPast = nowTime - 2 * 24 * 60 * 60 * 1000; // not older than 2 days
  if (startDate.getTime() > maxFuture) {
    throw new HandleERROR("startedAt cannot be in the future", 400);
  }
  if (startDate.getTime() < minPast) {
    throw new HandleERROR("startedAt cannot be older than 2 days", 400);
  }

  // 3. Verify project exists, is active, and user is assigned
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, isActive: true },
  });

  if (!project || !project.isActive) {
    throw new HandleERROR("Project not found or inactive", 400);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  if (!isSuperAdmin) {
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new HandleERROR("You are not an assigned member of this project", 403);
    }
  }

  // 4. Resolve Attendance for workDate: derived using same day boundary helper as attendance
  const workDate = todayDate(startDate);
  let targetAttendance = await prisma.attendance.findUnique({
    where: {
      userId_date: {
        userId,
        date: workDate,
      },
    },
  });

  if (!targetAttendance) {
    // Check Midnight Grace
    const minutes = minutesSinceMidnight(startDate);
    const graceMinutes = parseInt(process.env.MIDNIGHT_GRACE_MINUTES || "30", 10);

    if (minutes <= graceMinutes) {
      const yesterday = addDays(workDate, -1);
      targetAttendance = await prisma.attendance.findUnique({
        where: {
          userId_date: {
            userId,
            date: yesterday,
          },
        },
      });
    }
  }

  if (!targetAttendance) {
    throw new HandleERROR(
      "No active attendance record found for this date. Please mark attendance first.",
      400
    );
  }

  if (targetAttendance.status !== "PRESENT") {
    throw new HandleERROR(
      "Cannot log work session: attendance status must be PRESENT",
      400
    );
  }

  if (targetAttendance.approval === "REJECTED") {
    throw new HandleERROR(
      "Cannot log work session: attendance record has been REJECTED",
      400
    );
  }

  // 5. Race protection: lock attendance row with SELECT ... FOR UPDATE inside transaction
  try {
    const session = await prisma.$transaction(async (tx) => {
      const lockedRows = await tx.$queryRaw`
        SELECT id, status, approval FROM "Attendance"
        WHERE id = ${targetAttendance.id}
        FOR UPDATE
      `;

      if (!lockedRows || lockedRows.length === 0) {
        throw new HandleERROR("Attendance record not found", 404);
      }

      const lockedAttendance = lockedRows[0];
      if (
        lockedAttendance.status !== "PRESENT" ||
        lockedAttendance.approval === "REJECTED"
      ) {
        throw new HandleERROR(
          "Cannot log work session: attendance is not PRESENT or was REJECTED",
          400
        );
      }

      const created = await tx.workSession.create({
        data: {
          userId,
          projectId,
          attendanceId: lockedAttendance.id,
          durationSeconds,
          clientRequestId: clientRequestId || null,
          workDate: targetAttendance.date,
          startedAt: startDate,
          createdAt: now,
        },
        include: {
          project: {
            select: { id: true, name: true },
          },
        },
      });

      return created;
    });

    return session;
  } catch (err) {
    if (err?.code === "P2002" && clientRequestId) {
      const existing = await prisma.workSession.findUnique({
        where: {
          userId_clientRequestId: {
            userId,
            clientRequestId,
          },
        },
        include: {
          project: {
            select: { id: true, name: true },
          },
        },
      });
      if (existing) return existing;
    }
    throw err;
  }
};

export const getWorkSessionsSummaryAgg = async ({
  userId,
  projectId,
  date,
  dateFrom,
  dateTo,
  groupBy = "user_project",
  approval,
}) => {
  const where = {};

  if (userId) where.userId = Number(userId);
  if (projectId) where.projectId = Number(projectId);
  if (approval) {
    where.approval = approval;
  } else {
    // By default, exclude REJECTED sessions from summary aggregation
    where.approval = { not: "REJECTED" };
  }

  if (date || dateFrom || dateTo) {
    if (date) {
      where.workDate = toDateOnly(date);
    } else {
      where.workDate = {};
      if (dateFrom) where.workDate.gte = toDateOnly(dateFrom);
      if (dateTo) where.workDate.lte = toDateOnly(dateTo);
    }
  }

  let byFields;
  if (groupBy === "user") {
    byFields = ["userId"];
  } else if (groupBy === "project") {
    byFields = ["projectId"];
  } else {
    byFields = ["userId", "projectId"];
  }

  // Database groupBy aggregation
  const grouped = await prisma.workSession.groupBy({
    by: byFields,
    where,
    _count: { id: true },
    _sum: { durationSeconds: true },
  });

  // Batch load names to prevent N+1
  const userIds = [...new Set(grouped.map((g) => g.userId).filter(Boolean))];
  const projectIds = [...new Set(grouped.map((g) => g.projectId).filter(Boolean))];

  const [users, projects] = await Promise.all([
    userIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      : [],
    projectIds.length > 0
      ? prisma.project.findMany({
          where: { id: { in: projectIds } },
          select: { id: true, name: true },
        })
      : [],
  ]);

  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));

  const rows = grouped.map((g) => {
    const row = {
      totalSeconds: g._sum.durationSeconds || 0,
      sessionsCount: g._count.id,
    };

    if (g.userId) {
      row.user = {
        id: g.userId,
        name: userMap.get(g.userId) || "Unknown",
      };
    }

    if (g.projectId) {
      row.project = {
        id: g.projectId,
        name: projectMap.get(g.projectId) || "Unknown",
      };
    }

    return row;
  });

  return rows;
};

export const decideWorkSessionRecord = async (sessionId, decision, adminUser, now = new Date()) => {
  const session = await prisma.workSession.findUnique({
    where: { id: sessionId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!session) {
    throw new HandleERROR("سشن کاری یافت نشد", 404);
  }

  // Guard: ADMIN may not decide a SUPER_ADMIN's record
  if (adminUser.role === "ADMIN" && session.user.role === "SUPER_ADMIN") {
    throw new HandleERROR("مدیران اجازه بررسی و تغییر وضعیت سشن سوپرادمین را ندارند", 403);
  }

  if (decision !== "APPROVED" && decision !== "REJECTED") {
    throw new HandleERROR("وضعیت انتخابی نامعتبر است", 400);
  }

  const updated = await prisma.workSession.update({
    where: { id: sessionId },
    data: {
      approval: decision,
      source: "ADMIN",
      decidedById: adminUser.id,
      decidedAt: now,
    },
    include: {
      user: { select: { id: true, name: true, role: true } },
      project: { select: { id: true, name: true } },
      decidedBy: { select: { id: true, name: true } },
    },
  });

  return updated;
};

export const deleteWorkSession = async (sessionId, currentUser) => {
  const session = await prisma.workSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new HandleERROR("سشن کاری یافت نشد", 404);
  }

  const isPrivileged = currentUser.role === "ADMIN" || currentUser.role === "SUPER_ADMIN";
  const isOwner = session.userId === currentUser.id;

  if (!isPrivileged && !isOwner) {
    throw new HandleERROR("شما اجازه حذف این سشن کاری را ندارید", 403);
  }

  await prisma.workSession.delete({
    where: { id: sessionId },
  });

  return { id: sessionId };
};
