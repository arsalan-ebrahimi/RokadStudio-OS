import { catchAsync, HandleERROR } from "vanta-api";
import prisma from "../../config/prisma.js";
import { cacheGet, cacheSet } from "../../Utils/cache.js";
import { getPagination, formatPaginationMeta } from "../../Utils/pagination.js";
import {
  createProjectWithMembers,
  updateProjectById,
  syncProjectMembers,
  deleteProjectSafe,
  getProjectWorkSessionsById,
} from "./projectService.js";
import { mapPrismaError } from "../../Utils/prismaErrors.js";

export const getMineProjects = catchAsync(async (req, res, next) => {
  const userId = req.userId;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const cacheKey = `user:${userId}:projects`;

  const cached = await cacheGet(cacheKey);
  if (cached) {
    return res.status(200).json({
      success: true,
      message: "Projects fetched successfully",
      data: cached,
    });
  }

  const where = {
    isActive: true,
    ...(isSuperAdmin ? {} : { members: { some: { userId } } }),
  };

  const projects = await prisma.project.findMany({
    where,
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
    },
    orderBy: { name: "asc" },
  });

  await cacheSet(cacheKey, projects, 3600);

  return res.status(200).json({
    success: true,
    message: "Projects fetched successfully",
    data: projects,
  });
});

export const getAllProjects = catchAsync(async (req, res, next) => {
  const { page, limit, skip } = getPagination(req.query);
  const { isActive, search } = req.query;

  const where = {};
  if (isActive !== undefined) {
    where.isActive = isActive;
  }
  if (search) {
    where.name = { contains: search.trim(), mode: "insensitive" };
  }

  const [total, projects] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { members: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const formatted = projects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    isActive: p.isActive,
    createdById: p.createdById,
    memberCount: p._count.members,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));

  return res.status(200).json({
    success: true,
    message: "Projects fetched successfully",
    data: formatted,
    meta: formatPaginationMeta(page, limit, total),
  });
});

export const getProjectById = catchAsync(async (req, res, next) => {
  const id = Number(req.params.id);

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      members: {
        select: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!project) {
    return next(new HandleERROR("Project not found", 404));
  }

  const formatted = {
    id: project.id,
    name: project.name,
    description: project.description,
    isActive: project.isActive,
    createdById: project.createdById,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    members: project.members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
    })),
  };

  return res.status(200).json({
    success: true,
    message: "Project fetched successfully",
    data: formatted,
  });
});

export const getProjectWorkSessions = catchAsync(async (req, res, next) => {
  const id = Number(req.params.id);
  const result = await getProjectWorkSessionsById(id, req.query, req.user);
  return res.status(200).json({
    success: true,
    message: "سشن‌های کاری پروژه با موفقیت دریافت شد",
    data: result.data,
    meta: formatPaginationMeta(result.page, result.limit, result.total),
  });
});

export const createProject = catchAsync(async (req, res, next) => {
  try {
    const project = await createProjectWithMembers(req.body, req.userId);
    return res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: project,
    });
  } catch (err) {
    const mapped = mapPrismaError(err);
    if (mapped) return next(mapped);
    throw err;
  }
});

export const updateProject = catchAsync(async (req, res, next) => {
  const id = Number(req.params.id);

  try {
    const updated = await updateProjectById(id, req.body);

    return res.status(200).json({
      success: true,
      message: "Project updated successfully",
      data: updated,
    });
  } catch (err) {
    const mapped = mapPrismaError(err);
    if (mapped) return next(mapped);
    throw err;
  }
});

export const syncMembers = catchAsync(async (req, res, next) => {
  const id = Number(req.params.id);
  const { userIds } = req.body;

  try {
    const result = await syncProjectMembers(id, userIds);
    return res.status(200).json({
      success: true,
      message: "Project members updated successfully",
      data: result,
    });
  } catch (err) {
    const mapped = mapPrismaError(err);
    if (mapped) return next(mapped);
    throw err;
  }
});

export const deleteProject = catchAsync(async (req, res, next) => {
  const id = Number(req.params.id);

  try {
    await deleteProjectSafe(id);
    return res.status(200).json({
      success: true,
      message: "Project deleted successfully",
      data: null,
    });
  } catch (err) {
    const mapped = mapPrismaError(err);
    if (mapped) return next(mapped);
    throw err;
  }
});
