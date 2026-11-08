import "./config/env.js"; // fail-fast env validation at boot
import app from "./app.js";
import { connectRedis } from "./config/redis.js";
import prisma from "./config/prisma.js";
import redis from "./config/redis.js";
import { startCronJobs, stopCronJobs, runBootCatchup } from "./Jobs/index.js";

const port = process.env.PORT || 5000;

let server = null;

const startServer = async () => {
  try {
    server = app.listen(port, "0.0.0.0", () => {
      console.log(`Rokad Attendance Platform server running on port ${port} (0.0.0.0)`);
    });

    // Connect to Redis and initialize background jobs non-blockingly
    connectRedis()
      .then(() => {
        // Start daily close cron job
        startCronJobs();
        // Catch up absences after server restart/downtime
        runBootCatchup();
      })
      .catch((err) => {
        console.error("Redis connection error (running in fail-open mode):", err.message);
      });
  } catch (error) {
    console.error("Fatal error during server startup:", error);
    process.exit(1);
  }
};

const gracefulShutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

  // Stop cron jobs
  try {
    stopCronJobs();
  } catch (err) {
    console.error("Error stopping cron jobs:", err.message);
  }

  // Close HTTP server to stop accepting new requests
  if (server) {
    await new Promise((resolve) => {
      server.close(() => {
        console.log("HTTP server closed.");
        resolve();
      });
    });
  }

  // Disconnect from database
  try {
    await prisma.$disconnect();
    console.log("Prisma client disconnected.");
  } catch (err) {
    console.error("Error disconnecting Prisma client:", err.message);
  }

  // Disconnect from Redis
  try {
    if (redis.isOpen) {
      await redis.quit();
      console.log("Redis connection closed.");
    }
  } catch (err) {
    console.error("Error closing Redis connection:", err.message);
  }

  console.log("Graceful shutdown completed. Exiting.");
  process.exit(0);
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

startServer();
