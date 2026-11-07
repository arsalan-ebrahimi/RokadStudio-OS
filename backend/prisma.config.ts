import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node --experimental-strip-types prisma/seed.js",
  },
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://rokad_user:rokad_password@127.0.0.1:54320/rokad_attendance_db",
  },
});
