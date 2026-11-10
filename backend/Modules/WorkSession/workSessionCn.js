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
  const { projectId, taskId, durationSeconds, startedAt, clientRequestId } = req.body;
  const session = await logWorkSession({
    userId: req.userId,
    projectId: projectId ? Number(projectId) : null,
    taskId: taskId ? Number(taskId) : null,
    durationSeconds: Number(durationSeconds),
    startedAt,
    clientRequestId,
  });

  return res.status(200).json({
    success: true,
    message: "Work session logged successfully",
    data: {
      ...session,
      targetType: session.projectId ? "PROJECT" : "TASK",
    },
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
        task: {
          select: {
            id: true,
            name: true,
            points: true,
            scrum: { select: { id: true, name: true, color: true } },
          },
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
    targetType: s.projectId ? "PROJECT" : "TASK",
    projectId: s.projectId,
    project: s.project || null,
    taskId: s.taskId,
    task: s.task || null,
    projectName:
      s.project?.name ||
      (s.task ? `[${s.task.scrum.name}] ${s.task.name}` : undefined),
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
  const { userId, projectId, taskId, targetType, date, dateFrom, dateTo, approval } = req.query;

  const where = {};

  if (userId) where.userId = Number(userId);
  if (projectId) {
    where.projectId = Number(projectId);
  } else if (taskId) {
    where.taskId = Number(taskId);
  } else if (targetType === "PROJECT") {
    where.projectId = { not: null };
  } else if (targetType === "TASK") {
    where.taskId = { not: null };
  }
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
        task: {
          select: {
            id: true,
            name: true,
            points: true,
            scrum: { select: { id: true, name: true, color: true } },
          },
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
    targetType: s.projectId ? "PROJECT" : "TASK",
    projectId: s.projectId,
    project: s.project || null,
    taskId: s.taskId,
    task: s.task || null,
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

export const getWorkSessionTargets = catchAsync(async (req, res, next) => {
  const [projects, tasks] = await Promise.all([
    prisma.project.findMany({
      take: 200,
      select: { id: true, name: true, isActive: true },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    prisma.task.findMany({
      take: 200,
      select: {
        id: true,
        name: true,
        isActive: true,
        points: true,
        scrumId: true,
        scrum: { select: { id: true, name: true, color: true } },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
  ]);

  return res.status(200).json({
    success: true,
    message: "Work session targets fetched successfully",
    data: {
      projects,
      tasks: tasks.map((t) => ({
        id: t.id,
        name: t.name,
        isActive: t.isActive,
        points: t.points,
        scrumId: t.scrumId,
        scrumName: t.scrum.name,
        scrumColor: t.scrum.color,
      })),
    },
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
