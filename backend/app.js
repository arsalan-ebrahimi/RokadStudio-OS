import "./config/env.js";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { catchError, HandleERROR } from "vanta-api";

import prisma from "./config/prisma.js";
import redis, { connectRedis } from "./config/redis.js";
import { mapPrismaError } from "./Utils/prismaErrors.js";
import { ensureSchemaUpdated } from "./config/autoMigrate.js";

import authRouter from "./Modules/Auth/auth.js";
import usersRouter from "./Modules/Users/users.js";
import projectRouter from "./Modules/Project/project.js";
import attendanceRouter from "./Modules/Attendance/attendance.js";
import workSessionRouter from "./Modules/WorkSession/workSession.js";
import {
  scrumRouter,
  sprintRouter,
  sprintProjectRouter,
  workTargetsRouter,
} from "./Modules/Scrum/scrum.js";

import swaggerUi from "swagger-ui-express";
import { swaggerDocument, swaggerUiOptions } from "./docs/swagger.js";

const app = express();

// Initialize Redis asynchronously if not open
connectRedis().catch((err) => {
  console.warn("[Redis] Initial background connect note:", err.message);
});

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

app.use(
  cors({
    origin: (origin, callback) => {
      // Reflect origin so browsers never block when credentials: true is sent
      callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Payload size limit and proxy trust
app.use(express.json({ limit: "10kb" }));

if (process.env.TRUST_PROXY === "true" || process.env.TRUST_PROXY === "1") {
  app.set("trust proxy", true);
}

// Root landing endpoint (for Docker / PaaS health checks)
app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Rokad Studio OS Backend API is live",
    version: "1.0.0",
  });
});

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

// Ensure schema is updated asynchronously in background without blocking HTTP requests
ensureSchemaUpdated().catch((err) => {
  console.warn("[AutoMigrate] Background schema sync notice:", err.message);
});

// Mount modules under /api
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/projects", projectRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/work-sessions", workSessionRouter);
app.use("/api/scrums", scrumRouter);
app.use("/api/sprints", sprintRouter);
app.use("/api/sprint-projects", sprintProjectRouter);
app.use("/api/work-targets", workTargetsRouter);

// 404 Route handler
app.use((req, res, next) => {
  return next(new HandleERROR("Route not found", 404));
});

// Central error handler
app.use((err, req, res, next) => {
  console.error(`[API ERROR] ${req.method} ${req.originalUrl}:`, err);

  const mapped = mapPrismaError(err);
  if (mapped) {
    return catchError(mapped, req, res, next);
  }

  const statusCode = err.statusCode || (typeof err.status === "number" ? err.status : 500);
  const message = err.message || "Internal server error";

  return res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== "production" ? { stack: err.stack } : {}),
  });
});

export default app;
