import express from "express";
import { isLogin } from "../../Middlewares/isLogin.js";
import {
  getMemberCalendar,
  getMemberDay,
  getMemberProfile,
  getMemberWork,
} from "./memberCn.js";
import {
  memberCalendarValidator,
  memberDayValidator,
  memberProfileValidator,
  memberWorkValidator,
} from "./memberValidator.js";

const memberRouter = express.Router();

memberRouter.use(isLogin);

memberRouter.get("/:userId/profile", memberProfileValidator, getMemberProfile);
memberRouter.get("/:userId/calendar", memberCalendarValidator, getMemberCalendar);
memberRouter.get("/:userId/day", memberDayValidator, getMemberDay);
memberRouter.get("/:userId/work", memberWorkValidator, getMemberWork);

export default memberRouter;

