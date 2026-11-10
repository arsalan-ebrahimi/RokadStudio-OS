import { catchAsync } from "vanta-api";
import { mapPrismaError } from "../../Utils/prismaErrors.js";
import {
  listScrumsService,
  createScrumService,
  getScrumDetailsService,
  syncScrumAdminsService,
  updateScrumService,
  deleteScrumService,
  syncScrumMembersService,
  listSprintsService,
  createSprintService,
  getSprintDetailsService,
  updateSprintService,
  updateSprintStatusService,
  deleteSprintService,
  createSprintProjectService,
  updateSprintProjectService,
  deleteSprintProjectService,
  getKpisService,
  batchUpdateKpisService,
  getEventsService,
  batchUpdateEventsService,
  getTodayEventsService,
  getWorkTargetsMineService,
  getScrumReportService,
} from "./scrumService.js";
import {
  listScrumProjectsService,
  createScrumProjectService,
  listAvailableScrumProjectsService,
  linkProjectToScrumService,
  unlinkProjectFromScrumService,
  syncScrumProjectMembersService,
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
  const scrum = await getScrumDetailsService(req.scrum.id, req.user);
  return res.status(200).json({
    success: true,
    message: "اطلاعات اسکرام با موفقیت دریافت شد",
    data: scrum,
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

export const syncScrumAdmins = catchAsync(async (req, res, next) => {
  try {
    const body = req.validatedBody || req.body;
    const admins = await syncScrumAdminsService(req.scrum.id, body.userIds, req.user);
    return res.status(200).json({
      success: true,
      message: "ادمین‌های اسکرام با موفقیت بروزرسانی شدند",
      data: admins,
    });
  } catch (err) {
    forwardPrismaOrThrow(err, next);
  }
});

export const syncScrumMembers = catchAsync(async (req, res, next) => {
  try {
    const body = req.validatedBody || req.body;
    const members = await syncScrumMembersService(req.scrum.id, body.members);
    return res.status(200).json({
      success: true,
      message: "اعضای اسکرام با موفقیت بروزرسانی شدند",
      data: members,
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
  const sprint = await getSprintDetailsService(req.sprint.id, req.user, req.canEdit);
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

export const createSprintProject = catchAsync(async (req, res, next) => {
  try {
    const body = req.validatedBody || req.body;
    const project = await createSprintProjectService(req.sprint.id, body);
    return res.status(201).json({
      success: true,
      message: "پروژه اسپرینت با موفقیت ایجاد شد",
      data: project,
    });
  } catch (err) {
    forwardPrismaOrThrow(err, next);
  }
});

export const updateSprintProject = catchAsync(async (req, res, next) => {
  try {
    const body = req.validatedBody || req.body;
    const updated = await updateSprintProjectService(req.sprintProject.id, body, {
      canEdit: req.canEdit,
      isAssignee: req.isAssignee,
      currentUser: req.user,
    });
    return res.status(200).json({
      success: true,
      message: "پروژه اسپرینت با موفقیت ویرایش شد",
      data: updated,
    });
  } catch (err) {
    forwardPrismaOrThrow(err, next);
  }
});

export const deleteSprintProject = catchAsync(async (req, res, next) => {
  try {
    await deleteSprintProjectService(req.sprintProject.id);
    return res.status(200).json({
      success: true,
      message: "پروژه اسپرینت با موفقیت حذف شد",
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
    req.canEdit
  );
  return res.status(200).json({
    success: true,
    message: "گزارش اسکرام با موفقیت دریافت شد",
    data: report,
  });
});

export const listScrumProjects = catchAsync(async (req, res) => {
  const projects = await listScrumProjectsService(req.scrum.id, req.canEditContent);
  return res.status(200).json({
    success: true,
    message: "پروژه‌های متصل به اسکرام با موفقیت دریافت شدند",
    data: projects,
  });
});

export const createScrumProject = catchAsync(async (req, res, next) => {
  try {
    const body = req.validatedBody || req.body;
    const created = await createScrumProjectService(req.scrum.id, body, req.user);
    return res.status(201).json({
      success: true,
      message: "پروژه با موفقیت ایجاد و به اسکرام متصل شد",
      data: created,
    });
  } catch (err) {
    forwardPrismaOrThrow(err, next);
  }
});

export const getAvailableScrumProjects = catchAsync(async (req, res) => {
  const q = req.validatedQuery?.q ?? req.query?.q ?? "";
  const projects = await listAvailableScrumProjectsService(q);
  return res.status(200).json({
    success: true,
    message: "پروژه‌های آزاد قابل اتصال با موفقیت دریافت شدند",
    data: projects,
  });
});

export const linkProjectToScrum = catchAsync(async (req, res, next) => {
  try {
    const body = req.validatedBody || req.body;
    const linked = await linkProjectToScrumService(req.scrum.id, body.projectId);
    return res.status(200).json({
      success: true,
      message: "پروژه با موفقیت به اسکرام متصل شد",
      data: linked,
    });
  } catch (err) {
    forwardPrismaOrThrow(err, next);
  }
});

export const unlinkProjectFromScrum = catchAsync(async (req, res, next) => {
  try {
    const projectId = req.validatedParams?.projectId ?? Number(req.params.projectId);
    await unlinkProjectFromScrumService(req.scrum.id, projectId);
    return res.status(200).json({
      success: true,
      message: "اتصال پروژه از اسکرام با موفقیت قطع شد",
      data: null,
    });
  } catch (err) {
    forwardPrismaOrThrow(err, next);
  }
});

export const syncScrumProjectMembers = catchAsync(async (req, res, next) => {
  try {
    const projectId = req.validatedParams?.projectId ?? Number(req.params.projectId);
    const body = req.validatedBody || req.body;
    const members = await syncScrumProjectMembersService(req.scrum.id, projectId, body.userIds);
    return res.status(200).json({
      success: true,
      message: "اعضای پروژه اسکرام با موفقیت بروزرسانی شدند",
      data: members,
    });
  } catch (err) {
    forwardPrismaOrThrow(err, next);
  }
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
