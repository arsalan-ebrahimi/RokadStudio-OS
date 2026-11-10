import { HandleERROR } from "vanta-api";
import { Prisma } from "../../generated/prisma/client.ts";
import prisma from "../../config/prisma.js";
import {
  todayDate,
  toDateOnly,
  formatDate,
  getTehranJalaliMonthRange,
} from "../../Utils/date.js";
import { getPagination } from "../../Utils/pagination.js";
import {
  MAX_LIST_LIMIT,
  getTehranPersianDayOfWeek,
} from "./scrumService.js";

const formatScrumTask = (task, trackedMap = null, currentUserId = null) => {
  const members = (task.members || []).map((m) => ({
    id: m.user.id,
    name: m.user.name,
  }));

  return {
    id: task.id,
    scrumId: task.scrumId,
    name: task.name,
    description: task.description,
    points: task.points,
    isActive: task.isActive,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    members,
    isAssignedToMe: currentUserId ? members.some((m) => m.id === currentUserId) : false,
    trackedSeconds: trackedMap?.get(task.id) || {
      approved: 0,
      pending: 0,
      rejected: 0,
    },
  };
};

const fetchTaskTrackedMap = async (db, taskIds = [], scopedUserId = null) => {
  const map = new Map();
  if (!taskIds || taskIds.length === 0) return map;

  const grouped = await db.workSession.groupBy({
    by: ["taskId", "approval"],
    where: {
      taskId: { in: taskIds },
      approval: { in: ["APPROVED", "PENDING", "REJECTED"] },
      ...(scopedUserId ? { userId: scopedUserId } : {}),
    },
    _sum: { durationSeconds: true },
  });

  for (const row of grouped) {
    if (!row.taskId) continue;
    if (!map.has(row.taskId)) {
      map.set(row.taskId, { approved: 0, pending: 0, rejected: 0 });
    }
    const entry = map.get(row.taskId);
    const secs = row._sum.durationSeconds || 0;
    if (row.approval === "APPROVED") {
      entry.approved += secs;
    } else if (row.approval === "PENDING") {
      entry.pending += secs;
    } else if (row.approval === "REJECTED") {
      entry.rejected += secs;
    }
  }

  return map;
};

const assertValidTaskAssignees = async (db, scrumId, userIds = []) => {
  const uniqueIds = [...new Set(userIds.map(Number))];
  if (uniqueIds.length === 0) return [];

  const validUsers = await db.user.findMany({
    where: {
      id: { in: uniqueIds },
      isActive: true,
      role: { in: ["USER", "SCRUM_ADMIN", "SUPER_ADMIN"] },
      OR: [
        { scrumMembers: { some: { scrumId } } },
        { scrumAdmins: { some: { scrumId } } },
        { role: "SUPER_ADMIN" },
      ],
    },
    select: { id: true },
  });

  if (validUsers.length !== uniqueIds.length) {
    throw new HandleERROR(
      "همه کاربران انتخاب‌شده باید عضو فعال این اسکرام باشند",
      422
    );
  }

  return uniqueIds;
};

const taskSelectFields = {
  id: true,
  scrumId: true,
  name: true,
  description: true,
  points: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  members: {
    select: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { user: { name: "asc" } },
  },
};

export const listScrumTasksService = async (
  scrumId,
  { isActive, search } = {},
  currentUser,
  canEditContent
) => {
  const where = { scrumId };
  if (isActive !== undefined) {
    where.isActive = isActive;
  }
  if (search) {
    where.name = { contains: search.trim(), mode: "insensitive" };
  }

  const tasks = await prisma.task.findMany({
    where,
    take: MAX_LIST_LIMIT,
    select: taskSelectFields,
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });

  const scopedUserId = canEditContent ? null : currentUser.id;
  const trackedMap =
    tasks.length > 0
      ? await fetchTaskTrackedMap(
          prisma,
          tasks.map((t) => t.id),
          scopedUserId
        )
      : new Map();

  return tasks.map((t) => formatScrumTask(t, trackedMap, currentUser.id));
};

export const getTaskByIdService = async (taskId, currentUser, canEditContent) => {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: taskSelectFields,
  });

  if (!task) {
    throw new HandleERROR("تسک یافت نشد", 404);
  }

  const scopedUserId = canEditContent ? null : currentUser.id;
  const trackedMap = await fetchTaskTrackedMap(prisma, [task.id], scopedUserId);
  return formatScrumTask(task, trackedMap, currentUser.id);
};

export const createScrumTaskService = async (
  scrumId,
  { name, description, points = 0, isActive = true, memberIds = [] },
  actorUser
) => {
  const uniqueMemberIds = await assertValidTaskAssignees(prisma, scrumId, memberIds || []);

  const created = await prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        scrumId,
        name: name.trim(),
        description: description ? description.trim() || null : null,
        points: points != null ? Number(points) : 0,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    if (uniqueMemberIds.length > 0) {
      await tx.taskMember.createMany({
        data: uniqueMemberIds.map((userId) => ({
          taskId: task.id,
          userId,
          assignedById: actorUser.id,
        })),
      });
    }

    return await tx.task.findUnique({
      where: { id: task.id },
      select: taskSelectFields,
    });
  });

  const trackedMap = new Map([[created.id, { approved: 0, pending: 0, rejected: 0 }]]);
  return formatScrumTask(created, trackedMap, actorUser.id);
};

export const updateScrumTaskService = async (
  taskId,
  { name, description, points, isActive },
  currentUser,
  canEditContent
) => {
  const data = {};
  if (name !== undefined) data.name = name.trim();
  if (description !== undefined) {
    data.description = description === null ? null : description.trim() || null;
  }
  if (points !== undefined) data.points = Number(points);
  if (isActive !== undefined) data.isActive = Boolean(isActive);

  const updated = await prisma.task.update({
    where: { id: taskId },
    data,
    select: taskSelectFields,
  });

  const scopedUserId = canEditContent ? null : currentUser.id;
  const trackedMap = await fetchTaskTrackedMap(prisma, [updated.id], scopedUserId);
  return formatScrumTask(updated, trackedMap, currentUser.id);
};

export const syncTaskMembersService = async (taskId, userIds = [], actorUser) => {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, scrumId: true },
  });

  if (!task) {
    throw new HandleERROR("تسک یافت نشد", 404);
  }

  const targetUserIds = await assertValidTaskAssignees(prisma, task.scrumId, userIds || []);

  return await prisma.$transaction(async (tx) => {
    const existing = await tx.taskMember.findMany({
      where: { taskId },
      select: { userId: true },
    });

    const existingSet = new Set(existing.map((m) => m.userId));
    const targetSet = new Set(targetUserIds);

    const toAdd = targetUserIds.filter((uid) => !existingSet.has(uid));
    const toRemove = existing.map((m) => m.userId).filter((uid) => !targetSet.has(uid));

    if (toRemove.length > 0) {
      await tx.taskMember.deleteMany({
        where: {
          taskId,
          userId: { in: toRemove },
        },
      });
    }

    if (toAdd.length > 0) {
      await tx.taskMember.createMany({
        data: toAdd.map((userId) => ({
          taskId,
          userId,
          assignedById: actorUser.id,
        })),
      });
    }

    const updated = await tx.taskMember.findMany({
      where: { taskId },
      select: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { user: { name: "asc" } },
    });

    return updated.map((m) => ({
      id: m.user.id,
      name: m.user.name,
    }));
  });
};

export const deleteScrumTaskService = async (taskId) => {
  await prisma.$transaction(async (tx) => {
    const sessionCount = await tx.workSession.count({
      where: { taskId },
    });

    if (sessionCount > 0) {
      throw new HandleERROR(
        "امکان حذف این تسک به دلیل وجود سشن‌های کاری ثبت‌شده روی آن وجود ندارد. می‌توانید آن را غیرفعال کنید.",
        409
      );
    }

    await tx.task.delete({
      where: { id: taskId },
    });
  });
};

export const getTaskWorkSessionsService = async (
  taskId,
  query = {},
  currentUser,
  canEditContent
) => {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      scrumId: true,
      name: true,
      description: true,
      points: true,
      isActive: true,
      scrum: {
        select: { id: true, name: true, color: true, isActive: true },
      },
    },
  });

  if (!task) {
    throw new HandleERROR("تسک یافت نشد", 404);
  }

  const { page, limit, skip } = getPagination(query);
  const { date, dateFrom, dateTo, approval, userId } = query;

  if (!canEditContent && userId && Number(userId) !== currentUser.id) {
    throw new HandleERROR("شما فقط مجاز به مشاهده سشن‌های کاری خود هستید", 403);
  }

  const baseDateWhere = {
    taskId,
    ...(canEditContent ? {} : { userId: currentUser.id }),
  };

  if (date) {
    baseDateWhere.workDate = toDateOnly(date);
  } else if (dateFrom || dateTo) {
    baseDateWhere.workDate = {};
    if (dateFrom) baseDateWhere.workDate.gte = toDateOnly(dateFrom);
    if (dateTo) baseDateWhere.workDate.lte = toDateOnly(dateTo);
  }

  const listWhere = {
    ...baseDateWhere,
    ...(approval && approval !== "ALL" ? { approval } : {}),
    ...(canEditContent && userId ? { userId: Number(userId) } : {}),
  };

  const [groupedSummary, total, sessions] = await Promise.all([
    prisma.workSession.groupBy({
      by: ["userId", "approval"],
      where: baseDateWhere,
      _sum: { durationSeconds: true },
      _count: { id: true },
    }),
    prisma.workSession.count({ where: listWhere }),
    prisma.workSession.findMany({
      where: listWhere,
      skip,
      take: limit,
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
      include: {
        user: {
          select: { id: true, name: true, role: true },
        },
        decidedBy: {
          select: { id: true, name: true },
        },
      },
    }),
  ]);

  const contributorIds = [...new Set(groupedSummary.map((g) => g.userId))];
  const contributors =
    contributorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: contributorIds } },
          select: { id: true, name: true },
        })
      : [];
  const contributorNameMap = new Map(contributors.map((u) => [u.id, u.name]));

  const summary = {
    totalSeconds: 0,
    approvedSeconds: 0,
    pendingSeconds: 0,
    rejectedSeconds: 0,
    sessionCount: 0,
    approvedCount: 0,
    pendingCount: 0,
    rejectedCount: 0,
    byUser: [],
  };

  const byUserMap = new Map();
  for (const row of groupedSummary) {
    const secs = row._sum.durationSeconds || 0;
    const cnt = row._count.id || 0;

    summary.totalSeconds += secs;
    summary.sessionCount += cnt;

    if (!byUserMap.has(row.userId)) {
      byUserMap.set(row.userId, {
        user: {
          id: row.userId,
          name: contributorNameMap.get(row.userId) || "Unknown",
        },
        totalSeconds: 0,
        approvedSeconds: 0,
        pendingSeconds: 0,
        rejectedSeconds: 0,
        sessionCount: 0,
      });
    }

    const userEntry = byUserMap.get(row.userId);
    userEntry.totalSeconds += secs;
    userEntry.sessionCount += cnt;

    if (row.approval === "APPROVED") {
      summary.approvedSeconds += secs;
      summary.approvedCount += cnt;
      userEntry.approvedSeconds += secs;
    } else if (row.approval === "PENDING") {
      summary.pendingSeconds += secs;
      summary.pendingCount += cnt;
      userEntry.pendingSeconds += secs;
    } else if (row.approval === "REJECTED") {
      summary.rejectedSeconds += secs;
      summary.rejectedCount += cnt;
      userEntry.rejectedSeconds += secs;
    }
  }

  summary.byUser = [...byUserMap.values()].sort(
    (a, b) => b.totalSeconds - a.totalSeconds || a.user.name.localeCompare(b.user.name)
  );

  const isSuperAdmin = currentUser.role === "SUPER_ADMIN";

  const formattedSessions = sessions.map((s) => ({
    id: s.id,
    targetType: "TASK",
    projectId: null,
    project: null,
    taskId: task.id,
    task: {
      id: task.id,
      name: task.name,
      points: task.points,
      scrum: task.scrum,
    },
    user: { id: s.user.id, name: s.user.name },
    durationSeconds: s.durationSeconds,
    workDate: formatDate(s.workDate),
    startedAt: s.startedAt,
    createdAt: s.createdAt,
    approval: s.approval,
    source: s.source,
    decidedBy: s.decidedBy || null,
    decidedAt: s.decidedAt || null,
    canModerate: canEditContent && !(currentUser.role !== "SUPER_ADMIN" && s.user.role === "SUPER_ADMIN"),
    canDelete: isSuperAdmin,
  }));

  return {
    data: {
      target: {
        kind: "TASK",
        id: task.id,
        name: task.name,
        description: task.description,
        points: task.points,
        isActive: task.isActive,
        scrum: task.scrum,
      },
      permissions: {
        canViewAllUsers: canEditContent,
        canModerate: canEditContent,
        canDelete: isSuperAdmin,
      },
      summary,
      sessions: formattedSessions,
    },
    page,
    limit,
    total,
  };
};

export const getScrumLeaderboardService = async (
  scrumId,
  { period = "SPRINT", sprintId } = {},
  currentUser,
  now = new Date()
) => {
  const resolvedPeriod = period || "SPRINT";
  let sprintInfo = null;
  let range = null;
  let periodFilterSql = Prisma.sql`TRUE`;

  if (resolvedPeriod === "SPRINT") {
    let targetSprint = null;
    if (sprintId) {
      targetSprint = await prisma.sprint.findFirst({
        where: { id: Number(sprintId), scrumId },
        select: {
          id: true,
          number: true,
          title: true,
          startDate: true,
          endDate: true,
          completedAt: true,
        },
      });
      if (!targetSprint) {
        throw new HandleERROR("اسپرینت یافت نشد", 404);
      }
    } else {
      targetSprint = await prisma.sprint.findFirst({
        where: { scrumId, status: "ACTIVE" },
        select: {
          id: true,
          number: true,
          title: true,
          startDate: true,
          endDate: true,
          completedAt: true,
        },
      });

      if (!targetSprint) {
        targetSprint = await prisma.sprint.findFirst({
          where: { scrumId, status: "COMPLETED" },
          orderBy: { number: "desc" },
          select: {
            id: true,
            number: true,
            title: true,
            startDate: true,
            endDate: true,
            completedAt: true,
          },
        });
      }
    }

    if (!targetSprint) {
      periodFilterSql = Prisma.sql`FALSE`;
    } else {
      sprintInfo = {
        id: targetSprint.id,
        number: targetSprint.number,
        title: targetSprint.title,
      };

      const startStr = targetSprint.startDate ? formatDate(targetSprint.startDate) : null;
      const endStr = targetSprint.endDate ? formatDate(targetSprint.endDate) : null;
      const completedStr = targetSprint.completedAt
        ? formatDate(toDateOnly(targetSprint.completedAt))
        : null;
      const todayStr = formatDate(todayDate(now));

      const projFrom = startStr;
      let projTo = endStr || completedStr || (startStr ? todayStr : null);
      if (projFrom && projTo && projTo < projFrom) {
        projTo = projFrom;
      }

      if (projFrom && projTo) {
        range = { from: projFrom, to: projTo };
      }

      const conds = [Prisma.sql`t."scrumId" = ${scrumId}`];
      if (projFrom) {
        conds.push(Prisma.sql`ws."workDate" >= ${projFrom}::date`);
      }
      if (projTo) {
        conds.push(Prisma.sql`ws."workDate" <= ${projTo}::date`);
      }

      periodFilterSql = Prisma.join(conds, " AND ");
    }
  } else if (resolvedPeriod === "MONTH") {
    const { from, to } = getTehranJalaliMonthRange(now);
    const fromStr = formatDate(from);
    const toStr = formatDate(to);
    range = { from: fromStr, to: toStr };
    periodFilterSql = Prisma.sql`
      t."scrumId" = ${scrumId}
      AND ws."workDate" >= ${fromStr}::date
      AND ws."workDate" <= ${toStr}::date
    `;
  } else {
    range = null;
    periodFilterSql = Prisma.sql`t."scrumId" = ${scrumId}`;
  }

  // Single DB query joining ScrumMembers + caller against approved & pending Task WorkSessions
  const rawRows = await prisma.$queryRaw(Prisma.sql`
    WITH scoped_users AS (
      SELECT sm."userId", TRUE AS "isScrumMember"
      FROM "ScrumMember" sm
      WHERE sm."scrumId" = ${scrumId}
      UNION
      SELECT
        ${currentUser.id}::int AS "userId",
        EXISTS (
          SELECT 1
          FROM "ScrumMember" sm2
          WHERE sm2."scrumId" = ${scrumId} AND sm2."userId" = ${currentUser.id}
        ) AS "isScrumMember"
    ),
    session_agg AS (
      SELECT
        ws."userId",
        COALESCE(SUM(ws."durationSeconds") FILTER (WHERE ws."approval" = 'APPROVED'), 0)::bigint AS "approvedSeconds",
        COUNT(*) FILTER (WHERE ws."approval" = 'APPROVED')::int AS "sessionCount",
        COALESCE(SUM(ws."durationSeconds") FILTER (WHERE ws."approval" = 'PENDING'), 0)::bigint AS "pendingSeconds"
      FROM "WorkSession" ws
      JOIN "Attendance" a ON a."id" = ws."attendanceId"
      JOIN "Task" t ON t."id" = ws."taskId"
      WHERE a."approval" <> 'REJECTED'
        AND ws."approval" IN ('APPROVED', 'PENDING')
        AND (${periodFilterSql})
      GROUP BY ws."userId"
    )
    SELECT
      u."id"::int AS "id",
      u."name" AS "name",
      su."isScrumMember" AS "isScrumMember",
      COALESCE(sa."approvedSeconds", 0)::bigint AS "approvedSeconds",
      COALESCE(sa."sessionCount", 0)::int AS "sessionCount",
      COALESCE(sa."pendingSeconds", 0)::bigint AS "pendingSeconds"
    FROM scoped_users su
    JOIN "User" u ON u."id" = su."userId"
    LEFT JOIN session_agg sa ON sa."userId" = u."id"
    ORDER BY COALESCE(sa."approvedSeconds", 0) DESC, u."name" ASC
  `);

  const memberRows = rawRows.filter((r) => Boolean(r.isScrumMember));

  let prevRank = 0;
  let prevSeconds = null;
  const rows = memberRows.map((r, idx) => {
    const approvedSeconds = Number(r.approvedSeconds || 0);
    const sessionCount = Number(r.sessionCount || 0);
    const rank = idx === 0 ? 1 : approvedSeconds === prevSeconds ? prevRank : idx + 1;
    prevRank = rank;
    prevSeconds = approvedSeconds;

    return {
      rank,
      user: {
        id: Number(r.id),
        name: r.name,
      },
      approvedSeconds,
      sessionCount,
      isMe: Number(r.id) === currentUser.id,
    };
  });

  const meInRows = rows.find((r) => r.isMe);
  const meRaw = rawRows.find((r) => Number(r.id) === currentUser.id);

  const me = {
    rank: meInRows ? meInRows.rank : null,
    approvedSeconds: meInRows ? meInRows.approvedSeconds : Number(meRaw?.approvedSeconds || 0),
    pendingSeconds: Number(meRaw?.pendingSeconds || 0),
  };

  return {
    period: resolvedPeriod,
    range,
    sprint: sprintInfo,
    rows,
    me,
  };
};

export const getScrumAdminDashboardService = async (currentUser, now = new Date()) => {
  const isSuperAdmin = currentUser.role === "SUPER_ADMIN";
  const scrumWhere = isSuperAdmin
    ? { isActive: true }
    : { isActive: true, admins: { some: { userId: currentUser.id } } };

  const scrums = await prisma.scrum.findMany({
    where: scrumWhere,
    take: MAX_LIST_LIMIT,
    select: {
      id: true,
      name: true,
      color: true,
      _count: {
        select: {
          members: true,
          tasks: true,
        },
      },
      sprints: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          number: true,
          title: true,
          endDate: true,
          progressPercent: true,
        },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (scrums.length === 0) {
    return {
      totals: {
        scrums: 0,
        members: 0,
        activeSprints: 0,
        activeTasks: 0,
        totalTasks: 0,
        totalTaskPoints: 0,
      },
      scrums: [],
      todayEvents: [],
    };
  }

  const scrumIds = scrums.map((s) => s.id);
  const scrumMap = new Map(scrums.map((s) => [s.id, s]));

  const today = todayDate(now);
  const persianDayOfWeek = getTehranPersianDayOfWeek(now);

  const [distinctMembersRows, taskStatsRows, kpiRows, rawTodayEvents] = await Promise.all([
    prisma.$queryRaw(Prisma.sql`
      SELECT COUNT(DISTINCT "userId")::int AS "distinctMembers"
      FROM "ScrumMember"
      WHERE "scrumId" = ANY(${scrumIds}::int[])
    `),
    prisma.$queryRaw(Prisma.sql`
      SELECT
        "scrumId"::int AS "scrumId",
        COUNT(*)::int AS "totalTasks",
        COUNT(*) FILTER (WHERE "isActive" = true)::int AS "activeTasks",
        COALESCE(SUM("points"), 0)::int AS "totalTaskPoints"
      FROM "Task"
      WHERE "scrumId" = ANY(${scrumIds}::int[])
      GROUP BY "scrumId"
    `),
    prisma.$queryRaw(Prisma.sql`
      SELECT
        "scrumId"::int AS "scrumId",
        COUNT(*)::int AS "total",
        COUNT(*) FILTER (
          WHERE "actualValue" IS NOT NULL
            AND "target" IS NOT NULL
            AND "minExpected" IS NOT NULL
            AND "actualValue" < "minExpected"
        )::int AS "belowMin",
        COUNT(*) FILTER (
          WHERE "actualValue" IS NOT NULL
            AND "target" IS NOT NULL
            AND NOT ("minExpected" IS NOT NULL AND "actualValue" < "minExpected")
            AND "actualValue" >= "target"
        )::int AS "onTarget",
        COUNT(*) FILTER (
          WHERE "actualValue" IS NOT NULL
            AND "target" IS NOT NULL
            AND NOT ("minExpected" IS NOT NULL AND "actualValue" < "minExpected")
            AND "actualValue" < "target"
        )::int AS "inRange"
      FROM "ScrumKpi"
      WHERE "scrumId" = ANY(${scrumIds}::int[])
      GROUP BY "scrumId"
    `),
    prisma.scrumEvent.findMany({
      where: {
        scrumId: { in: scrumIds },
        OR: [
          { scheduleType: "WEEKLY", dayOfWeek: persianDayOfWeek },
          { scheduleType: "ONCE", date: today },
        ],
      },
      take: MAX_LIST_LIMIT,
      orderBy: [{ startTime: "asc" }, { sortOrder: "asc" }],
      select: {
        scrumId: true,
        name: true,
        startTime: true,
        durationMinutes: true,
      },
    }),
  ]);

  const taskStatsMap = new Map(
    taskStatsRows.map((row) => [
      Number(row.scrumId),
      {
        totalTasks: Number(row.totalTasks || 0),
        activeTasks: Number(row.activeTasks || 0),
        totalTaskPoints: Number(row.totalTaskPoints || 0),
      },
    ])
  );

  const kpiMap = new Map(
    kpiRows.map((row) => [
      Number(row.scrumId),
      {
        total: Number(row.total || 0),
        belowMin: Number(row.belowMin || 0),
        inRange: Number(row.inRange || 0),
        onTarget: Number(row.onTarget || 0),
      },
    ])
  );

  let activeSprintsCount = 0;
  let grandActiveTasks = 0;
  let grandTotalTasks = 0;
  let grandTotalTaskPoints = 0;

  const formattedScrums = scrums.map((s) => {
    const activeSp = s.sprints[0] || null;
    const tStats = taskStatsMap.get(s.id) || {
      totalTasks: 0,
      activeTasks: 0,
      totalTaskPoints: 0,
    };

    grandActiveTasks += tStats.activeTasks;
    grandTotalTasks += tStats.totalTasks;
    grandTotalTaskPoints += tStats.totalTaskPoints;

    let activeSprintSummary = null;
    if (activeSp) {
      activeSprintsCount += 1;
      activeSprintSummary = {
        id: activeSp.id,
        number: activeSp.number,
        title: activeSp.title,
        endDate: formatDate(activeSp.endDate),
        progressPercent: activeSp.progressPercent ?? 0,
      };
    }

    return {
      id: s.id,
      name: s.name,
      color: s.color,
      memberCount: s._count.members,
      taskCount: tStats.totalTasks,
      activeTaskCount: tStats.activeTasks,
      totalTaskPoints: tStats.totalTaskPoints,
      activeSprint: activeSprintSummary,
      kpi: kpiMap.get(s.id) || {
        total: 0,
        belowMin: 0,
        inRange: 0,
        onTarget: 0,
      },
    };
  });

  const todayEvents = rawTodayEvents.map((e) => {
    const sc = scrumMap.get(e.scrumId);
    return {
      scrumId: e.scrumId,
      scrumName: sc?.name || "",
      color: sc?.color || "ECOSYSTEM",
      name: e.name,
      startTime: e.startTime,
      durationMinutes: e.durationMinutes,
    };
  });

  return {
    totals: {
      scrums: formattedScrums.length,
      members: Number(distinctMembersRows[0]?.distinctMembers || 0),
      activeSprints: activeSprintsCount,
      activeTasks: grandActiveTasks,
      totalTasks: grandTotalTasks,
      totalTaskPoints: grandTotalTaskPoints,
    },
    scrums: formattedScrums,
    todayEvents,
  };
};
