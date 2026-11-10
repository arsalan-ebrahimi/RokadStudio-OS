import { toDateOnly } from "../../Utils/date.js";

/**
 * Roles excluded from Scrum leaderboard rankings and standings.
 * Operations ADMIN and SUPER_ADMIN do not participate in team leaderboard metrics.
 */
export const LEADERBOARD_EXCLUDED_ROLES = new Set(["ADMIN", "SUPER_ADMIN"]);

export const isLeaderboardEligibleMember = (row) =>
  Boolean(row?.isScrumMember) && !LEADERBOARD_EXCLUDED_ROLES.has(row?.role);

/**
 * Prisma User `where` snippet matching non-admin users who are ScrumMembers
 * of at least one Scrum managed (ScrumAdmin) by `scrumAdminUserId`.
 */
export const buildScrumAdminManagedMemberUserWhere = (scrumAdminUserId) => ({
  role: { notIn: ["ADMIN", "SUPER_ADMIN"] },
  scrumMembers: {
    some: {
      scrum: {
        admins: {
          some: { userId: Number(scrumAdminUserId) },
        },
      },
    },
  },
});

/**
 * Prisma WorkSession `where` snippet matching sessions on Scrum Tasks
 * whose parent Scrum is managed (ScrumAdmin) by `scrumAdminUserId`.
 */
export const scrumAdminManagedTaskRelationFilter = (scrumAdminUserId) => ({
  task: {
    is: {
      scrum: {
        admins: {
          some: { userId: Number(scrumAdminUserId) },
        },
      },
    },
  },
});

/**
 * Builds Prisma `where` clause for GET /api/attendance/admin.
 * - ADMIN / SUPER_ADMIN see all attendance records matching filters
 * - SCRUM_ADMIN sees only non-admin ScrumMembers of Scrums they admin
 */
export const buildAttendanceAdminWhere = (
  { userId, approval, status, source, date, dateFrom, dateTo } = {},
  actorUser = null
) => {
  const where = {};

  if (userId) where.userId = Number(userId);
  if (approval) where.approval = approval;
  if (status) where.status = status;
  if (source) where.source = source;

  if (date) {
    where.date = toDateOnly(date);
  } else if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = toDateOnly(dateFrom);
    if (dateTo) where.date.lte = toDateOnly(dateTo);
  }

  if (actorUser?.role === "SCRUM_ADMIN") {
    where.user = buildScrumAdminManagedMemberUserWhere(actorUser.id);
  }

  return where;
};

/**
 * Builds Prisma `where` clause for grouping WorkSessions per attendance row.
 * For SCRUM_ADMIN, only sessions on tasks of Scrums they admin are counted.
 */
export const buildAttendanceSessionAggWhere = (attendanceIds = [], actorUser = null) => ({
  attendanceId: { in: attendanceIds },
  approval: { not: "REJECTED" },
  ...(actorUser?.role === "SCRUM_ADMIN"
    ? scrumAdminManagedTaskRelationFilter(actorUser.id)
    : {}),
});

/**
 * Computes whether `actorUser` is permitted to submit a decision on `attendance`.
 */
export const computeAttendanceCanDecide = (attendance, actorUser) => {
  if (!attendance || !actorUser) return false;
  const targetUserId = attendance.userId ?? attendance.user?.id;
  const targetRole = attendance.user?.role;
  if (targetUserId === actorUser.id) return false;
  if (actorUser.role !== "SUPER_ADMIN" && targetRole === "SUPER_ADMIN") return false;
  if (actorUser.role === "SCRUM_ADMIN" && targetRole === "ADMIN") return false;
  return true;
};

/**
 * Builds Prisma `where` clause for GET /api/work-sessions & GET /api/work-sessions/summary.
 * Enforces strict intersection via AND so a SCRUM_ADMIN can never bypass scoping
 * with `projectId`, `targetType=PROJECT`, or an unassigned Scrum's `taskId`.
 */
export const buildWorkSessionReportWhere = (
  { userId, projectId, taskId, targetType, approval, date, dateFrom, dateTo } = {},
  actorUser = null,
  { defaultExcludeRejected = false } = {}
) => {
  const andConditions = [];

  if (actorUser?.role === "SCRUM_ADMIN") {
    if (projectId || targetType === "PROJECT") {
      return { id: -1 };
    }
  }

  if (userId) {
    andConditions.push({ userId: Number(userId) });
  }

  if (projectId) {
    andConditions.push({ projectId: Number(projectId) });
  } else if (taskId) {
    andConditions.push({ taskId: Number(taskId) });
  } else if (targetType === "PROJECT") {
    andConditions.push({ projectId: { not: null } });
  } else if (targetType === "TASK") {
    andConditions.push({ taskId: { not: null } });
  }

  if (approval) {
    andConditions.push({ approval });
  } else if (defaultExcludeRejected) {
    andConditions.push({ approval: { not: "REJECTED" } });
  }

  if (date) {
    andConditions.push({ workDate: toDateOnly(date) });
  } else if (dateFrom || dateTo) {
    const workDate = {};
    if (dateFrom) workDate.gte = toDateOnly(dateFrom);
    if (dateTo) workDate.lte = toDateOnly(dateTo);
    andConditions.push({ workDate });
  }

  if (actorUser?.role === "SCRUM_ADMIN") {
    andConditions.push(scrumAdminManagedTaskRelationFilter(actorUser.id));
  }

  if (andConditions.length === 0) return {};
  if (andConditions.length === 1) return andConditions[0];
  return { AND: andConditions };
};

/**
 * Computes per-session UI permissions matching backend guards in
 * decideWorkSessionRecord and deleteWorkSession.
 */
export const computeWorkSessionPermissions = (session, actorUser) => {
  const isSuperAdmin = actorUser?.role === "SUPER_ADMIN";
  const isAdmin = actorUser?.role === "ADMIN";
  const isOwner = (session.userId ?? session.user?.id) === actorUser?.id;
  const targetRole = session.user?.role;

  return {
    canModerate: isSuperAdmin || targetRole !== "SUPER_ADMIN",
    canDelete: isSuperAdmin || isAdmin || isOwner,
  };
};

