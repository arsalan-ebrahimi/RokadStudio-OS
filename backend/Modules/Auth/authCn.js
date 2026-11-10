import jwt from "jsonwebtoken";
import { catchAsync } from "vanta-api";
import prisma from "../../config/prisma.js";
import { cacheSet } from "../../Utils/cache.js";
import { fetchUserAuthWithCounts } from "../../Middlewares/isLogin.js";
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
    select: {
      id: true,
      name: true,
      role: true,
      isActive: true,
      _count: {
        select: {
          scrumAdmins: true,
          scrumMembers: true,
        },
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

  const isAdminEligible = user.role === "SCRUM_ADMIN" || user.role === "ADMIN";
  const isMemberEligible = user.role !== "SUPER_ADMIN";
  const authProfile = {
    id: user.id,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    administeredScrumCount: isAdminEligible ? Number(user._count?.scrumAdmins || 0) : 0,
    memberScrumCount: isMemberEligible ? Number(user._count?.scrumMembers || 0) : 0,
  };

  const payload = {
    id: user.id,
    role: user.role,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

  // Cache user auth status and scrum counts in Redis for fast authorization lookups
  await cacheSet(`user:auth:${user.id}`, authProfile, 60);

  return res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      token,
      user: {
        id: authProfile.id,
        name: authProfile.name,
        role: authProfile.role,
        administeredScrumCount: authProfile.administeredScrumCount,
        memberScrumCount: authProfile.memberScrumCount,
      },
    },
  });
});

export const me = catchAsync(async (req, res, next) => {
  let profile = req.user;

  if (
    !profile ||
    typeof profile.administeredScrumCount !== "number" ||
    typeof profile.memberScrumCount !== "number"
  ) {
    profile = await fetchUserAuthWithCounts(req.userId);
    if (profile && profile.isActive) {
      await cacheSet(`user:auth:${profile.id}`, profile, 60);
    }
  }

  if (!profile || !profile.isActive) {
    return res.status(401).json({
      success: false,
      message: "You are not logged in or account is inactive",
    });
  }

  return res.status(200).json({
    success: true,
    message: "User profile fetched successfully",
    data: {
      id: profile.id,
      name: profile.name,
      role: profile.role,
      administeredScrumCount: profile.administeredScrumCount,
      memberScrumCount: profile.memberScrumCount,
    },
  });
});
