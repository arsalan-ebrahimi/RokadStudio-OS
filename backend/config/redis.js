import { createClient } from "redis";

const redis = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
  disableOfflineQueue: true, // Fail-fast: never hang requests when redis is connecting/reconnecting
  socket: {
    connectTimeout: 2000,
    reconnectStrategy: (retries) => {
      if (retries > 3) {
        console.warn("[Redis] Maximum reconnection attempts reached. Continuing in offline mode.");
        return false; // stop reconnecting
      }
      return Math.min(retries * 500, 2000);
    },
  },
});

redis.on("error", (err) => {
  console.error("Redis Client Error:", err.message || err);
});

redis.on("connect", () => {
  console.log("Redis Client Connected");
});

redis.on("ready", () => {
  console.log("Redis Client ready to serve");
});

export const connectRedis = async () => {
  try {
    if (!redis.isOpen && !redis.isReady) {
      await Promise.race([
        redis.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Redis connect timeout")), 1500)),
      ]);
    }
  } catch (err) {
    console.warn("Failed to connect to Redis (continuing in fail-open mode):", err.message);
  }
  return redis;
};

/**
 * Deletes keys matching a pattern using SCAN instead of blocking KEYS command
 */
export const deleteKeysByPattern = async (pattern) => {
  try {
    if (!redis.isOpen) return;
    let cursor = "0";
    do {
      const reply = await redis.scan(cursor, {
        MATCH: pattern,
        COUNT: 100,
      });
      cursor = typeof reply === "object" && "cursor" in reply ? String(reply.cursor) : String(reply[0]);
      const keys = typeof reply === "object" && "keys" in reply ? reply.keys : reply[1];
      if (keys && keys.length > 0) {
        await redis.del(keys);
      }
    } while (cursor !== "0");
  } catch (err) {
    console.error(`deleteKeysByPattern error for pattern ${pattern}:`, err.message);
  }
};

export default redis;
