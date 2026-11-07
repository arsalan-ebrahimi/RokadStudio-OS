import { HandleERROR } from "vanta-api";

/**
 * Role-Based Access Control middleware.
 * Ensures the authenticated user has one of the allowed roles.
 */
export const allowedRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new HandleERROR("Forbidden: insufficient permissions", 403));
    }
    next();
  };
};

export default allowedRoles;
