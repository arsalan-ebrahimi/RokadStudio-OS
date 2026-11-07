import { catchAsync } from "vanta-api";
import prisma from "../../config/prisma.js";
import { todayDate, toDateOnly, formatDate } from "../../Utils/date.js";
import { getPagination, formatPaginationMeta } from "../../Utils/pagination.js";
import {
  logWorkSession,
  getWorkSessionsSummaryAgg,
} from "./workSessionService.js";

export const postWorkSession = catchAsync(async (req, res, next) => {
  const { projectId, durationSeconds } = req.body;
  const session = await logWorkSession({
    userId: req.userId,
    projectId: Number(projectId),
    durationSeconds: Number(durationSeconds),
  });

  return res.status(201).json({
    success: true,
    message: "Work session logged successfully",
    data: session,
  });
});

export const getMeWorkSessions = catchAsync(async (req, res, next) => {
  const { date, dateFrom, dateTo } = req.query;

  const where = {
    userId: req.userId,
  };

  if (date) {
    where.attendance = { date: toDateOnly(date) };
  } else if (dateFrom || dateTo) {
    where.attendance = { date: {} };
    if (dateFrom) where.attendance.date.gte = toDateOnly(dateFrom);
    if (dateTo) where.attendance.date.lte = toDateOnly(dateTo);
  } else {
    // Default to today
    where.attendance = { date: todayDate() };
  }

  const [totalAgg, sessions] = await Promise.all([
    prisma.workSession.aggregate({
      where,
      _sum: { durationSeconds: true },
    }),
    prisma.workSession.findMany({
      where,
      include: {
        project: {
          select: { id: true, name: true },
        },
        attendance: {
          select: { date: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const formatted = sessions.map((s) => ({
    id: s.id,
    projectId: s.projectId,
    projectName: s.project?.name,
    durationSeconds: s.durationSeconds,
    attendanceDate: formatDate(s.attendance?.date),
    createdAt: s.createdAt,
  }));

  return res.status(200).json({
    success: true,
    message: "Own work sessions fetched successfully",
    data: {
      totalSeconds: totalAgg._sum.durationSeconds || 0,
      sessions: formatted,
    },
  });
});

export const getAdminWorkSessions = catchAsync(async (req, res, next) => {
  const { page, limit, skip } = getPagination(req.query);
  const { userId, projectId, date, dateFrom, dateTo } = req.query;

  const where = {};

  if (userId) where.userId = Number(userId);
  if (projectId) where.projectId = Number(projectId);

  if (date) {
    where.attendance = { date: toDateOnly(date) };
  } else if (dateFrom || dateTo) {
    where.attendance = { date: {} };
    if (dateFrom) where.attendance.date.gte = toDateOnly(dateFrom);
    if (dateTo) where.attendance.date.lte = toDateOnly(dateTo);
  }

  const [total, totalAgg, sessions] = await Promise.all([
    prisma.workSession.count({ where }),
    prisma.workSession.aggregate({
      where,
      _sum: { durationSeconds: true },
    }),
    prisma.workSession.findMany({
      where,
      skip,
      take: limit,
      include: {
        user: {
          select: { id: true, name: true, role: true },
        },
        project: {
          select: { id: true, name: true },
        },
        attendance: {
          select: { date: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const formatted = sessions.map((s) => ({
    id: s.id,
    user: s.user,
    project: s.project,
    durationSeconds: s.durationSeconds,
    attendanceDate: formatDate(s.attendance?.date),
    createdAt: s.createdAt,
  }));

  return res.status(200).json({
    success: true,
    message: "Work sessions fetched successfully",
    data: {
      totalSeconds: totalAgg._sum.durationSeconds || 0,
      sessions: formatted,
    },
    meta: formatPaginationMeta(page, limit, total),
  });
});

export const getWorkSessionsSummary = catchAsync(async (req, res, next) => {
  const summaryRows = await getWorkSessionsSummaryAgg(req.query);

  return res.status(200).json({
    success: true,
    message: "Work sessions summary fetched successfully",
    data: summaryRows,
  });
});
