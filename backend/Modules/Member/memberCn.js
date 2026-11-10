import { catchAsync } from "vanta-api";
import {
  getMemberCalendarService,
  getMemberDayService,
  getMemberProfileService,
  getMemberWorkService,
} from "./memberService.js";

export const getMemberProfile = catchAsync(async (req, res) => {
  const data = await getMemberProfileService(req.user, req.params.userId, req.query);
  return res.status(200).json({
    success: true,
    message: "پروفایل عضو با موفقیت دریافت شد",
    data,
  });
});

export const getMemberCalendar = catchAsync(async (req, res) => {
  const data = await getMemberCalendarService(req.user, req.params.userId, req.query);
  return res.status(200).json({
    success: true,
    message: "تقویم حضور و کارکرد با موفقیت دریافت شد",
    data,
  });
});

export const getMemberDay = catchAsync(async (req, res) => {
  const data = await getMemberDayService(req.user, req.params.userId, req.query);
  return res.status(200).json({
    success: true,
    message: "جزئیات کارکرد روزانه با موفقیت دریافت شد",
    data,
  });
});

export const getMemberWork = catchAsync(async (req, res) => {
  const data = await getMemberWorkService(req.user, req.params.userId, req.query);
  return res.status(200).json({
    success: true,
    message: "گزارش کارکرد عضو با موفقیت دریافت شد",
    data,
  });
});

