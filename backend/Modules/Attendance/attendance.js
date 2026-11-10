import express from "express";
import {
  getTodayAttendance,
  postTodayAttendance,
  putTodayWorkNote,
  getMeAttendance,
  getAdminAttendance,
  getAttendanceImpact,
  patchAttendanceDecision,
} from "./attendanceCn.js";
import {
  attendanceIdParamValidator,
  postAttendanceValidator,
  putWorkNoteValidator,
  getAttendanceMeValidator,
  getAttendanceAdminValidator,
  attendanceDecisionValidator,
} from "./attendanceValidator.js";
import { isLogin } from "../../Middlewares/isLogin.js";
import { allowedRoles } from "../../Middlewares/allowedRoles.js";
import { scrumWriteRateLimiter } from "../../Middlewares/rateLimit.js";

const attendanceRouter = express.Router();

attendanceRouter.use(isLogin);

// User side
attendanceRouter.get("/today", getTodayAttendance);
attendanceRouter.post("/today", postAttendanceValidator, postTodayAttendance);
attendanceRouter.put(
  "/today/work-note",
  scrumWriteRateLimiter,
  putWorkNoteValidator,
  putTodayWorkNote
);
attendanceRouter.get("/me", getAttendanceMeValidator, getMeAttendance);

// Admin side
attendanceRouter.get(
  "/admin",
  allowedRoles("ADMIN", "SUPER_ADMIN", "SCRUM_ADMIN"),
  getAttendanceAdminValidator,
  getAdminAttendance
);

attendanceRouter.get(
  "/admin/:id/impact",
  allowedRoles("ADMIN", "SUPER_ADMIN"),
  attendanceIdParamValidator,
  getAttendanceImpact
);

attendanceRouter.patch(
  "/admin/:id/decision",
  allowedRoles("ADMIN", "SUPER_ADMIN", "SCRUM_ADMIN"),
  attendanceDecisionValidator,
  patchAttendanceDecision
);

export default attendanceRouter;
