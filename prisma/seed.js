import "dotenv/config";
import prisma from "../config/prisma.js";

export const runSeed = async () => {
  const code = process.env.SEED_SUPERADMIN_CODE || "super_admin_2026";
  const name = process.env.SEED_SUPERADMIN_NAME || "Studio Super Admin";

  const user = await prisma.user.upsert({
    where: { code },
    update: {
      name,
      role: "SUPER_ADMIN",
      isActive: true,
    },
    create: {
      code,
      name,
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });

  console.log(`Seed completed successfully: SUPER_ADMIN (${user.name}) is ready.`);
  return user;
};

if (process.argv[1] && process.argv[1].endsWith("seed.js")) {
  runSeed()
    .catch((e) => {
      console.error("Seed error:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
