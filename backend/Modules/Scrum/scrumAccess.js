import { HandleERROR } from "vanta-api";
import prisma from "../../config/prisma.js";

/**
 * Ensures the authenticated user is not an attendance operations ADMIN.
 * ADMIN users have zero access to the Scrum module.
 */
export const assertScrumRoleAllowed = (user) => {
  if (!user) {
    throw new HandleERROR("You are not logged in", 401);
  }
  if (user.role === "ADMIN") {
    throw new HandleERROR("دسترسی به ماژول اسکرام برای این نقش مجاز نیست", 403);
  }
};

/**
 * Router-level guard rejecting ADMIN role with 403 before touching Scrum handlers.
 */
export const requireNonAttendanceAdmin = (req, res, next) => {
  try {
    assertScrumRoleAllowed(req.user);
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Returns Prisma Scrum `where` filter matching scrums visible to `user`.
 * - SUPER_ADMIN sees all scrums
 * - SCRUM_ADMIN sees union of assigned (ScrumAdmin) and member (ScrumMember) scrums
 * - Other allowed roles (USER) see scrums they are a member of
 */
export const getVisibleScrumsWhere = (user, extraWhere = {}) => {
  assertScrumRoleAllowed(user);

  if (user.role === "SUPER_ADMIN") {
    return { ...extraWhere };
  }

  if (user.role === "SCRUM_ADMIN") {
    return {
      ...extraWhere,
      OR: [
        { admins: { some: { userId: user.id } } },
        { members: { some: { userId: user.id } } },
      ],
    };
  }

  return {
    ...extraWhere,
    members: { some: { userId: user.id } },
  };
};

/**
 * Central Scrum access resolver used by all Scrum, Sprint, and Task handlers.
 * Unrelated authenticated users receive 404 so resource existence is never leaked.
 *
 * @param {object} user - req.user ({ id, role, ... })
 * @param {{ scrumId?: number, sprintId?: number, taskId?: number }} target
 * @returns {Promise<{ scrum: object, sprint?: object, task?: object, isSuperAdmin: boolean, isScrumAdmin: boolean, isMember: boolean, isTaskMember: boolean, canEditContent: boolean, canManageAdmins: boolean, canArchive: boolean, canEdit: boolean }>}
 */
export const getScrumAccess = async (user, target = {}) => {
  assertScrumRoleAllowed(user);

  let scrum = null;
  let sprint = null;
  let task = null;
  let notFoundMessage = "اسکرام یافت نشد";

  if (target.scrumId !== undefined) {
    const scrumId = Number(target.scrumId);
    if (!Number.isInteger(scrumId) || scrumId < 1) {
      throw new HandleERROR("شناسه اسکرام نامعتبر است", 400);
    }

    scrum = await prisma.scrum.findUnique({
      where: { id: scrumId },
      select: {
        id: true,
        name: true,
        description: true,
        color: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        admins: {
          where: { userId: user.id },
          select: { userId: true },
        },
        members: {
          where: { userId: user.id },
          select: { userId: true, label: true },
        },
      },
    });
  } else if (target.sprintId !== undefined) {
    notFoundMessage = "اسپرینت یافت نشد";
    const sprintId = Number(target.sprintId);
    if (!Number.isInteger(sprintId) || sprintId < 1) {
      throw new HandleERROR("شناسه اسپرینت نامعتبر است", 400);
    }

    const loadedSprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      select: {
        id: true,
        scrumId: true,
        number: true,
        title: true,
        description: true,
        startDate: true,
        endDate: true,
        status: true,
        progressPercent: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        scrum: {
          select: {
            id: true,
            name: true,
            color: true,
            isActive: true,
            admins: {
              where: { userId: user.id },
              select: { userId: true },
            },
            members: {
              where: { userId: user.id },
              select: { userId: true, label: true },
            },
          },
        },
      },
    });

    if (loadedSprint) {
      const { scrum: parentScrum, ...sprintData } = loadedSprint;
      sprint = sprintData;
      scrum = parentScrum;
    }
  } else if (target.taskId !== undefined) {
    notFoundMessage = "تسک یافت نشد";
    const taskId = Number(target.taskId);
    if (!Number.isInteger(taskId) || taskId < 1) {
      throw new HandleERROR("شناسه تسک نامعتبر است", 400);
    }

    const loadedTask = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        scrumId: true,
        name: true,
        description: true,
        points: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        members: {
          where: { userId: user.id },
          select: { userId: true },
        },
        scrum: {
          select: {
            id: true,
            name: true,
            color: true,
            isActive: true,
            admins: {
              where: { userId: user.id },
              select: { userId: true },
            },
            members: {
              where: { userId: user.id },
              select: { userId: true, label: true },
            },
          },
        },
      },
    });

    if (loadedTask) {
      const { scrum: parentScrum, members: myMembership, ...taskData } = loadedTask;
      task = { ...taskData, isTaskMember: myMembership.length > 0 };
      scrum = parentScrum;
    }
  } else {
    throw new HandleERROR("هدف دسترسی نامعتبر است", 500);
  }

  if (!scrum) {
    throw new HandleERROR(notFoundMessage, 404);
  }

  const isSuperAdmin = user.role === "SUPER_ADMIN";
  const isScrumAdmin = user.role === "SCRUM_ADMIN" && scrum.admins.length > 0;
  const isMember = scrum.members.length > 0;
  const canEditContent = isSuperAdmin || isScrumAdmin;
  const canManageAdmins = isSuperAdmin;
  const canArchive = isSuperAdmin;
  const canEdit = canEditContent;
  const isTaskMember = Boolean(task && task.isTaskMember);

  // Outsiders receive 404 so Scrum/Sprint/Task existence is never leaked
  if (!isSuperAdmin && !isScrumAdmin && !isMember) {
    throw new HandleERROR(notFoundMessage, 404);
  }

  return {
    scrum,
    sprint,
    task,
    isSuperAdmin,
    isScrumAdmin,
    isMember,
    isTaskMember,
    canEditContent,
    canManageAdmins,
    canArchive,
    canEdit,
  };
};

/**
 * Checks and attaches Scrum context to the request.
 * mode:
 * - 'member': any member, assigned SCRUM_ADMIN, or SUPER_ADMIN
 * - 'editor': assigned SCRUM_ADMIN or SUPER_ADMIN only
 * - 'super_admin': SUPER_ADMIN only (outsiders still receive 404 from getScrumAccess)
 */
export const requireScrumAccess = (mode = "member") => {
  return async (req, res, next) => {
    try {
      const scrumId = req.validatedParams?.id ?? Number(req.params.id || req.params.scrumId);
      const access = await getScrumAccess(req.user, { scrumId });

      if (mode === "super_admin" && !access.isSuperAdmin) {
        return next(new HandleERROR("فقط سوپرادمین مجاز به انجام این عملیات است", 403));
      }

      if ((mode === "editor" || mode === "owner") && !access.canEditContent) {
        return next(new HandleERROR("شما دسترسی مدیریت این اسکرام را ندارید", 403));
      }

      req.scrumAccess = access;
      req.scrum = access.scrum;
      req.canEdit = access.canEditContent;
      req.canEditContent = access.canEditContent;
      req.isScrumMember = access.isMember;
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
      const sprintId = req.validatedParams?.id ?? Number(req.params.id || req.params.sprintId);
      const access = await getScrumAccess(req.user, { sprintId });

      if ((mode === "editor" || mode === "owner") && !access.canEditContent) {
        return next(new HandleERROR("شما دسترسی مدیریت این اسپرینت را ندارید", 403));
      }

      req.scrumAccess = access;
      req.sprint = access.sprint;
      req.scrum = access.scrum;
      req.canEdit = access.canEditContent;
      req.canEditContent = access.canEditContent;
      req.isScrumMember = access.isMember;
      next();
    } catch (err) {
      next(err);
    }
  };
};

/**
 * Checks access for Scrum Task endpoints.
 * mode: 'member' (scrum member, assigned SCRUM_ADMIN, SA) | 'editor' (assigned SCRUM_ADMIN or SA)
 */
export const requireTaskAccess = (mode = "member") => {
  return async (req, res, next) => {
    try {
      const taskId = req.validatedParams?.id ?? Number(req.params.id || req.params.taskId);
      const access = await getScrumAccess(req.user, { taskId });

      if ((mode === "editor" || mode === "owner") && !access.canEditContent) {
        return next(new HandleERROR("شما دسترسی مدیریت این تسک را ندارید", 403));
      }

      req.scrumAccess = access;
      req.task = access.task;
      req.scrum = access.scrum;
      req.canEdit = access.canEditContent;
      req.canEditContent = access.canEditContent;
      req.isTaskMember = access.isTaskMember;
      next();
    } catch (err) {
      next(err);
    }
  };
};
