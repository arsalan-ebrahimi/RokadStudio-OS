import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";
import { cacheGet, cacheSet } from "../Utils/cache.js";

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

    if (!user) {
      // Fallback to database
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          isActive: true,
          name: true,
        },
      });

      if (user) {
        // Cache user auth status for 60 seconds
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
