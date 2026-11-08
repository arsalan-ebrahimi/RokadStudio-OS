import jwt from "jsonwebtoken";
import { catchAsync } from "vanta-api";
import prisma from "../../config/prisma.js";
import { cacheSet } from "../../Utils/cache.js";
import { recordLoginFailure, clearLoginFailures } from "../../Middlewares/rateLimit.js";

export const login = catchAsync(async (req, res, next) => {
  const { code } = req.body;
  const trimmedCode = (code || "").trim().toUpperCase();

  const user = await prisma.user.findFirst({
    where: {
      code: {
        equals: trimmedCode,
        mode: "insensitive",
      },
    },
  });

  // Unknown code and inactive user return the same generic 401
  if (!user || !user.isActive) {
    await recordLoginFailure(req);
    return res.status(401).json({
      success: false,
      message: "Invalid credentials",
    });
  }

  // Clear failed attempt counter on success
  await clearLoginFailures(req);

  const payload = {
    id: user.id,
    role: user.role,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

  // Cache user auth status in Redis for fast authorization lookups
  await cacheSet(
    `user:auth:${user.id}`,
    {
      id: user.id,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
    },
    60
  );

  return res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    },
  });
});

export const me = catchAsync(async (req, res, next) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      id: true,
      name: true,
      role: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    return res.status(401).json({
      success: false,
      message: "You are not logged in or account is inactive",
    });
  }

  return res.status(200).json({
    success: true,
    message: "User profile fetched successfully",
    data: {
      id: user.id,
      name: user.name,
      role: user.role,
    },
  });
});
