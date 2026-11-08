import { catchAsync } from "vanta-api";
import prisma from "../../config/prisma.js";
import { todayDate, toDateOnly, formatDate } from "../../Utils/date.js";
import { getPagination, formatPaginationMeta } from "../../Utils/pagination.js";
import {
  logWorkSession,
  getWorkSessionsSummaryAgg,
  decideWorkSessionRecord,
  deleteWorkSession,
} from "./workSessionService.js";

export const postWorkSession = catchAsync(async (req, res, next) => {
  const { projectId, durationSeconds, startedAt, clientRequestId } = req.body;
  const session = await logWorkSession({
    userId: req.userId,
    projectId: Number(projectId),
    durationSeconds: Number(durationSeconds),
    startedAt,
    clientRequestId,
  });

  return res.status(200).json({
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
    where.workDate = toDateOnly(date);
  } else if (dateFrom || dateTo) {
    where.workDate = {};
    if (dateFrom) where.workDate.gte = toDateOnly(dateFrom);
    if (dateTo) where.workDate.lte = toDateOnly(dateTo);
  } else {
    // Default to today
    where.workDate = todayDate();
  }

  const [totalAgg, sessions] = await Promise.all([
    prisma.workSession.aggregate({
      where: {
        ...where,
        approval: { not: "REJECTED" },
      },
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
    workDate: formatDate(s.workDate),
    approval: s.approval,
    source: s.source,
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
  const { userId, projectId, date, dateFrom, dateTo, approval } = req.query;

  const where = {};

  if (userId) where.userId = Number(userId);
  if (projectId) where.projectId = Number(projectId);
  if (approval) where.approval = approval;

  if (date) {
    where.workDate = toDateOnly(date);
  } else if (dateFrom || dateTo) {
    where.workDate = {};
    if (dateFrom) where.workDate.gte = toDateOnly(dateFrom);
    if (dateTo) where.workDate.lte = toDateOnly(dateTo);
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
        decidedBy: {
          select: { id: true, name: true },
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
    workDate: formatDate(s.workDate),
    approval: s.approval,
    source: s.source,
    decidedBy: s.decidedBy,
    decidedAt: s.decidedAt,
    startedAt: s.startedAt,
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

export const patchWorkSessionDecision = catchAsync(async (req, res, next) => {
  const id = Number(req.params.id);
  const { decision } = req.body;

  const result = await decideWorkSessionRecord(id, decision, req.user);

  return res.status(200).json({
    success: true,
    message: decision === "APPROVED" ? "سشن کاری با موفقیت تایید شد" : "سشن کاری با موفقیت رد شد",
    data: {
      ...result,
      workDate: formatDate(result.workDate),
    },
  });
});

export const deleteWorkSessionController = catchAsync(async (req, res, next) => {
  const id = Number(req.params.id);
  await deleteWorkSession(id, req.user);

  return res.status(200).json({
    success: true,
    message: "سشن کاری با موفقیت حذف شد",
    data: { id },
  });
});
