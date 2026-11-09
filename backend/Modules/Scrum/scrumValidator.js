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

export const scrumIdValidator = [
  param("id").isInt({ min: 1 }).withMessage("Scrum ID must be a positive integer").toInt(),
  handleValidation,
];

export const sprintIdValidator = [
  param("id").isInt({ min: 1 }).withMessage("Sprint ID must be a positive integer").toInt(),
  handleValidation,
];

export const sprintProjectIdValidator = [
  param("id").isInt({ min: 1 }).withMessage("Sprint Project ID must be a positive integer").toInt(),
  handleValidation,
];

export const createScrumValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Scrum name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Scrum name must be between 2 and 100 characters"),
  body("description").optional().trim(),
  body("color")
    .optional()
    .isIn(["ECOSYSTEM", "MALE", "FEMALE", "COLLEGE", "CLUB"])
    .withMessage("Invalid color option"),
  body("ownerId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("ownerId must be a positive integer")
    .toInt(),
  handleValidation,
];

export const updateScrumValidator = [
  param("id").isInt({ min: 1 }).withMessage("Scrum ID must be a positive integer").toInt(),
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Scrum name must be between 2 and 100 characters"),
  body("description").optional().trim(),
  body("color")
    .optional()
    .isIn(["ECOSYSTEM", "MALE", "FEMALE", "COLLEGE", "CLUB"])
    .withMessage("Invalid color option"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean")
    .toBoolean(),
  handleValidation,
];

export const updateScrumMembersValidator = [
  param("id").isInt({ min: 1 }).withMessage("Scrum ID must be a positive integer").toInt(),
  body("members")
    .isArray()
    .withMessage("members must be an array"),
  body("members.*.userId")
    .isInt({ min: 1 })
    .withMessage("Each member must have a valid userId"),
  body("members.*.label")
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 50 })
    .withMessage("Label cannot exceed 50 characters"),
  handleValidation,
];

export const createSprintValidator = [
  param("id").isInt({ min: 1 }).withMessage("Scrum ID must be a positive integer").toInt(),
  body("title")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Title must be between 1 and 100 characters"),
  body("description").optional().trim(),
  body("startDate").optional({ nullable: true }).custom(dateValidator),
  body("endDate").optional({ nullable: true }).custom(dateValidator),
  handleValidation,
];

export const updateSprintValidator = [
  param("id").isInt({ min: 1 }).withMessage("Sprint ID must be a positive integer").toInt(),
  body("title")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Title must be between 1 and 100 characters"),
  body("description").optional().trim(),
  body("startDate").optional({ nullable: true }).custom(dateValidator),
  body("endDate").optional({ nullable: true }).custom(dateValidator),
  handleValidation,
];

export const updateSprintStatusValidator = [
  param("id").isInt({ min: 1 }).withMessage("Sprint ID must be a positive integer").toInt(),
  body("status")
    .isIn(["PLANNED", "ACTIVE", "COMPLETED"])
    .withMessage("Status must be PLANNED, ACTIVE, or COMPLETED"),
  handleValidation,
];

export const createSprintProjectValidator = [
  param("id").isInt({ min: 1 }).withMessage("Sprint ID must be a positive integer").toInt(),
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Project name is required")
    .isLength({ min: 1, max: 150 })
    .withMessage("Project name must be between 1 and 150 characters"),
  body("points")
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage("Points must be an integer between 0 and 100")
    .toInt(),
  body("assigneeId")
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage("assigneeId must be a positive integer")
    .toInt(),
  handleValidation,
];

export const updateSprintProjectValidator = [
  param("id").isInt({ min: 1 }).withMessage("Sprint Project ID must be a positive integer").toInt(),
  body("name")
    .optional()
    .trim()
    .isLength({ min: 1, max: 150 })
    .withMessage("Project name must be between 1 and 150 characters"),
  body("points")
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage("Points must be an integer between 0 and 100")
    .toInt(),
  body("assigneeId")
    .optional({ nullable: true })
    .custom((val) => {
      if (val === null || val === undefined || val === "") return true;
      if (!Number.isInteger(Number(val)) || Number(val) <= 0) {
        throw new Error("assigneeId must be a positive integer or null");
      }
      return true;
    }),
  body("status")
    .optional()
    .isIn(["TODO", "DOING", "DONE"])
    .withMessage("Status must be TODO, DOING, or DONE"),
  body("sortOrder")
    .optional()
    .isInt({ min: 0 })
    .withMessage("sortOrder must be a non-negative integer")
    .toInt(),
  handleValidation,
];

export const batchKpiValidator = [
  param("id").isInt({ min: 1 }).withMessage("Scrum ID must be a positive integer").toInt(),
  body("rows")
    .isArray()
    .withMessage("rows must be an array"),
  handleValidation,
];

export const batchEventsValidator = [
  param("id").isInt({ min: 1 }).withMessage("Scrum ID must be a positive integer").toInt(),
  body("rows")
    .isArray()
    .withMessage("rows must be an array"),
  handleValidation,
];

export const scrumReportValidator = [
  param("id").isInt({ min: 1 }).withMessage("Scrum ID must be a positive integer").toInt(),
  query("sprintId").optional().isInt({ min: 1 }).toInt(),
  query("from").optional().custom(dateValidator),
  query("to").optional().custom(dateValidator),
  handleValidation,
];

