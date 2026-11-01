import { body, query, validationResult } from "express-validator";
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

export const createWorkSessionValidator = [
  body("projectId")
    .notEmpty()
    .withMessage("projectId is required")
    .isInt({ min: 1 })
    .withMessage("projectId must be a positive integer")
    .toInt(),
  body("durationSeconds")
    .notEmpty()
    .withMessage("durationSeconds is required")
    .custom((val) => {
      // Must be an exact integer number, reject floats and non-numbers
      if (typeof val !== "number" || !Number.isInteger(val)) {
        throw new Error("durationSeconds must be an integer");
      }
      const maxSeconds = parseInt(process.env.SESSION_MAX_SECONDS || "1500", 10);
      if (val < 1 || val > maxSeconds) {
        throw new Error(`durationSeconds must be between 1 and ${maxSeconds}`);
      }
      return true;
    }),
  handleValidation,
];

export const getMeWorkSessionsValidator = [
  query("date").optional().custom(dateValidator),
  query("dateFrom").optional().custom(dateValidator),
  query("dateTo").optional().custom(dateValidator),
  handleValidation,
];

export const getAdminWorkSessionsValidator = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("userId").optional().isInt({ min: 1 }).toInt(),
  query("projectId").optional().isInt({ min: 1 }).toInt(),
  query("date").optional().custom(dateValidator),
  query("dateFrom").optional().custom(dateValidator),
  query("dateTo").optional().custom(dateValidator),
  handleValidation,
];

export const getWorkSessionsSummaryValidator = [
  query("userId").optional().isInt({ min: 1 }).toInt(),
  query("projectId").optional().isInt({ min: 1 }).toInt(),
  query("date").optional().custom(dateValidator),
  query("dateFrom").optional().custom(dateValidator),
  query("dateTo").optional().custom(dateValidator),
  query("groupBy")
    .optional()
    .isIn(["user", "project", "user_project"])
    .withMessage("groupBy must be user, project, or user_project"),
  handleValidation,
];
