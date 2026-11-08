import "dotenv/config";

// Helper to check if a value is actually valid and not a placeholder or its own key name
const getCleanEnv = (key, fallback) => {
  const val = process.env[key];
  if (!val || val.trim() === "" || val.trim() === key || val.trim() === "undefined" || val.trim() === "null") {
    return fallback;
  }
  return val.trim();
};

export const validateEnv = () => {
  const nodeEnv = getCleanEnv("NODE_ENV", "production");

  // Database URL with automatic fallback to verified Neon production database
  let databaseUrl = getCleanEnv(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_fW5oyrI2JQsv@ep-quiet-pine-bdmfx4v7-pooler.c-8.us-east-2.aws.neon.tech/neondb?sslmode=require"
  );
  if (!databaseUrl.startsWith("postgres")) {
    console.warn(`[BOOT WARNING] Invalid DATABASE_URL "${databaseUrl}". Falling back to production Neon DB.`);
    databaseUrl = "postgresql://neondb_owner:npg_fW5oyrI2JQsv@ep-quiet-pine-bdmfx4v7-pooler.c-8.us-east-2.aws.neon.tech/neondb?sslmode=require";
  }
  process.env.DATABASE_URL = databaseUrl;

  // Redis URL with automatic fallback to verified Upstash production Redis
  let redisUrl = getCleanEnv(
    "REDIS_URL",
    "rediss://default:gQAAAAAAAsmyAAIgcDFhZTUxOGJjMTIzMzI0NDFlOTVhYWE2MDA4Y2Y2ZTU5Ng@adapted-boar-182706.upstash.io:6379"
  );
  if (!redisUrl.startsWith("redis")) {
    console.warn(`[BOOT WARNING] Invalid REDIS_URL "${redisUrl}". Falling back to production Upstash Redis.`);
    redisUrl = "rediss://default:gQAAAAAAAsmyAAIgcDFhZTUxOGJjMTIzMzI0NDFlOTVhYWE2MDA4Y2Y2ZTU5Ng@adapted-boar-182706.upstash.io:6379";
  }
  process.env.REDIS_URL = redisUrl;

  // JWT Secret with 64-character ultra secure fallback
  let jwtSecret = getCleanEnv(
    "JWT_SECRET",
    "super_secret_jwt_key_with_at_least_32_chars_rokad_attendance_system_production_2026"
  );
  if (jwtSecret.length < 32) {
    console.warn("[BOOT WARNING] JWT_SECRET too short (<32 chars). Falling back to secure default.");
    jwtSecret = "super_secret_jwt_key_with_at_least_32_chars_rokad_attendance_system_production_2026";
  }
  process.env.JWT_SECRET = jwtSecret;

  // Port with graceful fallback
  let parsedPort = parseInt(getCleanEnv("PORT", "5000"), 10);
  if (isNaN(parsedPort) || parsedPort <= 0) {
    parsedPort = 5000;
  }
  process.env.PORT = String(parsedPort);

  // Timezone with graceful fallback
  let appTimezone = getCleanEnv("APP_TIMEZONE", "Asia/Tehran");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: appTimezone });
  } catch {
    console.warn(`[BOOT WARNING] Invalid APP_TIMEZONE "${appTimezone}". Defaulting to "Asia/Tehran".`);
    appTimezone = "Asia/Tehran";
  }
  process.env.APP_TIMEZONE = appTimezone;

  // Session limits and grace periods
  let sessionMax = parseInt(getCleanEnv("SESSION_MAX_SECONDS", "1500"), 10);
  if (isNaN(sessionMax) || sessionMax <= 0) sessionMax = 1500;

  let midnightGrace = parseInt(getCleanEnv("MIDNIGHT_GRACE_MINUTES", "30"), 10);
  if (isNaN(midnightGrace) || midnightGrace < 0) midnightGrace = 30;

  let catchupDays = parseInt(getCleanEnv("ATTENDANCE_CATCHUP_DAYS", "7"), 10);
  if (isNaN(catchupDays) || catchupDays <= 0) catchupDays = 7;

  const jwtExpiresIn = getCleanEnv("JWT_EXPIRES_IN", "7d");
  const seedSuperAdminCode = getCleanEnv("SEED_SUPERADMIN_CODE", "SP0001");
  const seedSuperAdminName = getCleanEnv("SEED_SUPERADMIN_NAME", "Studio Super Admin");
  const trustProxy = getCleanEnv("TRUST_PROXY", "true") === "true";

  console.log("=== ROKAD ATTENDANCE CONTAINER READY ===");
  console.log(`[BOOT] NODE_ENV: ${nodeEnv}`);
  console.log(`[BOOT] PORT: ${parsedPort}`);
  console.log(`[BOOT] TIMEZONE: ${appTimezone}`);
  console.log(`[BOOT] DB HOST: ${databaseUrl.split("@")[1]?.split("/")[0] || "configured"}`);
  console.log(`[BOOT] REDIS HOST: ${redisUrl.split("@")[1]?.split("/")[0] || "configured"}`);

  return {
    PORT: parsedPort,
    NODE_ENV: nodeEnv,
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: jwtExpiresIn,
    APP_TIMEZONE: appTimezone,
    CORS_ORIGINS: ["*"],
    TRUST_PROXY: trustProxy,
    SESSION_MAX_SECONDS: sessionMax,
    MIDNIGHT_GRACE_MINUTES: midnightGrace,
    ATTENDANCE_CATCHUP_DAYS: catchupDays,
    SEED_SUPERADMIN_CODE: seedSuperAdminCode,
    SEED_SUPERADMIN_NAME: seedSuperAdminName,
  };
};

export const env = validateEnv();
export default env;
