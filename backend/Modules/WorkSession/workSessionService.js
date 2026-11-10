import { HandleERROR } from "vanta-api";
import prisma from "../../config/prisma.js";
import {
  todayDate,
  addDays,
  minutesSinceMidnight,
} from "../../Utils/date.js";
import { buildWorkSessionReportWhere } from "../Scrum/scrumScope.js";

const taskInclude = {
  select: {
    id: true,
    name: true,
    points: true,
    scrum: {
      select: { id: true, name: true, color: true },
    },
  },
};

export const logWorkSession = async (
  { userId, projectId, taskId, durationSeconds, startedAt, clientRequestId },
  now = new Date()
) => {
  // Idempotency: return existing session if clientRequestId already processed
  if (clientRequestId) {
    const existing = await prisma.workSession.findUnique({
      where: {
        userId_clientRequestId: {
          userId,
          clientRequestId,
        },
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
        task: taskInclude,
      },
    });
    if (existing) {
      return existing;
    }
  }

  // 1. Duration validation
  const maxSeconds = parseInt(process.env.MAX_SESSION_SECONDS || "86400", 10);
  if (
    typeof durationSeconds !== "number" ||
    !Number.isInteger(durationSeconds) ||
    durationSeconds < 1 ||
    durationSeconds > maxSeconds
  ) {
    throw new HandleERROR(
      `durationSeconds must be an integer between 1 and ${maxSeconds}`,
      400
    );
  }

  // 2. startedAt validation and derivation
  const startDate = startedAt ? new Date(startedAt) : now;
  if (isNaN(startDate.getTime())) {
    throw new HandleERROR("Invalid startedAt timestamp", 400);
  }
  const nowTime = now.getTime();
  const maxFuture = nowTime + 15 * 60 * 1000; // 15 minutes clock skew allowed
  const minPast = nowTime - 2 * 24 * 60 * 60 * 1000; // not older than 2 days
  if (startDate.getTime() > maxFuture) {
    throw new HandleERROR("startedAt cannot be in the future", 400);
  }
  if (startDate.getTime() < minPast) {
    throw new HandleERROR("startedAt cannot be older than 2 days", 400);
  }

  // 3. Target verification (Project or Scrum Task)
  if (projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, isActive: true },
    });

    if (!project) {
      throw new HandleERROR("Project not found", 404);
    }

    if (!project.isActive) {
      throw new HandleERROR("Project is inactive", 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    const isSuperAdmin = user?.role === "SUPER_ADMIN";

    if (!isSuperAdmin) {
      const membership = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId,
          },
        },
      });

      if (!membership) {
        throw new HandleERROR("You are not an assigned member of this project", 403);
      }
    }
  } else if (taskId) {
    const [task, user] = await Promise.all([
      prisma.task.findUnique({
        where: { id: taskId },
        include: {
          scrum: {
            select: {
              id: true,
              name: true,
              isActive: true,
              admins: {
                where: { userId },
                select: { userId: true },
              },
              members: {
                where: { userId },
                select: { userId: true },
              },
            },
          },
          members: {
            where: { userId },
            select: { userId: true },
          },
        },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
      }),
    ]);

    if (!task) {
      throw new HandleERROR("تسک یافت نشد", 404);
    }

    if (user?.role === "ADMIN") {
      throw new HandleERROR("دسترسی به ماژول اسکرام برای این نقش مجاز نیست", 403);
    }

    if (!task.scrum.isActive) {
      throw new HandleERROR("اسکرام مربوطه غیرفعال است", 400);
    }

    if (!task.isActive) {
      throw new HandleERROR("این تسک غیرفعال است", 400);
    }

    const isAssignedToTask = task.members.length > 0;
    const isScrumParticipant =
      user?.role === "SUPER_ADMIN" ||
      task.scrum.members.length > 0 ||
      (user?.role === "SCRUM_ADMIN" && task.scrum.admins.length > 0);

    if (!isAssignedToTask || !isScrumParticipant) {
      throw new HandleERROR("این تسک به شما اختصاص ندارد", 403);
    }
  } else {
    throw new HandleERROR("باید دقیقاً یکی از projectId یا taskId ارسال شود", 422);
  }

  // 4. Resolve Attendance for workDate: derived using same day boundary helper as attendance
  const workDate = todayDate(startDate);
  let targetAttendance = await prisma.attendance.findUnique({
    where: {
      userId_date: {
        userId,
        date: workDate,
      },
    },
  });

  if (!targetAttendance) {
    // Check Midnight Grace
    const minutes = minutesSinceMidnight(startDate);
    const graceMinutes = parseInt(process.env.MIDNIGHT_GRACE_MINUTES || "30", 10);

    if (minutes <= graceMinutes) {
      const yesterday = addDays(workDate, -1);
      targetAttendance = await prisma.attendance.findUnique({
        where: {
          userId_date: {
            userId,
            date: yesterday,
          },
        },
      });
    }
  }

  if (!targetAttendance) {
    throw new HandleERROR(
      "No active attendance record found for this date. Please mark attendance first.",
      400
    );
  }

  if (targetAttendance.status !== "PRESENT") {
    throw new HandleERROR(
      "Cannot log work session: attendance status must be PRESENT",
      400
    );
  }

  if (targetAttendance.approval === "REJECTED") {
    throw new HandleERROR(
      "Cannot log work session: attendance record has been REJECTED",
      400
    );
  }

  // 5. Race protection: lock attendance row with SELECT ... FOR UPDATE inside transaction
  try {
    const session = await prisma.$transaction(async (tx) => {
      const lockedRows = await tx.$queryRaw`
        SELECT id, status, approval FROM "Attendance"
        WHERE id = ${targetAttendance.id}
        FOR UPDATE
      `;

      if (!lockedRows || lockedRows.length === 0) {
        throw new HandleERROR("Attendance record not found", 404);
      }

      const lockedAttendance = lockedRows[0];
      if (
        lockedAttendance.status !== "PRESENT" ||
        lockedAttendance.approval === "REJECTED"
      ) {
        throw new HandleERROR(
          "Cannot log work session: attendance is not PRESENT or was REJECTED",
          400
        );
      }

      const created = await tx.workSession.create({
        data: {
          userId,
          projectId: projectId || null,
          taskId: taskId || null,
          attendanceId: lockedAttendance.id,
          durationSeconds,
          clientRequestId: clientRequestId || null,
          workDate: targetAttendance.date,
          startedAt: startDate,
          createdAt: now,
        },
        include: {
          project: {
            select: { id: true, name: true },
          },
          task: taskInclude,
        },
      });

      return created;
    });

    return session;
  } catch (err) {
    if (err?.code === "P2002" && clientRequestId) {
      const existing = await prisma.workSession.findUnique({
        where: {
          userId_clientRequestId: {
            userId,
            clientRequestId,
          },
        },
        include: {
          project: {
            select: { id: true, name: true },
          },
          task: taskInclude,
        },
      });
      if (existing) return existing;
    }
    throw err;
  }
};

export const getWorkSessionsSummaryAgg = async (
  {
    userId,
    projectId,
    taskId,
    targetType,
    date,
    dateFrom,
    dateTo,
    groupBy = "user_project",
    approval,
  },
  actorUser = null
) => {
  const where = buildWorkSessionReportWhere(
    { userId, projectId, taskId, targetType, date, dateFrom, dateTo, approval },
    actorUser,
    { defaultExcludeRejected: true }
  );

  let byFields;
  if (groupBy === "user") {
    byFields = ["userId"];
  } else if (groupBy === "project") {
    byFields = ["projectId", "taskId"];
  } else {
    byFields = ["userId", "projectId", "taskId"];
  }

  // Database groupBy aggregation
  const grouped = await prisma.workSession.groupBy({
    by: byFields,
    where,
    _count: { id: true },
    _sum: { durationSeconds: true },
  });

  // Batch load names to prevent N+1
  const userIds = [...new Set(grouped.map((g) => g.userId).filter(Boolean))];
  const projectIds = [...new Set(grouped.map((g) => g.projectId).filter(Boolean))];
  const taskIds = [...new Set(grouped.map((g) => g.taskId).filter(Boolean))];

  const [users, projects, tasks] = await Promise.all([
    userIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      : [],
    projectIds.length > 0
      ? prisma.project.findMany({
          where: { id: { in: projectIds } },
          select: { id: true, name: true },
        })
      : [],
    taskIds.length > 0
      ? prisma.task.findMany({
          where: { id: { in: taskIds } },
          select: {
            id: true,
            name: true,
            points: true,
            scrum: { select: { id: true, name: true, color: true } },
          },
        })
      : [],
  ]);

  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  const rows = grouped.map((g) => {
    const row = {
      totalSeconds: g._sum.durationSeconds || 0,
      sessionsCount: g._count.id,
    };

    if (g.userId) {
      row.user = {
        id: g.userId,
        name: userMap.get(g.userId) || "Unknown",
      };
    }

    if (g.projectId) {
      const p = projectMap.get(g.projectId);
      row.targetType = "PROJECT";
      row.project = {
        id: g.projectId,
        name: p?.name || "Unknown",
      };
      row.task = null;
    } else if (g.taskId) {
      const t = taskMap.get(g.taskId);
      row.targetType = "TASK";
      row.project = null;
      row.task = t
        ? {
            id: t.id,
            name: t.name,
            points: t.points,
            scrum: t.scrum,
          }
        : {
            id: g.taskId,
            name: "Unknown",
            points: 0,
            scrum: null,
          };
    }

    return row;
  });

  return rows;
};

export const decideWorkSessionRecord = async (sessionId, decision, actorUser, now = new Date()) => {
  const session = await prisma.workSession.findUnique({
    where: { id: sessionId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      task: {
        select: {
          id: true,
          name: true,
          points: true,
          scrumId: true,
          scrum: {
            select: {
              id: true,
              name: true,
              color: true,
              admins: {
                where: { userId: actorUser.id },
                select: { userId: true },
              },
            },
          },
        },
      },
    },
  });

  if (!session) {
    throw new HandleERROR("سشن کاری یافت نشد", 404);
  }

  if (actorUser.role === "SCRUM_ADMIN") {
    if (!session.taskId || !session.task) {
      throw new HandleERROR("ادمین اسکرام فقط مجاز به تغییر وضعیت سشن‌های تسک‌های اسکرام است", 403);
    }
    if (!session.task.scrum?.admins || session.task.scrum.admins.length === 0) {
      throw new HandleERROR("شما ادمین اسکرام مربوط به این تسک نیستید", 403);
    }
  }

  // Guard: Non-SUPER_ADMIN may not decide a SUPER_ADMIN's record
  if (actorUser.role !== "SUPER_ADMIN" && session.user.role === "SUPER_ADMIN") {
    throw new HandleERROR("شما اجازه بررسی و تغییر وضعیت سشن سوپرادمین را ندارید", 403);
  }

  if (decision !== "APPROVED" && decision !== "REJECTED") {
    throw new HandleERROR("وضعیت انتخابی نامعتبر است", 400);
  }

  const updated = await prisma.workSession.update({
    where: { id: sessionId },
    data: {
      approval: decision,
      source: "ADMIN",
      decidedById: actorUser.id,
      decidedAt: now,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          ...(actorUser.role !== "SCRUM_ADMIN" ? { role: true } : {}),
        },
      },
      project: { select: { id: true, name: true } },
      task: taskInclude,
      decidedBy: { select: { id: true, name: true } },
    },
  });

  return {
    ...updated,
    targetType: updated.projectId ? "PROJECT" : "TASK",
  };
};

export const deleteWorkSession = async (sessionId, currentUser) => {
  const session = await prisma.workSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new HandleERROR("سشن کاری یافت نشد", 404);
  }

  const isPrivileged = currentUser.role === "ADMIN" || currentUser.role === "SUPER_ADMIN";
  const isOwner = session.userId === currentUser.id;

  if (!isPrivileged && !isOwner) {
    throw new HandleERROR("شما اجازه حذف این سشن کاری را ندارید", 403);
  }

  await prisma.workSession.delete({
    where: { id: sessionId },
  });

  return { id: sessionId };
};
