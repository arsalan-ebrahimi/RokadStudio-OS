import express from "express";
import { isLogin } from "../../Middlewares/isLogin.js";
import { allowedRoles } from "../../Middlewares/allowedRoles.js";
import {
  requireScrumAccess,
  requireSprintAccess,
  requireSprintProjectAccess,
} from "./scrumAccess.js";
import {
  scrumIdValidator,
  sprintIdValidator,
  sprintProjectIdValidator,
  createScrumValidator,
  updateScrumValidator,
  updateScrumMembersValidator,
  createSprintValidator,
  updateSprintValidator,
  updateSprintStatusValidator,
  createSprintProjectValidator,
  updateSprintProjectValidator,
  batchKpiValidator,
  batchEventsValidator,
  scrumReportValidator,
} from "./scrumValidator.js";
import {
  getScrums,
  createScrum,
  getScrumById,
  updateScrum,
  deleteScrum,
  syncScrumMembers,
  getSprints,
  createSprint,
  getSprintById,
  updateSprint,
  updateSprintStatus,
  deleteSprint,
  createSprintProject,
  updateSprintProject,
  deleteSprintProject,
  getKpis,
  batchUpdateKpis,
  getEvents,
  batchUpdateEvents,
  getTodayEvents,
  getWorkTargetsMine,
  getScrumReport,
} from "./scrumCn.js";

// ==========================================
// 1. Scrums Router (/api/scrums)
// ==========================================
export const scrumRouter = express.Router();
scrumRouter.use(isLogin);

// Special root helper: today's events for current user
// MUST be declared BEFORE /:id to avoid param capture
scrumRouter.get("/today-events", getTodayEvents);

// List scrums for current user
scrumRouter.get("/", getScrums);

// Create scrum (SCRUM_ADMIN, SUPER_ADMIN)
scrumRouter.post(
  "/",
  allowedRoles("SCRUM_ADMIN", "SUPER_ADMIN"),
  createScrumValidator,
  createScrum
);

// Scrum details
scrumRouter.get(
  "/:id",
  scrumIdValidator,
  requireScrumAccess("member"),
  getScrumById
);

// Update scrum (owner / SA)
scrumRouter.patch(
  "/:id",
  updateScrumValidator,
  requireScrumAccess("owner"),
  updateScrum
);

// Delete scrum (owner / SA)
scrumRouter.delete(
  "/:id",
  scrumIdValidator,
  requireScrumAccess("owner"),
  deleteScrum
);

// Sync members (owner / SA)
scrumRouter.put(
  "/:id/members",
  updateScrumMembersValidator,
  requireScrumAccess("owner"),
  syncScrumMembers
);

// List sprints of a scrum
scrumRouter.get(
  "/:id/sprints",
  scrumIdValidator,
  requireScrumAccess("member"),
  getSprints
);

// Create sprint in scrum (owner / SA)
scrumRouter.post(
  "/:id/sprints",
  createSprintValidator,
  requireScrumAccess("owner"),
  createSprint
);

// Get KPIs of scrum
scrumRouter.get(
  "/:id/kpis",
  scrumIdValidator,
  requireScrumAccess("member"),
  getKpis
);

// Batch update KPIs (owner / SA)
scrumRouter.put(
  "/:id/kpis",
  batchKpiValidator,
  requireScrumAccess("owner"),
  batchUpdateKpis
);

// Get events / ceremonies of scrum
scrumRouter.get(
  "/:id/events",
  scrumIdValidator,
  requireScrumAccess("member"),
  getEvents
);

// Batch update events / ceremonies (owner / SA)
scrumRouter.put(
  "/:id/events",
  batchEventsValidator,
  requireScrumAccess("owner"),
  batchUpdateEvents
);

// Scrum report
scrumRouter.get(
  "/:id/report",
  scrumReportValidator,
  requireScrumAccess("member"),
  getScrumReport
);

// ==========================================
// 2. Sprints Router (/api/sprints)
// ==========================================
export const sprintRouter = express.Router();
sprintRouter.use(isLogin);

// Get sprint details + sprint projects
sprintRouter.get(
  "/:id",
  sprintIdValidator,
  requireSprintAccess("member"),
  getSprintById
);

// Update sprint metadata (owner / SA)
sprintRouter.patch(
  "/:id",
  updateSprintValidator,
  requireSprintAccess("owner"),
  updateSprint
);

// Update sprint status: PLANNED -> ACTIVE -> COMPLETED (owner / SA)
sprintRouter.patch(
  "/:id/status",
  updateSprintStatusValidator,
  requireSprintAccess("owner"),
  updateSprintStatus
);

// Delete sprint (owner / SA)
sprintRouter.delete(
  "/:id",
  sprintIdValidator,
  requireSprintAccess("owner"),
  deleteSprint
);

// Create sprint project item (owner / SA)
sprintRouter.post(
  "/:id/projects",
  createSprintProjectValidator,
  requireSprintAccess("owner"),
  createSprintProject
);

// ==========================================
// 3. Sprint Projects Router (/api/sprint-projects)
// ==========================================
export const sprintProjectRouter = express.Router();
sprintProjectRouter.use(isLogin);

// Update sprint project item (owner/SA or assignee)
sprintProjectRouter.patch(
  "/:id",
  sprintProjectIdValidator,
  requireSprintProjectAccess,
  updateSprintProjectValidator,
  updateSprintProject
);

// Delete sprint project item (owner / SA)
sprintProjectRouter.delete(
  "/:id",
  sprintProjectIdValidator,
  requireSprintProjectAccess,
  (req, res, next) => {
    if (!req.canEdit) {
      return res.status(403).json({
        success: false,
        message: "شما دسترسی حذف این پروژه اسپرینت را ندارید",
      });
    }
    next();
  },
  deleteSprintProject
);

// ==========================================
// 4. Work Targets Router (/api/work-targets)
// ==========================================
export const workTargetsRouter = express.Router();
workTargetsRouter.use(isLogin);

workTargetsRouter.get("/mine", getWorkTargetsMine);

export default scrumRouter;

