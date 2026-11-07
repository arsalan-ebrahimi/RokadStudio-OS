import { body, validationResult } from "express-validator";

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

export const loginValidator = [
  body("code")
    .trim()
    .notEmpty()
    .withMessage("Code is required")
    .isLength({ min: 6, max: 64 })
    .withMessage("Code must be between 6 and 64 characters")
    .matches(/^[A-Za-z0-9_-]+$/)
    .withMessage("Code can only contain letters, numbers, underscores, and hyphens"),
  handleValidation,
];
