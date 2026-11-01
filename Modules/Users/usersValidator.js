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

export const userIdValidator = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("User ID must be a positive integer")
    .toInt(),
  handleValidation,
];

export const createUserValidator = [
  body("code")
    .trim()
    .notEmpty()
    .withMessage("Code is required")
    .isLength({ min: 6, max: 64 })
    .withMessage("Code must be between 6 and 64 characters")
    .matches(/^[A-Za-z0-9_-]+$/)
    .withMessage("Code can only contain letters, numbers, underscores, and hyphens"),
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),
  body("role")
    .optional()
    .isIn(["USER", "ADMIN", "SUPER_ADMIN"])
    .withMessage("Role must be USER, ADMIN, or SUPER_ADMIN"),
  handleValidation,
];

export const updateUserValidator = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("User ID must be a positive integer")
    .toInt(),
  body("code")
    .optional()
    .trim()
    .isLength({ min: 6, max: 64 })
    .withMessage("Code must be between 6 and 64 characters")
    .matches(/^[A-Za-z0-9_-]+$/)
    .withMessage("Code can only contain letters, numbers, underscores, and hyphens"),
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),
  body("role")
    .optional()
    .isIn(["USER", "ADMIN", "SUPER_ADMIN"])
    .withMessage("Role must be USER, ADMIN, or SUPER_ADMIN"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean")
    .toBoolean(),
  handleValidation,
];

export const getUsersValidator = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("role").optional().isIn(["USER", "ADMIN", "SUPER_ADMIN"]),
  query("isActive").optional().isBoolean().toBoolean(),
  query("search").optional().trim(),
  handleValidation,
];

export const searchUsersValidator = [
  query("q").optional().trim(),
  handleValidation,
];
