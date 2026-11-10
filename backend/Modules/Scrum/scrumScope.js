import { HandleERROR } from "vanta-api";
import prisma from "../../config/prisma.js";
import { toDateOnly } from "../../Utils/date.js";
import {
  getAdministeredScrumIds,
  getVisibleScrumsWhere,
  isScrumAdminOf,
  isScrumAdminRole,
  isScrumMemberOf,
} from "./scrumAccess.js";

/**
 * Central config toggle controlling whether SCRUM_ADMIN can approve/reject
 * studio-wide daily attendance records.
 * When false, attendance is strictly read-only for SCRUM_ADMIN (never applies to ADMIN/SUPER_ADMIN).
 */
export const SCRUM_ADMIN_CAN_DECIDE_ATTENDANCE = false;

/**
 * Roles excluded from Scrum leaderboard rankings and standings.
 * SUPER_ADMIN never participates in Scrum membership/leaderboard metrics.
 * ADMIN users who are explicitly registered as ScrumMembers DO participate.
 */
export const LEADERBOARD_EXCLUDED_ROLES = new Set(["SUPER_ADMIN"]);

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
 * - SCRUM_ADMIN sees only non-admin ScrumMembers of Scrums they admin (read-only by default)
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
export const computeAttendanceCanDecide = (
  attendance,
  actorUser,
  canScrumAdminDecide = SCRUM_ADMIN_CAN_DECIDE_ATTENDANCE
) => {
  if (!attendance || !actorUser) return false;
  const targetUserId = attendance.userId ?? attendance.user?.id;
  const targetRole = attendance.user?.role;
  if (targetUserId === actorUser.id) return false;
  if (actorUser.role !== "ADMIN" && actorUser.role !== "SUPER_ADMIN" && actorUser.role !== "SCRUM_ADMIN") {
    return false;
  }
  if (actorUser.role !== "SUPER_ADMIN" && targetRole === "SUPER_ADMIN") return false;
  if (actorUser.role === "SCRUM_ADMIN") {
    if (!canScrumAdminDecide) return false;
    if (targetRole === "ADMIN") return false;
  }
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
 * assertCanDecideWorkSession / decideWorkSessionRecord and deleteWorkSession.
 */
export const computeWorkSessionPermissions = (session, actorUser, options = {}) => {
  const isSuperAdmin = actorUser?.role === "SUPER_ADMIN";
  const isAdmin = actorUser?.role === "ADMIN";
  const isScrumAdmin = actorUser?.role === "SCRUM_ADMIN";
  const isOwner = (session.userId ?? session.user?.id) === actorUser?.id;
  const targetRole = session.user?.role;

  let canModerate = false;
  if (!isOwner && (isSuperAdmin || targetRole !== "SUPER_ADMIN")) {
    if (isSuperAdmin) {
      canModerate = true;
    } else if (session.taskId || options.isTaskSession) {
      const scrumId = session.task?.scrumId ?? options.scrumId;
      if (options.isTaskScrumAdmin !== undefined) {
        canModerate = isScrumAdminRole(actorUser?.role) && Boolean(options.isTaskScrumAdmin);
      } else if (options.administeredScrumIds instanceof Set && scrumId !== undefined) {
        canModerate = isScrumAdminRole(actorUser?.role) && options.administeredScrumIds.has(Number(scrumId));
      } else if (Array.isArray(session.task?.scrum?.admins)) {
        canModerate = isScrumAdminRole(actorUser?.role) && session.task.scrum.admins.some((a) => a.userId === actorUser.id);
      } else {
        canModerate = isScrumAdmin;
      }
    } else if (session.projectId || options.isProjectSession) {
      canModerate = isAdmin;
    } else {
      canModerate = isAdmin || isScrumAdmin;
    }
  }

  return {
    canModerate,
    canDelete: isSuperAdmin || isAdmin || isOwner,
  };
};

/**
 * Throws HandleERROR (403) if `actorUser` cannot moderate `session`.
 * - Nobody may decide their own sessions (including SUPER_ADMIN).
 * - Non-SUPER_ADMIN cannot decide SUPER_ADMIN sessions.
 * - Task sessions: SCRUM_ADMIN or ADMIN must administer the task's Scrum.
 * - Studio Project sessions: SCRUM_ADMIN cannot moderate; ADMIN and SUPER_ADMIN can.
 */
export const assertCanDecideWorkSession = async (session, actorUser, db = prisma) => {
  const targetUserId = session.userId ?? session.user?.id;
  const targetRole = session.user?.role;

  if (targetUserId === actorUser.id) {
    throw new HandleERROR("شما مجاز به تایید یا رد سشن کاری خود نیستید", 403);
  }

  if (actorUser.role !== "SUPER_ADMIN" && targetRole === "SUPER_ADMIN") {
    throw new HandleERROR("شما اجازه بررسی و تغییر وضعیت سشن سوپرادمین را ندارید", 403);
  }

  if (actorUser.role === "SUPER_ADMIN") {
    return true;
  }

  if (!isScrumAdminRole(actorUser.role)) {
    throw new HandleERROR("شما اجازه بررسی و تغییر وضعیت این سشن را ندارید", 403);
  }

  if (session.taskId && session.task) {
    const isAdminOfTaskScrum = await isScrumAdminOf(
      actorUser,
      Array.isArray(session.task.scrum?.admins)
        ? session.task.scrum
        : session.task.scrumId,
      db
    );
    if (!isAdminOfTaskScrum) {
      throw new HandleERROR("شما ادمین اسکرام مربوط به این تسک نیستید", 403);
    }
    return true;
  }

  if (actorUser.role === "SCRUM_ADMIN") {
    throw new HandleERROR("ادمین اسکرام فقط مجاز به تغییر وضعیت سشن‌های تسک‌های اسکرام است", 403);
  }

  // Studio project session for ADMIN
  return true;
};

/**
 * §6 Visibility rules for Scrum-level performance fields.
 * Permitted ONLY when viewer is NOT the target user AND (viewer is SUPER_ADMIN or administers S).
 */
export const canViewScrumPerformance = (viewer, targetUserId, isScrumAdminOfScrum = false) => {
  if (!viewer || Number(viewer.id) === Number(targetUserId)) return false;
  if (viewer.role === "SUPER_ADMIN") return true;
  return isScrumAdminRole(viewer.role) && Boolean(isScrumAdminOfScrum);
};

/**
 * §6 Visibility rules for Studio-level performance status.
 * Permitted ONLY when viewer is NOT the target user AND viewer role is SUPER_ADMIN or ADMIN.
 * SCRUM_ADMIN, plain members, and self NEVER see studio performance.
 */
export const canViewStudioPerformance = (viewer, targetUserId) => {
  if (!viewer || Number(viewer.id) === Number(targetUserId)) return false;
  return viewer.role === "SUPER_ADMIN" || viewer.role === "ADMIN";
};

/**
 * §7 Visibility rule for additive `include=attendanceTotals` on scrum members & leaderboard.
 */
export const canViewAttendanceTotals = (viewer, isScrumAdminOfScrum = false) => {
  if (!viewer) return false;
  if (viewer.role === "SUPER_ADMIN" || viewer.role === "ADMIN") return true;
  return viewer.role === "SCRUM_ADMIN" && Boolean(isScrumAdminOfScrum);
};

/**
 * Serializes Scrum-level performance fields onto a member/row object.
 * OMITS keys completely when disallowed (never leaves keys as `null` for disallowed viewers).
 */
export const serializeScrumMemberPerformance = (
  memberRow,
  viewer,
  targetUserId,
  { isScrumAdminOfScrum = false } = {}
) => {
  if (!canViewScrumPerformance(viewer, targetUserId, isScrumAdminOfScrum)) {
    return {};
  }
  return {
    performance: memberRow?.performance ?? null,
    performanceNote: memberRow?.performanceNote ?? null,
    performanceUpdatedAt: memberRow?.performanceUpdatedAt ?? null,
  };
};

/**
 * Serializes Studio-level performance status onto a user/profile object.
 * OMITS `studioPerformance` key completely when disallowed (never `studioPerformance: null` for disallowed viewers).
 */
export const serializeStudioPerformance = (studioPerf, viewer, targetUserId) => {
  if (!canViewStudioPerformance(viewer, targetUserId)) {
    return {};
  }
  return {
    studioPerformance: studioPerf
      ? {
          level: studioPerf.level,
          note: studioPerf.note ?? null,
          updatedAt: studioPerf.updatedAt,
        }
      : null,
  };
};

/**
 * Maps raw Attendance state for Member Calendar/Day endpoints.
 */
export const getMemberAttendanceState = (att) => {
  if (!att) return "NONE";
  if (att.approval === "REJECTED") return "REJECTED";
  if (att.status === "ABSENT") return "ABSENT";
  if (att.status === "PRESENT" && att.approval === "APPROVED") return "PRESENT_APPROVED";
  if (att.status === "PRESENT" && att.approval === "PENDING") return "PRESENT_PENDING";
  return "NONE";
};

/**
 * Computes all-time attendance totals (`present`, `pending`, `absent`) for `userIds`
 * using a SINGLE grouped Prisma query.
 */
export const fetchGroupedAttendanceTotals = async (userIds = [], db = prisma) => {
  const uniqueIds = [...new Set(userIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  const map = new Map();
  for (const id of uniqueIds) {
    map.set(id, { present: 0, pending: 0, absent: 0 });
  }
  if (uniqueIds.length === 0) return map;

  const grouped = await db.attendance.groupBy({
    by: ["userId", "status", "approval"],
    where: { userId: { in: uniqueIds } },
    _count: { id: true },
  });

  for (const row of grouped) {
    const totals = map.get(row.userId);
    if (!totals) continue;
    const count = Number(row._count?.id || 0);
    if (row.approval === "REJECTED" || row.status === "ABSENT") {
      totals.absent += count;
    } else if (row.status === "PRESENT" && row.approval === "APPROVED") {
      totals.present += count;
    } else if (row.status === "PRESENT" && row.approval === "PENDING") {
      totals.pending += count;
    }
  }

  return map;
};

/**
 * Resolves `me` or positive integer userId.
 */
export const resolveMemberUserIdParam = (rawUserId, viewer) => {
  if (rawUserId === "me") {
    return viewer.id;
  }
  const parsed = Number(rawUserId);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new HandleERROR("شناسه کاربر نامعتبر است", 400);
  }
  return parsed;
};

/**
 * Central access + scope check for `/api/members/:userId/...` endpoints (§7).
 * Unauthorized callers always receive 404.
 */
export const assertCanViewMember = async ({
  viewer,
  rawUserId,
  scrumId = null,
  db = prisma,
}) => {
  const targetUserId = resolveMemberUserIdParam(rawUserId, viewer);
  const isSelf = viewer.id === targetUserId;

  const targetUser = await db.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      name: true,
      role: true,
      isActive: true,
    },
  });

  if (!targetUser) {
    throw new HandleERROR("کاربر یافت نشد", 404);
  }

  const administeredScrumIds = isScrumAdminRole(viewer.role)
    ? await getAdministeredScrumIds(viewer, db)
    : [];

  if (!isSelf) {
    if (viewer.role === "SUPER_ADMIN" || viewer.role === "ADMIN") {
      // Allowed for any existing user
    } else if (viewer.role === "SCRUM_ADMIN") {
      if (targetUser.role === "SUPER_ADMIN" || administeredScrumIds.length === 0) {
        throw new HandleERROR("کاربر یافت نشد", 404);
      }
      const managedMember = await db.scrumMember.findFirst({
        where: {
          userId: targetUserId,
          scrumId: { in: administeredScrumIds },
        },
        select: { scrumId: true },
      });
      if (!managedMember) {
        throw new HandleERROR("کاربر یافت نشد", 404);
      }
    } else {
      throw new HandleERROR("کاربر یافت نشد", 404);
    }
  }

  const parsedScrumId = scrumId !== null && scrumId !== undefined && scrumId !== "" ? Number(scrumId) : null;
  if (parsedScrumId !== null) {
    const visibleScrum = await db.scrum.findFirst({
      where: getVisibleScrumsWhere(viewer, { id: parsedScrumId }),
      select: { id: true },
    });
    if (!visibleScrum) {
      throw new HandleERROR("کاربر یافت نشد", 404);
    }
    if (viewer.role === "SCRUM_ADMIN" && !isSelf && !administeredScrumIds.includes(parsedScrumId)) {
      throw new HandleERROR("کاربر یافت نشد", 404);
    }
    const isTargetMemberOfScrum = await isScrumMemberOf(targetUser, parsedScrumId, db);
    if (!isTargetMemberOfScrum) {
      throw new HandleERROR("کاربر یافت نشد", 404);
    }
  }

  const workScope = getMemberWorkScope({
    viewer,
    targetUserId,
    scrumId: parsedScrumId,
    administeredScrumIds,
  });

  return {
    targetUser,
    isSelf,
    administeredScrumIds,
    scrumId: parsedScrumId,
    workScope,
  };
};

/**
 * Determines which WorkSessions (projects vs scrum tasks) `viewer` can view for `targetUserId`.
 */
export const getMemberWorkScope = ({
  viewer,
  targetUserId,
  scrumId = null,
  administeredScrumIds = [],
}) => {
  const isSelf = viewer.id === targetUserId;
  const parsedScrumId = scrumId !== null && scrumId !== undefined ? Number(scrumId) : null;

  if (parsedScrumId !== null) {
    return {
      canViewProjects: false,
      isUnrestrictedTasks: false,
      scopedTaskScrumIds: [parsedScrumId],
    };
  }

  if (isSelf || viewer.role === "SUPER_ADMIN" || viewer.role === "ADMIN") {
    return {
      canViewProjects: true,
      isUnrestrictedTasks: true,
      scopedTaskScrumIds: null,
    };
  }

  // SCRUM_ADMIN viewing a managed member: strictly tasks of administered scrums, no studio projects
  return {
    canViewProjects: false,
    isUnrestrictedTasks: false,
    scopedTaskScrumIds: administeredScrumIds,
  };
};

/**
 * Builds Prisma `where` clause for WorkSessions visible in Member detail endpoints.
 */
export const buildMemberWorkSessionWhere = ({
  targetUserId,
  workScope,
  workDateFilter,
  approval,
  sprintId,
  projectId,
  taskId,
  targetType,
} = {}) => {
  const andConditions = [{ userId: Number(targetUserId) }];

  if (!workScope.canViewProjects) {
    if (projectId || targetType === "PROJECT") {
      return { id: -1 };
    }
    if (!workScope.scopedTaskScrumIds || workScope.scopedTaskScrumIds.length === 0) {
      return { id: -1 };
    }
    andConditions.push({
      taskId: { not: null },
      task: {
        is: {
          scrumId: { in: workScope.scopedTaskScrumIds },
        },
      },
    });
  } else {
    if (projectId) {
      andConditions.push({ projectId: Number(projectId) });
    } else if (targetType === "PROJECT") {
      andConditions.push({ projectId: { not: null } });
    }
  }

  if (taskId) {
    andConditions.push({ taskId: Number(taskId) });
  } else if (targetType === "TASK") {
    andConditions.push({ taskId: { not: null } });
  }

  if (sprintId) {
    andConditions.push({
      task: {
        is: {
          sprintId: Number(sprintId),
        },
      },
    });
  }

  if (approval && approval !== "ALL") {
    andConditions.push({ approval });
  }

  if (workDateFilter) {
    andConditions.push({ workDate: workDateFilter });
  }

  if (andConditions.length === 1) return andConditions[0];
  return { AND: andConditions };
};
