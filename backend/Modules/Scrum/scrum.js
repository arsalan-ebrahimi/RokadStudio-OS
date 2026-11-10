import express from "express";
import { isLogin } from "../../Middlewares/isLogin.js";
import { allowedRoles } from "../../Middlewares/allowedRoles.js";
import { scrumWriteRateLimiter } from "../../Middlewares/rateLimit.js";
import {
  requireScrumAccess,
  requireSprintAccess,
  requireTaskAccess,
} from "./scrumAccess.js";
import {
  scrumIdValidator,
  sprintIdValidator,
  taskIdValidator,
  scrumAndUserIdParamsValidator,
  scrumIncludeAttendanceQueryValidator,
  createScrumValidator,
  addScrumAdminBodyValidator,
  removeScrumAdminQueryValidator,
  updateScrumAdminMembershipBodyValidator,
  updateScrumBodyValidator,
  updateScrumMembersBodyValidator,
  updateScrumMemberPerformanceBodyValidator,
  createSprintBodyValidator,
  updateSprintBodyValidator,
  updateSprintStatusBodyValidator,
  listScrumTasksQueryValidator,
  myTasksQueryValidator,
  createTaskBodyValidator,
  updateTaskBodyValidator,
  updateTaskMembersBodyValidator,
  taskWorkSessionsQueryValidator,
  batchKpiBodyValidator,
  batchEventsBodyValidator,
  scrumReportQueryValidator,
  scrumLeaderboardQueryValidator,
} from "./scrumValidator.js";
import {
  getScrums,
  createScrum,
  getScrumById,
  getScrumMembers,
  addScrumAdmin,
  removeScrumAdmin,
  updateScrumAdminMembership,
  updateScrum,
  deleteScrum,
  syncScrumMembers,
  updateScrumMemberPerformance,
  getSprints,
  createSprint,
  getSprintById,
  updateSprint,
  updateSprintStatus,
  deleteSprint,
  listScrumTasks,
  getMyTasks,
  createScrumTask,
  getTaskById,
  updateScrumTask,
  syncTaskMembers,
  deleteScrumTask,
  getTaskWorkSessions,
  getKpis,
  batchUpdateKpis,
  getEvents,
  batchUpdateEvents,
  getTodayEvents,
  getWorkTargetsMine,
  getScrumReport,
  getScrumLeaderboard,
  getScrumAdminDashboard,
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
  scrumIncludeAttendanceQueryValidator,
  requireScrumAccess("member"),
  getScrumById
);

// Scrum members (optional include=attendanceTotals for admin viewers)
scrumRouter.get(
  "/:id/members",
  scrumIdValidator,
  scrumIncludeAttendanceQueryValidator,
  requireScrumAccess("member"),
  getScrumMembers
);

// Update scrum (assigned SCRUM_ADMIN / ADMIN / SUPER_ADMIN; isActive change restricted to SUPER_ADMIN in service)
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

// Assign Scrum admin with "also a member?" choice (SUPER_ADMIN only)
scrumRouter.post(
  "/:id/admins",
  scrumWriteRateLimiter,
  scrumIdValidator,
  requireScrumAccess("super_admin"),
  addScrumAdminBodyValidator,
  addScrumAdmin
);

// Remove Scrum admin with optional/required keepMembership flag (SUPER_ADMIN only)
scrumRouter.delete(
  "/:id/admins/:userId",
  scrumWriteRateLimiter,
  scrumAndUserIdParamsValidator,
  removeScrumAdminQueryValidator,
  requireScrumAccess("super_admin"),
  removeScrumAdmin
);

// Toggle membership for an existing Scrum admin (SUPER_ADMIN only)
scrumRouter.put(
  "/:id/admins/:userId/membership",
  scrumWriteRateLimiter,
  scrumAndUserIdParamsValidator,
  requireScrumAccess("super_admin"),
  updateScrumAdminMembershipBodyValidator,
  updateScrumAdminMembership
);

// Sync members (editor / SA; preserves existing ScrumAdmins, rejects ADMIN-role additions)
scrumRouter.put(
  "/:id/members",
  scrumWriteRateLimiter,
  scrumIdValidator,
  requireScrumAccess("editor"),
  updateScrumMembersBodyValidator,
  syncScrumMembers
);

// Set Scrum-level performance status for a Scrum member (editor / SA; self rejected 403)
scrumRouter.put(
  "/:id/members/:userId/performance",
  scrumWriteRateLimiter,
  scrumAndUserIdParamsValidator,
  requireScrumAccess("editor"),
  updateScrumMemberPerformanceBodyValidator,
  updateScrumMemberPerformance
);

// Tasks under scrum
scrumRouter.get(
  "/:id/tasks",
  scrumIdValidator,
  requireScrumAccess("member"),
  listScrumTasksQueryValidator,
  listScrumTasks
);

scrumRouter.post(
  "/:id/tasks",
  scrumWriteRateLimiter,
  scrumIdValidator,
  requireScrumAccess("editor"),
  createTaskBodyValidator,
  createScrumTask
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

// Scrum report (assigned SCRUM_ADMIN / SUPER_ADMIN only)
scrumRouter.get(
  "/:id/report",
  scrumIdValidator,
  requireScrumAccess("editor"),
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
sprintRouter.use(isLogin);

// Get sprint details (simplified Sprint metadata, status & manual progressPercent)
sprintRouter.get(
  "/:id",
  sprintIdValidator,
  requireSprintAccess("member"),
  getSprintById
);

// Update sprint metadata / manual progressPercent (editor / SA)
sprintRouter.patch(
  "/:id",
  scrumWriteRateLimiter,
  sprintIdValidator,
  requireSprintAccess("editor"),
  updateSprintBodyValidator,
  updateSprint
);

// Update sprint phase: bidirectional PLANNED <-> ACTIVE <-> COMPLETED (editor / SA)
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

// ==========================================
// 3. Tasks Router (/api/tasks)
// ==========================================
export const taskRouter = express.Router();
taskRouter.use(isLogin);

// MUST be declared BEFORE /:id to avoid param capture
taskRouter.get("/mine", myTasksQueryValidator, getMyTasks);

taskRouter.get(
  "/:id/work-sessions",
  taskIdValidator,
  requireTaskAccess("member"),
  taskWorkSessionsQueryValidator,
  getTaskWorkSessions
);

taskRouter.get(
  "/:id",
  taskIdValidator,
  requireTaskAccess("member"),
  getTaskById
);

taskRouter.patch(
  "/:id",
  scrumWriteRateLimiter,
  taskIdValidator,
  requireTaskAccess("editor"),
  updateTaskBodyValidator,
  updateScrumTask
);

taskRouter.put(
  "/:id/members",
  scrumWriteRateLimiter,
  taskIdValidator,
  requireTaskAccess("editor"),
  updateTaskMembersBodyValidator,
  syncTaskMembers
);

taskRouter.delete(
  "/:id",
  scrumWriteRateLimiter,
  taskIdValidator,
  requireTaskAccess("editor"),
  deleteScrumTask
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
scrumAdminRouter.use(isLogin, allowedRoles("ADMIN", "SCRUM_ADMIN", "SUPER_ADMIN"));

scrumAdminRouter.get("/dashboard", getScrumAdminDashboard);

export default scrumRouter;
