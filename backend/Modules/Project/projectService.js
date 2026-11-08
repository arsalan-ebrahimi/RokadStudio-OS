import { HandleERROR } from "vanta-api";
import prisma from "../../config/prisma.js";
import {
  invalidateUserProjectsCache,
  invalidateAllProjectsCache,
} from "../../Utils/cache.js";

export const createProjectWithMembers = async ({ name, description, memberIds = [] }, createdById) => {
  const uniqueMemberIds = [...new Set(memberIds)];

  if (uniqueMemberIds.length > 0) {
    const validUsers = await prisma.user.findMany({
      where: {
        id: { in: uniqueMemberIds },
        isActive: true,
      },
      select: { id: true },
    });

    const validUserIds = new Set(validUsers.map((u) => u.id));
    const invalidIds = uniqueMemberIds.filter((id) => !validUserIds.has(id));

    if (invalidIds.length > 0) {
      throw new HandleERROR(`Invalid or inactive user IDs: ${invalidIds.join(", ")}`, 400);
    }
  }

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        name,
        description,
        createdById,
      },
    });

    if (uniqueMemberIds.length > 0) {
      await tx.projectMember.createMany({
        data: uniqueMemberIds.map((userId) => ({
          projectId: created.id,
          userId,
        })),
      });
    }

    return created;
  });

  // Invalidate project cache for members
  for (const userId of uniqueMemberIds) {
    await invalidateUserProjectsCache(userId);
  }

  return project;
};

export const syncProjectMembers = async (projectId, userIds = []) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new HandleERROR("Project not found", 404);
  }

  const targetUserIds = [...new Set(userIds)];

  if (targetUserIds.length > 0) {
    const validUsers = await prisma.user.findMany({
      where: {
        id: { in: targetUserIds },
        isActive: true,
      },
      select: { id: true },
    });

    const validUserIds = new Set(validUsers.map((u) => u.id));
    const invalidIds = targetUserIds.filter((id) => !validUserIds.has(id));

    if (invalidIds.length > 0) {
      throw new HandleERROR(`Invalid or inactive user IDs: ${invalidIds.join(", ")}`, 400);
    }
  }

  const { toAdd, toRemove, allAffected } = await prisma.$transaction(async (tx) => {
    const existingMembers = await tx.projectMember.findMany({
      where: { projectId },
      select: { userId: true },
    });

    const currentIds = existingMembers.map((m) => m.userId);
    const currentIdSet = new Set(currentIds);
    const targetIdSet = new Set(targetUserIds);

    const toAdd = targetUserIds.filter((id) => !currentIdSet.has(id));
    const toRemove = currentIds.filter((id) => !targetIdSet.has(id));

    if (toRemove.length > 0) {
      await tx.projectMember.deleteMany({
        where: {
          projectId,
          userId: { in: toRemove },
        },
      });
    }

    if (toAdd.length > 0) {
      await tx.projectMember.createMany({
        data: toAdd.map((userId) => ({
          projectId,
          userId,
        })),
      });
    }

    const allAffected = [...new Set([...currentIds, ...targetUserIds])];
    return { toAdd, toRemove, allAffected };
  });

  // Invalidate cache for all affected users
  for (const userId of allAffected) {
    await invalidateUserProjectsCache(userId);
  }

  return {
    projectId,
    addedCount: toAdd.length,
    removedCount: toRemove.length,
    totalMembers: targetUserIds.length,
  };
};

export const deleteProjectSafe = async (projectId) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: {
        select: { userId: true },
      },
    },
  });

  if (!project) {
    throw new HandleERROR("Project not found", 404);
  }

  await prisma.project.delete({
    where: { id: projectId },
  });

  // Invalidate cache for all affected members and all projects
  for (const m of project.members || []) {
    await invalidateUserProjectsCache(m.userId);
  }
  await invalidateAllProjectsCache();
};
