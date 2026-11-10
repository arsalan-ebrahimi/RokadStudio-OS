import { HandleERROR } from "vanta-api";
import prisma from "../../config/prisma.js";
import {
  invalidateUserProjectsCache,
  invalidateAllProjectsCache,
} from "../../Utils/cache.js";
import { toDateOnly, formatDate } from "../../Utils/date.js";
import { getPagination } from "../../Utils/pagination.js";

export const createProjectWithMembers = async (
  { name, description, memberIds = [] },
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
    const created = await tx.project.create({
      data: {
        name: name.trim(),
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
  await invalidateAllProjectsCache();

  return project;
};

export const updateProjectById = async (projectId, { name, description, isActive }) => {
  const updatedProject = await prisma.$transaction(async (tx) => {
    const existing = await tx.project.findUnique({
      where: { id: projectId },
      select: { id: true },
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

    return await tx.project.update({
      where: { id: projectId },
      data,
    });
  });

  await invalidateAllProjectsCache();
  return updatedProject;
};

export const getProjectWorkSessionsById = async (
  projectId,
  query = {},
  currentUser
) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
    },
  });

  if (!project) {
    throw new HandleERROR("Project not found", 404);
  }

  const { page, limit, skip } = getPagination(query);
  const { date, dateFrom, dateTo, approval, userId } = query;

  const baseDateWhere = { projectId };
  if (date) {
    baseDateWhere.workDate = toDateOnly(date);
  } else if (dateFrom || dateTo) {
    baseDateWhere.workDate = {};
    if (dateFrom) baseDateWhere.workDate.gte = toDateOnly(dateFrom);
    if (dateTo) baseDateWhere.workDate.lte = toDateOnly(dateTo);
  }

  const listWhere = {
    ...baseDateWhere,
    ...(approval && approval !== "ALL" ? { approval } : {}),
    ...(userId ? { userId: Number(userId) } : {}),
  };

  const [groupedSummary, total, sessions] = await Promise.all([
    prisma.workSession.groupBy({
      by: ["userId", "approval"],
      where: baseDateWhere,
      _sum: { durationSeconds: true },
      _count: { id: true },
    }),
    prisma.workSession.count({ where: listWhere }),
    prisma.workSession.findMany({
      where: listWhere,
      skip,
      take: limit,
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
      include: {
        user: {
          select: { id: true, name: true, role: true },
        },
        decidedBy: {
          select: { id: true, name: true },
        },
      },
    }),
  ]);

  const contributorIds = [...new Set(groupedSummary.map((g) => g.userId))];
  const contributors =
    contributorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: contributorIds } },
          select: { id: true, name: true },
        })
      : [];
  const contributorNameMap = new Map(contributors.map((u) => [u.id, u.name]));

  const summary = {
    totalSeconds: 0,
    approvedSeconds: 0,
    pendingSeconds: 0,
    rejectedSeconds: 0,
    sessionCount: 0,
    approvedCount: 0,
    pendingCount: 0,
    rejectedCount: 0,
    byUser: [],
  };

  const byUserMap = new Map();
  for (const row of groupedSummary) {
    const secs = row._sum.durationSeconds || 0;
    const cnt = row._count.id || 0;

    summary.totalSeconds += secs;
    summary.sessionCount += cnt;

    if (!byUserMap.has(row.userId)) {
      byUserMap.set(row.userId, {
        user: {
          id: row.userId,
          name: contributorNameMap.get(row.userId) || "Unknown",
        },
        totalSeconds: 0,
        approvedSeconds: 0,
        pendingSeconds: 0,
        rejectedSeconds: 0,
        sessionCount: 0,
      });
    }

    const userEntry = byUserMap.get(row.userId);
    userEntry.totalSeconds += secs;
    userEntry.sessionCount += cnt;

    if (row.approval === "APPROVED") {
      summary.approvedSeconds += secs;
      summary.approvedCount += cnt;
      userEntry.approvedSeconds += secs;
    } else if (row.approval === "PENDING") {
      summary.pendingSeconds += secs;
      summary.pendingCount += cnt;
      userEntry.pendingSeconds += secs;
    } else if (row.approval === "REJECTED") {
      summary.rejectedSeconds += secs;
      summary.rejectedCount += cnt;
      userEntry.rejectedSeconds += secs;
    }
  }

  summary.byUser = [...byUserMap.values()].sort(
    (a, b) => b.totalSeconds - a.totalSeconds || a.user.name.localeCompare(b.user.name)
  );

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";
  const isAttendanceAdmin = currentUser?.role === "ADMIN";

  const formattedSessions = sessions.map((s) => ({
    id: s.id,
    targetType: "PROJECT",
    projectId: project.id,
    project: { id: project.id, name: project.name },
    taskId: null,
    task: null,
    user: { id: s.user.id, name: s.user.name },
    durationSeconds: s.durationSeconds,
    workDate: formatDate(s.workDate),
    startedAt: s.startedAt,
    createdAt: s.createdAt,
    approval: s.approval,
    source: s.source,
    decidedBy: s.decidedBy || null,
    decidedAt: s.decidedAt || null,
    canModerate: !(isAttendanceAdmin && s.user.role === "SUPER_ADMIN"),
    canDelete: isSuperAdmin || isAttendanceAdmin,
  }));

  return {
    data: {
      target: {
        kind: "PROJECT",
        id: project.id,
        name: project.name,
        description: project.description,
        isActive: project.isActive,
      },
      permissions: {
        canViewAllUsers: true,
        canModerate: true,
        canDelete: true,
      },
      summary,
      sessions: formattedSessions,
    },
    page,
    limit,
    total,
  };
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
