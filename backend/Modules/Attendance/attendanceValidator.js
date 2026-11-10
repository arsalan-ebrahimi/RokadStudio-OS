import { body, param, query, validationResult } from "express-validator";
import { isIsoDateString } from "../../Utils/date.js";

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

const dateValidator = (val) => {
  if (!val) return true;
  if (!isIsoDateString(val)) {
    throw new Error("Date must be in valid YYYY-MM-DD format");
  }
  return true;
};

export const attendanceIdParamValidator = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Attendance ID must be a positive integer")
    .toInt(),
  handleValidation,
];

export const postAttendanceValidator = [
  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn(["PRESENT", "ABSENT"])
    .withMessage("Status must be either PRESENT or ABSENT"),
  body("reason")
    .optional({ nullable: true })
    .isString()
    .withMessage("Reason must be a string")
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot exceed 500 characters"),
  handleValidation,
];

export const getAttendanceMeValidator = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("dateFrom").optional().custom(dateValidator),
  query("dateTo").optional().custom(dateValidator),
  handleValidation,
];

export const getAttendanceAdminValidator = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("date").optional().custom(dateValidator),
  query("dateFrom").optional().custom(dateValidator),
  query("dateTo").optional().custom(dateValidator),
  query("status").optional().isIn(["PRESENT", "ABSENT"]),
  query("approval").optional().isIn(["PENDING", "APPROVED", "REJECTED"]),
  query("source").optional().isIn(["USER", "ADMIN", "SYSTEM"]),
  query("userId").optional().isInt({ min: 1 }).toInt(),
  handleValidation,
];

export const attendanceDecisionValidator = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Attendance ID must be a positive integer")
    .toInt(),
  body("decision")
    .notEmpty()
    .withMessage("Decision is required")
    .isIn(["APPROVED", "REJECTED"])
    .withMessage("Decision must be APPROVED or REJECTED"),
  handleValidation,
];

export const putWorkNoteValidator = [
  body().custom((rawBody) => {
    if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
      throw new Error("بدنه درخواست باید یک آبجکت JSON معتبر باشد");
    }
    const keys = Object.keys(rawBody);
    const extraKeys = keys.filter((k) => k !== "text" && k !== "skipped");
    if (extraKeys.length > 0) {
      throw new Error(`فیلد ناشناخته در درخواست: ${extraKeys.join(", ")}`);
    }

    const hasText = Object.prototype.hasOwnProperty.call(rawBody, "text") && rawBody.text !== undefined;
    const hasSkipped =
      Object.prototype.hasOwnProperty.call(rawBody, "skipped") && rawBody.skipped !== undefined;

    if ((hasText && hasSkipped) || (!hasText && !hasSkipped)) {
      throw new Error("دقیقاً یکی از فیلدهای text یا skipped باید ارسال شود");
    }

    if (hasText) {
      if (typeof rawBody.text !== "string") {
        throw new Error("فیلد text باید از نوع رشته متنی باشد");
      }
      const trimmed = rawBody.text.trim();
      if (trimmed.length < 1 || trimmed.length > 1000) {
        throw new Error("متن یادداشت باید بین ۱ تا ۱۰۰۰ کاراکتر باشد");
      }
    }

    if (hasSkipped) {
      if (rawBody.skipped !== true) {
        throw new Error("فیلد skipped در صورت ارسال باید true باشد");
      }
    }

    return true;
  }),
  handleValidation,
];
