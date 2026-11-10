import { HandleERROR } from "vanta-api";
import prisma from "../../config/prisma.js";
import {
  invalidateUserProjectsCache,
  invalidateAllProjectsCache,
} from "../../Utils/cache.js";

const resolveScrumForProjectLink = async (db, scrumId) => {
  const scrum = await db.scrum.findUnique({
    where: { id: scrumId },
    select: { id: true, name: true, color: true, isActive: true },
  });

  if (!scrum) {
    throw new HandleERROR("Scrum not found", 404);
  }

  if (!scrum.isActive) {
    throw new HandleERROR("Cannot link project to an inactive Scrum", 422);
  }

  return scrum;
};

export const createProjectWithMembers = async (
  { name, description, memberIds = [], scrumId },
  createdById
) => {
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
    if (scrumId !== undefined && scrumId !== null) {
      await resolveScrumForProjectLink(tx, scrumId);
    }

    const created = await tx.project.create({
      data: {
        name: name.trim(),
        description,
        scrumId: scrumId ?? null,
        createdById,
      },
      include: {
        scrum: {
          select: { id: true, name: true, color: true },
        },
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

    return {
      ...created,
      scrum: created.scrum || null,
    };
  });

  // Invalidate project cache for members
  await invalidateAllProjectsCache();

  return project;
};

export const updateProjectById = async (projectId, { name, description, isActive, scrumId }) => {
  const updatedProject = await prisma.$transaction(async (tx) => {
    const existing = await tx.project.findUnique({
      where: { id: projectId },
      select: { id: true, scrumId: true },
    });

    if (!existing) {
      throw new HandleERROR("Project not found", 404);
    }

    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (description !== undefined) {
      data.description = description === null ? null : description.trim();
    }
    if (isActive !== undefined) data.isActive = isActive;

    if (scrumId !== undefined) {
      if (scrumId === null) {
        data.scrumId = null;
      } else {
        await resolveScrumForProjectLink(tx, scrumId);
        data.scrumId = scrumId;
      }

      // If unlinking or moving to another scrum, clear SprintProject.projectId in previous scrum
      if (existing.scrumId !== null && scrumId !== existing.scrumId) {
        await tx.sprintProject.updateMany({
          where: {
            projectId,
            sprint: { scrumId: existing.scrumId },
          },
          data: { projectId: null },
        });
      }
    }

    const updated = await tx.project.update({
      where: { id: projectId },
      data,
      include: {
        scrum: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    return {
      ...updated,
      scrum: updated.scrum || null,
    };
  });

  await invalidateAllProjectsCache();
  return updatedProject;
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
