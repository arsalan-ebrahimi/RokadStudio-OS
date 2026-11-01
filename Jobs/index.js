import cron from "node-cron";
import redis from "../config/redis.js";
import { runDailyClose } from "./dailyClose.js";

let dailyCloseTask = null;

const acquireLock = async (lockKey, ttlSeconds = 600) => {
  try {
    if (!redis.isOpen) return true; // fail-open: run job even if redis is down
    const result = await redis.set(lockKey, "locked", {
      NX: true,
      EX: ttlSeconds,
    });
    return result === "OK";
  } catch (err) {
    console.error("Cron lock acquisition error (failing open):", err.message);
    return true;
  }
};

export const startCronJobs = () => {
  const timezone = process.env.APP_TIMEZONE || "Asia/Tehran";

  // Run at 00:05 daily in app timezone
  dailyCloseTask = cron.schedule(
    "5 0 * * *",
    async () => {
      const lockKey = "cron:lock:dailyClose";
      const gotLock = await acquireLock(lockKey, 600);
      if (!gotLock) {
        console.log("[DailyClose] Another instance holds the lock, skipping cron trigger.");
        return;
      }

      try {
        await runDailyClose(new Date());
      } catch (err) {
        console.error("[DailyClose] Error executing daily close job:", err.message);
      }
    },
    {
      timezone,
    }
  );

  console.log(`Cron scheduler started for daily close (00:05 in ${timezone}).`);
};

export const stopCronJobs = () => {
  if (dailyCloseTask) {
    dailyCloseTask.stop();
    console.log("Cron scheduler stopped.");
  }
};

/**
 * Non-blocking boot catch-up to fill absences after server downtime
 */
export const runBootCatchup = () => {
  setImmediate(async () => {
    try {
      console.log("[DailyClose] Running non-blocking boot catch-up...");
      await runDailyClose(new Date());
    } catch (err) {
      console.error("[DailyClose] Boot catch-up error:", err.message);
    }
  });
};
