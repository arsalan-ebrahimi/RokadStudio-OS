import { catchAsync, HandleERROR } from "vanta-api";
import prisma from "../../config/prisma.js";
import { getPagination, formatPaginationMeta } from "../../Utils/pagination.js";
import { invalidateUserAuthCache, invalidateUserProjectsCache } from "../../Utils/cache.js";
import { mapPrismaError } from "../../Utils/prismaErrors.js";

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
  const { role, isActive, search } = req.query;

  const where = {};

  if (role) {
    where.role = role;
  }

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  if (search) {
    const term = search.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { code: { contains: term, mode: "insensitive" } },
    ];
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return res.status(200).json({
    success: true,
    message: "Users fetched successfully",
    data: users,
    meta: formatPaginationMeta(page, limit, total),
  });
});

export const searchUsers = catchAsync(async (req, res, next) => {
  const q = req.query.q ? req.query.q.trim() : "";

  const where = {
    isActive: true,
  };

  if (q) {
    where.name = { contains: q, mode: "insensitive" };
  }

  const isScrumAdminCaller = req.user?.role === "SCRUM_ADMIN";

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
    role: "SCRUM_ADMIN",
  };

  if (q) {
    where.name = { contains: q, mode: "insensitive" };
  }

  const admins = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
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

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    return next(new HandleERROR("User not found", 404));
  }

  return res.status(200).json({
    success: true,
    message: "User fetched successfully",
    data: user,
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
  const isDemotingSuperAdmin = user.role === "SUPER_ADMIN" && role !== undefined && role !== "SUPER_ADMIN";
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

  const shouldRemoveScrumAdmin =
    (role !== undefined && role !== "SCRUM_ADMIN") || isActive === false;

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
