import { HandleERROR } from "vanta-api";
import prisma from "../../config/prisma.js";
import {
  todayDate,
  addDays,
  minutesSinceMidnight,
  toDateOnly,
} from "../../Utils/date.js";

export const logWorkSession = async (
  { userId, projectId, durationSeconds },
  now = new Date()
) => {
  // 1. Verify project exists, is active, and user is assigned
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, isActive: true },
  });

  if (!project || !project.isActive) {
    throw new HandleERROR("Project not found or inactive", 400);
  }

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

  // 2. Resolve Attendance: today or midnight grace fallback
  const today = todayDate(now);
  let targetAttendance = await prisma.attendance.findUnique({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
  });

  if (!targetAttendance) {
    // Check Midnight Grace
    const minutes = minutesSinceMidnight(now);
    const graceMinutes = parseInt(process.env.MIDNIGHT_GRACE_MINUTES || "30", 10);

    if (minutes <= graceMinutes) {
      const yesterday = addDays(today, -1);
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
      "No active attendance record found for today. Please mark attendance first.",
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

  // 3. Race protection: lock attendance row with SELECT ... FOR UPDATE inside transaction
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
};

export const getWorkSessionsSummaryAgg = async ({
  userId,
  projectId,
  date,
  dateFrom,
  dateTo,
  groupBy = "user_project",
}) => {
  const where = {};

  if (userId) where.userId = Number(userId);
  if (projectId) where.projectId = Number(projectId);

  if (date || dateFrom || dateTo) {
    where.attendance = {};
    if (date) {
      where.attendance.date = toDateOnly(date);
    } else {
      where.attendance.date = {};
      if (dateFrom) where.attendance.date.gte = toDateOnly(dateFrom);
      if (dateTo) where.attendance.date.lte = toDateOnly(dateTo);
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
