import { body, query, param, validationResult } from "express-validator";
import { isIsoDateString } from "../../Utils/date.js";

export const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorList = errors.array();
    const isExactlyOneError = errorList.some(
      (err) => err.msg && err.msg.includes("باید دقیقاً یکی از projectId یا sprintProjectId ارسال شود")
    );
    const statusCode = isExactlyOneError ? 422 : 400;
    return res.status(statusCode).json({
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

export const MAX_SESSION_SECONDS = parseInt(
  process.env.MAX_SESSION_SECONDS || "86400",
  10
);

export const createWorkSessionValidator = [
  body().custom((_, { req }) => {
    const hasProject = req.body.projectId !== undefined && req.body.projectId !== null && req.body.projectId !== "";
    const hasSprintProject = req.body.sprintProjectId !== undefined && req.body.sprintProjectId !== null && req.body.sprintProjectId !== "";

    if ((hasProject && hasSprintProject) || (!hasProject && !hasSprintProject)) {
      throw new Error("باید دقیقاً یکی از projectId یا sprintProjectId ارسال شود");
    }
    return true;
  }),
  body("projectId")
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage("projectId must be a positive integer")
    .toInt(),
  body("sprintProjectId")
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage("sprintProjectId must be a positive integer")
    .toInt(),
  body("durationSeconds")
    .notEmpty()
    .withMessage("durationSeconds is required")
    .custom((val) => {
      // Must be an exact integer number, reject floats and non-numbers
      if (typeof val !== "number" || !Number.isInteger(val)) {
        throw new Error("durationSeconds must be an integer");
      }
      if (val < 1 || val > MAX_SESSION_SECONDS) {
        throw new Error(`durationSeconds must be between 1 and ${MAX_SESSION_SECONDS}`);
      }
      return true;
    }),
  body("startedAt")
    .notEmpty()
    .withMessage("startedAt is required")
    .isISO8601()
    .withMessage("startedAt must be a valid ISO timestamp")
    .custom((val) => {
      const startedTime = new Date(val).getTime();
      if (isNaN(startedTime)) {
        throw new Error("startedAt is not a valid date");
      }
      const now = Date.now();
      const maxFuture = now + 15 * 60 * 1000;
      const minPast = now - 2 * 24 * 60 * 60 * 1000;
      if (startedTime > maxFuture) {
        throw new Error("startedAt cannot be in the future");
      }
      if (startedTime < minPast) {
        throw new Error("startedAt cannot be older than 2 days");
      }
      return true;
    }),
  body("clientRequestId")
    .notEmpty()
    .withMessage("clientRequestId is required")
    .isUUID()
    .withMessage("clientRequestId must be a valid UUID"),
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
  query("approval").optional().isIn(["PENDING", "APPROVED", "REJECTED"]).withMessage("approval must be PENDING, APPROVED, or REJECTED"),
  query("date").optional().custom(dateValidator),
  query("dateFrom").optional().custom(dateValidator),
  query("dateTo").optional().custom(dateValidator),
  handleValidation,
];

export const getWorkSessionsSummaryValidator = [
  query("userId").optional().isInt({ min: 1 }).toInt(),
  query("projectId").optional().isInt({ min: 1 }).toInt(),
  query("approval").optional().isIn(["PENDING", "APPROVED", "REJECTED"]).withMessage("approval must be PENDING, APPROVED, or REJECTED"),
  query("date").optional().custom(dateValidator),
  query("dateFrom").optional().custom(dateValidator),
  query("dateTo").optional().custom(dateValidator),
  query("groupBy")
    .optional()
    .isIn(["user", "project", "user_project"])
    .withMessage("groupBy must be user, project, or user_project"),
  handleValidation,
];

export const decideWorkSessionValidator = [
  param("id").isInt({ min: 1 }).toInt().withMessage("id must be a positive integer"),
  body("decision")
    .isIn(["APPROVED", "REJECTED"])
    .withMessage("decision must be either APPROVED or REJECTED"),
  handleValidation,
];

export const deleteWorkSessionValidator = [
  param("id").isInt({ min: 1 }).toInt().withMessage("id must be a positive integer"),
  handleValidation,
];
