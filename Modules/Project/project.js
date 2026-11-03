import express from "express";
import {
  getMineProjects,
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  syncMembers,
  deleteProject,
} from "./projectCn.js";
import {
  projectIdValidator,
  createProjectValidator,
  updateProjectValidator,
  updateMembersValidator,
  getProjectsValidator,
} from "./projectValidator.js";
import { isLogin } from "../../Middlewares/isLogin.js";
import { allowedRoles } from "../../Middlewares/allowedRoles.js";

const projectRouter = express.Router();

projectRouter.use(isLogin);

// Current user's projects
projectRouter.get("/mine", getMineProjects);

// Project list for admins (with memberCount)
projectRouter.get(
  "/",
  allowedRoles("ADMIN", "SUPER_ADMIN"),
  getProjectsValidator,
  getAllProjects
);

// SUPER_ADMIN only endpoints
projectRouter.post(
  "/",
  allowedRoles("SUPER_ADMIN"),
  createProjectValidator,
  createProject
);

projectRouter.get(
  "/:id",
  allowedRoles("ADMIN", "SUPER_ADMIN"),
  projectIdValidator,
  getProjectById
);

projectRouter.patch(
  "/:id",
  allowedRoles("SUPER_ADMIN"),
  updateProjectValidator,
  updateProject
);

projectRouter.put(
  "/:id/members",
  allowedRoles("SUPER_ADMIN"),
  updateMembersValidator,
  syncMembers
);

projectRouter.delete(
  "/:id",
  allowedRoles("SUPER_ADMIN"),
  projectIdValidator,
  deleteProject
);

export default projectRouter;
