import express from "express";
import {
  getTodayAttendance,
  postTodayAttendance,
  getMeAttendance,
  getAdminAttendance,
  patchAttendanceDecision,
} from "./attendanceCn.js";
import {
  postAttendanceValidator,
  getAttendanceMeValidator,
  getAttendanceAdminValidator,
  attendanceDecisionValidator,
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
  allowedRoles("ADMIN", "SUPER_ADMIN", "SCRUM_ADMIN"),
  getAttendanceAdminValidator,
  getAdminAttendance
);

attendanceRouter.patch(
  "/admin/:id/decision",
  allowedRoles("ADMIN", "SUPER_ADMIN", "SCRUM_ADMIN"),
  attendanceDecisionValidator,
  patchAttendanceDecision
);

export default attendanceRouter;
