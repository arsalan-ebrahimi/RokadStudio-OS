import { param, query, validationResult } from "express-validator";
import { isIsoDateString, toDateOnly } from "../../Utils/date.js";

const INT32_MAX = 2147483647;
const MAX_CALENDAR_DAYS = 62;

export const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorList = errors.array();
    return res.status(400).json({
      success: false,
      message: errorList[0].msg,
      errors: errorList.map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  next();
};

const rejectUnknownQueryMiddleware = (allowedKeys) => {
  const allowedSet = new Set(allowedKeys);
  return (req, res, next) => {
    const unknown = Object.keys(req.query || {}).filter((k) => !allowedSet.has(k));
    if (unknown.length > 0) {
      return res.status(400).json({
        success: false,
        message: `پارامتر جستجوی نامعتبر: ${unknown[0]}`,
        errors: unknown.map((k) => ({
          field: k,
          message: `پارامتر جستجوی نامعتبر: ${k}`,
        })),
      });
    }
    next();
  };
};

const memberUserIdParam = param("userId").custom((val) => {
  if (val === "me") return true;
  if (typeof val === "string" && /^\d+$/.test(val)) {
    const n = Number(val);
    if (Number.isInteger(n) && n >= 1 && n <= INT32_MAX) {
      return true;
    }
  }
  throw new Error("شناسه کاربر باید me یا عدد صحیح مثبت باشد");
});

const optionalDateQuery = (field, { required = false } = {}) => {
  const chain = query(field);
  const configured = required
    ? chain.notEmpty().withMessage(`فیلد ${field} الزامی است`)
    : chain.optional();
  return configured.custom((val) => {
    if (!required && (val === undefined || val === null || val === "")) return true;
    if (typeof val !== "string" || !isIsoDateString(val)) {
      throw new Error(`فیلد ${field} باید تاریخ معتبر با فرمت YYYY-MM-DD باشد`);
    }
    return true;
  });
};

export const memberProfileValidator = [
  memberUserIdParam,
  rejectUnknownQueryMiddleware(["scrumId"]),
  query("scrumId")
    .optional()
    .isInt({ min: 1, max: INT32_MAX })
    .withMessage("شناسه اسکرام باید یک عدد صحیح مثبت باشد")
    .toInt(),
  handleValidation,
];

export const memberCalendarValidator = [
  memberUserIdParam,
  rejectUnknownQueryMiddleware(["from", "to", "scrumId"]),
  optionalDateQuery("from", { required: true }),
  optionalDateQuery("to", { required: true }),
  query("scrumId")
    .optional()
    .isInt({ min: 1, max: INT32_MAX })
    .withMessage("شناسه اسکرام باید یک عدد صحیح مثبت باشد")
    .toInt(),
  query().custom((_, { req }) => {
    const { from, to } = req.query || {};
    if (isIsoDateString(from) && isIsoDateString(to)) {
      const fromTime = toDateOnly(from).getTime();
      const toTime = toDateOnly(to).getTime();
      if (fromTime > toTime) {
        throw new Error("تاریخ شروع (from) نمی‌تواند بعد از تاریخ پایان (to) باشد");
      }
      const daySpan = Math.floor((toTime - fromTime) / 86400000) + 1;
      if (daySpan > MAX_CALENDAR_DAYS) {
        throw new Error(`حداکثر بازه مجاز تقویم ${MAX_CALENDAR_DAYS} روز است`);
      }
    }
    return true;
  }),
  handleValidation,
];

export const memberDayValidator = [
  memberUserIdParam,
  rejectUnknownQueryMiddleware(["date", "scrumId"]),
  optionalDateQuery("date", { required: true }),
  query("scrumId")
    .optional()
    .isInt({ min: 1, max: INT32_MAX })
    .withMessage("شناسه اسکرام باید یک عدد صحیح مثبت باشد")
    .toInt(),
  handleValidation,
];

export const memberWorkValidator = [
  memberUserIdParam,
  rejectUnknownQueryMiddleware([
    "from",
    "to",
    "scrumId",
    "sprintId",
    "projectId",
    "approval",
    "page",
    "limit",
  ]),
  optionalDateQuery("from"),
  optionalDateQuery("to"),
  query("scrumId")
    .optional()
    .isInt({ min: 1, max: INT32_MAX })
    .withMessage("شناسه اسکرام باید یک عدد صحیح مثبت باشد")
    .toInt(),
  query("sprintId")
    .optional()
    .isInt({ min: 1, max: INT32_MAX })
    .withMessage("شناسه اسپرینت باید یک عدد صحیح مثبت باشد")
    .toInt(),
  query("projectId")
    .optional()
    .isInt({ min: 1, max: INT32_MAX })
    .withMessage("شناسه پروژه باید یک عدد صحیح مثبت باشد")
    .toInt(),
  query("approval")
    .optional()
    .isIn(["ALL", "PENDING", "APPROVED", "REJECTED"])
    .withMessage("وضعیت تایید باید ALL، PENDING، APPROVED یا REJECTED باشد"),
  query("page").optional().isInt({ min: 1, max: INT32_MAX }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query().custom((_, { req }) => {
    const { from, to } = req.query || {};
    if (
      typeof from === "string" &&
      typeof to === "string" &&
      from !== "" &&
      to !== "" &&
      isIsoDateString(from) &&
      isIsoDateString(to) &&
      toDateOnly(from).getTime() > toDateOnly(to).getTime()
    ) {
      throw new Error("تاریخ شروع (from) نمی‌تواند بعد از تاریخ پایان (to) باشد");
    }
    return true;
  }),
  handleValidation,
];

