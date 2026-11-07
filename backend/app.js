import express from "express";
import helmet from "helmet";
import cors from "cors";
import { catchError, HandleERROR } from "vanta-api";

import prisma from "./config/prisma.js";
import redis from "./config/redis.js";
import { mapPrismaError } from "./Utils/prismaErrors.js";

import authRouter from "./Modules/Auth/auth.js";
import usersRouter from "./Modules/Users/users.js";
import projectRouter from "./Modules/Project/project.js";
import attendanceRouter from "./Modules/Attendance/attendance.js";
import workSessionRouter from "./Modules/WorkSession/workSession.js";

import swaggerUi from "swagger-ui-express";
import { swaggerDocument, swaggerUiOptions } from "./docs/swagger.js";

const app = express();

// Security and CORS
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": ["'self'", "'unsafe-inline'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "validator.swagger.io"],
      },
    },
  })
);

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim())
  : ["*"];

app.use(
  cors({
    origin: corsOrigins.includes("*") ? "*" : corsOrigins,
    credentials: true,
  })
);

// Payload size limit and proxy trust
app.use(express.json({ limit: "10kb" }));

if (process.env.TRUST_PROXY === "true" || process.env.TRUST_PROXY === "1") {
  app.set("trust proxy", true);
}

// Health check endpoint (public, unauthenticated)
app.get("/health", async (req, res) => {
  let dbOk = false;
  let redisOk = false;
  let redisStatus = "disconnected";

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (err) {
    dbOk = false;
  }

  try {
    if (redis.isOpen) {
      const pong = await redis.ping();
      redisOk = pong === "PONG";
      redisStatus = "connected";
    }
  } catch (err) {
    redisOk = false;
  }

  const isHealthy = dbOk && redisOk;
  const statusCode = isHealthy ? 200 : 503;

  return res.status(statusCode).json({
    success: isHealthy,
    message: isHealthy ? "System is healthy" : "System is degraded or unhealthy",
    data: {
      database: dbOk ? "connected" : "disconnected",
      redis: redisStatus,
    },
  });
});

// Swagger / OpenAPI documentation routes (public, unauthenticated)
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerUiOptions));
app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  return res.json(swaggerDocument);
});
app.get("/docs", (req, res) => res.redirect("/api-docs"));

// Mount modules under /api
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/projects", projectRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/work-sessions", workSessionRouter);

// 404 Route handler
app.use((req, res, next) => {
  return next(new HandleERROR("Route not found", 404));
});

// Central error handler
app.use((err, req, res, next) => {
  const mapped = mapPrismaError(err);
  if (mapped) {
    return catchError(mapped, req, res, next);
  }

  // Prevent leaking stack traces or internal SQL in production
  if (process.env.NODE_ENV === "production" && (!err.statusCode || err.statusCode === 500)) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }

  return catchError(err, req, res, next);
});

export default app;
