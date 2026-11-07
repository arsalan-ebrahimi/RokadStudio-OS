import express from "express";
import {
  postWorkSession,
  getMeWorkSessions,
  getAdminWorkSessions,
  getWorkSessionsSummary,
} from "./workSessionCn.js";
import {
  createWorkSessionValidator,
  getMeWorkSessionsValidator,
  getAdminWorkSessionsValidator,
  getWorkSessionsSummaryValidator,
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

export default workSessionRouter;
