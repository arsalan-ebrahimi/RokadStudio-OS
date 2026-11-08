import { body, param, query, validationResult } from "express-validator";

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

export const projectIdValidator = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Project ID must be a positive integer")
    .toInt(),
  handleValidation,
];

export const createProjectValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Project name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Project name must be between 2 and 100 characters"),
  body("description")
    .optional()
    .trim(),
  body("memberIds")
    .optional()
    .isArray()
    .withMessage("memberIds must be an array of user IDs")
    .custom((ids) => {
      if (!Array.isArray(ids)) return false;
      for (const id of ids) {
        if (!Number.isInteger(id) || id <= 0) {
          throw new Error("Each member ID must be a positive integer");
        }
      }
      return true;
    }),
  handleValidation,
];

export const updateProjectValidator = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Project ID must be a positive integer")
    .toInt(),
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Project name must be between 2 and 100 characters"),
  body("description")
    .optional()
    .trim(),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean")
    .toBoolean(),
  handleValidation,
];

export const updateMembersValidator = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Project ID must be a positive integer")
    .toInt(),
  body("userIds")
    .isArray()
    .withMessage("userIds must be an array")
    .custom((ids) => {
      for (const id of ids) {
        if (!Number.isInteger(id) || id <= 0) {
          throw new Error("Each user ID must be a positive integer");
        }
      }
      return true;
    }),
  handleValidation,
];

export const getProjectsValidator = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("isActive").optional().isBoolean().toBoolean(),
  query("search").optional().trim(),
  handleValidation,
];
