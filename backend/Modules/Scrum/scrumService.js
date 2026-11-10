import { HandleERROR } from "vanta-api";
import prisma from "../../config/prisma.js";
import { todayDate, toDateOnly, formatDate, getTimezoneParts } from "../../Utils/date.js";
import { invalidateAllProjectsCache } from "../../Utils/cache.js";
import { getVisibleScrumsWhere } from "./scrumAccess.js";
import { serializeKpiRows } from "./kpiSerializer.js";
import { isEventRowEmpty } from "./scrumValidator.js";

export const MAX_LIST_LIMIT = 200;

/**
 * Returns today's Persian weekday in Asia/Tehran:
 * Saturday = 0, Sunday = 1, ..., Friday = 6
 */
export const getTehranPersianDayOfWeek = (now = new Date()) => {
  const parts = getTimezoneParts(now, process.env.APP_TIMEZONE || "Asia/Tehran");
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0));
  const jsDay = d.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  return (jsDay + 1) % 7;
};

export const buildScrumAccessMeta = (currentUser, isAssignedAdmin) => {
  const isSuperAdmin = currentUser.role === "SUPER_ADMIN";
  const isScrumAdmin = currentUser.role === "SCRUM_ADMIN" && Boolean(isAssignedAdmin);
  const canEditContent = isSuperAdmin || isScrumAdmin;
  const myRole = isSuperAdmin ? "SUPER_ADMIN" : isScrumAdmin ? "ADMIN" : "MEMBER";
  return {
    myRole,
    canEdit: canEditContent,
    permissions: {
      canEditContent,
      canManageAdmins: isSuperAdmin,
      canArchive: isSuperAdmin,
    },
  };
};

const assertValidScrumAdminUsers = async (db, adminIds = []) => {
  const uniqueIds = [...new Set(adminIds.map(Number))];
  if (uniqueIds.length === 0) return [];

  const users = await db.user.findMany({
    where: {
      id: { in: uniqueIds },
      isActive: true,
      role: "SCRUM_ADMIN",
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (users.length !== uniqueIds.length) {
    throw new HandleERROR(
      "همه ادمین‌های اسکرام باید کاربر فعال با نقش SCRUM_ADMIN باشند",
      422
    );
  }

  return users;
};

const formatEventRow = (e) => ({
  id: e.id,
  scrumId: e.scrumId,
  name: e.name,
  scheduleType: e.scheduleType,
  dayOfWeek: e.dayOfWeek,
  date: formatDate(e.date),
  startTime: e.startTime,
  durationMinutes: e.durationMinutes,
  inputs: e.inputs,
  outputs: e.outputs,
  sortOrder: e.sortOrder,
});

const formatSprintSummary = (sprint, stats = { totalPoints: 0, donePoints: 0, itemCount: 0 }) => ({
  id: sprint.id,
  scrumId: sprint.scrumId,
  number: sprint.number,
  title: sprint.title,
  description: sprint.description,
  startDate: formatDate(sprint.startDate),
  endDate: formatDate(sprint.endDate),
  status: sprint.status,
  completedAt: sprint.completedAt,
  createdAt: sprint.createdAt,
  updatedAt: sprint.updatedAt,
  totalPoints: stats.totalPoints,
  donePoints: stats.donePoints,
  itemCount: stats.itemCount,
});

const formatSprintProjectItem = (item, stats = { totalSeconds: 0, sessionsCount: 0 }) => ({
  id: item.id,
  sprintId: item.sprintId,
  projectId: item.project?.id ?? item.projectId ?? null,
  project: item.project ? { id: item.project.id, name: item.project.name } : null,
  name: item.name,
  points: item.points,
  status: item.status,
  sortOrder: item.sortOrder,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  assignee: item.assignee ? { id: item.assignee.id, name: item.assignee.name } : null,
  totalTrackedSeconds: stats.totalSeconds,
  sessionCount: stats.sessionsCount,
});

const getSprintStatsMap = async (db, sprintIds) => {
  const statsMap = new Map();
  if (!sprintIds || sprintIds.length === 0) return statsMap;

  const grouped = await db.sprintProject.groupBy({
    by: ["sprintId", "status"],
    where: { sprintId: { in: sprintIds } },
    _sum: { points: true },
    _count: { id: true },
  });

  for (const row of grouped) {
    if (!statsMap.has(row.sprintId)) {
      statsMap.set(row.sprintId, { totalPoints: 0, donePoints: 0, itemCount: 0 });
    }
    const entry = statsMap.get(row.sprintId);
    const pts = row._sum.points || 0;
    const cnt = row._count.id || 0;
    entry.totalPoints += pts;
    entry.itemCount += cnt;
    if (row.status === "DONE") {
      entry.donePoints += pts;
    }
  }

  return statsMap;
};

const assertValidSprintAssignee = async (db, scrumId, assigneeId) => {
  const member = await db.scrumMember.findUnique({
    where: {
      scrumId_userId: { scrumId, userId: assigneeId },
    },
    select: {
      user: {
        select: { id: true, isActive: true, role: true },
      },
    },
  });

  if (!member || !member.user.isActive || member.user.role === "ADMIN") {
    throw new HandleERROR("کاربر انتخاب‌شده عضو فعال این اسکرام نیست", 400);
  }
};

export const listScrumsService = async (currentUser) => {
  const where = getVisibleScrumsWhere(currentUser);

  const scrums = await prisma.scrum.findMany({
    where,
    take: MAX_LIST_LIMIT,
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      admins: {
        select: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { user: { name: "asc" } },
      },
      _count: {
        select: { members: true },
      },
      sprints: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          number: true,
          title: true,
        },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return scrums.map((s) => {
    const admins = s.admins.map((a) => ({
      id: a.user.id,
      name: a.user.name,
    }));
    const isAssignedAdmin = admins.some((a) => a.id === currentUser.id);
    const meta = buildScrumAccessMeta(currentUser, isAssignedAdmin);

    return {
      id: s.id,
      name: s.name,
      description: s.description,
      color: s.color,
      isActive: s.isActive,
      admins,
      memberCount: s._count.members,
      ...meta,
      activeSprint: s.sprints[0] || null,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  });
};

export const createScrumService = async ({ name, description, color, adminIds = [] }, currentUser) => {
  if (currentUser.role !== "SUPER_ADMIN") {
    throw new HandleERROR("فقط سوپرادمین مجاز به ایجاد اسکرام است", 403);
  }

  const uniqueAdminIds = [...new Set((adminIds || []).map(Number))];

  const created = await prisma.$transaction(async (tx) => {
    await assertValidScrumAdminUsers(tx, uniqueAdminIds);

    const scrum = await tx.scrum.create({
      data: {
        name: name.trim(),
        description: description ? description.trim() || null : null,
        color: color || "ECOSYSTEM",
      },
    });

    if (uniqueAdminIds.length > 0) {
      await tx.scrumAdmin.createMany({
        data: uniqueAdminIds.map((userId) => ({
          scrumId: scrum.id,
          userId,
          assignedById: currentUser.id,
        })),
      });
    }

    return scrum;
  });

  return await getScrumDetailsService(created.id, currentUser);
};

export const getScrumDetailsService = async (scrumId, currentUser) => {
  const scrum = await prisma.scrum.findUnique({
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
        select: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { user: { name: "asc" } },
      },
      members: {
        select: {
          label: true,
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { user: { name: "asc" } },
      },
      sprints: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          number: true,
          title: true,
        },
        take: 1,
      },
    },
  });

  if (!scrum) {
    throw new HandleERROR("اسکرام یافت نشد", 404);
  }

  const admins = scrum.admins.map((a) => ({
    id: a.user.id,
    name: a.user.name,
  }));
  const isAssignedAdmin = admins.some((a) => a.id === currentUser.id);
  const meta = buildScrumAccessMeta(currentUser, isAssignedAdmin);

  return {
    id: scrum.id,
    name: scrum.name,
    description: scrum.description,
    color: scrum.color,
    isActive: scrum.isActive,
    admins,
    memberCount: scrum.members.length,
    ...meta,
    activeSprint: scrum.sprints[0] || null,
    createdAt: scrum.createdAt,
    updatedAt: scrum.updatedAt,
    members: scrum.members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      label: m.label || null,
    })),
  };
};

export const syncScrumAdminsService = async (scrumId, userIds = [], currentUser) => {
  const targetIds = [...new Set((userIds || []).map(Number))];

  return await prisma.$transaction(async (tx) => {
    await assertValidScrumAdminUsers(tx, targetIds);

    const existing = await tx.scrumAdmin.findMany({
      where: { scrumId },
      select: { userId: true },
    });

    const existingSet = new Set(existing.map((e) => e.userId));
    const targetSet = new Set(targetIds);

    const toAdd = targetIds.filter((uid) => !existingSet.has(uid));
    const toRemove = existing.map((e) => e.userId).filter((uid) => !targetSet.has(uid));

    if (toRemove.length > 0) {
      await tx.scrumAdmin.deleteMany({
        where: {
          scrumId,
          userId: { in: toRemove },
        },
      });
    }

    if (toAdd.length > 0) {
      await tx.scrumAdmin.createMany({
        data: toAdd.map((userId) => ({
          scrumId,
          userId,
          assignedById: currentUser.id,
        })),
      });
    }

    const updatedAdmins = await tx.scrumAdmin.findMany({
      where: { scrumId },
      select: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { user: { name: "asc" } },
    });

    return updatedAdmins.map((a) => ({
      id: a.user.id,
      name: a.user.name,
    }));
  });
};

export const updateScrumService = async (
  scrumId,
  { name, description, color, isActive },
  currentUser
) => {
  if (isActive !== undefined && currentUser.role !== "SUPER_ADMIN") {
    throw new HandleERROR("فقط سوپرادمین مجاز به تغییر وضعیت فعال/آرشیو اسکرام است", 403);
  }

  const data = {};
  if (name !== undefined) data.name = name.trim();
  if (description !== undefined) {
    data.description = description === null ? null : description.trim() || null;
  }
  if (color !== undefined) data.color = color;
  if (isActive !== undefined) data.isActive = isActive;

  await prisma.scrum.update({
    where: { id: scrumId },
    data,
  });

  return await getScrumDetailsService(scrumId, currentUser);
};

export const deleteScrumService = async (scrumId) => {
  await prisma.$transaction(async (tx) => {
    const sessionCount = await tx.workSession.count({
      where: {
        sprintProject: {
          sprint: {
            scrumId,
          },
        },
      },
    });

    if (sessionCount > 0) {
      throw new HandleERROR(
        "امکان حذف این اسکرام به دلیل وجود سشن‌های کاری ثبت‌شده وجود ندارد. می‌توانید آن را غیرفعال (آرشیو) کنید.",
        409
      );
    }

    await tx.scrum.delete({
      where: { id: scrumId },
    });
  });

  await invalidateAllProjectsCache();
};

export const syncScrumMembersService = async (scrumId, memberList = []) => {
  const targetUserIds = memberList.map((m) => Number(m.userId));

  if (targetUserIds.length > 0) {
    const validUsers = await prisma.user.findMany({
      where: {
        id: { in: targetUserIds },
        isActive: true,
        role: { in: ["USER", "SCRUM_ADMIN", "SUPER_ADMIN"] },
      },
      select: { id: true },
    });

    const validIdSet = new Set(validUsers.map((u) => u.id));
    const invalidIds = targetUserIds.filter((id) => !validIdSet.has(id));

    if (invalidIds.length > 0) {
      throw new HandleERROR(
        `کاربران با شناسه ${invalidIds.join(", ")} نامعتبر، غیرفعال یا دارای نقش غیرمجاز هستند`,
        400
      );
    }
  }

  return await prisma.$transaction(async (tx) => {
    const existing = await tx.scrumMember.findMany({
      where: { scrumId },
      select: { userId: true, label: true },
    });

    const existingMap = new Map(existing.map((e) => [e.userId, e.label ?? null]));
    const targetSet = new Set(targetUserIds);
    const removedIds = existing.map((e) => e.userId).filter((id) => !targetSet.has(id));

    if (removedIds.length > 0) {
      await tx.sprintProject.updateMany({
        where: {
          sprint: { scrumId },
          assigneeId: { in: removedIds },
        },
        data: { assigneeId: null },
      });

      await tx.scrumMember.deleteMany({
        where: {
          scrumId,
          userId: { in: removedIds },
        },
      });
    }

    const toCreate = [];
    const toUpdate = [];

    for (const m of memberList) {
      const uid = Number(m.userId);
      const label = typeof m.label === "string" && m.label.trim() ? m.label.trim() : null;
      if (!existingMap.has(uid)) {
        toCreate.push({ scrumId, userId: uid, label });
      } else if (existingMap.get(uid) !== label) {
        toUpdate.push({ uid, label });
      }
    }

    if (toCreate.length > 0) {
      await tx.scrumMember.createMany({ data: toCreate });
    }

    if (toUpdate.length > 0) {
      await Promise.all(
        toUpdate.map(({ uid, label }) =>
          tx.scrumMember.update({
            where: { scrumId_userId: { scrumId, userId: uid } },
            data: { label },
          })
        )
      );
    }

    const updatedMembers = await tx.scrumMember.findMany({
      where: { scrumId },
      select: {
        label: true,
        user: { select: { id: true, name: true } },
      },
      orderBy: { user: { name: "asc" } },
    });

    return updatedMembers.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      label: m.label || null,
    }));
  });
};

export const listSprintsService = async (scrumId) => {
  const sprints = await prisma.sprint.findMany({
    where: { scrumId },
    take: MAX_LIST_LIMIT,
    select: {
      id: true,
      scrumId: true,
      number: true,
      title: true,
      description: true,
      startDate: true,
      endDate: true,
      status: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { number: "asc" },
  });

  const statsMap = await getSprintStatsMap(
    prisma,
    sprints.map((s) => s.id)
  );

  return sprints.map((s) => formatSprintSummary(s, statsMap.get(s.id)));
};

export const createSprintService = async (scrumId, { title, description, startDate, endDate }) => {
  const sDate = startDate ? toDateOnly(startDate) : null;
  const eDate = endDate ? toDateOnly(endDate) : null;

  if (sDate && eDate && eDate.getTime() < sDate.getTime()) {
    throw new HandleERROR("تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد", 400);
  }

  // Retry loop up to 5 times on Sprint(scrumId, number) P2002 race conditions
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const created = await prisma.$transaction(async (tx) => {
        const last = await tx.sprint.findFirst({
          where: { scrumId },
          orderBy: { number: "desc" },
          select: { number: true },
        });

        const nextNumber = (last?.number || 0) + 1;
        const sprintTitle = title ? title.trim() : `اسپرینت ${nextNumber}`;

        return await tx.sprint.create({
          data: {
            scrumId,
            number: nextNumber,
            title: sprintTitle,
            description: description ? description.trim() || null : null,
            startDate: sDate,
            endDate: eDate,
            status: "PLANNED",
          },
        });
      });

      return formatSprintSummary(created);
    } catch (err) {
      if (err?.code === "P2002" && attempt < 4) {
        continue;
      }
      throw err;
    }
  }
};

const assertValidLinkedProjectForSprint = async (db, scrumId, projectId) => {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, scrumId: true },
  });

  if (!project || project.scrumId !== scrumId) {
    throw new HandleERROR("پروژه انتخاب‌شده به این اسکرام متصل نیست", 422);
  }
};

export const getSprintDetailsService = async (sprintId, currentUser, canEdit) => {
  const sprint = await prisma.sprint.findUnique({
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
      completedAt: true,
      createdAt: true,
      updatedAt: true,
      projects: {
        select: {
          id: true,
          sprintId: true,
          projectId: true,
          name: true,
          points: true,
          status: true,
          sortOrder: true,
          createdAt: true,
          updatedAt: true,
          project: {
            select: {
              id: true,
              name: true,
            },
          },
          assignee: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!sprint) {
    throw new HandleERROR("اسپرینت یافت نشد", 404);
  }

  // Plain members only see their own tracked seconds; owners/SA see team totals.
  const projectIds = sprint.projects.map((p) => p.id);
  const trackedAggs =
    projectIds.length > 0
      ? await prisma.workSession.groupBy({
          by: ["sprintProjectId"],
          where: {
            sprintProjectId: { in: projectIds },
            approval: { not: "REJECTED" },
            ...(canEdit ? {} : { userId: currentUser.id }),
          },
          _sum: { durationSeconds: true },
          _count: { id: true },
        })
      : [];

  const trackedMap = new Map(
    trackedAggs.map((a) => [
      a.sprintProjectId,
      {
        totalSeconds: a._sum.durationSeconds || 0,
        sessionsCount: a._count.id || 0,
      },
    ])
  );

  const formattedProjects = sprint.projects.map((p) =>
    formatSprintProjectItem(p, trackedMap.get(p.id))
  );

  let totalPoints = 0;
  let donePoints = 0;
  let totalSeconds = 0;
  for (const p of formattedProjects) {
    totalPoints += p.points || 0;
    if (p.status === "DONE") donePoints += p.points || 0;
    totalSeconds += p.totalTrackedSeconds;
  }

  return {
    ...formatSprintSummary(sprint, {
      totalPoints,
      donePoints,
      itemCount: formattedProjects.length,
    }),
    totalTrackedSeconds: totalSeconds,
    projects: formattedProjects,
  };
};

export const updateSprintService = async (sprintId, { title, description, startDate, endDate }) => {
  return await prisma.$transaction(async (tx) => {
    const current = await tx.sprint.findUnique({
      where: { id: sprintId },
      select: { id: true, startDate: true, endDate: true },
    });

    if (!current) {
      throw new HandleERROR("اسپرینت یافت نشد", 404);
    }

    const sDate =
      startDate !== undefined ? (startDate ? toDateOnly(startDate) : null) : current.startDate;
    const eDate = endDate !== undefined ? (endDate ? toDateOnly(endDate) : null) : current.endDate;

    if (sDate && eDate && eDate.getTime() < sDate.getTime()) {
      throw new HandleERROR("تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد", 400);
    }

    const data = {};
    if (title !== undefined) data.title = title.trim();
    if (description !== undefined) {
      data.description = description === null ? null : description.trim() || null;
    }
    if (startDate !== undefined) data.startDate = sDate;
    if (endDate !== undefined) data.endDate = eDate;

    const updated = await tx.sprint.update({
      where: { id: sprintId },
      data,
    });

    const statsMap = await getSprintStatsMap(tx, [sprintId]);
    return formatSprintSummary(updated, statsMap.get(sprintId));
  });
};

export const updateSprintStatusService = async (sprintId, newStatus) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.sprint.findUnique({
        where: { id: sprintId },
        select: { id: true, scrumId: true, status: true },
      });

      if (!current) {
        throw new HandleERROR("اسپرینت یافت نشد", 404);
      }

      const isValidTransition =
        (current.status === "PLANNED" && newStatus === "ACTIVE") ||
        (current.status === "ACTIVE" && newStatus === "COMPLETED");

      if (!isValidTransition) {
        throw new HandleERROR(
          "تغییر وضعیت نامعتبر است. فقط انتقال از برنامه‌ریزی به فعال یا از فعال به تمام‌شده مجاز است",
          400
        );
      }

      if (newStatus === "ACTIVE") {
        const activeSprint = await tx.sprint.findFirst({
          where: {
            scrumId: current.scrumId,
            status: "ACTIVE",
            id: { not: sprintId },
          },
          select: { id: true, number: true },
        });

        if (activeSprint) {
          throw new HandleERROR(
            `یک اسپرینت فعال دیگر (اسپرینت ${activeSprint.number}) در این اسکرام وجود دارد`,
            409
          );
        }
      }

      const data = { status: newStatus };
      if (newStatus === "COMPLETED") {
        data.completedAt = new Date();
      }

      const updated = await tx.sprint.update({
        where: { id: sprintId },
        data,
      });

      const statsMap = await getSprintStatsMap(tx, [sprintId]);
      return formatSprintSummary(updated, statsMap.get(sprintId));
    });
  } catch (err) {
    if (err?.code === "P2002") {
      throw new HandleERROR("یک اسپرینت فعال دیگر در این اسکرام وجود دارد", 409);
    }
    throw err;
  }
};

export const deleteSprintService = async (sprintId) => {
  await prisma.$transaction(async (tx) => {
    const sessionCount = await tx.workSession.count({
      where: {
        sprintProject: {
          sprintId,
        },
      },
    });

    if (sessionCount > 0) {
      throw new HandleERROR(
        "امکان حذف اسپرینت به دلیل وجود سشن‌های کاری ثبت‌شده روی پروژه‌های آن وجود ندارد",
        409
      );
    }

    await tx.sprint.delete({
      where: { id: sprintId },
    });
  });
};

export const createSprintProjectService = async (
  sprintId,
  { name, points = 0, assigneeId, projectId }
) => {
  const created = await prisma.$transaction(async (tx) => {
    const sprint = await tx.sprint.findUnique({
      where: { id: sprintId },
      select: { id: true, scrumId: true },
    });

    if (!sprint) {
      throw new HandleERROR("اسپرینت یافت نشد", 404);
    }

    let resolvedAssigneeId = null;
    if (assigneeId !== undefined && assigneeId !== null) {
      await assertValidSprintAssignee(tx, sprint.scrumId, assigneeId);
      resolvedAssigneeId = assigneeId;
    }

    let resolvedProjectId = null;
    if (projectId !== undefined && projectId !== null) {
      await assertValidLinkedProjectForSprint(tx, sprint.scrumId, projectId);
      resolvedProjectId = projectId;
    }

    const lastItem = await tx.sprintProject.findFirst({
      where: { sprintId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const nextSort = (lastItem?.sortOrder ?? -1) + 1;

    return await tx.sprintProject.create({
      data: {
        sprintId,
        projectId: resolvedProjectId,
        name: name.trim(),
        points: points != null ? Number(points) : 0,
        assigneeId: resolvedAssigneeId,
        sortOrder: nextSort,
        status: "TODO",
      },
      select: {
        id: true,
        sprintId: true,
        projectId: true,
        name: true,
        points: true,
        status: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  });

  return formatSprintProjectItem(created);
};

export const updateSprintProjectService = async (
  itemId,
  body,
  { canEdit, isAssignee, currentUser }
) => {
  return await prisma.$transaction(async (tx) => {
    const current = await tx.sprintProject.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        sprint: {
          select: {
            scrumId: true,
          },
        },
      },
    });

    if (!current) {
      throw new HandleERROR("پروژه اسپرینت یافت نشد", 404);
    }

    const data = {};

    if (!canEdit) {
      if (!isAssignee) {
        throw new HandleERROR("شما دسترسی ویرایش این پروژه اسپرینت را ندارید", 403);
      }

      const disallowedKeys = Object.keys(body).filter((k) => k !== "status");
      if (disallowedKeys.length > 0) {
        throw new HandleERROR("شما فقط مجاز به تغییر وضعیت این تسک هستید", 403);
      }

      data.status = body.status;
    } else {
      if (body.name !== undefined) data.name = body.name.trim();
      if (body.points !== undefined) data.points = Number(body.points);
      if (body.status !== undefined) data.status = body.status;
      if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder);

      if (body.assigneeId !== undefined) {
        if (body.assigneeId === null) {
          data.assigneeId = null;
        } else {
          const aid = Number(body.assigneeId);
          await assertValidSprintAssignee(tx, current.sprint.scrumId, aid);
          data.assigneeId = aid;
        }
      }

      if (body.projectId !== undefined) {
        if (body.projectId === null) {
          data.projectId = null;
        } else {
          const pid = Number(body.projectId);
          await assertValidLinkedProjectForSprint(tx, current.sprint.scrumId, pid);
          data.projectId = pid;
        }
      }
    }

    const [updated, trackedAgg] = await Promise.all([
      tx.sprintProject.update({
        where: { id: itemId },
        data,
        select: {
          id: true,
          sprintId: true,
          projectId: true,
          name: true,
          points: true,
          status: true,
          sortOrder: true,
          createdAt: true,
          updatedAt: true,
          project: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true } },
        },
      }),
      tx.workSession.aggregate({
        where: {
          sprintProjectId: itemId,
          approval: { not: "REJECTED" },
          ...(canEdit ? {} : { userId: currentUser.id }),
        },
        _sum: { durationSeconds: true },
        _count: { id: true },
      }),
    ]);

    return formatSprintProjectItem(updated, {
      totalSeconds: trackedAgg._sum.durationSeconds || 0,
      sessionsCount: trackedAgg._count.id || 0,
    });
  });
};

export const deleteSprintProjectService = async (projectId) => {
  await prisma.$transaction(async (tx) => {
    const sessionCount = await tx.workSession.count({
      where: { sprintProjectId: projectId },
    });

    if (sessionCount > 0) {
      throw new HandleERROR(
        "امکان حذف این پروژه اسپرینت به دلیل وجود سشن‌های کاری ثبت‌شده روی آن وجود ندارد",
        409
      );
    }

    await tx.sprintProject.delete({
      where: { id: projectId },
    });
  });
};

export const getKpisService = async (scrumId, isAdmin = false) => {
  const kpis = await prisma.scrumKpi.findMany({
    where: { scrumId },
    take: MAX_LIST_LIMIT,
    orderBy: { sortOrder: "asc" },
  });

  return serializeKpiRows(kpis, isAdmin);
};

export const batchUpdateKpisService = async (scrumId, rawRows = [], isAdmin = false) => {
  const isRowEmpty = (r) => {
    const fields = [
      r.indicator,
      r.formula,
      r.strategicGoal,
      r.unit,
      r.target,
      r.firstMonthTarget,
      r.actualValue,
      r.minExpected,
    ];
    return fields.every(
      (f) => f === undefined || f === null || f === "" || (typeof f === "string" && f.trim() === "")
    );
  };

  const toNullableDecimal = (val) =>
    val !== undefined && val !== null && val !== "" ? Number(val) : null;

  const updatedRows = await prisma.$transaction(async (tx) => {
    const existing = await tx.scrumKpi.findMany({
      where: { scrumId },
      select: { id: true },
    });

    const existingIds = new Set(existing.map((e) => e.id));

    for (const r of rawRows) {
      if (r.id !== undefined && r.id !== null && !existingIds.has(Number(r.id))) {
        throw new HandleERROR("ردیف KPI با شناسه نامعتبر یا متعلق به اسکرام دیگر ارسال شده است", 400);
      }
    }

    const validRows = rawRows.filter((r) => !isRowEmpty(r));
    const payloadIds = new Set(validRows.filter((r) => r.id).map((r) => Number(r.id)));

    const toDelete = existing.filter((e) => !payloadIds.has(e.id)).map((e) => e.id);
    if (toDelete.length > 0) {
      await tx.scrumKpi.deleteMany({
        where: { id: { in: toDelete } },
      });
    }

    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i];
      const data = {
        indicator: typeof r.indicator === "string" && r.indicator.trim() ? r.indicator.trim() : null,
        formula: typeof r.formula === "string" && r.formula.trim() ? r.formula.trim() : null,
        strategicGoal:
          typeof r.strategicGoal === "string" && r.strategicGoal.trim() ? r.strategicGoal.trim() : null,
        unit: typeof r.unit === "string" && r.unit.trim() ? r.unit.trim() : null,
        target: toNullableDecimal(r.target),
        firstMonthTarget: toNullableDecimal(r.firstMonthTarget),
        actualValue: toNullableDecimal(r.actualValue),
        minExpected: toNullableDecimal(r.minExpected),
        sortOrder: i,
      };

      if (r.id) {
        await tx.scrumKpi.update({
          where: { id: Number(r.id) },
          data,
        });
      } else {
        await tx.scrumKpi.create({
          data: {
            ...data,
            scrumId,
          },
        });
      }
    }

    return await tx.scrumKpi.findMany({
      where: { scrumId },
      orderBy: { sortOrder: "asc" },
    });
  });

  return serializeKpiRows(updatedRows, isAdmin);
};

export const getEventsService = async (scrumId) => {
  const events = await prisma.scrumEvent.findMany({
    where: { scrumId },
    take: MAX_LIST_LIMIT,
    orderBy: { sortOrder: "asc" },
  });

  return events.map(formatEventRow);
};

export const batchUpdateEventsService = async (scrumId, rawRows = []) => {
  const updatedEvents = await prisma.$transaction(async (tx) => {
    const existing = await tx.scrumEvent.findMany({
      where: { scrumId },
      select: { id: true },
    });

    const existingIds = new Set(existing.map((e) => e.id));

    for (const r of rawRows) {
      if (r.id !== undefined && r.id !== null && !existingIds.has(Number(r.id))) {
        throw new HandleERROR("رویداد با شناسه نامعتبر یا متعلق به اسکرام دیگر ارسال شده است", 400);
      }
    }

    const validRows = rawRows.filter((r) => !isEventRowEmpty(r));
    const payloadIds = new Set(validRows.filter((r) => r.id).map((r) => Number(r.id)));

    const toDelete = existing.filter((e) => !payloadIds.has(e.id)).map((e) => e.id);
    if (toDelete.length > 0) {
      await tx.scrumEvent.deleteMany({
        where: { id: { in: toDelete } },
      });
    }

    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i];
      const data = {
        name: r.name.trim(),
        scheduleType: r.scheduleType,
        dayOfWeek: r.scheduleType === "WEEKLY" ? Number(r.dayOfWeek) : null,
        date: r.scheduleType === "ONCE" && r.date ? toDateOnly(r.date) : null,
        startTime: typeof r.startTime === "string" && r.startTime.trim() ? r.startTime.trim() : null,
        durationMinutes:
          r.durationMinutes !== undefined && r.durationMinutes !== null && r.durationMinutes !== ""
            ? Number(r.durationMinutes)
            : null,
        inputs: typeof r.inputs === "string" && r.inputs.trim() ? r.inputs.trim() : null,
        outputs: typeof r.outputs === "string" && r.outputs.trim() ? r.outputs.trim() : null,
        sortOrder: i,
      };

      if (r.id) {
        await tx.scrumEvent.update({
          where: { id: Number(r.id) },
          data,
        });
      } else {
        await tx.scrumEvent.create({
          data: {
            ...data,
            scrumId,
          },
        });
      }
    }

    return await tx.scrumEvent.findMany({
      where: { scrumId },
      orderBy: { sortOrder: "asc" },
    });
  });

  return updatedEvents.map(formatEventRow);
};

export const getTodayEventsService = async (currentUser) => {
  const scrumWhere = getVisibleScrumsWhere(currentUser, { isActive: true });

  const activeScrums = await prisma.scrum.findMany({
    where: scrumWhere,
    take: MAX_LIST_LIMIT,
    select: { id: true, name: true, color: true },
  });

  if (activeScrums.length === 0) {
    return [];
  }

  const scrumMap = new Map(activeScrums.map((s) => [s.id, s]));
  const activeScrumIds = activeScrums.map((s) => s.id);

  const today = todayDate();
  const persianDayOfWeek = getTehranPersianDayOfWeek();

  const events = await prisma.scrumEvent.findMany({
    where: {
      scrumId: { in: activeScrumIds },
      OR: [
        {
          scheduleType: "WEEKLY",
          dayOfWeek: persianDayOfWeek,
        },
        {
          scheduleType: "ONCE",
          date: today,
        },
      ],
    },
    take: MAX_LIST_LIMIT,
    orderBy: [{ startTime: "asc" }, { sortOrder: "asc" }],
  });

  return events.map((e) => {
    const sc = scrumMap.get(e.scrumId);
    return {
      id: e.id,
      scrumId: e.scrumId,
      scrumName: sc?.name || "",
      scrumColor: sc?.color || "ECOSYSTEM",
      name: e.name,
      scheduleType: e.scheduleType,
      dayOfWeek: e.dayOfWeek,
      date: formatDate(e.date),
      startTime: e.startTime,
      durationMinutes: e.durationMinutes,
      inputs: e.inputs,
      outputs: e.outputs,
    };
  });
};

export const getWorkTargetsMineService = async (currentUser, now = new Date()) => {
  const userId = currentUser.id;
  const isSuperAdmin = currentUser.role === "SUPER_ADMIN";
  const isAttendanceAdmin = currentUser.role === "ADMIN";

  // 1. Fetch active candidate projects visible to user (ADMIN uses studio projects via this too)
  const candidateProjects = await prisma.project.findMany({
    where: {
      isActive: true,
      ...(isSuperAdmin ? {} : { members: { some: { userId } } }),
    },
    take: MAX_LIST_LIMIT,
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      scrumId: true,
      members: {
        where: { userId },
        select: { userId: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const trackableProjectIds = new Set(candidateProjects.map((p) => p.id));

  // 2. scrums: ADMIN has zero access to Scrum targets
  let scrumsFormatted = [];
  let memberScrumIds = new Set();
  const excludedFromStudioIds = new Set();
  const linkedProjectScrumMap = new Map();

  if (!isAttendanceAdmin) {
    const userScrums = await prisma.scrum.findMany({
      where: {
        isActive: true,
        members: { some: { userId } },
      },
      take: MAX_LIST_LIMIT,
      select: {
        id: true,
        name: true,
        color: true,
        sprints: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            number: true,
            title: true,
            projects: {
              where: { assigneeId: userId },
              select: {
                id: true,
                name: true,
                points: true,
                status: true,
              },
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            },
          },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    });

    memberScrumIds = new Set(userScrums.map((s) => s.id));

    for (const s of userScrums) {
      const activeSprint = s.sprints[0] || null;
      const items = activeSprint
        ? activeSprint.projects.map((p) => ({
            id: p.id,
            name: p.name,
            points: p.points,
            status: p.status,
          }))
        : [];

      // Linked active projects where caller has a ProjectMember row move into this scrum group
      const linkedProjectsForScrum = candidateProjects
        .filter((p) => p.scrumId === s.id && p.members.length > 0)
        .map((p) => {
          excludedFromStudioIds.add(p.id);
          linkedProjectScrumMap.set(p.id, s.name);
          return {
            id: p.id,
            name: p.name,
          };
        });

      if (items.length > 0 || linkedProjectsForScrum.length > 0) {
        scrumsFormatted.push({
          scrum: {
            id: s.id,
            name: s.name,
            color: s.color,
          },
          sprint: activeSprint
            ? {
                id: activeSprint.id,
                number: activeSprint.number,
                title: activeSprint.title,
              }
            : null,
          items,
          projects: linkedProjectsForScrum,
        });
      }
    }
  }

  // Remaining projects appear in studioProjects (plus any unlinked, inactive-scrum, or non-scrum-member projects)
  const studioProjects = candidateProjects
    .filter((p) => !excludedFromStudioIds.has(p.id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      createdAt: p.createdAt,
    }));

  // 3. recent targets: up to 3 most recently used still-trackable targets
  const recentSessions = await prisma.workSession.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      projectId: true,
      sprintProjectId: true,
      project: { select: { id: true, name: true, isActive: true } },
      sprintProject: {
        select: {
          id: true,
          name: true,
          points: true,
          status: true,
          assigneeId: true,
          sprint: {
            select: {
              id: true,
              number: true,
              title: true,
              status: true,
              completedAt: true,
              scrum: { select: { id: true, name: true, color: true, isActive: true } },
            },
          },
        },
      },
    },
  });

  const recent = [];
  const seen = new Set();
  const nowMs = now.getTime();

  for (const s of recentSessions) {
    if (recent.length >= 3) break;

    if (s.sprintProjectId && s.sprintProject && !isAttendanceAdmin) {
      const sp = s.sprintProject;
      const sprint = sp.sprint;
      const scrum = sprint?.scrum;
      const isSprintTrackable =
        sprint?.status === "ACTIVE" ||
        (sprint?.status === "COMPLETED" &&
          sprint.completedAt &&
          nowMs - new Date(sprint.completedAt).getTime() <= 60 * 60 * 1000);

      const isTrackableTarget =
        Boolean(scrum?.isActive) &&
        memberScrumIds.has(scrum.id) &&
        sp.assigneeId === userId &&
        isSprintTrackable;

      const key = `SPRINT_${s.sprintProjectId}`;
      if (!seen.has(key) && isTrackableTarget) {
        seen.add(key);
        recent.push({
          kind: "SPRINT",
          id: sp.id,
          name: sp.name,
          points: sp.points,
          status: sp.status,
          pathLabel: `[${scrum.name} · S${sprint.number}] ${sp.name}`,
          scrum: {
            id: scrum.id,
            name: scrum.name,
            color: scrum.color,
          },
          sprint: {
            id: sprint.id,
            number: sprint.number,
            title: sprint.title,
          },
        });
      }
    } else if (s.projectId && s.project) {
      const key = `STUDIO_${s.projectId}`;
      if (!seen.has(key) && s.project.isActive && trackableProjectIds.has(s.projectId)) {
        seen.add(key);
        const scrumName = linkedProjectScrumMap.get(s.projectId);
        recent.push({
          kind: "STUDIO",
          id: s.project.id,
          name: s.project.name,
          pathLabel: scrumName ? `[${scrumName}] ${s.project.name}` : s.project.name,
        });
      }
    }
  }

  return {
    recent,
    scrums: scrumsFormatted,
    studioProjects,
  };
};

export const getScrumReportService = async (
  scrumId,
  { sprintId, from, to },
  currentUser,
  canEdit
) => {
  const sprintWhere = { scrumId };
  if (sprintId) sprintWhere.id = Number(sprintId);

  const [sprints, linkedProjects] = await Promise.all([
    prisma.sprint.findMany({
      where: sprintWhere,
      take: MAX_LIST_LIMIT,
      select: {
        id: true,
        number: true,
        title: true,
        projects: {
          select: {
            id: true,
            name: true,
            points: true,
            status: true,
            project: { select: { id: true, name: true } },
            assignee: { select: { id: true, name: true } },
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
      },
      orderBy: { number: "asc" },
    }),
    sprintId
      ? []
      : prisma.project.findMany({
          where: { scrumId },
          take: MAX_LIST_LIMIT,
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
  ]);

  if (sprintId && sprints.length === 0) {
    throw new HandleERROR("اسپرینت یافت نشد", 404);
  }

  const allSprintItemIds = sprints.flatMap((s) => s.projects.map((p) => p.id));
  const linkedProjectIds = linkedProjects.map((p) => p.id);

  let workDateFilter;
  if (from || to) {
    workDateFilter = {};
    if (from) workDateFilter.gte = toDateOnly(from);
    if (to) workDateFilter.lte = toDateOnly(to);
  }

  const baseSessionFilter = {
    approval: { not: "REJECTED" },
    ...(canEdit ? {} : { userId: currentUser.id }),
    ...(workDateFilter ? { workDate: workDateFilter } : {}),
  };

  // DB groupBy aggregations scoped by userId when !canEdit so plain members
  // never see teammates' tracked seconds or session counts anywhere in the report.
  const [groupedSprintSessions, groupedProjectSessions] = await Promise.all([
    allSprintItemIds.length > 0
      ? prisma.workSession.groupBy({
          by: ["sprintProjectId", "userId"],
          where: {
            ...baseSessionFilter,
            sprintProjectId: { in: allSprintItemIds },
          },
          _sum: { durationSeconds: true },
          _count: { id: true },
        })
      : [],
    linkedProjectIds.length > 0
      ? prisma.workSession.groupBy({
          by: ["projectId", "userId"],
          where: {
            ...baseSessionFilter,
            projectId: { in: linkedProjectIds },
          },
          _sum: { durationSeconds: true },
          _count: { id: true },
        })
      : [],
  ]);

  const sessionUserIds = [
    ...new Set([
      ...groupedSprintSessions.map((g) => g.userId),
      ...groupedProjectSessions.map((g) => g.userId),
    ]),
  ];
  const sessionUsers =
    sessionUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: sessionUserIds } },
          select: { id: true, name: true },
        })
      : [];
  const userNameMap = new Map(sessionUsers.map((u) => [u.id, u.name]));

  const itemSessionsMap = new Map();
  for (const g of groupedSprintSessions) {
    if (!itemSessionsMap.has(g.sprintProjectId)) {
      itemSessionsMap.set(g.sprintProjectId, []);
    }
    itemSessionsMap.get(g.sprintProjectId).push({
      userId: g.userId,
      userName: userNameMap.get(g.userId) || "Unknown",
      sessionCount: g._count.id || 0,
      totalSeconds: g._sum.durationSeconds || 0,
    });
  }

  const projectSessionsMap = new Map();
  for (const g of groupedProjectSessions) {
    if (!projectSessionsMap.has(g.projectId)) {
      projectSessionsMap.set(g.projectId, []);
    }
    projectSessionsMap.get(g.projectId).push({
      userId: g.userId,
      userName: userNameMap.get(g.userId) || "Unknown",
      sessionCount: g._count.id || 0,
      totalSeconds: g._sum.durationSeconds || 0,
    });
  }

  const rows = [];
  const sprintAggregates = [];
  let grandTotalPoints = 0;
  let grandDonePoints = 0;
  let grandTotalSeconds = 0;
  let grandSessionCount = 0;

  for (const sp of sprints) {
    let sprintTotalPoints = 0;
    let sprintDonePoints = 0;
    let sprintTotalSeconds = 0;
    let sprintSessionCount = 0;

    for (const item of sp.projects) {
      sprintTotalPoints += item.points || 0;
      if (item.status === "DONE") {
        sprintDonePoints += item.points || 0;
      }

      const itemEntries = itemSessionsMap.get(item.id) || [];
      const linkedProjSummary = item.project ? { id: item.project.id, name: item.project.name } : null;

      if (itemEntries.length === 0) {
        const assignee = item.assignee;
        const isMyRow = assignee?.id === currentUser.id;

        if (canEdit || isMyRow) {
          rows.push({
            kind: "SPRINT_ITEM",
            member: assignee ? { id: assignee.id, name: assignee.name } : null,
            item: {
              id: item.id,
              name: item.name,
              points: item.points,
              status: item.status,
              sprint: {
                id: sp.id,
                number: sp.number,
                title: sp.title,
              },
            },
            project: linkedProjSummary,
            sessionCount: 0,
            totalSeconds: 0,
            secondsPerPoint: null,
          });
        }
      } else {
        for (const entry of itemEntries) {
          sprintTotalSeconds += entry.totalSeconds;
          sprintSessionCount += entry.sessionCount;

          rows.push({
            kind: "SPRINT_ITEM",
            member: {
              id: entry.userId,
              name: entry.userName,
            },
            item: {
              id: item.id,
              name: item.name,
              points: item.points,
              status: item.status,
              sprint: {
                id: sp.id,
                number: sp.number,
                title: sp.title,
              },
            },
            project: linkedProjSummary,
            sessionCount: entry.sessionCount,
            totalSeconds: entry.totalSeconds,
            secondsPerPoint: item.points > 0 ? Math.round(entry.totalSeconds / item.points) : null,
          });
        }
      }
    }

    sprintAggregates.push({
      sprintId: sp.id,
      sprintNumber: sp.number,
      sprintTitle: sp.title,
      totalPoints: sprintTotalPoints,
      donePoints: sprintDonePoints,
      totalSeconds: sprintTotalSeconds,
      sessionCount: sprintSessionCount,
    });

    grandTotalPoints += sprintTotalPoints;
    grandDonePoints += sprintDonePoints;
    grandTotalSeconds += sprintTotalSeconds;
    grandSessionCount += sprintSessionCount;
  }

  for (const proj of linkedProjects) {
    const entries = projectSessionsMap.get(proj.id) || [];
    entries.sort((a, b) => a.userName.localeCompare(b.userName));

    for (const entry of entries) {
      grandTotalSeconds += entry.totalSeconds;
      grandSessionCount += entry.sessionCount;

      rows.push({
        kind: "PROJECT",
        member: {
          id: entry.userId,
          name: entry.userName,
        },
        item: null,
        project: {
          id: proj.id,
          name: proj.name,
        },
        sessionCount: entry.sessionCount,
        totalSeconds: entry.totalSeconds,
        secondsPerPoint: null,
      });
    }
  }

  return {
    rows,
    sprintAggregates,
    total: {
      totalPoints: grandTotalPoints,
      donePoints: grandDonePoints,
      totalSeconds: grandTotalSeconds,
      sessionCount: grandSessionCount,
    },
  };
};
