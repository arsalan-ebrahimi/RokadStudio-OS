import { HandleERROR } from "vanta-api";
import prisma from "../../config/prisma.js";

/**
 * Checks and attaches Scrum context to the request.
 * mode: 'member' (read-only or owner) | 'owner' (owner or SUPER_ADMIN only)
 */
export const requireScrumAccess = (mode = "member") => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return next(new HandleERROR("You are not logged in", 401));
      }

      // ADMIN (attendance operations admin) has no access to Scrum
      if (user.role === "ADMIN") {
        return next(new HandleERROR("دسترسی به ماژول اسکرام برای این نقش مجاز نیست", 403));
      }

      const scrumId = Number(req.params.id || req.params.scrumId);
      if (!scrumId || isNaN(scrumId)) {
        return next(new HandleERROR("شناسه اسکرام نامعتبر است", 400));
      }

      const scrum = await prisma.scrum.findUnique({
        where: { id: scrumId },
        include: {
          members: {
            where: { userId: user.id },
            select: { userId: true, label: true },
          },
        },
      });

      if (!scrum) {
        return next(new HandleERROR("اسکرام یافت نشد", 404));
      }

      const isSuperAdmin = user.role === "SUPER_ADMIN";
      const isOwner = user.role === "SCRUM_ADMIN" && scrum.ownerId === user.id;
      const canEdit = isSuperAdmin || isOwner;
      const isMember = scrum.members.length > 0;

      if (mode === "owner" && !canEdit) {
        return next(new HandleERROR("شما دسترسی مدیریت این اسکرام را ندارید", 403));
      }

      if (mode === "member" && !canEdit && !isMember) {
        return next(new HandleERROR("شما دسترسی به این اسکرام را ندارید", 403));
      }

      req.scrum = scrum;
      req.canEdit = canEdit;
      req.isScrumMember = isMember;
      next();
    } catch (err) {
      next(err);
    }
  };
};

/**
 * Checks and loads a Sprint along with Scrum access validation.
 */
export const requireSprintAccess = (mode = "member") => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return next(new HandleERROR("You are not logged in", 401));
      }

      if (user.role === "ADMIN") {
        return next(new HandleERROR("دسترسی به ماژول اسکرام برای این نقش مجاز نیست", 403));
      }

      const sprintId = Number(req.params.id || req.params.sprintId);
      if (!sprintId || isNaN(sprintId)) {
        return next(new HandleERROR("شناسه اسپرینت نامعتبر است", 400));
      }

      const sprint = await prisma.sprint.findUnique({
        where: { id: sprintId },
        include: {
          scrum: {
            include: {
              members: {
                where: { userId: user.id },
                select: { userId: true, label: true },
              },
            },
          },
        },
      });

      if (!sprint) {
        return next(new HandleERROR("اسپرینت یافت نشد", 404));
      }

      const scrum = sprint.scrum;
      const isSuperAdmin = user.role === "SUPER_ADMIN";
      const isOwner = user.role === "SCRUM_ADMIN" && scrum.ownerId === user.id;
      const canEdit = isSuperAdmin || isOwner;
      const isMember = scrum.members.length > 0;

      if (mode === "owner" && !canEdit) {
        return next(new HandleERROR("شما دسترسی مدیریت این اسپرینت را ندارید", 403));
      }

      if (mode === "member" && !canEdit && !isMember) {
        return next(new HandleERROR("شما دسترسی به این اسپرینت را ندارید", 403));
      }

      req.sprint = sprint;
      req.scrum = scrum;
      req.canEdit = canEdit;
      req.isScrumMember = isMember;
      next();
    } catch (err) {
      next(err);
    }
  };
};

/**
 * Checks access for SprintProject (item) endpoints.
 */
export const requireSprintProjectAccess = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return next(new HandleERROR("You are not logged in", 401));
    }

    if (user.role === "ADMIN") {
      return next(new HandleERROR("دسترسی به ماژول اسکرام برای این نقش مجاز نیست", 403));
    }

    const projectId = Number(req.params.id);
    if (!projectId || isNaN(projectId)) {
      return next(new HandleERROR("شناسه پروژه اسپرینت نامعتبر است", 400));
    }

    const item = await prisma.sprintProject.findUnique({
      where: { id: projectId },
      include: {
        sprint: {
          include: {
            scrum: {
              include: {
                members: {
                  where: { userId: user.id },
                  select: { userId: true, label: true },
                },
              },
            },
          },
        },
      },
    });

    if (!item) {
      return next(new HandleERROR("پروژه اسپرینت یافت نشد", 404));
    }

    const scrum = item.sprint.scrum;
    const isSuperAdmin = user.role === "SUPER_ADMIN";
    const isOwner = user.role === "SCRUM_ADMIN" && scrum.ownerId === user.id;
    const canEdit = isSuperAdmin || isOwner;
    const isAssignee = item.assigneeId === user.id;
    const isMember = scrum.members.length > 0;

    if (!canEdit && !isMember) {
      return next(new HandleERROR("شما دسترسی به این پروژه اسپرینت را ندارید", 403));
    }

    req.sprintProject = item;
    req.sprint = item.sprint;
    req.scrum = scrum;
    req.canEdit = canEdit;
    req.isAssignee = isAssignee;
    next();
  } catch (err) {
    next(err);
  }
};

