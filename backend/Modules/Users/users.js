import express from "express";
import {
  createUser,
  getUsers,
  searchUsers,
  getScrumAdmins,
  getUserById,
  updateUser,
  deleteUser,
} from "./usersCn.js";
import {
  createUserValidator,
  updateUserValidator,
  userIdValidator,
  getUsersValidator,
  searchUsersValidator,
} from "./usersValidator.js";
import { isLogin } from "../../Middlewares/isLogin.js";
import { allowedRoles } from "../../Middlewares/allowedRoles.js";

const usersRouter = express.Router();

usersRouter.use(isLogin);

// Search endpoint for ADMIN + SUPER_ADMIN + SCRUM_ADMIN (must be registered BEFORE /:id)
usersRouter.get(
  "/search",
  allowedRoles("ADMIN", "SUPER_ADMIN", "SCRUM_ADMIN"),
  searchUsersValidator,
  searchUsers
);

// All other endpoints in Users are SUPER_ADMIN only
usersRouter.use(allowedRoles("SUPER_ADMIN"));

// Active SCRUM_ADMIN list for Scrum admin assignment (must be registered BEFORE /:id)
usersRouter.get("/scrum-admins", searchUsersValidator, getScrumAdmins);

usersRouter
  .route("/")
  .get(getUsersValidator, getUsers)
  .post(createUserValidator, createUser);

usersRouter
  .route("/:id")
  .get(userIdValidator, getUserById)
  .patch(updateUserValidator, updateUser)
  .delete(userIdValidator, deleteUser);

export default usersRouter;
