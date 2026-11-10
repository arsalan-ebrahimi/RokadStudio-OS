import express from "express";
import { isLogin } from "../../Middlewares/isLogin.js";
import { allowedRoles } from "../../Middlewares/allowedRoles.js";
import { scrumWriteRateLimiter } from "../../Middlewares/rateLimit.js";
import {
  requireNonAttendanceAdmin,
  requireScrumAccess,
  requireSprintAccess,
  requireSprintProjectAccess,
} from "./scrumAccess.js";
import {
  scrumIdValidator,
  scrumAndProjectIdValidator,
  sprintIdValidator,
  sprintProjectIdValidator,
  createScrumValidator,
  updateScrumAdminsBodyValidator,
  updateScrumBodyValidator,
  updateScrumMembersBodyValidator,
  createSprintBodyValidator,
  updateSprintBodyValidator,
  updateSprintStatusBodyValidator,
  createSprintProjectBodyValidator,
  updateSprintProjectBodyValidator,
  batchKpiBodyValidator,
  batchEventsBodyValidator,
  scrumReportQueryValidator,
  createScrumProjectBodyValidator,
  availableScrumProjectsQueryValidator,
  linkScrumProjectBodyValidator,
  updateScrumProjectMembersBodyValidator,
  scrumLeaderboardQueryValidator,
} from "./scrumValidator.js";
import {
  getScrums,
  createScrum,
  getScrumById,
  syncScrumAdmins,
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
  listScrumProjects,
  createScrumProject,
  getAvailableScrumProjects,
  linkProjectToScrum,
  unlinkProjectFromScrum,
  syncScrumProjectMembers,
  getScrumLeaderboard,
  getScrumAdminDashboard,
} from "./scrumCn.js";

// ==========================================
// 1. Scrums Router (/api/scrums)
// ==========================================
export const scrumRouter = express.Router();
scrumRouter.use(isLogin, requireNonAttendanceAdmin);

// Special root helper: today's events for current user
// MUST be declared BEFORE /:id to avoid param capture
scrumRouter.get("/today-events", getTodayEvents);

// List scrums for current user
scrumRouter.get("/", getScrums);

// Create scrum (SUPER_ADMIN only)
scrumRouter.post(
  "/",
  allowedRoles("SUPER_ADMIN"),
  scrumWriteRateLimiter,
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

// Update scrum (assigned SCRUM_ADMIN / SUPER_ADMIN; isActive change restricted to SUPER_ADMIN in service)
scrumRouter.patch(
  "/:id",
  scrumWriteRateLimiter,
  scrumIdValidator,
  requireScrumAccess("editor"),
  updateScrumBodyValidator,
  updateScrum
);

// Delete scrum (SUPER_ADMIN only)
scrumRouter.delete(
  "/:id",
  scrumWriteRateLimiter,
  scrumIdValidator,
  requireScrumAccess("super_admin"),
  deleteScrum
);

// Sync assigned Scrum admins (SUPER_ADMIN only)
scrumRouter.put(
  "/:id/admins",
  scrumWriteRateLimiter,
  scrumIdValidator,
  requireScrumAccess("super_admin"),
  updateScrumAdminsBodyValidator,
  syncScrumAdmins
);

// Sync members (editor / SA)
scrumRouter.put(
  "/:id/members",
  scrumWriteRateLimiter,
  scrumIdValidator,
  requireScrumAccess("editor"),
  updateScrumMembersBodyValidator,
  syncScrumMembers
);

// Linked studio projects under scrum
scrumRouter.get(
  "/:id/projects/available",
  scrumIdValidator,
  requireScrumAccess("editor"),
  availableScrumProjectsQueryValidator,
  getAvailableScrumProjects
);

scrumRouter.post(
  "/:id/projects/link",
  scrumWriteRateLimiter,
  scrumIdValidator,
  requireScrumAccess("editor"),
  linkScrumProjectBodyValidator,
  linkProjectToScrum
);

scrumRouter.get(
  "/:id/projects",
  scrumIdValidator,
  requireScrumAccess("member"),
  listScrumProjects
);

scrumRouter.post(
  "/:id/projects",
  scrumWriteRateLimiter,
  scrumIdValidator,
  requireScrumAccess("editor"),
  createScrumProjectBodyValidator,
  createScrumProject
);

scrumRouter.delete(
  "/:id/projects/:projectId/link",
  scrumWriteRateLimiter,
  scrumAndProjectIdValidator,
  requireScrumAccess("editor"),
  unlinkProjectFromScrum
);

scrumRouter.put(
  "/:id/projects/:projectId/members",
  scrumWriteRateLimiter,
  scrumAndProjectIdValidator,
  requireScrumAccess("editor"),
  updateScrumProjectMembersBodyValidator,
  syncScrumProjectMembers
);

// List sprints of a scrum
scrumRouter.get(
  "/:id/sprints",
  scrumIdValidator,
  requireScrumAccess("member"),
  getSprints
);

// Create sprint in scrum (editor / SA)
scrumRouter.post(
  "/:id/sprints",
  scrumWriteRateLimiter,
  scrumIdValidator,
  requireScrumAccess("editor"),
  createSprintBodyValidator,
  createSprint
);

// Get KPIs of scrum
scrumRouter.get(
  "/:id/kpis",
  scrumIdValidator,
  requireScrumAccess("member"),
  getKpis
);

// Batch update KPIs (editor / SA)
scrumRouter.put(
  "/:id/kpis",
  scrumWriteRateLimiter,
  scrumIdValidator,
  requireScrumAccess("editor"),
  batchKpiBodyValidator,
  batchUpdateKpis
);

// Get events / ceremonies of scrum
scrumRouter.get(
  "/:id/events",
  scrumIdValidator,
  requireScrumAccess("member"),
  getEvents
);

// Batch update events / ceremonies (editor / SA)
scrumRouter.put(
  "/:id/events",
  scrumWriteRateLimiter,
  scrumIdValidator,
  requireScrumAccess("editor"),
  batchEventsBodyValidator,
  batchUpdateEvents
);

// Scrum report
scrumRouter.get(
  "/:id/report",
  scrumIdValidator,
  requireScrumAccess("member"),
  scrumReportQueryValidator,
  getScrumReport
);

// Scrum leaderboard (single grouped query, APPROVED sessions only)
scrumRouter.get(
  "/:id/leaderboard",
  scrumIdValidator,
  requireScrumAccess("member"),
  scrumLeaderboardQueryValidator,
  getScrumLeaderboard
);

// ==========================================
// 2. Sprints Router (/api/sprints)
// ==========================================
export const sprintRouter = express.Router();
sprintRouter.use(isLogin, requireNonAttendanceAdmin);

// Get sprint details + sprint projects
sprintRouter.get(
  "/:id",
  sprintIdValidator,
  requireSprintAccess("member"),
  getSprintById
);

// Update sprint metadata (editor / SA)
sprintRouter.patch(
  "/:id",
  scrumWriteRateLimiter,
  sprintIdValidator,
  requireSprintAccess("editor"),
  updateSprintBodyValidator,
  updateSprint
);

// Update sprint status: PLANNED -> ACTIVE -> COMPLETED (editor / SA)
sprintRouter.patch(
  "/:id/status",
  scrumWriteRateLimiter,
  sprintIdValidator,
  requireSprintAccess("editor"),
  updateSprintStatusBodyValidator,
  updateSprintStatus
);

// Delete sprint (editor / SA)
sprintRouter.delete(
  "/:id",
  scrumWriteRateLimiter,
  sprintIdValidator,
  requireSprintAccess("editor"),
  deleteSprint
);

// Create sprint project item (editor / SA)
sprintRouter.post(
  "/:id/projects",
  scrumWriteRateLimiter,
  sprintIdValidator,
  requireSprintAccess("editor"),
  createSprintProjectBodyValidator,
  createSprintProject
);

// ==========================================
// 3. Sprint Projects Router (/api/sprint-projects)
// ==========================================
export const sprintProjectRouter = express.Router();
sprintProjectRouter.use(isLogin, requireNonAttendanceAdmin);

// Update sprint project item (editor/SA or assignee)
sprintProjectRouter.patch(
  "/:id",
  scrumWriteRateLimiter,
  sprintProjectIdValidator,
  requireSprintProjectAccess("update"),
  updateSprintProjectBodyValidator,
  updateSprintProject
);

// Delete sprint project item (editor / SA)
sprintProjectRouter.delete(
  "/:id",
  scrumWriteRateLimiter,
  sprintProjectIdValidator,
  requireSprintProjectAccess("editor"),
  deleteSprintProject
);

// ==========================================
// 4. Work Targets Router (/api/work-targets)
// ==========================================
export const workTargetsRouter = express.Router();
workTargetsRouter.use(isLogin);

workTargetsRouter.get("/mine", getWorkTargetsMine);

// ==========================================
// 5. Scrum Admin Router (/api/scrum-admin)
// ==========================================
export const scrumAdminRouter = express.Router();
scrumAdminRouter.use(isLogin, allowedRoles("SCRUM_ADMIN", "SUPER_ADMIN"));

scrumAdminRouter.get("/dashboard", getScrumAdminDashboard);

export default scrumRouter;
