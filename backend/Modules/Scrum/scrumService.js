import { HandleERROR } from "vanta-api";
import { Prisma } from "../../generated/prisma/client.ts";
import prisma from "../../config/prisma.js";
import { todayDate, toDateOnly, formatDate, getTimezoneParts } from "../../Utils/date.js";
import { invalidateUserAuthCache, invalidateUsersAuthCache } from "../../Utils/cache.js";
import {
  getVisibleScrumsWhere,
  isScrumAdminOf,
  isScrumAdminRole,
} from "./scrumAccess.js";
import {
  canViewAttendanceTotals,
  fetchGroupedAttendanceTotals,
  serializeScrumMemberPerformance,
} from "./scrumScope.js";
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
  const isScrumAdmin = isScrumAdminRole(currentUser.role) && Boolean(isAssignedAdmin);
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
      role: { in: ["SCRUM_ADMIN", "ADMIN"] },
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  if (users.length !== uniqueIds.length) {
    throw new HandleERROR(
      "همه ادمین‌های اسکرام باید کاربر فعال با نقش SCRUM_ADMIN یا ADMIN باشند",
      422
    );
  }

  return users;
};

/**
 * Shared helper removing ScrumMember rows along with any TaskMember assignments inside `scrumId`.
 * Reused across syncScrumMembers, admin removal (when removing membership), and membership toggle.
 */
export const removeScrumMembershipAndTasks = async (tx, scrumId, userIds = []) => {
  const uniqueIds = [...new Set(userIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  if (uniqueIds.length === 0) return;

  await tx.taskMember.deleteMany({
    where: {
      task: { scrumId },
      userId: { in: uniqueIds },
    },
  });

  await tx.scrumMember.deleteMany({
    where: {
      scrumId,
      userId: { in: uniqueIds },
    },
  });
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

const formatSprintSummary = (sprint) => ({
  id: sprint.id,
  scrumId: sprint.scrumId,
  number: sprint.number,
  title: sprint.title,
  description: sprint.description,
  startDate: formatDate(sprint.startDate),
  endDate: formatDate(sprint.endDate),
  status: sprint.status,
  progressPercent: sprint.progressPercent ?? 0,
  completedAt: sprint.completedAt,
  createdAt: sprint.createdAt,
  updatedAt: sprint.updatedAt,
});

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
        select: { members: true, tasks: true },
      },
      sprints: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          number: true,
          title: true,
          progressPercent: true,
        },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const scrumMetaList = scrums.map((s) => {
    const admins = s.admins.map((a) => ({
      id: a.user.id,
      name: a.user.name,
    }));
    const isAssignedAdmin = admins.some((a) => a.id === currentUser.id);
    const meta = buildScrumAccessMeta(currentUser, isAssignedAdmin);
    return { s, admins, meta };
  });

  const scopedScrumIds = scrumMetaList
    .filter(({ meta }) => !meta.permissions.canEditContent)
    .map(({ s }) => s.id);

  let assignedTaskCountMap = new Map();
  if (scopedScrumIds.length > 0) {
    const countRows = await prisma.$queryRaw(Prisma.sql`
      SELECT t."scrumId"::int AS "scrumId", COUNT(DISTINCT t."id")::int AS "taskCount"
      FROM "Task" t
      JOIN "TaskMember" tm ON tm."taskId" = t."id"
      WHERE t."scrumId" = ANY(${scopedScrumIds}::int[])
        AND tm."userId" = ${currentUser.id}
      GROUP BY t."scrumId"
    `);
    assignedTaskCountMap = new Map(
      countRows.map((row) => [Number(row.scrumId), Number(row.taskCount || 0)])
    );
  }

  return scrumMetaList.map(({ s, admins, meta }) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    color: s.color,
    isActive: s.isActive,
    admins,
    memberCount: s._count.members,
    taskCount: meta.permissions.canEditContent
      ? s._count.tasks
      : assignedTaskCountMap.get(s.id) || 0,
    ...meta,
    activeSprint: s.sprints[0] || null,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));
};

export const createScrumService = async (
  { name, description, color, admins = [] },
  currentUser
) => {
  if (currentUser.role !== "SUPER_ADMIN") {
    throw new HandleERROR("فقط سوپرادمین مجاز به ایجاد اسکرام است", 403);
  }

  const adminEntries = Array.isArray(admins) ? admins : [];
  for (let i = 0; i < adminEntries.length; i++) {
    const entry = adminEntries[i];
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof entry.alsoMember !== "boolean"
    ) {
      throw new HandleERROR(
        `فیلد alsoMember (boolean) در ردیف ادمین ${i + 1} الزامی است`,
        422
      );
    }
  }

  const uniqueAdminIds = [...new Set(adminEntries.map((a) => Number(a.userId)))];
  if (uniqueAdminIds.length !== adminEntries.length) {
    throw new HandleERROR("شناسه کاربران در لیست admins نباید تکراری باشد", 400);
  }

  const memberAdminIds = adminEntries
    .filter((a) => a.alsoMember === true)
    .map((a) => Number(a.userId));

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

    if (memberAdminIds.length > 0) {
      await tx.scrumMember.createMany({
        data: memberAdminIds.map((userId) => ({
          scrumId: scrum.id,
          userId,
        })),
        skipDuplicates: true,
      });
    }

    return scrum;
  });

  if (uniqueAdminIds.length > 0) {
    await invalidateUsersAuthCache(uniqueAdminIds);
  }

  return await getScrumDetailsService(created.id, currentUser);
};

const formatScrumMembersPayload = async (
  scrumMembers = [],
  adminUserIdSet,
  currentUser,
  isAssignedAdmin,
  { includeAttendanceTotals = false } = {}
) => {
  const memberUserIds = scrumMembers.map((m) => m.user.id);
  const allowAttendanceTotals =
    includeAttendanceTotals && canViewAttendanceTotals(currentUser, isAssignedAdmin);
  const totalsMap =
    allowAttendanceTotals && memberUserIds.length > 0
      ? await fetchGroupedAttendanceTotals(memberUserIds)
      : null;

  return scrumMembers.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    label: m.label || null,
    isAdmin: adminUserIdSet.has(m.user.id),
    ...serializeScrumMemberPerformance(m, currentUser, m.user.id, {
      isScrumAdminOfScrum: isAssignedAdmin,
    }),
    ...(totalsMap
      ? {
          attendanceTotals: totalsMap.get(m.user.id) || {
            present: 0,
            pending: 0,
            absent: 0,
          },
        }
      : {}),
  }));
};

export const getScrumDetailsService = async (
  scrumId,
  currentUser,
  { includeAttendanceTotals = false } = {}
) => {
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
              role: true,
            },
          },
        },
        orderBy: { user: { name: "asc" } },
      },
      members: {
        select: {
          label: true,
          performance: true,
          performanceNote: true,
          performanceUpdatedAt: true,
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
        select: { tasks: true },
      },
      sprints: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          number: true,
          title: true,
          progressPercent: true,
        },
        take: 1,
      },
    },
  });

  if (!scrum) {
    throw new HandleERROR("اسکرام یافت نشد", 404);
  }

  const adminUserIdSet = new Set(scrum.admins.map((a) => a.user.id));
  const memberUserIdSet = new Set(scrum.members.map((m) => m.user.id));

  const admins = scrum.admins.map((a) => ({
    id: a.user.id,
    name: a.user.name,
    role: a.user.role,
    isMember: memberUserIdSet.has(a.user.id),
  }));

  const isAssignedAdmin =
    isScrumAdminRole(currentUser.role) && adminUserIdSet.has(currentUser.id);
  const meta = buildScrumAccessMeta(currentUser, isAssignedAdmin);

  const [visibleTaskCount, membersPayload] = await Promise.all([
    meta.permissions.canEditContent
      ? Promise.resolve(scrum._count.tasks)
      : prisma.task.count({
          where: {
            scrumId,
            members: { some: { userId: currentUser.id } },
          },
        }),
    formatScrumMembersPayload(
      scrum.members,
      adminUserIdSet,
      currentUser,
      isAssignedAdmin,
      { includeAttendanceTotals }
    ),
  ]);

  return {
    id: scrum.id,
    name: scrum.name,
    description: scrum.description,
    color: scrum.color,
    isActive: scrum.isActive,
    admins,
    memberCount: scrum.members.length,
    taskCount: visibleTaskCount,
    ...meta,
    activeSprint: scrum.sprints[0] || null,
    createdAt: scrum.createdAt,
    updatedAt: scrum.updatedAt,
    members: membersPayload,
  };
};

export const getScrumMembersService = async (
  scrumId,
  currentUser,
  { includeAttendanceTotals = false } = {}
) => {
  const [adminRows, members] = await Promise.all([
    prisma.scrumAdmin.findMany({
      where: { scrumId },
      select: { userId: true },
    }),
    prisma.scrumMember.findMany({
      where: { scrumId },
      select: {
        label: true,
        performance: true,
        performanceNote: true,
        performanceUpdatedAt: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { user: { name: "asc" } },
    }),
  ]);

  const adminUserIdSet = new Set(adminRows.map((a) => a.userId));
  const isAssignedAdmin =
    isScrumAdminRole(currentUser.role) && adminUserIdSet.has(currentUser.id);

  return await formatScrumMembersPayload(
    members,
    adminUserIdSet,
    currentUser,
    isAssignedAdmin,
    { includeAttendanceTotals }
  );
};

export const addScrumAdminService = async (
  scrumId,
  { userId, alsoMember },
  currentUser
) => {
  if (typeof alsoMember !== "boolean") {
    throw new HandleERROR("فیلد alsoMember (boolean) الزامی است", 422);
  }

  const targetUserId = Number(userId);
  const [validUser] = await assertValidScrumAdminUsers(prisma, [targetUserId]);

  await prisma.$transaction(async (tx) => {
    const existingAdmin = await tx.scrumAdmin.findUnique({
      where: {
        scrumId_userId: { scrumId, userId: targetUserId },
      },
      select: { userId: true },
    });

    if (existingAdmin) {
      throw new HandleERROR("این کاربر هم‌اکنون ادمین این اسکرام است", 409);
    }

    await tx.scrumAdmin.create({
      data: {
        scrumId,
        userId: targetUserId,
        assignedById: currentUser.id,
      },
    });

    if (alsoMember) {
      await tx.scrumMember.upsert({
        where: {
          scrumId_userId: { scrumId, userId: targetUserId },
        },
        create: {
          scrumId,
          userId: targetUserId,
        },
        update: {},
      });
    }
  });

  await invalidateUserAuthCache(targetUserId);

  const memberRow = await prisma.scrumMember.findUnique({
    where: { scrumId_userId: { scrumId, userId: targetUserId } },
    select: { userId: true },
  });

  return {
    scrumId,
    userId: targetUserId,
    name: validUser.name,
    role: validUser.role,
    isMember: Boolean(memberRow),
  };
};

export const removeScrumAdminService = async (
  scrumId,
  targetUserId,
  { keepMembership } = {}
) => {
  const uid = Number(targetUserId);

  const result = await prisma.$transaction(async (tx) => {
    const existingAdmin = await tx.scrumAdmin.findUnique({
      where: {
        scrumId_userId: { scrumId, userId: uid },
      },
      include: {
        user: {
          select: { id: true, role: true },
        },
      },
    });

    if (!existingAdmin) {
      throw new HandleERROR("ادمین مورد نظر در این اسکرام یافت نشد", 404);
    }

    const existingMember = await tx.scrumMember.findUnique({
      where: {
        scrumId_userId: { scrumId, userId: uid },
      },
      select: { userId: true },
    });

    let removeMembership = false;
    if (existingMember) {
      if (existingAdmin.user.role === "ADMIN") {
        // Studio ADMIN relates to a Scrum strictly by administering it; unassign always removes membership
        removeMembership = true;
      } else {
        if (keepMembership === undefined || keepMembership === null || keepMembership === "") {
          throw new HandleERROR(
            "برای حذف ادمینی که عضو اسکرام است، تعیین پارامتر keepMembership (true یا false) الزامی است",
            422
          );
        }
        const parsedKeep =
          keepMembership === true || keepMembership === "true";
        removeMembership = !parsedKeep;
      }
    }

    await tx.scrumAdmin.delete({
      where: {
        scrumId_userId: { scrumId, userId: uid },
      },
    });

    if (removeMembership) {
      await removeScrumMembershipAndTasks(tx, scrumId, [uid]);
    }

    return {
      scrumId,
      userId: uid,
      removedMembership: removeMembership,
      isMember: Boolean(existingMember) && !removeMembership,
    };
  });

  await invalidateUserAuthCache(uid);
  return result;
};

export const updateScrumAdminMembershipService = async (
  scrumId,
  targetUserId,
  { isMember }
) => {
  const uid = Number(targetUserId);

  await prisma.$transaction(async (tx) => {
    const existingAdmin = await tx.scrumAdmin.findUnique({
      where: {
        scrumId_userId: { scrumId, userId: uid },
      },
      include: {
        user: {
          select: { id: true, role: true },
        },
      },
    });

    if (!existingAdmin) {
      throw new HandleERROR("کاربر مورد نظر ادمین این اسکرام نیست", 404);
    }

    if (isMember) {
      if (existingAdmin.user.role === "SUPER_ADMIN") {
        throw new HandleERROR("سوپرادمین نمی‌تواند عضو اسکرام باشد", 422);
      }
      await tx.scrumMember.upsert({
        where: {
          scrumId_userId: { scrumId, userId: uid },
        },
        create: {
          scrumId,
          userId: uid,
        },
        update: {},
      });
    } else {
      await removeScrumMembershipAndTasks(tx, scrumId, [uid]);
    }
  });

  await invalidateUserAuthCache(uid);

  return {
    scrumId,
    userId: uid,
    isMember: Boolean(isMember),
  };
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
  const affectedUserIds = await prisma.$transaction(async (tx) => {
    const sessionCount = await tx.workSession.count({
      where: {
        task: {
          scrumId,
        },
      },
    });

    if (sessionCount > 0) {
      throw new HandleERROR(
        "امکان حذف این اسکرام به دلیل وجود سشن‌های کاری ثبت‌شده روی تسک‌های آن وجود ندارد. می‌توانید آن را غیرفعال (آرشیو) کنید.",
        409
      );
    }

    const [admins, members] = await Promise.all([
      tx.scrumAdmin.findMany({ where: { scrumId }, select: { userId: true } }),
      tx.scrumMember.findMany({ where: { scrumId }, select: { userId: true } }),
    ]);

    await tx.scrum.delete({
      where: { id: scrumId },
    });

    return [...new Set([...admins.map((a) => a.userId), ...members.map((m) => m.userId)])];
  });

  if (affectedUserIds.length > 0) {
    await invalidateUsersAuthCache(affectedUserIds);
  }
};

export const syncScrumMembersService = async (scrumId, memberList = [], currentUser) => {
  const targetUserIds = memberList.map((m) => Number(m.userId));

  const [existingAdmins, existingMembers, requestedUsers] = await Promise.all([
    prisma.scrumAdmin.findMany({
      where: { scrumId },
      select: { userId: true },
    }),
    prisma.scrumMember.findMany({
      where: { scrumId },
      select: { userId: true, label: true },
    }),
    targetUserIds.length > 0
      ? prisma.user.findMany({
          where: {
            id: { in: targetUserIds },
            isActive: true,
          },
          select: { id: true, role: true },
        })
      : [],
  ]);

  const adminIdSet = new Set(existingAdmins.map((a) => a.userId));
  const existingMap = new Map(existingMembers.map((e) => [e.userId, e.label ?? null]));

  if (targetUserIds.length > 0) {
    const userById = new Map(requestedUsers.map((u) => [u.id, u]));
    const invalidIds = targetUserIds.filter((id) => !userById.has(id));

    if (invalidIds.length > 0) {
      throw new HandleERROR(
        `کاربران با شناسه ${invalidIds.join(", ")} نامعتبر یا غیرفعال هستند`,
        400
      );
    }

    const superAdminUsers = requestedUsers.filter((u) => u.role === "SUPER_ADMIN");
    if (superAdminUsers.length > 0) {
      throw new HandleERROR("سوپرادمین نمی‌تواند عضو اسکرام باشد", 422);
    }

    // ADMIN-role users cannot be added via Members sync; existing member-admins remain manageable via admin endpoints
    const disallowedAdminAdds = requestedUsers.filter(
      (u) => u.role === "ADMIN" && !existingMap.has(u.id)
    );
    if (disallowedAdminAdds.length > 0) {
      throw new HandleERROR(
        "کاربران با نقش ADMIN را نمی‌توان از بخش اعضا اضافه کرد؛ لطفاً از بخش ادمین‌های اسکرام و گزینه عضویت استفاده کنید",
        422
      );
    }
  }

  const { addedIds, removedIds, updatedMembers } = await prisma.$transaction(async (tx) => {
    const targetSet = new Set(targetUserIds);
    // Users who are ScrumAdmins of S are NEVER removed by a Members sync
    const removedIds = existingMembers
      .map((e) => e.userId)
      .filter((id) => !targetSet.has(id) && !adminIdSet.has(id));

    if (removedIds.length > 0) {
      await removeScrumMembershipAndTasks(tx, scrumId, removedIds);
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
        performance: true,
        performanceNote: true,
        performanceUpdatedAt: true,
        user: { select: { id: true, name: true } },
      },
      orderBy: { user: { name: "asc" } },
    });

    return {
      addedIds: toCreate.map((c) => c.userId),
      removedIds,
      updatedMembers,
    };
  });

  const membershipChangedIds = [...addedIds, ...removedIds];
  if (membershipChangedIds.length > 0) {
    await invalidateUsersAuthCache(membershipChangedIds);
  }

  const isAssignedAdmin =
    Boolean(currentUser) &&
    isScrumAdminRole(currentUser.role) &&
    adminIdSet.has(currentUser.id);

  return await formatScrumMembersPayload(
    updatedMembers,
    adminIdSet,
    currentUser,
    isAssignedAdmin
  );
};

export const updateScrumMemberPerformanceService = async (
  scrumId,
  targetUserId,
  { level, note },
  actorUser
) => {
  const uid = Number(targetUserId);

  if (actorUser.id === uid) {
    throw new HandleERROR("شما مجاز به ثبت وضعیت عملکرد برای خود نیستید", 403);
  }

  const existing = await prisma.scrumMember.findUnique({
    where: {
      scrumId_userId: { scrumId, userId: uid },
    },
    select: { userId: true },
  });

  if (!existing) {
    throw new HandleERROR("کاربر مورد نظر عضو این اسکرام نیست", 404);
  }

  const normalizedNote = typeof note === "string" && note.trim() ? note.trim() : null;

  const updated = await prisma.scrumMember.update({
    where: {
      scrumId_userId: { scrumId, userId: uid },
    },
    data:
      level === null
        ? {
            performance: null,
            performanceNote: null,
            performanceUpdatedAt: null,
            performanceUpdatedById: null,
          }
        : {
            performance: level,
            performanceNote: normalizedNote,
            performanceUpdatedAt: new Date(),
            performanceUpdatedById: actorUser.id,
          },
    select: {
      label: true,
      performance: true,
      performanceNote: true,
      performanceUpdatedAt: true,
      user: { select: { id: true, name: true } },
    },
  });

  return {
    id: updated.user.id,
    name: updated.user.name,
    label: updated.label || null,
    performance: updated.performance ?? null,
    performanceNote: updated.performanceNote ?? null,
    performanceUpdatedAt: updated.performanceUpdatedAt ?? null,
  };
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
      progressPercent: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { number: "asc" },
  });

  return sprints.map(formatSprintSummary);
};

export const createSprintService = async (
  scrumId,
  { title, description, startDate, endDate, progressPercent }
) => {
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
            progressPercent: progressPercent !== undefined ? Number(progressPercent) : 0,
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

export const getSprintDetailsService = async (sprintId) => {
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
      progressPercent: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!sprint) {
    throw new HandleERROR("اسپرینت یافت نشد", 404);
  }

  return formatSprintSummary(sprint);
};

export const updateSprintService = async (
  sprintId,
  { title, description, startDate, endDate, progressPercent }
) => {
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
    if (progressPercent !== undefined) data.progressPercent = Number(progressPercent);

    const updated = await tx.sprint.update({
      where: { id: sprintId },
      data,
    });

    return formatSprintSummary(updated);
  });
};

export const updateSprintStatusService = async (sprintId, newStatus) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.sprint.findUnique({
        where: { id: sprintId },
        select: { id: true, scrumId: true, status: true, completedAt: true },
      });

      if (!current) {
        throw new HandleERROR("اسپرینت یافت نشد", 404);
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
        data.completedAt = current.status === "COMPLETED" && current.completedAt ? current.completedAt : new Date();
      } else {
        data.completedAt = null;
      }

      const updated = await tx.sprint.update({
        where: { id: sprintId },
        data,
      });

      return formatSprintSummary(updated);
    });
  } catch (err) {
    if (err?.code === "P2002") {
      throw new HandleERROR("یک اسپرینت فعال دیگر در این اسکرام وجود دارد", 409);
    }
    throw err;
  }
};

export const deleteSprintService = async (sprintId) => {
  await prisma.sprint.delete({
    where: { id: sprintId },
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
  const VALID_KPI_STATUSES = new Set(["BELOW_MIN", "IN_RANGE", "ON_TARGET"]);

  const isRowEmpty = (r) => {
    const fields = [
      r.indicator,
      r.formula,
      r.strategicGoal,
      r.unit,
      r.target,
      r.firstMonthTarget,
      r.finalTarget,
      r.progressPercent,
      r.status,
      r.minExpected,
    ];
    return fields.every(
      (f) => f === undefined || f === null || f === "" || (typeof f === "string" && f.trim() === "")
    );
  };

  const toNullableText = (val) =>
    typeof val === "string" && val.trim() !== "" ? val.trim() : null;

  const toNullableDecimal = (val) =>
    val !== undefined && val !== null && val !== "" ? Number(val) : null;

  const toNullablePercent = (val) =>
    val !== undefined && val !== null && val !== ""
      ? Math.round(Number(val) * 100) / 100
      : null;

  const toNullableStatus = (val) =>
    typeof val === "string" && VALID_KPI_STATUSES.has(val) ? val : null;

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
        indicator: toNullableText(r.indicator),
        formula: toNullableText(r.formula),
        strategicGoal: toNullableText(r.strategicGoal),
        unit: toNullableText(r.unit),
        target: toNullableText(r.target),
        firstMonthTarget: toNullableText(r.firstMonthTarget),
        finalTarget: toNullableText(r.finalTarget),
        progressPercent: toNullablePercent(r.progressPercent),
        status: toNullableStatus(r.status),
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

  // 1. Fetch active studio projects visible to user
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
    },
    orderBy: { name: "asc" },
  });

  const studioProjects = candidateProjects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    createdAt: p.createdAt,
  }));
  const trackableProjectIds = new Set(studioProjects.map((p) => p.id));

  // 2. Scrum Tasks assigned to current user (relationship-based: ScrumMember + TaskMember, role != SUPER_ADMIN)
  const scrumsFormatted = [];
  const trackableTaskIds = new Set();

  if (!isSuperAdmin) {
    const userScrums = await prisma.scrum.findMany({
      where: {
        isActive: true,
        members: { some: { userId } },
        tasks: {
          some: {
            isActive: true,
            members: { some: { userId } },
          },
        },
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
          },
          take: 1,
        },
        tasks: {
          where: {
            isActive: true,
            members: { some: { userId } },
          },
          select: {
            id: true,
            name: true,
            description: true,
            points: true,
            sprint: {
              select: {
                id: true,
                number: true,
                title: true,
              },
            },
          },
          orderBy: [{ name: "asc" }],
        },
      },
      orderBy: { name: "asc" },
    });

    for (const s of userScrums) {
      if (s.tasks.length === 0) continue;
      for (const t of s.tasks) {
        trackableTaskIds.add(t.id);
      }

      const activeSprint = s.sprints[0] || null;
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
        tasks: s.tasks.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          points: t.points,
          sprint: t.sprint
            ? {
                id: t.sprint.id,
                number: t.sprint.number,
                title: t.sprint.title,
              }
            : null,
        })),
      });
    }
  }

  // 3. Recent targets: up to 3 most recently used still-trackable targets
  const recentSessions = await prisma.workSession.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      projectId: true,
      taskId: true,
      project: { select: { id: true, name: true, isActive: true } },
      task: {
        select: {
          id: true,
          name: true,
          points: true,
          isActive: true,
          sprint: {
            select: {
              id: true,
              number: true,
              title: true,
            },
          },
          scrum: {
            select: {
              id: true,
              name: true,
              color: true,
              isActive: true,
            },
          },
        },
      },
    },
  });

  const recent = [];
  const seen = new Set();

  for (const s of recentSessions) {
    if (recent.length >= 3) break;

    if (s.taskId && s.task && !isSuperAdmin) {
      const key = `TASK_${s.taskId}`;
      if (!seen.has(key) && s.task.isActive && s.task.scrum.isActive && trackableTaskIds.has(s.taskId)) {
        seen.add(key);
        recent.push({
          kind: "TASK",
          id: s.task.id,
          name: s.task.name,
          points: s.task.points,
          pathLabel: `[${s.task.scrum.name}] ${s.task.name}`,
          sprint: s.task.sprint
            ? {
                id: s.task.sprint.id,
                number: s.task.sprint.number,
                title: s.task.sprint.title,
              }
            : null,
          scrum: {
            id: s.task.scrum.id,
            name: s.task.scrum.name,
            color: s.task.scrum.color,
          },
        });
      }
    } else if (s.projectId && s.project) {
      const key = `PROJECT_${s.projectId}`;
      if (!seen.has(key) && s.project.isActive && trackableProjectIds.has(s.projectId)) {
        seen.add(key);
        recent.push({
          kind: "PROJECT",
          id: s.project.id,
          name: s.project.name,
          pathLabel: s.project.name,
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
  { sprintId, taskId, from, to },
  currentUser,
  canEdit
) => {
  if (!canEdit) {
    throw new HandleERROR("شما دسترسی مشاهده گزارش این اسکرام را ندارید", 403);
  }

  const [sprints, tasks] = await Promise.all([
    prisma.sprint.findMany({
      where: { scrumId },
      take: MAX_LIST_LIMIT,
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        progressPercent: true,
        startDate: true,
        endDate: true,
        completedAt: true,
      },
      orderBy: { number: "asc" },
    }),
    prisma.task.findMany({
      where: {
        scrumId,
        ...(taskId ? { id: Number(taskId) } : {}),
      },
      take: MAX_LIST_LIMIT,
      select: {
        id: true,
        name: true,
        description: true,
        points: true,
        isActive: true,
        sprintId: true,
        sprint: {
          select: {
            id: true,
            number: true,
            title: true,
          },
        },
        members: {
          select: {
            user: {
              select: { id: true, name: true },
            },
          },
          orderBy: { user: { name: "asc" } },
        },
      },
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    }),
  ]);

  if (taskId && tasks.length === 0) {
    throw new HandleERROR("تسک یافت نشد", 404);
  }

  const explicitFrom = from ? toDateOnly(from) : null;
  const explicitTo = to ? toDateOnly(to) : null;
  const buildWorkDateFilter = (rangeFrom, rangeTo) => {
    if (!rangeFrom && !rangeTo) return undefined;
    const f = {};
    if (rangeFrom) f.gte = rangeFrom;
    if (rangeTo) f.lte = rangeTo;
    return f;
  };

  let targetSprint = null;
  let sprintFrom = null;
  let sprintTo = null;
  if (sprintId) {
    targetSprint = sprints.find((sp) => sp.id === Number(sprintId));
    if (!targetSprint) {
      throw new HandleERROR("اسپرینت یافت نشد", 404);
    }
    sprintFrom = targetSprint.startDate ? toDateOnly(targetSprint.startDate) : null;
    sprintTo = targetSprint.endDate
      ? toDateOnly(targetSprint.endDate)
      : targetSprint.completedAt
      ? toDateOnly(targetSprint.completedAt)
      : null;
  }

  let groupedTaskSessions = [];
  let reportTasks = tasks;

  if (!targetSprint) {
    const workDateFilter = buildWorkDateFilter(explicitFrom, explicitTo);
    const taskIds = tasks.map((t) => t.id);
    groupedTaskSessions =
      taskIds.length > 0
        ? await prisma.workSession.groupBy({
            by: ["taskId", "userId"],
            where: {
              approval: { not: "REJECTED" },
              ...(workDateFilter ? { workDate: workDateFilter } : {}),
              taskId: { in: taskIds },
            },
            _sum: { durationSeconds: true },
            _count: { id: true },
          })
        : [];
  } else {
    const linkedTasks = tasks.filter((t) => t.sprintId === targetSprint.id);
    const unlinkedTasks =
      sprintFrom || sprintTo ? tasks.filter((t) => t.sprintId === null) : [];

    const linkedTaskIds = linkedTasks.map((t) => t.id);
    const unlinkedTaskIds = unlinkedTasks.map((t) => t.id);

    const linkedWorkDateFilter = buildWorkDateFilter(explicitFrom, explicitTo);

    let unlinkedFrom = explicitFrom;
    if (sprintFrom && (!unlinkedFrom || sprintFrom.getTime() > unlinkedFrom.getTime())) {
      unlinkedFrom = sprintFrom;
    }
    let unlinkedTo = explicitTo;
    if (sprintTo && (!unlinkedTo || sprintTo.getTime() < unlinkedTo.getTime())) {
      unlinkedTo = sprintTo;
    }
    const unlinkedRangeValid =
      !unlinkedFrom || !unlinkedTo || unlinkedFrom.getTime() <= unlinkedTo.getTime();
    const unlinkedWorkDateFilter = buildWorkDateFilter(unlinkedFrom, unlinkedTo);

    const [linkedGrouped, unlinkedGrouped] = await Promise.all([
      linkedTaskIds.length > 0
        ? prisma.workSession.groupBy({
            by: ["taskId", "userId"],
            where: {
              approval: { not: "REJECTED" },
              ...(linkedWorkDateFilter ? { workDate: linkedWorkDateFilter } : {}),
              taskId: { in: linkedTaskIds },
            },
            _sum: { durationSeconds: true },
            _count: { id: true },
          })
        : [],
      unlinkedTaskIds.length > 0 && unlinkedRangeValid && unlinkedWorkDateFilter
        ? prisma.workSession.groupBy({
            by: ["taskId", "userId"],
            where: {
              approval: { not: "REJECTED" },
              workDate: unlinkedWorkDateFilter,
              taskId: { in: unlinkedTaskIds },
            },
            _sum: { durationSeconds: true },
            _count: { id: true },
          })
        : [],
    ]);

    const unlinkedTasksWithSessions = new Set(unlinkedGrouped.map((g) => g.taskId));
    reportTasks = [
      ...linkedTasks,
      ...unlinkedTasks.filter((t) => unlinkedTasksWithSessions.has(t.id)),
    ];
    groupedTaskSessions = [...linkedGrouped, ...unlinkedGrouped];
  }

  const sessionUserIds = [...new Set(groupedTaskSessions.map((g) => g.userId))];
  const [sessionUsers, scrumMemberRows, isViewerScrumAdmin] = await Promise.all([
    sessionUserIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: sessionUserIds } },
          select: { id: true, name: true },
        })
      : [],
    prisma.scrumMember.findMany({
      where: { scrumId },
      select: {
        userId: true,
        performance: true,
        performanceNote: true,
        performanceUpdatedAt: true,
      },
    }),
    currentUser.role === "SUPER_ADMIN"
      ? Promise.resolve(true)
      : isScrumAdminOf(currentUser, scrumId),
  ]);
  const userNameMap = new Map(sessionUsers.map((u) => [u.id, u.name]));
  const memberPerfMap = new Map(scrumMemberRows.map((m) => [m.userId, m]));

  const taskSessionsMap = new Map();
  for (const g of groupedTaskSessions) {
    if (!taskSessionsMap.has(g.taskId)) {
      taskSessionsMap.set(g.taskId, []);
    }
    taskSessionsMap.get(g.taskId).push({
      userId: g.userId,
      userName: userNameMap.get(g.userId) || "Unknown",
      sessionCount: g._count.id || 0,
      totalSeconds: g._sum.durationSeconds || 0,
    });
  }

  const rows = [];
  const taskAggregates = [];
  let grandTotalPoints = 0;
  let grandTotalSeconds = 0;
  let grandSessionCount = 0;
  let activeTasksCount = 0;

  for (const task of reportTasks) {
    const taskPoints = task.points || 0;
    grandTotalPoints += taskPoints;
    if (task.isActive) activeTasksCount += 1;

    const assignedMembers = task.members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
    }));

    const sprintSummary = task.sprint
      ? { id: task.sprint.id, number: task.sprint.number, title: task.sprint.title }
      : null;

    const taskSummaryBase = {
      id: task.id,
      name: task.name,
      points: taskPoints,
      isActive: task.isActive,
      sprintId: task.sprintId ?? null,
      sprint: sprintSummary,
    };

    const entries = (taskSessionsMap.get(task.id) || []).sort((a, b) =>
      b.totalSeconds - a.totalSeconds || a.userName.localeCompare(b.userName)
    );

    let taskTotalSeconds = 0;
    let taskSessionCount = 0;

    if (entries.length === 0) {
      const firstMember = assignedMembers[0] || null;
      const firstPerf = firstMember ? memberPerfMap.get(firstMember.id) : null;
      rows.push({
        task: taskSummaryBase,
        member: firstMember,
        assignedMembersCount: assignedMembers.length,
        sessionCount: 0,
        totalSeconds: 0,
        secondsPerPoint: null,
        ...(firstMember
          ? serializeScrumMemberPerformance(firstPerf, currentUser, firstMember.id, {
              isScrumAdminOfScrum: isViewerScrumAdmin,
            })
          : {}),
      });
    } else {
      for (const entry of entries) {
        taskTotalSeconds += entry.totalSeconds;
        taskSessionCount += entry.sessionCount;
        const entryPerf = memberPerfMap.get(entry.userId);

        rows.push({
          task: taskSummaryBase,
          member: {
            id: entry.userId,
            name: entry.userName,
          },
          assignedMembersCount: assignedMembers.length,
          sessionCount: entry.sessionCount,
          totalSeconds: entry.totalSeconds,
          secondsPerPoint:
            taskPoints > 0 && entry.totalSeconds > 0
              ? Math.round(entry.totalSeconds / taskPoints)
              : null,
          ...serializeScrumMemberPerformance(entryPerf, currentUser, entry.userId, {
            isScrumAdminOfScrum: isViewerScrumAdmin,
          }),
        });
      }
    }

    taskAggregates.push({
      taskId: task.id,
      taskName: task.name,
      points: taskPoints,
      isActive: task.isActive,
      sprintId: task.sprintId ?? null,
      sprint: sprintSummary,
      memberCount: assignedMembers.length,
      totalSeconds: taskTotalSeconds,
      sessionCount: taskSessionCount,
    });

    grandTotalSeconds += taskTotalSeconds;
    grandSessionCount += taskSessionCount;
  }

  return {
    rows,
    taskAggregates,
    sprints: sprints.map(formatSprintSummary),
    total: {
      totalTasks: reportTasks.length,
      activeTasks: activeTasksCount,
      totalPoints: grandTotalPoints,
      totalSeconds: grandTotalSeconds,
      sessionCount: grandSessionCount,
    },
  };
};
