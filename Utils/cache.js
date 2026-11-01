import redis, { deleteKeysByPattern } from "../config/redis.js";

/**
 * Safe get from Redis cache. Fails open (returns null on error).
 */
export const cacheGet = async (key) => {
  try {
    if (!redis.isOpen) return null;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error(`cacheGet failed for ${key}:`, err.message);
    return null;
  }
};

/**
 * Safe set to Redis cache with TTL in seconds. Fails open (does not throw).
 */
export const cacheSet = async (key, value, ttlSeconds = 3600) => {
  try {
    if (!redis.isOpen) return;
    const serialized = JSON.stringify(value);
    await redis.set(key, serialized, { EX: ttlSeconds });
  } catch (err) {
    console.error(`cacheSet failed for ${key}:`, err.message);
  }
};

/**
 * Safe deletion of specific key(s). Fails open.
 */
export const cacheDel = async (keyOrKeys) => {
  try {
    if (!redis.isOpen) return;
    if (Array.isArray(keyOrKeys)) {
      if (keyOrKeys.length > 0) {
        await redis.del(keyOrKeys);
      }
    } else if (keyOrKeys) {
      await redis.del(keyOrKeys);
    }
  } catch (err) {
    console.error("cacheDel failed:", err.message);
  }
};

/**
 * Invalidate user project list cache
 */
export const invalidateUserProjectsCache = async (userId) => {
  await cacheDel(`user:${userId}:projects`);
};

/**
 * Invalidate all user project caches (e.g. on project create/update/delete)
 */
export const invalidateAllProjectsCache = async () => {
  await deleteKeysByPattern("user:*:projects");
};

/**
 * Invalidate user auth cache (on role change, deactivation, deletion)
 */
export const invalidateUserAuthCache = async (userId) => {
  await cacheDel(`user:auth:${userId}`);
};
