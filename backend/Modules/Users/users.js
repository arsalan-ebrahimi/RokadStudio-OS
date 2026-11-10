import express from "express";
import { HandleERROR } from "vanta-api";
import {
  createUser,
  getUsers,
  searchUsers,
  getScrumAdmins,
  getUserById,
  updateUserPerformance,
  updateUser,
  deleteUser,
} from "./usersCn.js";
import {
  createUserValidator,
  updateUserValidator,
  userIdValidator,
  getUsersValidator,
  searchUsersValidator,
  updateUserPerformanceValidator,
} from "./usersValidator.js";
import { isLogin } from "../../Middlewares/isLogin.js";
import { allowedRoles } from "../../Middlewares/allowedRoles.js";
import { scrumWriteRateLimiter } from "../../Middlewares/rateLimit.js";

const usersRouter = express.Router();

usersRouter.use(isLogin);

// Search endpoint for ADMIN + SUPER_ADMIN + SCRUM_ADMIN (must be registered BEFORE /:id)
usersRouter.get(
  "/search",
  allowedRoles("ADMIN", "SUPER_ADMIN", "SCRUM_ADMIN"),
  searchUsersValidator,
  searchUsers
);

// Active SCRUM_ADMIN & ADMIN list for Scrum admin assignment (SUPER_ADMIN only)
usersRouter.get(
  "/scrum-admins",
  allowedRoles("SUPER_ADMIN"),
  searchUsersValidator,
  getScrumAdmins
);

// Studio-level performance status (ADMIN & SUPER_ADMIN; SCRUM_ADMIN receives 404)
usersRouter.put(
  "/:id/performance",
  (req, res, next) => {
    if (req.user?.role === "SCRUM_ADMIN") {
      return next(new HandleERROR("یافت نشد", 404));
    }
    return next();
  },
  allowedRoles("ADMIN", "SUPER_ADMIN"),
  scrumWriteRateLimiter,
  updateUserPerformanceValidator,
  updateUserPerformance
);

// Admin users list & read endpoints (ADMIN & SUPER_ADMIN; code omitted for ADMIN)
usersRouter.get(
  "/",
  allowedRoles("ADMIN", "SUPER_ADMIN"),
  getUsersValidator,
  getUsers
);

usersRouter.get(
  "/:id",
  allowedRoles("ADMIN", "SUPER_ADMIN"),
  userIdValidator,
  getUserById
);

// Remaining user mutations are SUPER_ADMIN only
usersRouter.use(allowedRoles("SUPER_ADMIN"));

usersRouter.post("/", createUserValidator, createUser);

usersRouter
  .route("/:id")
  .patch(updateUserValidator, updateUser)
  .delete(userIdValidator, deleteUser);

export default usersRouter;
