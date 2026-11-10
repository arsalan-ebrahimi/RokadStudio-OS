import { HandleERROR } from "vanta-api";
import { Prisma } from "../../generated/prisma/client.ts";
import prisma from "../../config/prisma.js";
import {
  todayDate,
  toDateOnly,
  formatDate,
  getTehranJalaliMonthRange,
} from "../../Utils/date.js";
import {
  invalidateAllProjectsCache,
  invalidateUserProjectsCache,
} from "../../Utils/cache.js";
import {
  MAX_LIST_LIMIT,
  getTehranPersianDayOfWeek,
} from "./scrumService.js";

const formatScrumLinkedProject = (proj, trackedMap = null, includeTracked = false) => {
  const base = {
    id: proj.id,
    name: proj.name,
    description: proj.description,
    isActive: proj.isActive,
    members: (proj.members || []).map((m) => ({
      id: m.user.id,
      name: m.user.name,
    })),
  };

  if (includeTracked) {
    base.trackedSeconds = trackedMap?.get(proj.id) || { approved: 0, pending: 0 };
  }

  return base;
};

const fetchLinkedProjectTrackedMap = async (db, projectIds = []) => {
  const map = new Map();
  if (!projectIds || projectIds.length === 0) return map;

  const grouped = await db.workSession.groupBy({
    by: ["projectId", "approval"],
    where: {
      projectId: { in: projectIds },
      approval: { in: ["APPROVED", "PENDING"] },
      attendance: { approval: { not: "REJECTED" } },
    },
    _sum: { durationSeconds: true },
  });

  for (const row of grouped) {
    if (!row.projectId) continue;
    if (!map.has(row.projectId)) {
      map.set(row.projectId, { approved: 0, pending: 0 });
    }
    const entry = map.get(row.projectId);
    const secs = row._sum.durationSeconds || 0;
    if (row.approval === "APPROVED") {
      entry.approved += secs;
    } else if (row.approval === "PENDING") {
      entry.pending += secs;
    }
  }

  return map;
};

const assertActiveScrumMembers = async (db, scrumId, userIds = []) => {
  const uniqueIds = [...new Set(userIds.map(Number))];
  if (uniqueIds.length === 0) return [];

  const validMembers = await db.scrumMember.findMany({
    where: {
      scrumId,
      userId: { in: uniqueIds },
      user: {
        isActive: true,
        role: { in: ["USER", "SCRUM_ADMIN", "SUPER_ADMIN"] },
      },
    },
    select: { userId: true },
  });

  if (validMembers.length !== uniqueIds.length) {
    throw new HandleERROR(
      "همه کاربران انتخاب‌شده باید عضو فعال این اسکرام باشند",
      422
    );
  }

  return uniqueIds;
};

export const listScrumProjectsService = async (scrumId, canEditContent) => {
  const projects = await prisma.project.findMany({
    where: { scrumId },
    take: MAX_LIST_LIMIT,
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
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
    },
    orderBy: { name: "asc" },
  });

  let trackedMap = null;
  if (canEditContent && projects.length > 0) {
    trackedMap = await fetchLinkedProjectTrackedMap(
      prisma,
      projects.map((p) => p.id)
    );
  }

  return projects.map((p) => formatScrumLinkedProject(p, trackedMap, canEditContent));
};

export const createScrumProjectService = async (
  scrumId,
  { name, description, memberIds = [] },
  actorUser
) => {
  const uniqueMemberIds = [...new Set((memberIds || []).map(Number))];

  const created = await prisma.$transaction(async (tx) => {
    await assertActiveScrumMembers(tx, scrumId, uniqueMemberIds);

    const proj = await tx.project.create({
      data: {
        name: name.trim(),
        description: description ? description.trim() || null : null,
        isActive: true,
        scrumId,
        createdById: actorUser.id,
      },
    });

    if (uniqueMemberIds.length > 0) {
      await tx.projectMember.createMany({
        data: uniqueMemberIds.map((userId) => ({
          projectId: proj.id,
          userId,
        })),
      });
    }

    return await tx.project.findUnique({
      where: { id: proj.id },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
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
      },
    });
  });

  await invalidateAllProjectsCache();

  const trackedMap = new Map([[created.id, { approved: 0, pending: 0 }]]);
  return formatScrumLinkedProject(created, trackedMap, true);
};

export const listAvailableScrumProjectsService = async (q = "") => {
  const term = q ? q.trim() : "";

  const projects = await prisma.project.findMany({
    where: {
      isActive: true,
      scrumId: null,
      ...(term ? { name: { contains: term, mode: "insensitive" } } : {}),
    },
    take: 50,
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      _count: {
        select: { members: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    isActive: p.isActive,
    memberCount: p._count.members,
  }));
};

export const linkProjectToScrumService = async (scrumId, projectId) => {
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        isActive: true,
        scrumId: true,
      },
    });

    if (!existing) {
      throw new HandleERROR("پروژه یافت نشد", 404);
    }

    if (!existing.isActive) {
      throw new HandleERROR("فقط پروژه‌های فعال قابل اتصال به اسکرام هستند", 422);
    }

    if (existing.scrumId !== null) {
      throw new HandleERROR("این پروژه هم‌اکنون به یک اسکرام متصل است", 409);
    }

    return await tx.project.update({
      where: { id: projectId },
      data: { scrumId },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
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
      },
    });
  });

  await invalidateAllProjectsCache();

  const trackedMap = await fetchLinkedProjectTrackedMap(prisma, [updated.id]);
  return formatScrumLinkedProject(updated, trackedMap, true);
};

export const unlinkProjectFromScrumService = async (scrumId, projectId) => {
  await prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: { id: true, scrumId: true },
    });

    if (!project || project.scrumId !== scrumId) {
      throw new HandleERROR("پروژه متصل به این اسکرام یافت نشد", 404);
    }

    await tx.project.update({
      where: { id: projectId },
      data: { scrumId: null },
    });

    await tx.sprintProject.updateMany({
      where: {
        projectId,
        sprint: { scrumId },
      },
      data: { projectId: null },
    });
  });

  await invalidateAllProjectsCache();
};

export const syncScrumProjectMembersService = async (scrumId, projectId, userIds = []) => {
  const targetUserIds = [...new Set((userIds || []).map(Number))];

  const { members, changedUserIds } = await prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: { id: true, scrumId: true },
    });

    if (!project || project.scrumId !== scrumId) {
      throw new HandleERROR("پروژه متصل به این اسکرام یافت نشد", 404);
    }

    await assertActiveScrumMembers(tx, scrumId, targetUserIds);

    // Load ALL ScrumMember userIds so we ONLY diff over scrum members
    // and leave non-scrum ProjectMembers completely untouched.
    const scrumMembers = await tx.scrumMember.findMany({
      where: { scrumId },
      select: { userId: true },
    });
    const scrumMemberIdSet = new Set(scrumMembers.map((m) => m.userId));

    const existingProjectMembers = await tx.projectMember.findMany({
      where: { projectId },
      select: { userId: true },
    });
    const existingSet = new Set(existingProjectMembers.map((m) => m.userId));
    const targetSet = new Set(targetUserIds);

    const toAdd = targetUserIds.filter((uid) => !existingSet.has(uid));
    const toRemove = existingProjectMembers
      .map((m) => m.userId)
      .filter((uid) => scrumMemberIdSet.has(uid) && !targetSet.has(uid));

    if (toRemove.length > 0) {
      await tx.projectMember.deleteMany({
        where: {
          projectId,
          userId: { in: toRemove },
        },
      });
    }

    if (toAdd.length > 0) {
      await tx.projectMember.createMany({
        data: toAdd.map((userId) => ({
          projectId,
          userId,
        })),
      });
    }

    const updated = await tx.projectMember.findMany({
      where: { projectId },
      select: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { user: { name: "asc" } },
    });

    return {
      members: updated.map((m) => ({
        id: m.user.id,
        name: m.user.name,
      })),
      changedUserIds: [...new Set([...toAdd, ...toRemove])],
    };
  });

  for (const uid of changedUserIds) {
    await invalidateUserProjectsCache(uid);
  }

  return members;
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

      let projFrom = startStr;
      let projTo = endStr || completedStr || (startStr ? todayStr : null);
      if (projFrom && projTo && projTo < projFrom) {
        projTo = projFrom;
      }

      if (projFrom && projTo) {
        range = { from: projFrom, to: projTo };
      }

      const projectDateConds = [];
      if (projFrom) {
        projectDateConds.push(Prisma.sql`ws."workDate" >= ${projFrom}::date`);
      }
      if (projTo) {
        projectDateConds.push(Prisma.sql`ws."workDate" <= ${projTo}::date`);
      }

      const projFilter =
        projectDateConds.length > 0
          ? Prisma.sql`p."scrumId" = ${scrumId} AND ${Prisma.join(projectDateConds, " AND ")}`
          : Prisma.sql`p."scrumId" = ${scrumId}`;

      periodFilterSql = Prisma.sql`(sp."sprintId" = ${targetSprint.id} OR (${projFilter}))`;
    }
  } else if (resolvedPeriod === "MONTH") {
    const { from, to } = getTehranJalaliMonthRange(now);
    const fromStr = formatDate(from);
    const toStr = formatDate(to);
    range = { from: fromStr, to: toStr };
    periodFilterSql = Prisma.sql`
      (s."scrumId" = ${scrumId} OR p."scrumId" = ${scrumId})
      AND ws."workDate" >= ${fromStr}::date
      AND ws."workDate" <= ${toStr}::date
    `;
  } else {
    range = null;
    periodFilterSql = Prisma.sql`(s."scrumId" = ${scrumId} OR p."scrumId" = ${scrumId})`;
  }

  // Single DB query joining ScrumMembers + caller against approved & pending WorkSessions
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
      LEFT JOIN "SprintProject" sp ON sp."id" = ws."sprintProjectId"
      LEFT JOIN "Sprint" s ON s."id" = sp."sprintId"
      LEFT JOIN "Project" p ON p."id" = ws."projectId"
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
          projects: true,
        },
      },
      sprints: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          number: true,
          title: true,
          endDate: true,
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
        openItems: 0,
        donePoints: 0,
        totalPoints: 0,
      },
      scrums: [],
      todayEvents: [],
    };
  }

  const scrumIds = scrums.map((s) => s.id);
  const scrumMap = new Map(scrums.map((s) => [s.id, s]));
  const activeSprintIds = scrums.flatMap((s) => s.sprints.map((sp) => sp.id));

  const today = todayDate(now);
  const persianDayOfWeek = getTehranPersianDayOfWeek(now);

  const [distinctMembersRows, sprintStatsRows, kpiRows, rawTodayEvents] = await Promise.all([
    prisma.$queryRaw(Prisma.sql`
      SELECT COUNT(DISTINCT "userId")::int AS "distinctMembers"
      FROM "ScrumMember"
      WHERE "scrumId" = ANY(${scrumIds}::int[])
    `),
    activeSprintIds.length > 0
      ? prisma.$queryRaw(Prisma.sql`
          SELECT
            "sprintId"::int AS "sprintId",
            COALESCE(SUM("points"), 0)::int AS "totalPoints",
            COALESCE(SUM("points") FILTER (WHERE "status" = 'DONE'), 0)::int AS "donePoints",
            COUNT(*) FILTER (WHERE "status" <> 'DONE')::int AS "openItems"
          FROM "SprintProject"
          WHERE "sprintId" = ANY(${activeSprintIds}::int[])
          GROUP BY "sprintId"
        `)
      : [],
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

  const sprintStatsMap = new Map(
    sprintStatsRows.map((row) => [
      Number(row.sprintId),
      {
        totalPoints: Number(row.totalPoints || 0),
        donePoints: Number(row.donePoints || 0),
        openItems: Number(row.openItems || 0),
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
  let grandOpenItems = 0;
  let grandDonePoints = 0;
  let grandTotalPoints = 0;

  const formattedScrums = scrums.map((s) => {
    const activeSp = s.sprints[0] || null;
    let activeSprintSummary = null;

    if (activeSp) {
      activeSprintsCount += 1;
      const stats = sprintStatsMap.get(activeSp.id) || {
        totalPoints: 0,
        donePoints: 0,
        openItems: 0,
      };
      grandOpenItems += stats.openItems;
      grandDonePoints += stats.donePoints;
      grandTotalPoints += stats.totalPoints;

      activeSprintSummary = {
        id: activeSp.id,
        number: activeSp.number,
        title: activeSp.title,
        endDate: formatDate(activeSp.endDate),
        totalPoints: stats.totalPoints,
        donePoints: stats.donePoints,
        openItems: stats.openItems,
      };
    }

    return {
      id: s.id,
      name: s.name,
      color: s.color,
      memberCount: s._count.members,
      linkedProjectCount: s._count.projects,
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
      openItems: grandOpenItems,
      donePoints: grandDonePoints,
      totalPoints: grandTotalPoints,
    },
    scrums: formattedScrums,
    todayEvents,
  };
};

