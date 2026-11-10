import { catchAsync } from "vanta-api";
import { formatPaginationMeta } from "../../Utils/pagination.js";
import { mapPrismaError } from "../../Utils/prismaErrors.js";
import {
  listScrumsService,
  createScrumService,
  getScrumDetailsService,
  getScrumMembersService,
  addScrumAdminService,
  removeScrumAdminService,
  updateScrumAdminMembershipService,
  updateScrumService,
  deleteScrumService,
  syncScrumMembersService,
  updateScrumMemberPerformanceService,
  listSprintsService,
  createSprintService,
  getSprintDetailsService,
  updateSprintService,
  updateSprintStatusService,
  deleteSprintService,
  getKpisService,
  batchUpdateKpisService,
  getEventsService,
  batchUpdateEventsService,
  getTodayEventsService,
  getWorkTargetsMineService,
  getScrumReportService,
} from "./scrumService.js";
import {
  listScrumTasksService,
  getMyScrumTasksService,
  getTaskByIdService,
  createScrumTaskService,
  updateScrumTaskService,
  syncTaskMembersService,
  deleteScrumTaskService,
  getTaskWorkSessionsService,
  getScrumLeaderboardService,
  getScrumAdminDashboardService,
} from "./scrumExtendedService.js";

const forwardPrismaOrThrow = (err, next) => {
  const mapped = mapPrismaError(err);
  if (mapped) return next(mapped);
  throw err;
};

export const getScrums = catchAsync(async (req, res) => {
  const scrums = await listScrumsService(req.user);
  return res.status(200).json({
    success: true,
    message: "اسکرام‌ها با موفقیت دریافت شدند",
    data: scrums,
  });
});

export const createScrum = catchAsync(async (req, res, next) => {
  try {
    const body = req.validatedBody || req.body;
    const scrum = await createScrumService(body, req.user);
    return res.status(201).json({
      success: true,
      message: "اسکرام با موفقیت ایجاد شد",
      data: scrum,
    });
  } catch (err) {
    forwardPrismaOrThrow(err, next);
  }
});

export const getScrumById = catchAsync(async (req, res) => {
  const query = req.validatedQuery || req.query;
  const scrum = await getScrumDetailsService(req.scrum.id, req.user, {
    includeAttendanceTotals: query?.include === "attendanceTotals",
  });
  return res.status(200).json({
    success: true,
    message: "اطلاعات اسکرام با موفقیت دریافت شد",
    data: scrum,
  });
});

export const getScrumMembers = catchAsync(async (req, res) => {
  const query = req.validatedQuery || req.query;
  const members = await getScrumMembersService(req.scrum.id, req.user, {
    includeAttendanceTotals: query?.include === "attendanceTotals",
  });
  return res.status(200).json({
    success: true,
    message: "اعضای اسکرام با موفقیت دریافت شدند",
    data: members,
  });
});

export const updateScrum = catchAsync(async (req, res, next) => {
  try {
    const body = req.validatedBody || req.body;
    const updated = await updateScrumService(req.scrum.id, body, req.user);
    return res.status(200).json({
      success: true,
      message: "اسکرام با موفقیت ویرایش شد",
      data: updated,
    });
  } catch (err) {
    forwardPrismaOrThrow(err, next);
  }
});

export const deleteScrum = catchAsync(async (req, res, next) => {
  try {
    await deleteScrumService(req.scrum.id);
    return res.status(200).json({
      success: true,
      message: "اسکرام با موفقیت حذف شد",
      data: null,
    });
  } catch (err) {
    forwardPrismaOrThrow(err, next);
  }
});

export const addScrumAdmin = catchAsync(async (req, res, next) => {
  try {
    const body = req.validatedBody || req.body;
    const admin = await addScrumAdminService(req.scrum.id, body, req.user);
    return res.status(201).json({
      success: true,
      message: "ادمین با موفقیت به اسکرام اضافه شد",
      data: admin,
    });
  } catch (err) {
    forwardPrismaOrThrow(err, next);
  }
});

export const removeScrumAdmin = catchAsync(async (req, res, next) => {
  try {
    const targetUserId = req.validatedParams?.userId ?? Number(req.params.userId);
    const query = req.validatedQuery || req.query;
    const result = await removeScrumAdminService(req.scrum.id, targetUserId, query);
    return res.status(200).json({
      success: true,
      message: "ادمین از اسکرام حذف شد",
      data: result,
    });
  } catch (err) {
    forwardPrismaOrThrow(err, next);
  }
});

export const updateScrumAdminMembership = catchAsync(async (req, res, next) => {
  try {
    const targetUserId = req.validatedParams?.userId ?? Number(req.params.userId);
    const body = req.validatedBody || req.body;
    const result = await updateScrumAdminMembershipService(req.scrum.id, targetUserId, body);
    return res.status(200).json({
      success: true,
      message: "وضعیت عضویت ادمین اسکرام با موفقیت بروزرسانی شد",
      data: result,
    });
  } catch (err) {
    forwardPrismaOrThrow(err, next);
  }
});

export const syncScrumMembers = catchAsync(async (req, res, next) => {
  try {
    const body = req.validatedBody || req.body;
    const members = await syncScrumMembersService(req.scrum.id, body.members, req.user);
    return res.status(200).json({
      success: true,
      message: "اعضای اسکرام با موفقیت بروزرسانی شدند",
      data: members,
    });
  } catch (err) {
    forwardPrismaOrThrow(err, next);
  }
});

export const updateScrumMemberPerformance = catchAsync(async (req, res, next) => {
  try {
    const targetUserId = req.validatedParams?.userId ?? Number(req.params.userId);
    const body = req.validatedBody || req.body;
    const result = await updateScrumMemberPerformanceService(
      req.scrum.id,
      targetUserId,
      body,
      req.user
    );
    return res.status(200).json({
      success: true,
      message: "وضعیت عملکرد عضو اسکرام با موفقیت ثبت شد",
      data: result,
    });
  } catch (err) {
    forwardPrismaOrThrow(err, next);
  }
});

export const getSprints = catchAsync(async (req, res) => {
  const sprints = await listSprintsService(req.scrum.id);
  return res.status(200).json({
    success: true,
    message: "اسپرینت‌ها با موفقیت دریافت شدند",
    data: sprints,
  });
});

export const createSprint = catchAsync(async (req, res, next) => {
  try {
    const body = req.validatedBody || req.body;
    const sprint = await createSprintService(req.scrum.id, body);
    return res.status(201).json({
      success: true,
      message: "اسپرینت جدید با موفقیت ایجاد شد",
      data: sprint,
    });
  } catch (err) {
    forwardPrismaOrThrow(err, next);
  }
});

export const getSprintById = catchAsync(async (req, res) => {
  const sprint = await getSprintDetailsService(req.sprint.id);
  return res.status(200).json({
    success: true,
    message: "اطلاعات اسپرینت با موفقیت دریافت شد",
    data: sprint,
  });
});

export const updateSprint = catchAsync(async (req, res, next) => {
  try {
    const body = req.validatedBody || req.body;
    const updated = await updateSprintService(req.sprint.id, body);
    return res.status(200).json({
      success: true,
      message: "اسپرینت با موفقیت ویرایش شد",
      data: updated,
    });
  } catch (err) {
    forwardPrismaOrThrow(err, next);
  }
});

export const updateSprintStatus = catchAsync(async (req, res, next) => {
  try {
    const body = req.validatedBody || req.body;
    const updated = await updateSprintStatusService(req.sprint.id, body.status);
    return res.status(200).json({
      success: true,
      message: "وضعیت اسپرینت با موفقیت تغییر یافت",
      data: updated,
    });
  } catch (err) {
    forwardPrismaOrThrow(err, next);
  }
});

export const deleteSprint = catchAsync(async (req, res, next) => {
  try {
    await deleteSprintService(req.sprint.id);
    return res.status(200).json({
      success: true,
      message: "اسپرینت با موفقیت حذف شد",
      data: null,
    });
  } catch (err) {
    forwardPrismaOrThrow(err, next);
  }
});

export const getKpis = catchAsync(async (req, res) => {
  const kpis = await getKpisService(req.scrum.id, req.canEdit);
  return res.status(200).json({
    success: true,
    message: "شاخص‌های کلیدی با موفقیت دریافت شدند",
    data: kpis,
  });
});

export const batchUpdateKpis = catchAsync(async (req, res, next) => {
  try {
    const body = req.validatedBody || req.body;
    const kpis = await batchUpdateKpisService(req.scrum.id, body.rows, req.canEdit);
    return res.status(200).json({
      success: true,
      message: "شاخص‌های کلیدی با موفقیت بروزرسانی شدند",
      data: kpis,
    });
  } catch (err) {
    forwardPrismaOrThrow(err, next);
  }
});

export const getEvents = catchAsync(async (req, res) => {
  const events = await getEventsService(req.scrum.id);
  return res.status(200).json({
    success: true,
    message: "ریتم جلسات با موفقیت دریافت شد",
    data: events,
  });
});

export const batchUpdateEvents = catchAsync(async (req, res, next) => {
  try {
    const body = req.validatedBody || req.body;
    const events = await batchUpdateEventsService(req.scrum.id, body.rows);
    return res.status(200).json({
      success: true,
      message: "ریتم جلسات با موفقیت بروزرسانی شد",
      data: events,
    });
  } catch (err) {
    forwardPrismaOrThrow(err, next);
  }
});

export const getTodayEvents = catchAsync(async (req, res) => {
  const events = await getTodayEventsService(req.user);
  return res.status(200).json({
    success: true,
    message: "جلسات امروز با موفقیت دریافت شدند",
    data: events,
  });
});

export const getWorkTargetsMine = catchAsync(async (req, res) => {
  const targets = await getWorkTargetsMineService(req.user);
  return res.status(200).json({
    success: true,
    message: "اهداف کاری با موفقیت دریافت شدند",
    data: targets,
  });
});

export const getScrumReport = catchAsync(async (req, res) => {
  const filters = req.validatedQuery || req.query;
  const report = await getScrumReportService(
    req.scrum.id,
    filters,
    req.user,
    req.canEditContent
  );
  return res.status(200).json({
    success: true,
    message: "گزارش اسکرام با موفقیت دریافت شد",
    data: report,
  });
});

export const listScrumTasks = catchAsync(async (req, res) => {
  const query = req.validatedQuery || req.query;
  const tasks = await listScrumTasksService(req.scrum.id, query, req.user, req.canEditContent);
  return res.status(200).json({
    success: true,
    message: "تسک‌های اسکرام با موفقیت دریافت شدند",
    data: tasks,
  });
});

export const getMyTasks = catchAsync(async (req, res) => {
  const query = req.validatedQuery || req.query;
  const result = await getMyScrumTasksService(query, req.user);
  return res.status(200).json({
    success: true,
    message: "تسک‌های اسکرام شما با موفقیت دریافت شدند",
    data: result,
  });
});

export const createScrumTask = catchAsync(async (req, res, next) => {
  try {
    const body = req.validatedBody || req.body;
    const created = await createScrumTaskService(req.scrum.id, body, req.user);
    return res.status(201).json({
      success: true,
      message: "تسک با موفقیت ایجاد شد",
      data: created,
    });
  } catch (err) {
    forwardPrismaOrThrow(err, next);
  }
});

export const getTaskById = catchAsync(async (req, res) => {
  const task = await getTaskByIdService(req.task.id, req.user, req.canEditContent);
  return res.status(200).json({
    success: true,
    message: "اطلاعات تسک با موفقیت دریافت شد",
    data: task,
  });
});

export const updateScrumTask = catchAsync(async (req, res, next) => {
  try {
    const body = req.validatedBody || req.body;
    const updated = await updateScrumTaskService(
      req.task.id,
      body,
      req.user,
      req.canEditContent
    );
    return res.status(200).json({
      success: true,
      message: "تسک با موفقیت ویرایش شد",
      data: updated,
    });
  } catch (err) {
    forwardPrismaOrThrow(err, next);
  }
});

export const syncTaskMembers = catchAsync(async (req, res, next) => {
  try {
    const body = req.validatedBody || req.body;
    const members = await syncTaskMembersService(req.task.id, body.userIds, req.user);
    return res.status(200).json({
      success: true,
      message: "افراد اختصاص‌داده‌شده به تسک با موفقیت بروزرسانی شدند",
      data: members,
    });
  } catch (err) {
    forwardPrismaOrThrow(err, next);
  }
});

export const deleteScrumTask = catchAsync(async (req, res, next) => {
  try {
    await deleteScrumTaskService(req.task.id);
    return res.status(200).json({
      success: true,
      message: "تسک با موفقیت حذف شد",
      data: null,
    });
  } catch (err) {
    forwardPrismaOrThrow(err, next);
  }
});

export const getTaskWorkSessions = catchAsync(async (req, res) => {
  const query = req.validatedQuery || req.query;
  const result = await getTaskWorkSessionsService(
    req.task.id,
    query,
    req.user,
    req.canEditContent
  );
  return res.status(200).json({
    success: true,
    message: "سشن‌های کاری تسک با موفقیت دریافت شد",
    data: result.data,
    meta: formatPaginationMeta(result.page, result.limit, result.total),
  });
});

export const getScrumLeaderboard = catchAsync(async (req, res) => {
  const query = req.validatedQuery || req.query;
  const leaderboard = await getScrumLeaderboardService(req.scrum.id, query, req.user);
  return res.status(200).json({
    success: true,
    message: "جدول برترین‌های اسکرام با موفقیت دریافت شد",
    data: leaderboard,
  });
});

export const getScrumAdminDashboard = catchAsync(async (req, res) => {
  const dashboard = await getScrumAdminDashboardService(req.user);
  return res.status(200).json({
    success: true,
    message: "داشبورد مدیریت اسکرام با موفقیت دریافت شد",
    data: dashboard,
  });
});
