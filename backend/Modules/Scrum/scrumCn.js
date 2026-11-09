import { catchAsync } from "vanta-api";
import { mapPrismaError } from "../../Utils/prismaErrors.js";
import {
  listScrumsService,
  createScrumService,
  getScrumDetailsService,
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
    const scrum = await createScrumService(req.body, req.user);
    return res.status(201).json({
      success: true,
      message: "اسکرام با موفقیت ایجاد شد",
      data: scrum,
    });
  } catch (err) {
    const mapped = mapPrismaError(err);
    if (mapped) return next(mapped);
    throw err;
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
    const updated = await updateScrumService(req.scrum.id, req.body);
    return res.status(200).json({
      success: true,
      message: "اسکرام با موفقیت ویرایش شد",
      data: updated,
    });
  } catch (err) {
    const mapped = mapPrismaError(err);
    if (mapped) return next(mapped);
    throw err;
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
    const mapped = mapPrismaError(err);
    if (mapped) return next(mapped);
    throw err;
  }
});

export const syncScrumMembers = catchAsync(async (req, res, next) => {
  try {
    const members = await syncScrumMembersService(req.scrum.id, req.body.members);
    return res.status(200).json({
      success: true,
      message: "اعضای اسکرام با موفقیت بروزرسانی شدند",
      data: members,
    });
  } catch (err) {
    const mapped = mapPrismaError(err);
    if (mapped) return next(mapped);
    throw err;
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
    const sprint = await createSprintService(req.scrum.id, req.body);
    return res.status(201).json({
      success: true,
      message: "اسپرینت جدید با موفقیت ایجاد شد",
      data: sprint,
    });
  } catch (err) {
    const mapped = mapPrismaError(err);
    if (mapped) return next(mapped);
    throw err;
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
    const updated = await updateSprintService(req.sprint.id, req.body);
    return res.status(200).json({
      success: true,
      message: "اسپرینت با موفقیت ویرایش شد",
      data: updated,
    });
  } catch (err) {
    const mapped = mapPrismaError(err);
    if (mapped) return next(mapped);
    throw err;
  }
});

export const updateSprintStatus = catchAsync(async (req, res, next) => {
  try {
    const updated = await updateSprintStatusService(req.sprint.id, req.body.status);
    return res.status(200).json({
      success: true,
      message: "وضعیت اسپرینت با موفقیت تغییر یافت",
      data: updated,
    });
  } catch (err) {
    const mapped = mapPrismaError(err);
    if (mapped) return next(mapped);
    throw err;
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
    const mapped = mapPrismaError(err);
    if (mapped) return next(mapped);
    throw err;
  }
});

export const createSprintProject = catchAsync(async (req, res, next) => {
  try {
    const project = await createSprintProjectService(req.sprint.id, req.body);
    return res.status(201).json({
      success: true,
      message: "پروژه اسپرینت با موفقیت ایجاد شد",
      data: project,
    });
  } catch (err) {
    const mapped = mapPrismaError(err);
    if (mapped) return next(mapped);
    throw err;
  }
});

export const updateSprintProject = catchAsync(async (req, res, next) => {
  try {
    const updated = await updateSprintProjectService(req.sprintProject.id, req.body, {
      canEdit: req.canEdit,
      isAssignee: req.isAssignee,
    });
    return res.status(200).json({
      success: true,
      message: "پروژه اسپرینت با موفقیت ویرایش شد",
      data: updated,
    });
  } catch (err) {
    const mapped = mapPrismaError(err);
    if (mapped) return next(mapped);
    throw err;
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
    const mapped = mapPrismaError(err);
    if (mapped) return next(mapped);
    throw err;
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
    const kpis = await batchUpdateKpisService(req.scrum.id, req.body.rows, req.canEdit);
    return res.status(200).json({
      success: true,
      message: "شاخص‌های کلیدی با موفقیت بروزرسانی شدند",
      data: kpis,
    });
  } catch (err) {
    const mapped = mapPrismaError(err);
    if (mapped) return next(mapped);
    throw err;
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
    const events = await batchUpdateEventsService(req.scrum.id, req.body.rows);
    return res.status(200).json({
      success: true,
      message: "ریتم جلسات با موفقیت بروزرسانی شد",
      data: events,
    });
  } catch (err) {
    const mapped = mapPrismaError(err);
    if (mapped) return next(mapped);
    throw err;
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
  const targets = await getWorkTargetsMineService(
    req.userId,
    req.user.role === "SUPER_ADMIN"
  );
  return res.status(200).json({
    success: true,
    message: "اهداف کاری با موفقیت دریافت شدند",
    data: targets,
  });
});

export const getScrumReport = catchAsync(async (req, res) => {
  const report = await getScrumReportService(
    req.scrum.id,
    req.query,
    req.user,
    req.canEdit
  );
  return res.status(200).json({
    success: true,
    message: "گزارش اسکرام با موفقیت دریافت شد",
    data: report,
  });
});

