import { catchAsync } from "vanta-api";
import prisma from "../../config/prisma.js";
import { todayDate, toDateOnly, formatDate } from "../../Utils/date.js";
import { getPagination, formatPaginationMeta } from "../../Utils/pagination.js";
import {
  computeEffectiveStatus,
  declareTodayAttendance,
  saveWorkNoteService,
  decideAttendanceRecord,
  getAttendanceImpactService,
} from "./attendanceService.js";
import { getAdministeredScrumIds } from "../Scrum/scrumAccess.js";
import {
  buildAttendanceAdminWhere,
  buildAttendanceSessionAggWhere,
  computeAttendanceCanDecide,
} from "../Scrum/scrumScope.js";

export const getTodayAttendance = catchAsync(async (req, res, next) => {
  const userId = req.userId;
  const date = todayDate();

  const attendance = await prisma.attendance.findUnique({
    where: {
      userId_date: {
        userId,
        date,
      },
    },
  });

  if (!attendance) {
    return res.status(200).json({
      success: true,
      message: "No attendance recorded for today",
      data: null,
    });
  }

  const sessionAgg = await prisma.workSession.aggregate({
    where: {
      OR: [
        { attendanceId: attendance.id },
        { userId, workDate: date },
      ],
      approval: { not: "REJECTED" },
    },
    _count: { id: true },
    _sum: { durationSeconds: true },
  });

  const formatted = {
    id: attendance.id,
    userId: attendance.userId,
    date: formatDate(attendance.date),
    status: attendance.status,
    effectiveStatus: computeEffectiveStatus(attendance.status, attendance.approval),
    approval: attendance.approval,
    source: attendance.source,
    reason: attendance.reason,
    workNote: attendance.workNote ?? null,
    workNoteAt: attendance.workNoteAt ?? null,
    workNotePrompted: Boolean(attendance.workNotePromptedAt || attendance.workNote !== null),
    decidedById: attendance.decidedById,
    decidedAt: attendance.decidedAt,
    sessionsCount: sessionAgg._count.id,
    totalSeconds: sessionAgg._sum.durationSeconds || 0,
    createdAt: attendance.createdAt,
    updatedAt: attendance.updatedAt,
  };

  return res.status(200).json({
    success: true,
    message: "Today's attendance fetched successfully",
    data: formatted,
  });
});

export const postTodayAttendance = catchAsync(async (req, res, next) => {
  const { status, reason } = req.body;
  const record = await declareTodayAttendance(req.userId, status, reason);
  const { workNotePromptedAt, ...safeRecord } = record;

  const sessionAgg = await prisma.workSession.aggregate({
    where: {
      OR: [
        { attendanceId: record.id },
        { userId: req.userId, workDate: record.date },
      ],
      approval: { not: "REJECTED" },
    },
    _count: { id: true },
    _sum: { durationSeconds: true },
  });

  return res.status(200).json({
    success: true,
    message: status === "PRESENT" ? "حضور با موفقیت ثبت شد" : "عدم حضور با موفقیت ثبت شد",
    data: {
      ...safeRecord,
      date: formatDate(record.date),
      workNote: record.workNote ?? null,
      workNoteAt: record.workNoteAt ?? null,
      workNotePrompted: Boolean(workNotePromptedAt || record.workNote !== null),
      sessionsCount: sessionAgg._count.id,
      totalSeconds: sessionAgg._sum.durationSeconds || 0,
    },
  });
});

export const putTodayWorkNote = catchAsync(async (req, res, next) => {
  const updated = await saveWorkNoteService(req.userId, req.body);

  return res.status(200).json({
    success: true,
    message: req.body.skipped ? "وضعیت نمایش یادداشت ثبت شد" : "یادداشت پایان کار با موفقیت ثبت شد",
    data: {
      id: updated.id,
      userId: updated.userId,
      date: formatDate(updated.date),
      workNote: updated.workNote ?? null,
      workNoteAt: updated.workNoteAt ?? null,
      workNotePrompted: Boolean(updated.workNotePromptedAt || updated.workNote !== null),
    },
  });
});

export const getMeAttendance = catchAsync(async (req, res, next) => {
  const { page, limit, skip } = getPagination(req.query);
  const { dateFrom, dateTo } = req.query;

  const where = {
    userId: req.userId,
  };

  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = toDateOnly(dateFrom);
    if (dateTo) where.date.lte = toDateOnly(dateTo);
  }

  const [total, records] = await Promise.all([
    prisma.attendance.count({ where }),
    prisma.attendance.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ date: "desc" }, { id: "desc" }],
    }),
  ]);

  const attendanceIds = records.map((r) => r.id);
  const sessionAggs =
    attendanceIds.length > 0
      ? await prisma.workSession.groupBy({
          by: ["attendanceId"],
          where: {
            attendanceId: { in: attendanceIds },
            approval: { not: "REJECTED" },
          },
          _count: { id: true },
          _sum: { durationSeconds: true },
        })
      : [];

  const aggMap = new Map();
  for (const agg of sessionAggs) {
    aggMap.set(agg.attendanceId, {
      sessionsCount: agg._count.id,
      totalSeconds: agg._sum.durationSeconds || 0,
    });
  }

  const formatted = records.map((r) => {
    const agg = aggMap.get(r.id) || { sessionsCount: 0, totalSeconds: 0 };
    return {
      id: r.id,
      date: formatDate(r.date),
      status: r.status,
      effectiveStatus: computeEffectiveStatus(r.status, r.approval),
      approval: r.approval,
      source: r.source,
      reason: r.reason,
      workNote: r.workNote ?? null,
      workNoteAt: r.workNoteAt ?? null,
      workNotePrompted: Boolean(r.workNotePromptedAt || r.workNote !== null),
      decidedById: r.decidedById,
      decidedAt: r.decidedAt,
      sessionsCount: agg.sessionsCount,
      totalSeconds: agg.totalSeconds,
      createdAt: r.createdAt,
    };
  });

  return res.status(200).json({
    success: true,
    message: "Attendance history fetched successfully",
    data: formatted,
    meta: formatPaginationMeta(page, limit, total),
  });
});

export const getAdminAttendance = catchAsync(async (req, res, next) => {
  const { page, limit, skip } = getPagination(req.query);
  const { date, dateFrom, dateTo, approval, status, userId, source } = req.query;
  const isScrumAdminCaller = req.user?.role === "SCRUM_ADMIN";

  const where = buildAttendanceAdminWhere(
    { date, dateFrom, dateTo, approval, status, userId, source },
    req.user
  );

  const [total, records, administeredScrumIds] = await Promise.all([
    prisma.attendance.count({ where }),
    prisma.attendance.findMany({
      where,
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        decidedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    }),
    isScrumAdminCaller ? getAdministeredScrumIds(req.user) : Promise.resolve(null),
  ]);

  // Avoid N+1: compute session aggregates & member scrums with batched queries
  const attendanceIds = records.map((r) => r.id);
  const pageUserIds = [...new Set(records.map((r) => r.userId))];

  const [sessionAggs, scrumMemberships] = await Promise.all([
    attendanceIds.length > 0
      ? prisma.workSession.groupBy({
          by: ["attendanceId"],
          where: buildAttendanceSessionAggWhere(attendanceIds, req.user),
          _count: { id: true },
          _sum: { durationSeconds: true },
        })
      : [],
    pageUserIds.length > 0
      ? isScrumAdminCaller && (!administeredScrumIds || administeredScrumIds.length === 0)
        ? []
        : prisma.scrumMember.findMany({
            where: {
              userId: { in: pageUserIds },
              ...(isScrumAdminCaller ? { scrumId: { in: administeredScrumIds } } : {}),
            },
            select: {
              userId: true,
              scrum: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                },
              },
            },
            orderBy: { scrum: { name: "asc" } },
          })
      : [],
  ]);

  const aggMap = new Map();
  for (const agg of sessionAggs) {
    aggMap.set(agg.attendanceId, {
      sessionsCount: agg._count.id,
      totalSeconds: agg._sum.durationSeconds || 0,
    });
  }

  const scrumsByUserMap = new Map();
  for (const m of scrumMemberships) {
    if (!scrumsByUserMap.has(m.userId)) {
      scrumsByUserMap.set(m.userId, []);
    }
    scrumsByUserMap.get(m.userId).push({
      id: m.scrum.id,
      name: m.scrum.name,
      color: m.scrum.color,
    });
  }

  const formatted = records.map((r) => {
    const agg = aggMap.get(r.id) || { sessionsCount: 0, totalSeconds: 0 };
    return {
      id: r.id,
      date: formatDate(r.date),
      user: isScrumAdminCaller ? { id: r.user.id, name: r.user.name } : r.user,
      status: r.status,
      effectiveStatus: computeEffectiveStatus(r.status, r.approval),
      approval: r.approval,
      source: r.source,
      reason: r.reason,
      workNote: r.workNote ?? null,
      workNoteAt: r.workNoteAt ?? null,
      scrums: scrumsByUserMap.get(r.userId) || [],
      decidedBy: r.decidedBy,
      decidedAt: r.decidedAt,
      sessionsCount: agg.sessionsCount,
      totalSeconds: agg.totalSeconds,
      canDecide: computeAttendanceCanDecide({ userId: r.userId, user: r.user }, req.user),
    };
  });

  return res.status(200).json({
    success: true,
    message: "Admin attendance fetched successfully",
    data: formatted,
    meta: formatPaginationMeta(page, limit, total),
  });
});

export const getAttendanceImpact = catchAsync(async (req, res, next) => {
  const id = Number(req.params.id);
  const impact = await getAttendanceImpactService(id);

  return res.status(200).json({
    success: true,
    message: "Attendance impact fetched successfully",
    data: impact,
  });
});

export const patchAttendanceDecision = catchAsync(async (req, res, next) => {
  const id = Number(req.params.id);
  const { decision } = req.body;

  const result = await decideAttendanceRecord(id, decision, req.user);

  return res.status(200).json({
    success: true,
    message: `Attendance ${decision.toLowerCase()} successfully`,
    data: {
      ...result,
      date: formatDate(result.date),
    },
  });
});
