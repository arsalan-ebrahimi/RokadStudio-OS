import "dotenv/config";
import prisma from "../config/prisma.js";

export const runSeed = async () => {
  const adminCode = process.env.SEED_SUPERADMIN_CODE || "super_admin_2026";
  const adminName = process.env.SEED_SUPERADMIN_NAME || "Studio Super Admin";

  // 1. Seed Super Admin
  const admin = await prisma.user.upsert({
    where: { code: adminCode },
    update: {
      name: adminName,
      role: "SUPER_ADMIN",
      isActive: true,
    },
    create: {
      code: adminCode,
      name: adminName,
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });

  // 2. Seed Regular User
  const regularUser = await prisma.user.upsert({
    where: { code: "ROK1101" },
    update: {
      name: "علی محمدی",
      role: "USER",
      isActive: true,
    },
    create: {
      code: "ROK1101",
      name: "علی محمدی",
      role: "USER",
      isActive: true,
    },
  });

  // 3. Seed Sample Project
  let project = await prisma.project.findFirst({
    where: { name: "توسعه راکاد استودیو" },
  });

  if (!project) {
    project = await prisma.project.create({
      data: {
        name: "توسعه راکاد استودیو",
        description: "پروژه اصلی پلتفرم استودیو و سیستم حضور و غیاب",
        isActive: true,
        createdById: admin.id,
      },
    });
  }

  // 4. Assign Regular User to Project
  await prisma.projectMember.upsert({
    where: {
      projectId_userId: {
        projectId: project.id,
        userId: regularUser.id,
      },
    },
    update: {},
    create: {
      projectId: project.id,
      userId: regularUser.id,
    },
  });

  console.log(`✅ Seed completed successfully:`);
  console.log(`   - Super Admin: ${admin.name} (Code: ${admin.code})`);
  console.log(`   - Sample User: ${regularUser.name} (Code: ${regularUser.code})`);
  console.log(`   - Sample Project: ${project.name} (ID: ${project.id}) assigned to ${regularUser.name}`);

  return { admin, regularUser, project };
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
