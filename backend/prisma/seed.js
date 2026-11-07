import "dotenv/config";
import prisma from "../config/prisma.js";
import { todayDate } from "../Utils/date.js";

export const runSeed = async () => {
  const envSuperAdminCode = process.env.SEED_SUPERADMIN_CODE || "super_admin_2026";
  const envSuperAdminName = process.env.SEED_SUPERADMIN_NAME || "Studio Super Admin";
  const today = todayDate();

  console.log("\n=======================================================");
  console.log("🌱 Starting Database Seed - Rokad Studio OS Platform");
  console.log("=======================================================\n");

  // 1. Seed Main Super Admin from environment
  console.log("👑 Seeding Super Admin accounts...");
  const superAdmin = await prisma.user.upsert({
    where: { code: envSuperAdminCode },
    update: {
      name: envSuperAdminName,
      role: "SUPER_ADMIN",
      isActive: true,
    },
    create: {
      code: envSuperAdminCode,
      name: envSuperAdminName,
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });

  // 1.1 Also ensure short test code SP0001 exists as Super Admin for UI testing
  let shortCodeSuperAdmin = superAdmin;
  if (envSuperAdminCode !== "SP0001") {
    shortCodeSuperAdmin = await prisma.user.upsert({
      where: { code: "SP0001" },
      update: {
        name: "Studio Super Admin (SP0001)",
        role: "SUPER_ADMIN",
        isActive: true,
      },
      create: {
        code: "SP0001",
        name: "Studio Super Admin (SP0001)",
        role: "SUPER_ADMIN",
        isActive: true,
      },
    });
  }

  // 2. Seed Simple Admin (ADMIN)
  console.log("🛡️  Seeding Operations Admin account...");
  const simpleAdmin = await prisma.user.upsert({
    where: { code: "AD0001" },
    update: {
      name: "Studio Operations Admin (AD0001)",
      role: "ADMIN",
      isActive: true,
    },
    create: {
      code: "AD0001",
      name: "Studio Operations Admin (AD0001)",
      role: "ADMIN",
      isActive: true,
    },
  });

  // 3. Remove old regular users (non-admin) for a clean reset
  console.log("🧹 Cleaning up old regular users...");
  await prisma.user.deleteMany({
    where: {
      role: { notIn: ["ADMIN", "SUPER_ADMIN"] },
    },
  });

  // 4. Seed Regular Personnel Users (USER) partitioned by Department
  // IT: Engineering & Development
  // AR: Creative & Artists
  // AF: Operations & Generalists
  const usersData = [
    // Engineering (IT)
    { code: "IT1101", name: "Artin Amiri" },
    { code: "IT1102", name: "MohammadMehdi Sadeghi" },
    { code: "IT1103", name: "Arsalan Ebrahimi" },
    { code: "IT1104", name: "Mahdiar Tavakoli" },
    { code: "IT1105", name: "Setareh Sayyad" },
    // Creative & Artists (AR)
    { code: "AR1101", name: "Mahdiar Hassanzadeh" },
    { code: "AR1102", name: "Parsa Rahmani" },
    { code: "AR1103", name: "Matin Ghanei" },
    // Generalists (AF)
    { code: "AF1101", name: "Soroush Hassani" },
    { code: "AF1102", name: "Hossein Khoshraftar" },
    { code: "AF1103", name: "Elisa Valizadeh" },
    { code: "AF1104", name: "Melika Tork" },
    { code: "AF1105", name: "MohammadReza Nabavi" },
    { code: "AF1106", name: "Bahar Bazrafshan" },
  ];

  console.log("👥 Seeding studio personnel users across departments...");
  const seededUsers = [];
  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { code: u.code },
      update: { name: u.name, role: "USER", isActive: true },
      create: { code: u.code, name: u.name, role: "USER", isActive: true },
    });
    seededUsers.push(user);
  }

  // 5. Seed Projects
  console.log("📁 Seeding active studio projects and assigning members...");
  const projectsData = [
    {
      name: "Rokad Studio OS Platform",
      description: "Central attendance, focus timer and team workspace portal",
      members: [
        seededUsers[0].id,
        seededUsers[1].id,
        seededUsers[2].id,
        seededUsers[3].id,
        seededUsers[4].id,
      ],
    },
    {
      name: "Design System & Visual Identity",
      description: "Design tokens, typography and neo-brutalist UI components",
      members: [
        seededUsers[5].id,
        seededUsers[6].id,
        seededUsers[7].id,
        seededUsers[8].id,
      ],
    },
    {
      name: "College Digital Marketing Campaign",
      description: "Bootcamp applicant acquisition, campaigns and performance tracking",
      members: [
        seededUsers[9].id,
        seededUsers[10].id,
        seededUsers[11].id,
      ],
    },
    {
      name: "Mentoring & Courses Platform",
      description: "Interview management, mentoring sessions and student homework reviews",
      members: [
        seededUsers[11].id,
        seededUsers[12].id,
        seededUsers[13].id,
        seededUsers[0].id,
      ],
    },
  ];

  const seededProjects = [];
  for (const p of projectsData) {
    let proj = await prisma.project.findFirst({ where: { name: p.name } });
    if (!proj) {
      proj = await prisma.project.create({
        data: {
          name: p.name,
          description: p.description,
          isActive: true,
          createdById: superAdmin.id,
        },
      });
    } else {
      proj = await prisma.project.update({
        where: { id: proj.id },
        data: {
          description: p.description,
          isActive: true,
        },
      });
    }
    // sync members
    for (const userId of p.members) {
      await prisma.projectMember.upsert({
        where: { projectId_userId: { projectId: proj.id, userId } },
        update: {},
        create: { projectId: proj.id, userId },
      });
    }
    seededProjects.push(proj);
  }

  // 6. Seed Sample Attendance for Today (for testing admin review & dashboard)
  console.log("⏰ Seeding today's attendance sample records...");
  // IT1101: Present, PENDING (ready for admin approval)
  const att1 = await prisma.attendance.upsert({
    where: { userId_date: { userId: seededUsers[0].id, date: today } },
    update: { status: "PRESENT", approval: "PENDING", source: "USER" },
    create: {
      userId: seededUsers[0].id,
      date: today,
      status: "PRESENT",
      approval: "PENDING",
      source: "USER",
    },
  });

  // IT1102: Present, PENDING (ready for admin approval)
  await prisma.attendance.upsert({
    where: { userId_date: { userId: seededUsers[1].id, date: today } },
    update: { status: "PRESENT", approval: "PENDING", source: "USER" },
    create: {
      userId: seededUsers[1].id,
      date: today,
      status: "PRESENT",
      approval: "PENDING",
      source: "USER",
    },
  });

  // IT1103: Present, APPROVED (approved by admin)
  const att3 = await prisma.attendance.upsert({
    where: { userId_date: { userId: seededUsers[2].id, date: today } },
    update: {
      status: "PRESENT",
      approval: "APPROVED",
      source: "ADMIN",
      decidedById: simpleAdmin.id,
      decidedAt: new Date(),
    },
    create: {
      userId: seededUsers[2].id,
      date: today,
      status: "PRESENT",
      approval: "APPROVED",
      source: "ADMIN",
      decidedById: simpleAdmin.id,
      decidedAt: new Date(),
    },
  });

  // AR1101: Present, APPROVED (approved by admin)
  const att4 = await prisma.attendance.upsert({
    where: { userId_date: { userId: seededUsers[5].id, date: today } },
    update: {
      status: "PRESENT",
      approval: "APPROVED",
      source: "ADMIN",
      decidedById: simpleAdmin.id,
      decidedAt: new Date(),
    },
    create: {
      userId: seededUsers[5].id,
      date: today,
      status: "PRESENT",
      approval: "APPROVED",
      source: "ADMIN",
      decidedById: simpleAdmin.id,
      decidedAt: new Date(),
    },
  });

  // 7. Seed Sample Work Sessions for Today (1500s each = 25 mins Pomodoro)
  console.log("⏳ Seeding sample focus work sessions (25-min Pomodoro)...");
  const existingSessions = await prisma.workSession.count({ where: { attendanceId: att1.id } });
  if (existingSessions === 0) {
    await prisma.workSession.createMany({
      data: [
        {
          userId: seededUsers[0].id,
          projectId: seededProjects[0].id,
          attendanceId: att1.id,
          durationSeconds: 1500,
        },
        {
          userId: seededUsers[0].id,
          projectId: seededProjects[1].id,
          attendanceId: att1.id,
          durationSeconds: 1500,
        },
        {
          userId: seededUsers[2].id,
          projectId: seededProjects[0].id,
          attendanceId: att3.id,
          durationSeconds: 1500,
        },
        {
          userId: seededUsers[5].id,
          projectId: seededProjects[1].id,
          attendanceId: att4.id,
          durationSeconds: 1500,
        },
      ],
    });
  }

  console.log("\n=======================================================");
  console.log("✅ Database Seed Completed Successfully!");
  console.log("=======================================================");
  console.log("🔑 Login Credentials for System Testing:");
  console.log(`   👑 Super Admin:        Code: "${superAdmin.code}" (${superAdmin.name})`);
  if (envSuperAdminCode !== "SP0001") {
    console.log(`   👑 Super Admin (Test): Code: "${shortCodeSuperAdmin.code}" (${shortCodeSuperAdmin.name})`);
  }
  console.log(`   🛡️  Operations Admin:   Code: "${simpleAdmin.code}" (${simpleAdmin.name})`);
  console.log("\n   👥 Regular Personnel (Code & Name):");
  seededUsers.forEach((u) => {
    console.log(`      • [${u.code}] - ${u.name}`);
  });
  console.log(`\n   📁 Projects: ${seededProjects.length} active projects created and assigned.`);
  console.log("   ⏰ Attendance: Today's records seeded (APPROVED & PENDING states).");
  console.log("   ⏳ Work Sessions: 4 sample 25-minute Pomodoro sessions registered.");
  console.log("=======================================================\n");

  return { superAdmin, shortCodeSuperAdmin, simpleAdmin, seededUsers, seededProjects };
};

const isPrismaDirectCall =
  process.argv[1] &&
  (process.argv[1].endsWith("prisma\\seed.js") ||
    process.argv[1].endsWith("prisma/seed.js") ||
    process.argv[1].endsWith("prisma\\seed.ts") ||
    process.argv[1].endsWith("prisma/seed.ts"));

if (isPrismaDirectCall) {
  runSeed()
    .catch((e) => {
      console.error("❌ Database seed failed:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
