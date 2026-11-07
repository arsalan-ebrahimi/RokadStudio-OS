import express from "express";
import {
  getTodayAttendance,
  postTodayAttendance,
  getMeAttendance,
  getAdminAttendance,
  patchAttendanceDecision,
  unlockUserTimerByAttendance,
  unlockUserTimerByUserId,
} from "./attendanceCn.js";
import {
  postAttendanceValidator,
  getAttendanceMeValidator,
  getAttendanceAdminValidator,
  attendanceDecisionValidator,
  attendanceIdParamValidator,
  userIdParamValidator,
} from "./attendanceValidator.js";
import { isLogin } from "../../Middlewares/isLogin.js";
import { allowedRoles } from "../../Middlewares/allowedRoles.js";

const attendanceRouter = express.Router();

attendanceRouter.use(isLogin);

// User side
attendanceRouter.get("/today", getTodayAttendance);
attendanceRouter.post("/today", postAttendanceValidator, postTodayAttendance);
attendanceRouter.get("/me", getAttendanceMeValidator, getMeAttendance);

// Admin side
attendanceRouter.get(
  "/admin",
  allowedRoles("ADMIN", "SUPER_ADMIN"),
  getAttendanceAdminValidator,
  getAdminAttendance
);

attendanceRouter.patch(
  "/admin/:id/decision",
  allowedRoles("ADMIN", "SUPER_ADMIN"),
  attendanceDecisionValidator,
  patchAttendanceDecision
);

attendanceRouter.post(
  "/admin/:id/unlock-timer",
  allowedRoles("ADMIN", "SUPER_ADMIN"),
  attendanceIdParamValidator,
  unlockUserTimerByAttendance
);

attendanceRouter.post(
  "/admin/user/:userId/unlock-timer",
  allowedRoles("ADMIN", "SUPER_ADMIN"),
  userIdParamValidator,
  unlockUserTimerByUserId
);

export default attendanceRouter;
