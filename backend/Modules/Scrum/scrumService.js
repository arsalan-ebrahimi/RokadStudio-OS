import { HandleERROR } from "vanta-api";
import prisma from "../../config/prisma.js";
import { todayDate, toDateOnly, getTimezoneParts } from "../../Utils/date.js";
import { serializeKpiRows } from "./kpiSerializer.js";

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

export const listScrumsService = async (currentUser) => {
  const isSuperAdmin = currentUser.role === "SUPER_ADMIN";
  const isScrumAdmin = currentUser.role === "SCRUM_ADMIN";

  let where = {};
  if (isSuperAdmin) {
    where = {};
  } else if (isScrumAdmin) {
    where = {
      OR: [
        { ownerId: currentUser.id },
        { members: { some: { userId: currentUser.id } } },
      ],
    };
  } else {
    // USER role
    where = {
      members: { some: { userId: currentUser.id } },
    };
  }

  const scrums = await prisma.scrum.findMany({
    where,
    include: {
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

  return scrums.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    color: s.color,
    isActive: s.isActive,
    ownerId: s.ownerId,
    memberCount: s._count.members,
    activeSprint: s.sprints[0] || null,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));
};

export const createScrumService = async ({ name, description, color, ownerId }, currentUser) => {
  let resolvedOwnerId = currentUser.id;

  if (currentUser.role === "SUPER_ADMIN" && ownerId) {
    const ownerUser = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { id: true, isActive: true },
    });
    if (!ownerUser || !ownerUser.isActive) {
      throw new HandleERROR("مالک انتخاب‌شده نامعتبر یا غیرفعال است", 400);
    }
    resolvedOwnerId = ownerId;
  }

  const scrum = await prisma.$transaction(async (tx) => {
    const created = await tx.scrum.create({
      data: {
        name: name.trim(),
        description: description ? description.trim() : null,
        color: color || "ECOSYSTEM",
        ownerId: resolvedOwnerId,
      },
    });

    // Add owner as a ScrumMember automatically
    await tx.scrumMember.create({
      data: {
        scrumId: created.id,
        userId: resolvedOwnerId,
        label: "اسکرام مستر",
      },
    });

    return created;
  });

  return scrum;
};

export const getScrumDetailsService = async (scrumId, currentUser) => {
  const scrum = await prisma.scrum.findUnique({
    where: { id: scrumId },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              isActive: true,
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

  const isSuperAdmin = currentUser.role === "SUPER_ADMIN";
  const isOwner = currentUser.role === "SCRUM_ADMIN" && scrum.ownerId === currentUser.id;
  const canEdit = isSuperAdmin || isOwner;

  return {
    id: scrum.id,
    name: scrum.name,
    description: scrum.description,
    color: scrum.color,
    isActive: scrum.isActive,
    ownerId: scrum.ownerId,
    activeSprint: scrum.sprints[0] || null,
    createdAt: scrum.createdAt,
    updatedAt: scrum.updatedAt,
    canEdit,
    members: scrum.members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      label: m.label || null,
    })),
  };
};

export const updateScrumService = async (scrumId, { name, description, color, isActive }) => {
  const data = {};
  if (name !== undefined) data.name = name.trim();
  if (description !== undefined) data.description = description.trim();
  if (color !== undefined) data.color = color;
  if (isActive !== undefined) data.isActive = isActive;

  const updated = await prisma.scrum.update({
    where: { id: scrumId },
    data,
  });

  return updated;
};

export const deleteScrumService = async (scrumId) => {
  // Check if any WorkSession exists beneath this scrum
  const sessionCount = await prisma.workSession.count({
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

  await prisma.scrum.delete({
    where: { id: scrumId },
  });
};

export const syncScrumMembersService = async (scrumId, memberList = []) => {
  const targetUserIds = [...new Set(memberList.map((m) => Number(m.userId)))];

  if (targetUserIds.length > 0) {
    const validUsers = await prisma.user.findMany({
      where: {
        id: { in: targetUserIds },
        isActive: true,
      },
      select: { id: true },
    });

    const validIdSet = new Set(validUsers.map((u) => u.id));
    const invalidIds = targetUserIds.filter((id) => !validIdSet.has(id));

    if (invalidIds.length > 0) {
      throw new HandleERROR(`کاربران با شناسه ${invalidIds.join(", ")} نامعتبر یا غیرفعال هستند`, 400);
    }
  }

  return await prisma.$transaction(async (tx) => {
    const existing = await tx.scrumMember.findMany({
      where: { scrumId },
      select: { userId: true },
    });

    const currentIds = existing.map((e) => e.userId);
    const targetSet = new Set(targetUserIds);
    const removedIds = currentIds.filter((id) => !targetSet.has(id));

    // If removing members who have assigned sprint projects in this scrum,
    // nullify their assigneeId in the same transaction
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

    // Upsert members and labels
    for (const m of memberList) {
      const uid = Number(m.userId);
      const label = m.label ? m.label.trim() : null;
      await tx.scrumMember.upsert({
        where: {
          scrumId_userId: { scrumId, userId: uid },
        },
        create: {
          scrumId,
          userId: uid,
          label,
        },
        update: {
          label,
        },
      });
    }

    const updatedMembers = await tx.scrumMember.findMany({
      where: { scrumId },
      include: {
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
    include: {
      projects: {
        select: {
          points: true,
          status: true,
        },
      },
    },
    orderBy: { number: "asc" },
  });

  return sprints.map((s) => {
    const totalPoints = s.projects.reduce((acc, p) => acc + (p.points || 0), 0);
    const donePoints = s.projects
      .filter((p) => p.status === "DONE")
      .reduce((acc, p) => acc + (p.points || 0), 0);

    return {
      id: s.id,
      scrumId: s.scrumId,
      number: s.number,
      title: s.title,
      description: s.description,
      startDate: s.startDate,
      endDate: s.endDate,
      status: s.status,
      completedAt: s.completedAt,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      totalPoints,
      donePoints,
      itemCount: s.projects.length,
    };
  });
};

export const createSprintService = async (scrumId, { title, description, startDate, endDate }) => {
  // Retry loop up to 3 times on P2002 race conditions
  for (let attempt = 0; attempt < 3; attempt++) {
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
            description: description ? description.trim() : null,
            startDate: startDate ? toDateOnly(startDate) : null,
            endDate: endDate ? toDateOnly(endDate) : null,
            status: "PLANNED",
          },
        });
      });

      return {
        ...created,
        totalPoints: 0,
        donePoints: 0,
        itemCount: 0,
      };
    } catch (err) {
      if (err?.code === "P2002" && attempt < 2) {
        continue;
      }
      throw err;
    }
  }
};

export const getSprintDetailsService = async (sprintId) => {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: {
      projects: {
        include: {
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

  // Calculate tracked seconds per project for the sprint
  const projectIds = sprint.projects.map((p) => p.id);
  const trackedAggs = projectIds.length > 0
    ? await prisma.workSession.groupBy({
        by: ["sprintProjectId"],
        where: {
          sprintProjectId: { in: projectIds },
          approval: { not: "REJECTED" },
        },
        _sum: { durationSeconds: true },
        _count: { id: true },
      })
    : [];

  const trackedMap = new Map(
    trackedAggs.map((a) => [a.sprintProjectId, {
      totalSeconds: a._sum.durationSeconds || 0,
      sessionsCount: a._count.id || 0,
    }])
  );

  const formattedProjects = sprint.projects.map((p) => {
    const stats = trackedMap.get(p.id) || { totalSeconds: 0, sessionsCount: 0 };
    return {
      id: p.id,
      sprintId: p.sprintId,
      name: p.name,
      points: p.points,
      status: p.status,
      sortOrder: p.sortOrder,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      assignee: p.assignee ? { id: p.assignee.id, name: p.assignee.name } : null,
      totalTrackedSeconds: stats.totalSeconds,
      sessionCount: stats.sessionsCount,
    };
  });

  const totalPoints = sprint.projects.reduce((acc, p) => acc + (p.points || 0), 0);
  const donePoints = sprint.projects
    .filter((p) => p.status === "DONE")
    .reduce((acc, p) => acc + (p.points || 0), 0);
  const totalSeconds = formattedProjects.reduce((acc, p) => acc + p.totalTrackedSeconds, 0);

  return {
    id: sprint.id,
    scrumId: sprint.scrumId,
    number: sprint.number,
    title: sprint.title,
    description: sprint.description,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    status: sprint.status,
    completedAt: sprint.completedAt,
    createdAt: sprint.createdAt,
    updatedAt: sprint.updatedAt,
    totalPoints,
    donePoints,
    itemCount: sprint.projects.length,
    totalTrackedSeconds: totalSeconds,
    projects: formattedProjects,
  };
};

export const updateSprintService = async (sprintId, { title, description, startDate, endDate }) => {
  const current = await prisma.sprint.findUnique({
    where: { id: sprintId },
  });

  if (!current) {
    throw new HandleERROR("اسپرینت یافت نشد", 404);
  }

  const sDate = startDate !== undefined ? (startDate ? toDateOnly(startDate) : null) : current.startDate;
  const eDate = endDate !== undefined ? (endDate ? toDateOnly(endDate) : null) : current.endDate;

  if (sDate && eDate && eDate.getTime() < sDate.getTime()) {
    throw new HandleERROR("تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد", 400);
  }

  const data = {};
  if (title !== undefined) data.title = title.trim();
  if (description !== undefined) data.description = description.trim();
  if (startDate !== undefined) data.startDate = sDate;
  if (endDate !== undefined) data.endDate = eDate;

  const updated = await prisma.sprint.update({
    where: { id: sprintId },
    data,
  });

  return updated;
};

export const updateSprintStatusService = async (sprintId, newStatus) => {
  const current = await prisma.sprint.findUnique({
    where: { id: sprintId },
  });

  if (!current) {
    throw new HandleERROR("اسپرینت یافت نشد", 404);
  }

  // Allowed transitions: PLANNED -> ACTIVE, ACTIVE -> COMPLETED
  const isValidTransition =
    (current.status === "PLANNED" && newStatus === "ACTIVE") ||
    (current.status === "ACTIVE" && newStatus === "COMPLETED");

  if (!isValidTransition) {
    throw new HandleERROR(
      "تغییر وضعیت نامعتبر است. فقط انتقال از برنامهریزی به فعال یا از فعال به تمامشده مجاز است",
      400
    );
  }

  if (newStatus === "ACTIVE") {
    // Check if another sprint is currently ACTIVE for this scrum
    const activeSprint = await prisma.sprint.findFirst({
      where: {
        scrumId: current.scrumId,
        status: "ACTIVE",
        id: { not: sprintId },
      },
    });

    if (activeSprint) {
      throw new HandleERROR(
        `یک اسپرینت فعال دیگر (اسپرینت ${activeSprint.number}) در این اسکرام وجود دارد`,
        409
      );
    }
  }

  const data = {
    status: newStatus,
  };
  if (newStatus === "COMPLETED") {
    data.completedAt = new Date();
  }

  try {
    const updated = await prisma.sprint.update({
      where: { id: sprintId },
      data,
    });
    return updated;
  } catch (err) {
    if (err?.code === "P2002") {
      throw new HandleERROR("یک اسپرینت فعال دیگر در این اسکرام وجود دارد", 409);
    }
    throw err;
  }
};

export const deleteSprintService = async (sprintId) => {
  // Check if any WorkSession exists on its items
  const sessionCount = await prisma.workSession.count({
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

  await prisma.sprint.delete({
    where: { id: sprintId },
  });
};

export const createSprintProjectService = async (sprintId, { name, points = 0, assigneeId }) => {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: {
      scrum: {
        include: {
          members: true,
        },
      },
    },
  });

  if (!sprint) {
    throw new HandleERROR("اسپرینت یافت نشد", 404);
  }

  let resolvedAssigneeId = null;
  if (assigneeId) {
    const isMember = sprint.scrum.members.some((m) => m.userId === assigneeId);
    if (!isMember) {
      throw new HandleERROR("کاربر انتخاب‌شده عضو این اسکرام نیست", 400);
    }
    resolvedAssigneeId = assigneeId;
  }

  const lastItem = await prisma.sprintProject.findFirst({
    where: { sprintId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const nextSort = (lastItem?.sortOrder ?? -1) + 1;

  const project = await prisma.sprintProject.create({
    data: {
      sprintId,
      name: name.trim(),
      points: points != null ? Number(points) : 0,
      assigneeId: resolvedAssigneeId,
      sortOrder: nextSort,
      status: "TODO",
    },
    include: {
      assignee: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return {
    ...project,
    totalTrackedSeconds: 0,
    sessionCount: 0,
  };
};

export const updateSprintProjectService = async (
  projectId,
  body,
  { canEdit, isAssignee }
) => {
  const current = await prisma.sprintProject.findUnique({
    where: { id: projectId },
    include: {
      sprint: {
        include: {
          scrum: {
            include: { members: true },
          },
        },
      },
    },
  });

  if (!current) {
    throw new HandleERROR("پروژه اسپرینت یافت نشد", 404);
  }

  // Non-owner assignee can change ONLY status
  if (!canEdit) {
    if (!isAssignee) {
      throw new HandleERROR("شما دسترسی ویرایش این پروژه اسپرینت را ندارید", 403);
    }

    const disallowedKeys = Object.keys(body).filter((k) => k !== "status");
    if (disallowedKeys.length > 0) {
      throw new HandleERROR("شما فقط مجاز به تغییر وضعیت این تسک هستید", 403);
    }

    if (!body.status) {
      return current;
    }

    const updated = await prisma.sprintProject.update({
      where: { id: projectId },
      data: { status: body.status },
      include: {
        assignee: { select: { id: true, name: true } },
      },
    });

    return updated;
  }

  // canEdit (owner or super-admin)
  const data = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.points !== undefined) data.points = Number(body.points);
  if (body.status !== undefined) data.status = body.status;
  if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder);

  if (body.assigneeId !== undefined) {
    if (body.assigneeId === null || body.assigneeId === "") {
      data.assigneeId = null;
    } else {
      const aid = Number(body.assigneeId);
      const isMember = current.sprint.scrum.members.some((m) => m.userId === aid);
      if (!isMember) {
        throw new HandleERROR("کاربر انتخاب‌شده عضو این اسکرام نیست", 400);
      }
      data.assigneeId = aid;
    }
  }

  const updated = await prisma.sprintProject.update({
    where: { id: projectId },
    data,
    include: {
      assignee: { select: { id: true, name: true } },
    },
  });

  return updated;
};

export const deleteSprintProjectService = async (projectId) => {
  const sessionCount = await prisma.workSession.count({
    where: { sprintProjectId: projectId },
  });

  if (sessionCount > 0) {
    throw new HandleERROR(
      "امکان حذف این پروژه اسپرینت به دلیل وجود سشن‌های کاری ثبت‌شده روی آن وجود ندارد",
      409
    );
  }

  await prisma.sprintProject.delete({
    where: { id: projectId },
  });
};

export const getKpisService = async (scrumId, isAdmin = false) => {
  const kpis = await prisma.scrumKpi.findMany({
    where: { scrumId },
    orderBy: { sortOrder: "asc" },
  });

  return serializeKpiRows(kpis, isAdmin);
};

export const batchUpdateKpisService = async (scrumId, rawRows = [], isAdmin = false) => {
  // Drop fully empty rows silently
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

  const validRows = rawRows.filter((r) => !isRowEmpty(r));

  // Numeric validation: reject NaN
  for (const r of validRows) {
    const numFields = ["target", "firstMonthTarget", "actualValue", "minExpected"];
    for (const f of numFields) {
      if (r[f] !== undefined && r[f] !== null && r[f] !== "") {
        const n = Number(r[f]);
        if (isNaN(n)) {
          throw new HandleERROR(`مقدار فیلد ${f} باید یک عدد معتبر باشد`, 400);
        }
      }
    }
  }

  const updatedRows = await prisma.$transaction(async (tx) => {
    const existing = await tx.scrumKpi.findMany({
      where: { scrumId },
      select: { id: true },
    });

    const existingIds = new Set(existing.map((e) => e.id));
    const payloadIds = new Set(validRows.filter((r) => r.id).map((r) => Number(r.id)));

    // Delete rows missing from payload
    const toDelete = existing.filter((e) => !payloadIds.has(e.id)).map((e) => e.id);
    if (toDelete.length > 0) {
      await tx.scrumKpi.deleteMany({
        where: { id: { in: toDelete } },
      });
    }

    // Upsert remaining rows with array index as sortOrder
    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i];
      const target = r.target !== undefined && r.target !== null && r.target !== "" ? Number(r.target) : null;
      const firstMonthTarget =
        r.firstMonthTarget !== undefined && r.firstMonthTarget !== null && r.firstMonthTarget !== ""
          ? Number(r.firstMonthTarget)
          : null;
      const actualValue =
        r.actualValue !== undefined && r.actualValue !== null && r.actualValue !== ""
          ? Number(r.actualValue)
          : null;
      const minExpected =
        r.minExpected !== undefined && r.minExpected !== null && r.minExpected !== ""
          ? Number(r.minExpected)
          : null;

      const data = {
        indicator: r.indicator ? r.indicator.trim() : null,
        formula: r.formula ? r.formula.trim() : null,
        strategicGoal: r.strategicGoal ? r.strategicGoal.trim() : null,
        unit: r.unit ? r.unit.trim() : null,
        target,
        firstMonthTarget,
        actualValue,
        minExpected,
        sortOrder: i,
      };

      if (r.id && existingIds.has(Number(r.id))) {
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
    orderBy: { sortOrder: "asc" },
  });

  return events;
};

export const batchUpdateEventsService = async (scrumId, rawRows = []) => {
  // Drop fully empty rows
  const isEventEmpty = (r) => {
    const fields = [
      r.name,
      r.scheduleType,
      r.dayOfWeek,
      r.date,
      r.startTime,
      r.durationMinutes,
      r.inputs,
      r.outputs,
    ];
    return fields.every(
      (f) => f === undefined || f === null || f === "" || (typeof f === "string" && f.trim() === "")
    );
  };

  const validRows = rawRows.filter((r) => !isEventEmpty(r));

  // Validate non-empty rows
  for (const r of validRows) {
    if (!r.name || !r.name.trim()) {
      throw new HandleERROR("نام رویداد الزامی است", 400);
    }
    if (!["WEEKLY", "ONCE"].includes(r.scheduleType)) {
      throw new HandleERROR("نوع برگزاری باید WEEKLY یا ONCE باشد", 400);
    }
    if (r.scheduleType === "WEEKLY") {
      const day = Number(r.dayOfWeek);
      if (isNaN(day) || day < 0 || day > 6) {
        throw new HandleERROR("برای رویدادهای هفتگی، روز هفته باید بین ۰ (شنبه) تا ۶ (جمعه) باشد", 400);
      }
    }
    if (r.scheduleType === "ONCE") {
      if (!r.date) {
        throw new HandleERROR("برای رویداد یکباره، تاریخ برگزاری الزامی است", 400);
      }
    }
    if (r.startTime) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.startTime.trim())) {
        throw new HandleERROR("ساعت شروع باید به فرمت HH:mm باشد", 400);
      }
    }
    if (r.durationMinutes !== undefined && r.durationMinutes !== null && r.durationMinutes !== "") {
      const dur = Number(r.durationMinutes);
      if (isNaN(dur) || dur < 1 || dur > 1440) {
        throw new HandleERROR("مدت جلسه باید بین ۱ تا ۱۴۴۰ دقیقه باشد", 400);
      }
    }
  }

  const updatedEvents = await prisma.$transaction(async (tx) => {
    const existing = await tx.scrumEvent.findMany({
      where: { scrumId },
      select: { id: true },
    });

    const existingIds = new Set(existing.map((e) => e.id));
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
        startTime: r.startTime ? r.startTime.trim() : null,
        durationMinutes:
          r.durationMinutes !== undefined && r.durationMinutes !== null && r.durationMinutes !== ""
            ? Number(r.durationMinutes)
            : null,
        inputs: r.inputs ? r.inputs.trim() : null,
        outputs: r.outputs ? r.outputs.trim() : null,
        sortOrder: i,
      };

      if (r.id && existingIds.has(Number(r.id))) {
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

  return updatedEvents;
};

export const getTodayEventsService = async (currentUser) => {
  const isSuperAdmin = currentUser.role === "SUPER_ADMIN";
  const isScrumAdmin = currentUser.role === "SCRUM_ADMIN";

  let scrumWhere = { isActive: true };
  if (!isSuperAdmin) {
    scrumWhere = {
      isActive: true,
      OR: [
        { members: { some: { userId: currentUser.id } } },
        ...(isScrumAdmin ? [{ ownerId: currentUser.id }] : []),
      ],
    };
  }

  const activeScrums = await prisma.scrum.findMany({
    where: scrumWhere,
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
      date: e.date,
      startTime: e.startTime,
      durationMinutes: e.durationMinutes,
      inputs: e.inputs,
      outputs: e.outputs,
    };
  });
};

export const getWorkTargetsMineService = async (userId, isSuperAdmin) => {
  // 1. studioProjects (same as /api/projects/mine)
  const studioProjects = await prisma.project.findMany({
    where: {
      isActive: true,
      ...(isSuperAdmin ? {} : { members: { some: { userId } } }),
    },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
    },
    orderBy: { name: "asc" },
  });

  // 2. scrums: only scrums user is a member of, only ACTIVE sprint, only items assigned to user
  const userScrums = await prisma.scrum.findMany({
    where: {
      isActive: true,
      members: { some: { userId } },
    },
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

  const scrumsFormatted = userScrums
    .filter((s) => s.sprints.length > 0 && s.sprints[0].projects.length > 0)
    .map((s) => ({
      scrum: {
        id: s.id,
        name: s.name,
        color: s.color,
      },
      sprint: {
        id: s.sprints[0].id,
        number: s.sprints[0].number,
        title: s.sprints[0].title,
      },
      items: s.sprints[0].projects.map((p) => ({
        id: p.id,
        name: p.name,
        points: p.points,
        status: p.status,
      })),
    }));

  // 3. recent targets: up to 3 most recently used from user's sessions
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
          sprint: {
            select: {
              id: true,
              number: true,
              title: true,
              scrum: { select: { id: true, name: true, color: true, isActive: true } },
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

    if (s.sprintProjectId && s.sprintProject) {
      const key = `SPRINT_${s.sprintProjectId}`;
      if (!seen.has(key) && s.sprintProject.sprint?.scrum?.isActive) {
        seen.add(key);
        recent.push({
          kind: "SPRINT",
          id: s.sprintProject.id,
          name: s.sprintProject.name,
          points: s.sprintProject.points,
          status: s.sprintProject.status,
          pathLabel: `[${s.sprintProject.sprint.scrum.name} · S${s.sprintProject.sprint.number}] ${s.sprintProject.name}`,
          scrum: s.sprintProject.sprint.scrum,
          sprint: {
            id: s.sprintProject.sprint.id,
            number: s.sprintProject.sprint.number,
            title: s.sprintProject.sprint.title,
          },
        });
      }
    } else if (s.projectId && s.project) {
      const key = `STUDIO_${s.projectId}`;
      if (!seen.has(key) && s.project.isActive) {
        seen.add(key);
        recent.push({
          kind: "STUDIO",
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

export const getScrumReportService = async (scrumId, { sprintId, from, to }, currentUser, canEdit) => {
  const sprintWhere = { scrumId };
  if (sprintId) sprintWhere.id = Number(sprintId);

  const sprints = await prisma.sprint.findMany({
    where: sprintWhere,
    include: {
      projects: {
        include: {
          assignee: { select: { id: true, name: true } },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
    orderBy: { number: "asc" },
  });

  const allProjectIds = sprints.flatMap((s) => s.projects.map((p) => p.id));

  // Build workSession query
  const sessionWhere = {
    sprintProjectId: { in: allProjectIds },
    approval: { not: "REJECTED" },
  };

  if (from || to) {
    sessionWhere.workDate = {};
    if (from) sessionWhere.workDate.gte = toDateOnly(from);
    if (to) sessionWhere.workDate.lte = toDateOnly(to);
  }

  const sessions = await prisma.workSession.findMany({
    where: sessionWhere,
    select: {
      id: true,
      userId: true,
      sprintProjectId: true,
      durationSeconds: true,
      user: { select: { id: true, name: true } },
    },
  });

  // Group sessions by sprintProjectId and userId
  // key: `${sprintProjectId}_${userId}`
  const userItemMap = new Map();
  for (const s of sessions) {
    const key = `${s.sprintProjectId}_${s.userId}`;
    if (!userItemMap.has(key)) {
      userItemMap.set(key, {
        userId: s.userId,
        userName: s.user?.name || "Unknown",
        sprintProjectId: s.sprintProjectId,
        sessionCount: 0,
        totalSeconds: 0,
      });
    }
    const entry = userItemMap.get(key);
    entry.sessionCount += 1;
    entry.totalSeconds += s.durationSeconds;
  }

  // Build rows per member x sprint project
  const rows = [];
  const sprintAggMap = new Map();

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

      // Find all session groups for this item
      const itemEntries = [...userItemMap.values()].filter((e) => e.sprintProjectId === item.id);

      if (itemEntries.length === 0) {
        // Item with 0 sessions
        // Member visibility rule:
        // Plain members receive ONLY their own time rows, but item data is visible.
        const assignee = item.assignee;
        const isMyRow = assignee?.id === currentUser.id;

        if (canEdit || isMyRow) {
          rows.push({
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
            sessionCount: 0,
            totalSeconds: 0,
            secondsPerPoint: null,
          });
        }
      } else {
        for (const entry of itemEntries) {
          sprintTotalSeconds += entry.totalSeconds;
          sprintSessionCount += entry.sessionCount;

          const isMyRow = entry.userId === currentUser.id;
          if (canEdit || isMyRow) {
            rows.push({
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
              sessionCount: entry.sessionCount,
              totalSeconds: entry.totalSeconds,
              secondsPerPoint: item.points > 0 ? Math.round(entry.totalSeconds / item.points) : null,
            });
          }
        }
      }
    }

    sprintAggMap.set(sp.id, {
      sprintId: sp.id,
      sprintNumber: sp.number,
      sprintTitle: sp.title,
      totalPoints: sprintTotalPoints,
      donePoints: sprintDonePoints,
      totalSeconds: sprintTotalSeconds,
      sessionCount: sprintSessionCount,
    });
  }

  // Calculate totals across all sprints
  const totalPoints = sprints.reduce(
    (acc, s) => acc + s.projects.reduce((pAcc, p) => pAcc + (p.points || 0), 0),
    0
  );
  const donePoints = sprints.reduce(
    (acc, s) =>
      acc + s.projects.filter((p) => p.status === "DONE").reduce((pAcc, p) => pAcc + (p.points || 0), 0),
    0
  );

  // If plain member, total seconds and session counts in totals should reflect visible rows
  const visibleTotalSeconds = rows.reduce((acc, r) => acc + r.totalSeconds, 0);
  const visibleSessionCount = rows.reduce((acc, r) => acc + r.sessionCount, 0);

  return {
    rows,
    sprintAggregates: [...sprintAggMap.values()],
    total: {
      totalPoints,
      donePoints,
      totalSeconds: visibleTotalSeconds,
      sessionCount: visibleSessionCount,
    },
  };
};

