import { catchAsync, HandleERROR } from "vanta-api";
import prisma from "../../config/prisma.js";
import { cacheGet, cacheSet } from "../../Utils/cache.js";
import { todayDate, toDateOnly, formatDate } from "../../Utils/date.js";
import { getPagination, formatPaginationMeta } from "../../Utils/pagination.js";
import {
  computeEffectiveStatus,
  declareTodayAttendance,
  decideAttendanceRecord,
} from "./attendanceService.js";

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
    where: { attendanceId: attendance.id },
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

  return res.status(200).json({
    success: true,
    message: status === "PRESENT" ? "حضور با موفقیت ثبت شد" : "عدم حضور با موفقیت ثبت شد",
    data: {
      ...record,
      date: formatDate(record.date),
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
          where: { attendanceId: { in: attendanceIds } },
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

  const [total, records] = await Promise.all([
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
  ]);

  // Avoid N+1: compute session aggregates with ONE grouped query
  const attendanceIds = records.map((r) => r.id);
  const sessionAggs =
    attendanceIds.length > 0
      ? await prisma.workSession.groupBy({
          by: ["attendanceId"],
          where: { attendanceId: { in: attendanceIds } },
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
      user: r.user,
      status: r.status,
      effectiveStatus: computeEffectiveStatus(r.status, r.approval),
      approval: r.approval,
      source: r.source,
      reason: r.reason,
      decidedBy: r.decidedBy,
      decidedAt: r.decidedAt,
      sessionsCount: agg.sessionsCount,
      totalSeconds: agg.totalSeconds,
    };
  });

  return res.status(200).json({
    success: true,
    message: "Admin attendance fetched successfully",
    data: formatted,
    meta: formatPaginationMeta(page, limit, total),
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
