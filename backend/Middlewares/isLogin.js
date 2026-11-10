import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";
import { cacheGet, cacheSet } from "../Utils/cache.js";

/**
 * Loads user auth identity alongside Scrum admin/member counts for auth cache & /api/auth/me.
 */
export const fetchUserAuthWithCounts = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      isActive: true,
      name: true,
      _count: {
        select: {
          scrumAdmins: true,
          scrumMembers: true,
        },
      },
    },
  });

  if (!user) return null;

  const isAdminEligible = user.role === "SCRUM_ADMIN" || user.role === "ADMIN";
  const isMemberEligible = user.role !== "SUPER_ADMIN";

  return {
    id: user.id,
    role: user.role,
    isActive: user.isActive,
    name: user.name,
    administeredScrumCount: isAdminEligible ? Number(user._count?.scrumAdmins || 0) : 0,
    memberScrumCount: isMemberEligible ? Number(user._count?.scrumMembers || 0) : 0,
  };
};

export const isLogin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "You are not logged in",
      });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "You are not logged in",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = Number(decoded.userId || decoded.id);

    if (!userId || isNaN(userId)) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload",
      });
    }

    // Try loading from short-TTL Redis cache (60s)
    const cacheKey = `user:auth:${userId}`;
    let user = await cacheGet(cacheKey);

    if (
      !user ||
      typeof user.administeredScrumCount !== "number" ||
      typeof user.memberScrumCount !== "number"
    ) {
      // Fallback to database
      user = await fetchUserAuthWithCounts(userId);

      if (user) {
        // Cache user auth status & scrum counts for 60 seconds
        await cacheSet(cacheKey, user, 60);
      }
    }

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "You are not logged in or account is inactive",
      });
    }

    req.userId = user.id;
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "You are not logged in",
    });
  }
};

export default isLogin;
