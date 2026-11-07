import "dotenv/config";

const requiredInProduction = ["DATABASE_URL", "JWT_SECRET"];

export const validateEnv = () => {
  const nodeEnv = process.env.NODE_ENV || "development";

  if (nodeEnv === "production") {
    for (const key of requiredInProduction) {
      if (!process.env[key]) {
        throw new Error(`Environment validation error: ${key} is required in production`);
      }
    }
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
      throw new Error("Environment validation error: JWT_SECRET must be at least 32 characters in production");
    }
  }

  // Set default values if not provided
  if (!process.env.PORT) process.env.PORT = "5000";
  if (!process.env.APP_TIMEZONE) process.env.APP_TIMEZONE = "Asia/Tehran";
  if (!process.env.REDIS_URL) process.env.REDIS_URL = "redis://localhost:6379";
  if (!process.env.JWT_EXPIRES_IN) process.env.JWT_EXPIRES_IN = "7d";
  if (!process.env.SESSION_MAX_SECONDS) process.env.SESSION_MAX_SECONDS = "1500";
  if (!process.env.MIDNIGHT_GRACE_MINUTES) process.env.MIDNIGHT_GRACE_MINUTES = "30";
  if (!process.env.ATTENDANCE_CATCHUP_DAYS) process.env.ATTENDANCE_CATCHUP_DAYS = "7";
  if (!process.env.SEED_SUPERADMIN_CODE) process.env.SEED_SUPERADMIN_CODE = "SP0001";
  if (!process.env.SEED_SUPERADMIN_NAME) process.env.SEED_SUPERADMIN_NAME = "Studio Super Admin";
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = "default_dev_jwt_secret_must_be_long_enough_rokad";

  // Validate numeric configs
  const sessionMax = parseInt(process.env.SESSION_MAX_SECONDS, 10);
  if (isNaN(sessionMax) || sessionMax <= 0) {
    throw new Error("Environment validation error: SESSION_MAX_SECONDS must be a positive integer");
  }

  const midnightGrace = parseInt(process.env.MIDNIGHT_GRACE_MINUTES, 10);
  if (isNaN(midnightGrace) || midnightGrace < 0) {
    throw new Error("Environment validation error: MIDNIGHT_GRACE_MINUTES must be a non-negative integer");
  }

  const catchupDays = parseInt(process.env.ATTENDANCE_CATCHUP_DAYS, 10);
  if (isNaN(catchupDays) || catchupDays <= 0) {
    throw new Error("Environment validation error: ATTENDANCE_CATCHUP_DAYS must be a positive integer");
  }

  // Validate timezone validity using Intl
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: process.env.APP_TIMEZONE });
  } catch (err) {
    throw new Error(`Environment validation error: Invalid APP_TIMEZONE: ${process.env.APP_TIMEZONE}`);
  }

  return {
    PORT: parseInt(process.env.PORT, 10),
    NODE_ENV: nodeEnv,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
    APP_TIMEZONE: process.env.APP_TIMEZONE,
    CORS_ORIGINS: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim()) : ["*"],
    TRUST_PROXY: process.env.TRUST_PROXY === "true" || process.env.TRUST_PROXY === "1",
    SESSION_MAX_SECONDS: sessionMax,
    MIDNIGHT_GRACE_MINUTES: midnightGrace,
    ATTENDANCE_CATCHUP_DAYS: catchupDays,
    SEED_SUPERADMIN_CODE: process.env.SEED_SUPERADMIN_CODE,
    SEED_SUPERADMIN_NAME: process.env.SEED_SUPERADMIN_NAME,
  };
};

export const env = validateEnv();
export default env;
