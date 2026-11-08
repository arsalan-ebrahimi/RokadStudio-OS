import redis from "../config/redis.js";

const LOGIN_FAIL_LIMIT = 10;
const LOGIN_FAIL_WINDOW_SECONDS = 15 * 60; // 15 minutes

const WORK_SESSION_LIMIT = 30;
const WORK_SESSION_WINDOW_SECONDS = 60; // 1 minute

/**
 * Check if the IP has exceeded login failure attempts. Fails open if Redis is down.
 */
export const loginRateLimiter = async (req, res, next) => {
  try {
    if (!redis.isReady) return next();

    const ip = req.ip || req.socket.remoteAddress || "unknown_ip";
    const key = `ratelimit:login:fails:${ip}`;
    const failures = await redis.get(key);

    if (failures && parseInt(failures, 10) >= LOGIN_FAIL_LIMIT) {
      return res.status(429).json({
        success: false,
        message: "Too many failed login attempts. Please try again in 15 minutes.",
      });
    }

    next();
  } catch (err) {
    console.error("Login rate limiter error (failing open):", err.message);
    next();
  }
};

/**
 * Record a login failure for the given IP.
 */
export const recordLoginFailure = async (req) => {
  try {
    if (!redis.isReady) return;
    const ip = req.ip || req.socket.remoteAddress || "unknown_ip";
    const key = `ratelimit:login:fails:${ip}`;
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, LOGIN_FAIL_WINDOW_SECONDS);
    }
  } catch (err) {
    console.error("Record login failure error:", err.message);
  }
};

/**
 * Clear login failures upon successful login.
 */
export const clearLoginFailures = async (req) => {
  try {
    if (!redis.isReady) return;
    const ip = req.ip || req.socket.remoteAddress || "unknown_ip";
    const key = `ratelimit:login:fails:${ip}`;
    await redis.del(key);
  } catch (err) {
    console.error("Clear login failures error:", err.message);
  }
};

/**
 * Light per-user rate limit for WorkSession submissions. Fails open.
 */
export const workSessionRateLimiter = async (req, res, next) => {
  try {
    if (!redis.isReady || !req.userId) return next();

    const key = `ratelimit:work-session:${req.userId}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, WORK_SESSION_WINDOW_SECONDS);
    }

    if (count > WORK_SESSION_LIMIT) {
      return res.status(429).json({
        success: false,
        message: "Rate limit exceeded. Please wait a moment before logging more sessions.",
      });
    }

    next();
  } catch (err) {
    console.error("WorkSession rate limiter error (failing open):", err.message);
    next();
  }
};
