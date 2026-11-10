import { catchAsync, HandleERROR } from "vanta-api";
import prisma from "../../config/prisma.js";
import { getPagination, formatPaginationMeta } from "../../Utils/pagination.js";
import { invalidateUserAuthCache, invalidateUserProjectsCache } from "../../Utils/cache.js";
import { mapPrismaError } from "../../Utils/prismaErrors.js";
import { isScrumAdminRole } from "../Scrum/scrumAccess.js";
import {
  buildScrumAdminManagedMemberUserWhere,
  fetchGroupedAttendanceTotals,
  serializeStudioPerformance,
} from "../Scrum/scrumScope.js";

export const createUser = catchAsync(async (req, res, next) => {
  const { code, name, role = "USER" } = req.body;

  try {
    const user = await prisma.user.create({
      data: {
        code: code.trim(),
        name: name.trim(),
        role,
      },
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: user,
    });
  } catch (err) {
    const mapped = mapPrismaError(err);
    if (mapped) return next(mapped);
    throw err;
  }
});

export const getUsers = catchAsync(async (req, res, next) => {
  const { page, limit, skip } = getPagination(req.query);
  const { role, isActive, search, include } = req.query;
  const isSuperAdminCaller = req.user?.role === "SUPER_ADMIN";

  const where = {};

  if (role) {
    where.role = role;
  }

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  if (search) {
    const term = search.trim();
    where.OR = isSuperAdminCaller
      ? [
          { name: { contains: term, mode: "insensitive" } },
          { code: { contains: term, mode: "insensitive" } },
        ]
      : [{ name: { contains: term, mode: "insensitive" } }];
  }

  const userSelect = {
    id: true,
    ...(isSuperAdminCaller ? { code: true } : {}),
    name: true,
    role: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    studioPerformance: {
      select: {
        level: true,
        note: true,
        updatedAt: true,
      },
    },
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      select: userSelect,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const includeAttendanceTotals = include === "attendanceTotals";
  const totalsMap =
    includeAttendanceTotals && users.length > 0
      ? await fetchGroupedAttendanceTotals(users.map((u) => u.id))
      : null;

  const formattedUsers = users.map((u) => {
    const { studioPerformance, ...baseUser } = u;
    return {
      ...baseUser,
      ...serializeStudioPerformance(studioPerformance, req.user, u.id),
      ...(totalsMap
        ? { attendanceTotals: totalsMap.get(u.id) || { present: 0, pending: 0, absent: 0 } }
        : {}),
    };
  });

  return res.status(200).json({
    success: true,
    message: "Users fetched successfully",
    data: formattedUsers,
    meta: formatPaginationMeta(page, limit, total),
  });
});

export const searchUsers = catchAsync(async (req, res, next) => {
  const q = req.query.q ? req.query.q.trim() : "";
  const scope = req.query.scope === "managed" ? "managed" : "all";
  const isScrumAdminCaller = req.user?.role === "SCRUM_ADMIN";

  const where = {
    isActive: true,
    ...(isScrumAdminRole(req.user?.role) && scope === "managed"
      ? buildScrumAdminManagedMemberUserWhere(req.user.id)
      : { role: { not: "ADMIN" } }),
  };

  if (q) {
    where.name = { contains: q, mode: "insensitive" };
  }

  const users = await prisma.user.findMany({
    where,
    select: isScrumAdminCaller
      ? {
          id: true,
          name: true,
        }
      : {
          id: true,
          name: true,
          role: true,
        },
    take: 20,
    orderBy: { name: "asc" },
  });

  return res.status(200).json({
    success: true,
    message: "Users searched successfully",
    data: users,
  });
});

export const getScrumAdmins = catchAsync(async (req, res, next) => {
  const q = req.query.q ? req.query.q.trim() : "";

  const where = {
    isActive: true,
    role: { in: ["SCRUM_ADMIN", "ADMIN"] },
  };

  if (q) {
    where.name = { contains: q, mode: "insensitive" };
  }

  const admins = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      role: true,
    },
    take: 50,
    orderBy: { name: "asc" },
  });

  return res.status(200).json({
    success: true,
    message: "Scrum admins fetched successfully",
    data: admins,
  });
});

export const getUserById = catchAsync(async (req, res, next) => {
  const id = Number(req.params.id);
  const isSuperAdminCaller = req.user?.role === "SUPER_ADMIN";

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      ...(isSuperAdminCaller ? { code: true } : {}),
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      studioPerformance: {
        select: {
          level: true,
          note: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!user) {
    return next(new HandleERROR("User not found", 404));
  }

  const { studioPerformance, ...baseUser } = user;

  return res.status(200).json({
    success: true,
    message: "User fetched successfully",
    data: {
      ...baseUser,
      ...serializeStudioPerformance(studioPerformance, req.user, user.id),
    },
  });
});

export const updateUserPerformance = catchAsync(async (req, res, next) => {
  const id = Number(req.params.id);
  const { level, note } = req.body;

  if (req.user.id === id) {
    return next(new HandleERROR("شما مجاز به ثبت وضعیت عملکرد برای خود نیستید", 403));
  }

  const targetUser = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true },
  });

  if (!targetUser) {
    return next(new HandleERROR("User not found", 404));
  }

  if (level === null) {
    await prisma.studioPerformance.deleteMany({
      where: { userId: id },
    });

    return res.status(200).json({
      success: true,
      message: "وضعیت عملکرد استودیو پاک شد",
      data: {
        userId: id,
        studioPerformance: null,
      },
    });
  }

  const normalizedNote = typeof note === "string" && note.trim() ? note.trim() : null;

  const perf = await prisma.studioPerformance.upsert({
    where: { userId: id },
    create: {
      userId: id,
      level,
      note: normalizedNote,
      updatedById: req.user.id,
    },
    update: {
      level,
      note: normalizedNote,
      updatedById: req.user.id,
    },
    select: {
      level: true,
      note: true,
      updatedAt: true,
    },
  });

  return res.status(200).json({
    success: true,
    message: "وضعیت عملکرد استودیو با موفقیت ثبت شد",
    data: {
      userId: id,
      studioPerformance: perf,
    },
  });
});

export const updateUser = catchAsync(async (req, res, next) => {
  const id = Number(req.params.id);
  const { code, name, role, isActive } = req.body;

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    return next(new HandleERROR("User not found", 404));
  }

  // Guard: SUPER_ADMIN cannot demote or deactivate themselves
  if (req.userId === id) {
    if (role !== undefined && role !== "SUPER_ADMIN") {
      return next(new HandleERROR("You cannot demote yourself", 409));
    }
    if (isActive !== undefined && !isActive) {
      return next(new HandleERROR("You cannot deactivate yourself", 409));
    }
  }

  // Guard: The last active SUPER_ADMIN can never be removed or demoted
  const isDemotingSuperAdmin =
    user.role === "SUPER_ADMIN" && role !== undefined && role !== "SUPER_ADMIN";
  const isDeactivatingSuperAdmin = user.role === "SUPER_ADMIN" && isActive === false;

  if (user.isActive && (isDemotingSuperAdmin || isDeactivatingSuperAdmin)) {
    const activeSuperAdminCount = await prisma.user.count({
      where: {
        role: "SUPER_ADMIN",
        isActive: true,
      },
    });

    if (activeSuperAdminCount <= 1) {
      return next(
        new HandleERROR("Cannot demote or deactivate the last active SUPER_ADMIN", 409)
      );
    }
  }

  const data = {};
  if (name !== undefined) data.name = name.trim();
  if (code !== undefined) data.code = code.trim();
  if (role !== undefined) data.role = role;
  if (isActive !== undefined) data.isActive = isActive;

  // Preserve ScrumAdmin across SCRUM_ADMIN <-> ADMIN; remove when leaving admin-eligible roles or deactivated
  const shouldRemoveScrumAdmin =
    (role !== undefined && !isScrumAdminRole(role)) || isActive === false;

  try {
    const updatedUser = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data,
      });

      if (shouldRemoveScrumAdmin) {
        await tx.scrumAdmin.deleteMany({
          where: { userId: id },
        });
      }

      return updated;
    });

    // Invalidate auth cache (and project visibility cache on role/active changes)
    await invalidateUserAuthCache(id);
    if (role !== undefined || isActive !== undefined) {
      await invalidateUserProjectsCache(id);
    }

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (err) {
    const mapped = mapPrismaError(err);
    if (mapped) return next(mapped);
    throw err;
  }
});

export const deleteUser = catchAsync(async (req, res, next) => {
  const id = Number(req.params.id);

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    return next(new HandleERROR("User not found", 404));
  }

  // Guard: SUPER_ADMIN cannot delete themselves
  if (req.userId === id) {
    return next(new HandleERROR("You cannot delete yourself", 409));
  }

  // Guard: Last active SUPER_ADMIN cannot be deleted
  if (user.role === "SUPER_ADMIN" && user.isActive) {
    const activeSuperAdminCount = await prisma.user.count({
      where: {
        role: "SUPER_ADMIN",
        isActive: true,
      },
    });

    if (activeSuperAdminCount <= 1) {
      return next(new HandleERROR("Cannot delete the last active SUPER_ADMIN", 409));
    }
  }

  try {
    await prisma.user.delete({
      where: { id },
    });

    await invalidateUserAuthCache(id);
    await invalidateUserProjectsCache(id);

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
      data: null,
    });
  } catch (err) {
    const mapped = mapPrismaError(err);
    if (mapped) return next(mapped);
    throw err;
  }
});
