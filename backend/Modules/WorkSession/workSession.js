import express from "express";
import {
  postWorkSession,
  getMeWorkSessions,
  getAdminWorkSessions,
  getWorkSessionsSummary,
  patchWorkSessionDecision,
  deleteWorkSessionController,
} from "./workSessionCn.js";
import {
  createWorkSessionValidator,
  getMeWorkSessionsValidator,
  getAdminWorkSessionsValidator,
  getWorkSessionsSummaryValidator,
  decideWorkSessionValidator,
  deleteWorkSessionValidator,
} from "./workSessionValidator.js";
import { isLogin } from "../../Middlewares/isLogin.js";
import { allowedRoles } from "../../Middlewares/allowedRoles.js";
import { workSessionRateLimiter } from "../../Middlewares/rateLimit.js";

const workSessionRouter = express.Router();

workSessionRouter.use(isLogin);

// Post work session (any logged-in user, rate limited)
workSessionRouter.post(
  "/",
  workSessionRateLimiter,
  createWorkSessionValidator,
  postWorkSession
);

// Get own sessions (any logged-in user)
workSessionRouter.get("/me", getMeWorkSessionsValidator, getMeWorkSessions);

// Summary aggregation for admins (registered before root GET /)
workSessionRouter.get(
  "/summary",
  allowedRoles("ADMIN", "SUPER_ADMIN"),
  getWorkSessionsSummaryValidator,
  getWorkSessionsSummary
);

// All work sessions list for admins
workSessionRouter.get(
  "/",
  allowedRoles("ADMIN", "SUPER_ADMIN"),
  getAdminWorkSessionsValidator,
  getAdminWorkSessions
);

// Decision endpoint: approve or reject session (admins)
workSessionRouter.patch(
  "/:id/decision",
  allowedRoles("ADMIN", "SUPER_ADMIN"),
  decideWorkSessionValidator,
  patchWorkSessionDecision
);

// Delete session endpoint
workSessionRouter.delete(
  "/:id",
  deleteWorkSessionValidator,
  deleteWorkSessionController
);

export default workSessionRouter;
