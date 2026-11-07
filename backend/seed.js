/**
 * Rokad Studio OS - Database Seeder Entrypoint
 * Usage:
 *   node --experimental-strip-types seed.js
 *   or: npm run seed
 */
import "./config/env.js";
import { runSeed } from "./prisma/seed.js";
import prisma from "./config/prisma.js";

runSeed()
  .catch((err) => {
    console.error("❌ Database seed execution failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
