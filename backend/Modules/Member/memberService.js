import { HandleERROR } from "vanta-api";
import prisma from "../../config/prisma.js";
import { datesBetween, formatDate, toDateOnly } from "../../Utils/date.js";
import { formatPaginationMeta, getPagination } from "../../Utils/pagination.js";
import { buildWorkDateFilter } from "../Scrum/scrumExtendedService.js";
import {
  assertCanViewMember,
  buildMemberWorkSessionWhere,
  canViewStudioPerformance,
  fetchGroupedAttendanceTotals,
  getMemberAttendanceState,
  serializeScrumMemberPerformance,
  serializeStudioPerformance,
} from "../Scrum/scrumScope.js";

const buildSprintTaskWorkWhere = ({
  targetUserId,
  sprint,
  explicitFrom,
  explicitTo,
  approval,
}) => {
  const sprintFrom = sprint.startDate ? toDateOnly(sprint.startDate) : null;
  const sprintTo = sprint.endDate
    ? toDateOnly(sprint.endDate)
    : sprint.completedAt
    ? toDateOnly(sprint.completedAt)
    : null;

  const buildDateObj = (rangeFrom, rangeTo) => {
    if (!rangeFrom && !rangeTo) return undefined;
    const obj = {};
    if (rangeFrom) obj.gte = rangeFrom;
    if (rangeTo) obj.lte = rangeTo;
    return obj;
  };

  const linkedWorkDate = buildDateObj(explicitFrom, explicitTo);
  const linkedBranch = {
    task: {
      is: {
        scrumId: sprint.scrumId,
        sprintId: sprint.id,
      },
    },
    ...(linkedWorkDate ? { workDate: linkedWorkDate } : {}),
  };

  let unlinkedBranch = null;
  if (sprintFrom || sprintTo) {
    let unlinkedFrom = explicitFrom;
    if (sprintFrom && (!unlinkedFrom || sprintFrom.getTime() > unlinkedFrom.getTime())) {
      unlinkedFrom = sprintFrom;
    }
    let unlinkedTo = explicitTo;
    if (sprintTo && (!unlinkedTo || sprintTo.getTime() < unlinkedTo.getTime())) {
      unlinkedTo = sprintTo;
    }
    const validRange =
      !unlinkedFrom || !unlinkedTo || unlinkedFrom.getTime() <= unlinkedTo.getTime();
    const unlinkedWorkDate = buildDateObj(unlinkedFrom, unlinkedTo);
    if (validRange && unlinkedWorkDate) {
      unlinkedBranch = {
        task: {
          is: {
            scrumId: sprint.scrumId,
            sprintId: null,
          },
        },
        workDate: unlinkedWorkDate,
      };
    }
  }

  return {
    userId: Number(targetUserId),
    ...(approval && approval !== "ALL" ? { approval } : {}),
    ...(unlinkedBranch ? { OR: [linkedBranch, unlinkedBranch] } : linkedBranch),
  };
};

export const getMemberProfileService = async (
  viewer,
  rawUserId,
  { scrumId } = {},
  db = prisma
) => {
  const {
    targetUser,
    isSelf,
    administeredScrumIds,
    scrumId: scopedScrumId,
  } = await assertCanViewMember({
    viewer,
    rawUserId,
    scrumId,
    db,
  });

  // Memberships visibility:
  // - SUPER_ADMIN or self: all of target's memberships (or narrowed by scrumId)
  // - SCRUM_ADMIN / ADMIN viewing another member: only memberships in scrums the viewer administers
  let membershipScrumFilter = null;
  if (viewer.role !== "SUPER_ADMIN" && !isSelf) {
    membershipScrumFilter =
      scopedScrumId !== null
        ? scopedScrumId
        : administeredScrumIds.length > 0
        ? { in: administeredScrumIds }
        : { in: [] };
  } else if (scopedScrumId !== null) {
    membershipScrumFilter = scopedScrumId;
  }

  const [rawMemberships, studioPerf, totalsMap] = await Promise.all([
    db.scrumMember.findMany({
      where: {
        userId: targetUser.id,
        ...(membershipScrumFilter !== null ? { scrumId: membershipScrumFilter } : {}),
      },
      select: {
        scrumId: true,
        label: true,
        performance: true,
        performanceNote: true,
        performanceUpdatedAt: true,
        scrum: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
      orderBy: { scrum: { name: "asc" } },
    }),
    canViewStudioPerformance(viewer, targetUser.id)
      ? db.studioPerformance.findUnique({
          where: { userId: targetUser.id },
          select: {
            level: true,
            note: true,
            updatedAt: true,
          },
        })
      : Promise.resolve(null),
    fetchGroupedAttendanceTotals([targetUser.id], db),
  ]);

  const administeredSet = new Set(administeredScrumIds);
  const memberships = rawMemberships.map((m) => ({
    scrum: m.scrum,
    label: m.label ?? null,
    ...serializeScrumMemberPerformance(m, viewer, targetUser.id, {
      isScrumAdminOfScrum: viewer.role === "SUPER_ADMIN" || administeredSet.has(m.scrumId),
    }),
  }));

  return {
    id: targetUser.id,
    name: targetUser.name,
    memberships,
    ...serializeStudioPerformance(studioPerf, viewer, targetUser.id),
    attendanceTotals: totalsMap.get(targetUser.id) || {
      present: 0,
      pending: 0,
      absent: 0,
    },
  };
};

export const getMemberCalendarService = async (
  viewer,
  rawUserId,
  { from, to, scrumId } = {},
  db = prisma
) => {
  const { targetUser, workScope } = await assertCanViewMember({
    viewer,
    rawUserId,
    scrumId,
    db,
  });

  const fromDate = toDateOnly(from);
  const toDate = toDateOnly(to);
  const dateRangeFilter = { gte: fromDate, lte: toDate };

  const sessionWhere = buildMemberWorkSessionWhere({
    targetUserId: targetUser.id,
    workScope,
    workDateFilter: dateRangeFilter,
  });

  const isImpossibleScope = sessionWhere.id === -1;

  const [attendances, groupedSessions] = await Promise.all([
    db.attendance.findMany({
      where: {
        userId: targetUser.id,
        date: dateRangeFilter,
      },
      select: {
        date: true,
        status: true,
        approval: true,
      },
    }),
    isImpossibleScope
      ? Promise.resolve([])
      : db.workSession.groupBy({
          by: ["workDate", "taskId", "projectId"],
          where: {
            ...sessionWhere,
            approval: { not: "REJECTED" },
          },
          _count: { id: true },
        }),
  ]);

  const attendanceByDate = new Map();
  for (const att of attendances) {
    attendanceByDate.set(formatDate(att.date), att);
  }

  const daySessionAggMap = new Map();
  for (const row of groupedSessions) {
    const dateStr = formatDate(row.workDate);
    if (!daySessionAggMap.has(dateStr)) {
      daySessionAggMap.set(dateStr, {
        sessionCount: 0,
        taskIds: new Set(),
        projectIds: new Set(),
      });
    }
    const entry = daySessionAggMap.get(dateStr);
    entry.sessionCount += Number(row._count?.id || 0);
    if (row.taskId) {
      entry.taskIds.add(row.taskId);
    }
    if (row.projectId && workScope.canViewProjects) {
      entry.projectIds.add(row.projectId);
    }
  }

  const calendarDates = datesBetween(fromDate, toDate);
  const totals = { present: 0, pending: 0, absent: 0 };

  const days = calendarDates.map((d) => {
    const dateStr = formatDate(d);
    const att = attendanceByDate.get(dateStr);
    const state = getMemberAttendanceState(att);

    if (state === "PRESENT_APPROVED") {
      totals.present += 1;
    } else if (state === "PRESENT_PENDING") {
      totals.pending += 1;
    } else if (state === "ABSENT" || state === "REJECTED") {
      totals.absent += 1;
    }

    const agg = daySessionAggMap.get(dateStr);
    return {
      date: dateStr,
      state,
      sessionCount: agg ? agg.sessionCount : 0,
      taskCount: agg ? agg.taskIds.size : 0,
      projectCount: agg && workScope.canViewProjects ? agg.projectIds.size : 0,
    };
  });

  return {
    days,
    totals,
  };
};

export const getMemberDayService = async (
  viewer,
  rawUserId,
  { date, scrumId } = {},
  db = prisma
) => {
  const { targetUser, workScope } = await assertCanViewMember({
    viewer,
    rawUserId,
    scrumId,
    db,
  });

  const targetDate = toDateOnly(date);
  const dateStr = formatDate(targetDate);

  const sessionWhere = buildMemberWorkSessionWhere({
    targetUserId: targetUser.id,
    workScope,
    workDateFilter: targetDate,
  });
  const isImpossibleScope = sessionWhere.id === -1;

  const [attendance, rawSessions] = await Promise.all([
    db.attendance.findUnique({
      where: {
        userId_date: {
          userId: targetUser.id,
          date: targetDate,
        },
      },
      select: {
        status: true,
        approval: true,
        source: true,
        workNote: true,
        workNoteAt: true,
      },
    }),
    isImpossibleScope
      ? Promise.resolve([])
      : db.workSession.findMany({
          where: sessionWhere,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            createdAt: true,
            durationSeconds: true,
            approval: true,
            projectId: true,
            taskId: true,
            project: {
              select: {
                id: true,
                name: true,
              },
            },
            task: {
              select: {
                id: true,
                name: true,
                points: true,
                scrum: {
                  select: {
                    id: true,
                    name: true,
                    color: true,
                  },
                },
                sprint: {
                  select: {
                    id: true,
                    number: true,
                    title: true,
                  },
                },
              },
            },
          },
        }),
  ]);

  const taskAggMap = new Map();
  const projectAggMap = new Map();

  const sessions = rawSessions.map((s) => {
    const isNonRejected = s.approval !== "REJECTED";

    if (s.taskId && s.task) {
      if (isNonRejected) {
        if (!taskAggMap.has(s.task.id)) {
          taskAggMap.set(s.task.id, {
            task: { id: s.task.id, name: s.task.name },
            scrum: s.task.scrum,
            sprint: s.task.sprint
              ? { id: s.task.sprint.id, number: s.task.sprint.number, title: s.task.sprint.title }
              : null,
            points: s.task.points,
            sessionCount: 0,
            totalSeconds: 0,
          });
        }
        const entry = taskAggMap.get(s.task.id);
        entry.sessionCount += 1;
        entry.totalSeconds += Number(s.durationSeconds || 0);
      }

      return {
        id: s.id,
        createdAt: s.createdAt,
        durationSeconds: s.durationSeconds,
        approval: s.approval,
        target: {
          kind: "TASK",
          id: s.task.id,
          name: s.task.name,
          scrum: s.task.scrum,
          sprint: s.task.sprint
            ? { id: s.task.sprint.id, number: s.task.sprint.number }
            : null,
        },
      };
    }

    if (s.projectId && s.project && workScope.canViewProjects) {
      if (isNonRejected) {
        if (!projectAggMap.has(s.project.id)) {
          projectAggMap.set(s.project.id, {
            project: { id: s.project.id, name: s.project.name },
            sessionCount: 0,
            totalSeconds: 0,
          });
        }
        const entry = projectAggMap.get(s.project.id);
        entry.sessionCount += 1;
        entry.totalSeconds += Number(s.durationSeconds || 0);
      }
    }

    return {
      id: s.id,
      createdAt: s.createdAt,
      durationSeconds: s.durationSeconds,
      approval: s.approval,
      target: {
        kind: "PROJECT",
        id: s.project?.id ?? s.projectId,
        name: s.project?.name || "Unknown",
      },
    };
  });

  const tasks = [...taskAggMap.values()].sort(
    (a, b) => b.totalSeconds - a.totalSeconds || a.task.name.localeCompare(b.task.name)
  );
  const projects = [...projectAggMap.values()].sort(
    (a, b) => b.totalSeconds - a.totalSeconds || a.project.name.localeCompare(b.project.name)
  );

  return {
    date: dateStr,
    attendance: attendance
      ? {
          state: getMemberAttendanceState(attendance),
          source: attendance.source,
          workNote: attendance.workNote ?? null,
          workNoteAt: attendance.workNoteAt ?? null,
        }
      : null,
    sessions,
    tasks,
    projects,
  };
};

export const getMemberWorkService = async (
  viewer,
  rawUserId,
  { from, to, scrumId, sprintId, projectId, approval, page, limit } = {},
  db = prisma
) => {
  const { targetUser, isSelf, administeredScrumIds, workScope } = await assertCanViewMember({
    viewer,
    rawUserId,
    scrumId,
    db,
  });

  const pagination = getPagination({ page, limit });
  const explicitFrom = from ? toDateOnly(from) : null;
  const explicitTo = to ? toDateOnly(to) : null;
  const workDateFilter = buildWorkDateFilter({ dateFrom: from, dateTo: to });

  let sprint = null;
  if (sprintId !== undefined && sprintId !== null && sprintId !== "") {
    sprint = await db.sprint.findUnique({
      where: { id: Number(sprintId) },
      select: {
        id: true,
        scrumId: true,
        number: true,
        title: true,
        startDate: true,
        endDate: true,
        completedAt: true,
      },
    });
    if (!sprint) {
      throw new HandleERROR("اسپرینت یافت نشد", 404);
    }
    if (workScope.scopedTaskScrumIds && !workScope.scopedTaskScrumIds.includes(sprint.scrumId)) {
      throw new HandleERROR("کاربر یافت نشد", 404);
    }
    if (
      viewer.role === "SCRUM_ADMIN" &&
      !isSelf &&
      !administeredScrumIds.includes(sprint.scrumId)
    ) {
      throw new HandleERROR("کاربر یافت نشد", 404);
    }
  }

  let listWhere;
  if (sprint) {
    if (projectId || (workScope.scopedTaskScrumIds && !workScope.scopedTaskScrumIds.includes(sprint.scrumId))) {
      listWhere = { id: -1 };
    } else {
      listWhere = buildSprintTaskWorkWhere({
        targetUserId: targetUser.id,
        sprint,
        explicitFrom,
        explicitTo,
        approval,
      });
    }
  } else {
    listWhere = buildMemberWorkSessionWhere({
      targetUserId: targetUser.id,
      workScope,
      workDateFilter,
      approval,
      projectId,
    });
  }

  const isImpossibleScope = listWhere.id === -1;

  // Match scrum report tab semantics: default aggregates exclude REJECTED unless REJECTED/ALL requested
  const includeRejectedInAgg = approval === "REJECTED" || approval === "ALL";
  const aggWhere = isImpossibleScope
    ? { id: -1 }
    : includeRejectedInAgg
    ? listWhere
    : {
        AND: [listWhere, { approval: { not: "REJECTED" } }],
      };

  const [groupedByTargetAndApproval, totalCount, rawSessions] = isImpossibleScope
    ? [[], 0, []]
    : await Promise.all([
        db.workSession.groupBy({
          by: ["taskId", "projectId", "approval"],
          where: listWhere,
          _sum: { durationSeconds: true },
          _count: { id: true },
        }),
        db.workSession.count({ where: listWhere }),
        db.workSession.findMany({
          where: listWhere,
          skip: pagination.skip,
          take: pagination.limit,
          orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            createdAt: true,
            workDate: true,
            durationSeconds: true,
            approval: true,
            source: true,
            projectId: true,
            taskId: true,
            project: {
              select: { id: true, name: true },
            },
            task: {
              select: {
                id: true,
                name: true,
                points: true,
                scrum: { select: { id: true, name: true, color: true } },
                sprint: { select: { id: true, number: true, title: true } },
              },
            },
          },
        }),
      ]);

  const taskIdsSet = new Set();
  const projectIdsSet = new Set();
  const totals = {
    totalSeconds: 0,
    approvedSeconds: 0,
    pendingSeconds: 0,
    rejectedSeconds: 0,
    sessionCount: 0,
    approvedCount: 0,
    pendingCount: 0,
    rejectedCount: 0,
  };

  const taskStatsMap = new Map();
  const projectStatsMap = new Map();

  for (const row of groupedByTargetAndApproval) {
    const secs = Number(row._sum?.durationSeconds || 0);
    const cnt = Number(row._count?.id || 0);

    if (row.approval === "APPROVED") {
      totals.approvedSeconds += secs;
      totals.approvedCount += cnt;
    } else if (row.approval === "PENDING") {
      totals.pendingSeconds += secs;
      totals.pendingCount += cnt;
    } else if (row.approval === "REJECTED") {
      totals.rejectedSeconds += secs;
      totals.rejectedCount += cnt;
    }

    const countedInActiveWork = includeRejectedInAgg || row.approval !== "REJECTED";
    if (countedInActiveWork) {
      totals.totalSeconds += secs;
      totals.sessionCount += cnt;
    }

    if (row.taskId && countedInActiveWork) {
      taskIdsSet.add(row.taskId);
      if (!taskStatsMap.has(row.taskId)) {
        taskStatsMap.set(row.taskId, {
          sessionCount: 0,
          totalSeconds: 0,
          approvedSeconds: 0,
          pendingSeconds: 0,
          rejectedSeconds: 0,
        });
      }
      const entry = taskStatsMap.get(row.taskId);
      entry.sessionCount += cnt;
      entry.totalSeconds += secs;
      if (row.approval === "APPROVED") entry.approvedSeconds += secs;
      if (row.approval === "PENDING") entry.pendingSeconds += secs;
      if (row.approval === "REJECTED") entry.rejectedSeconds += secs;
    } else if (row.projectId && workScope.canViewProjects && !sprint && countedInActiveWork) {
      projectIdsSet.add(row.projectId);
      if (!projectStatsMap.has(row.projectId)) {
        projectStatsMap.set(row.projectId, {
          sessionCount: 0,
          totalSeconds: 0,
          approvedSeconds: 0,
          pendingSeconds: 0,
          rejectedSeconds: 0,
        });
      }
      const entry = projectStatsMap.get(row.projectId);
      entry.sessionCount += cnt;
      entry.totalSeconds += secs;
      if (row.approval === "APPROVED") entry.approvedSeconds += secs;
      if (row.approval === "PENDING") entry.pendingSeconds += secs;
      if (row.approval === "REJECTED") entry.rejectedSeconds += secs;
    }
  }

  // Keep aggWhere referenced conceptually via single grouped query above; no duplicate query needed
  void aggWhere;

  const taskIds = [...taskIdsSet];
  const projectIds = [...projectIdsSet];

  const [taskMetaList, projectMetaList] = await Promise.all([
    taskIds.length > 0
      ? db.task.findMany({
          where: { id: { in: taskIds } },
          select: {
            id: true,
            name: true,
            points: true,
            scrum: { select: { id: true, name: true, color: true } },
            sprint: { select: { id: true, number: true, title: true } },
          },
        })
      : Promise.resolve([]),
    projectIds.length > 0
      ? db.project.findMany({
          where: { id: { in: projectIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const tasks = taskMetaList
    .map((t) => {
      const st = taskStatsMap.get(t.id) || {
        sessionCount: 0,
        totalSeconds: 0,
        approvedSeconds: 0,
        pendingSeconds: 0,
        rejectedSeconds: 0,
      };
      return {
        task: { id: t.id, name: t.name },
        scrum: t.scrum,
        sprint: t.sprint ? { id: t.sprint.id, number: t.sprint.number, title: t.sprint.title } : null,
        points: t.points,
        sessionCount: st.sessionCount,
        totalSeconds: st.totalSeconds,
        approvedSeconds: st.approvedSeconds,
        pendingSeconds: st.pendingSeconds,
        ...(includeRejectedInAgg ? { rejectedSeconds: st.rejectedSeconds } : {}),
      };
    })
    .sort((a, b) => b.totalSeconds - a.totalSeconds || a.task.name.localeCompare(b.task.name));

  const projects = projectMetaList
    .map((p) => {
      const st = projectStatsMap.get(p.id) || {
        sessionCount: 0,
        totalSeconds: 0,
        approvedSeconds: 0,
        pendingSeconds: 0,
        rejectedSeconds: 0,
      };
      return {
        project: { id: p.id, name: p.name },
        sessionCount: st.sessionCount,
        totalSeconds: st.totalSeconds,
        approvedSeconds: st.approvedSeconds,
        pendingSeconds: st.pendingSeconds,
        ...(includeRejectedInAgg ? { rejectedSeconds: st.rejectedSeconds } : {}),
      };
    })
    .sort((a, b) => b.totalSeconds - a.totalSeconds || a.project.name.localeCompare(b.project.name));

  const items = rawSessions.map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    workDate: formatDate(s.workDate),
    durationSeconds: s.durationSeconds,
    approval: s.approval,
    source: s.source,
    target:
      s.taskId && s.task
        ? {
            kind: "TASK",
            id: s.task.id,
            name: s.task.name,
            scrum: s.task.scrum,
            sprint: s.task.sprint
              ? { id: s.task.sprint.id, number: s.task.sprint.number }
              : null,
          }
        : {
            kind: "PROJECT",
            id: s.project?.id ?? s.projectId,
            name: s.project?.name || "Unknown",
          },
  }));

  return {
    tasks,
    projects,
    sessions: {
      items,
      meta: formatPaginationMeta(pagination.page, pagination.limit, totalCount),
    },
    totals,
  };
};

