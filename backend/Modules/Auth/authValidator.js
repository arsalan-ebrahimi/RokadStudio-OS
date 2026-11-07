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
    .matches(/^\d{6}$/)
    .withMessage("Login code must be exactly 6 digits"),
  handleValidation,
];
