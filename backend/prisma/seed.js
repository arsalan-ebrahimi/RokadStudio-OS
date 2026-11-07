import "dotenv/config";
import prisma from "../config/prisma.js";
import { todayDate } from "../Utils/date.js";

export const runSeed = async () => {
  const superAdminCode = process.env.SEED_SUPERADMIN_CODE || "999999";
  const superAdminName = process.env.SEED_SUPERADMIN_NAME || "Studio Super Admin";
  const today = todayDate();

  console.log("\n=======================================================");
  console.log("🌱 Database Seeder - Rokad Studio OS (6-Digit Numeric)");
  console.log("=======================================================\n");

  // 1. Clean up ALL existing data in reverse relational order
  console.log("🧹 Wiping all existing database tables for a clean slate...");
  await prisma.workSession.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.projectMember.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.user.deleteMany({});
  console.log("   ✓ All tables cleared successfully.");

  // 2. Seed Super Admin (SUPER_ADMIN) - 6 digits: 999999
  console.log("\n👑 Seeding Super Admin account...");
  const superAdmin = await prisma.user.create({
    data: {
      code: superAdminCode,
      name: superAdminName,
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });
  console.log(`   ✓ Super Admin: [${superAdmin.code}] - ${superAdmin.name}`);

  // 3. Seed Operations Admin (ADMIN) - 6 digits: 888888
  console.log("\n🛡️  Seeding Operations Admin account...");
  const simpleAdmin = await prisma.user.create({
    data: {
      code: "888888",
      name: "Studio Operations Admin",
      role: "ADMIN",
      isActive: true,
    },
  });
  console.log(`   ✓ Operations Admin: [${simpleAdmin.code}] - ${simpleAdmin.name}`);

  // 4. Seed Personnel Users (USER) partitioned by Department (All 6 digits)
  // 10xxxx: Engineering (IT)
  // 20xxxx: Creative / Artists (AR)
  // 30xxxx: Operations & Generalists (AF)
  const usersData = [
    // Engineering (10xxxx)
    { code: "101101", name: "Artin Amiri", department: "Engineering (IT)" },
    { code: "101102", name: "MohammadMehdi Sadeghi", department: "Engineering (IT)" },
    { code: "101103", name: "Arsalan Ebrahimi", department: "Engineering (IT)" },
    { code: "101104", name: "Mahdiar Tavakoli", department: "Engineering (IT)" },
    { code: "101105", name: "Setareh Sayyad", department: "Engineering (IT)" },
    // Creative & Artists (20xxxx)
    { code: "201101", name: "Mahdiar Hassanzadeh", department: "Creative / Artists (AR)" },
    { code: "201102", name: "Parsa Rahmani", department: "Creative / Artists (AR)" },
    { code: "201103", name: "Matin Ghanei", department: "Creative / Artists (AR)" },
    // Operations & Generalists (30xxxx)
    { code: "301101", name: "Soroush Hassani", department: "Operations / Generalists (AF)" },
    { code: "301102", name: "Hossein Khoshraftar", department: "Operations / Generalists (AF)" },
    { code: "301103", name: "Elisa Valizadeh", department: "Operations / Generalists (AF)" },
    { code: "301104", name: "Melika Tork", department: "Operations / Generalists (AF)" },
    { code: "301105", name: "MohammadReza Nabavi", department: "Operations / Generalists (AF)" },
    { code: "301106", name: "Bahar Bazrafshan", department: "Operations / Generalists (AF)" },
  ];

  console.log("\n👥 Seeding personnel users across departments...");
  const seededUsers = [];
  for (const u of usersData) {
    const user = await prisma.user.create({
      data: {
        code: u.code,
        name: u.name,
        role: "USER",
        isActive: true,
      },
    });
    seededUsers.push({ ...user, department: u.department });
    console.log(`   ✓ [${user.code}] ${user.name} (${u.department})`);
  }

  // 5. Seed Projects and Assign Members
  console.log("\n📁 Seeding active studio projects...");
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
        seededUsers[4].id,
      ],
    },
    {
      name: "College Digital Marketing Campaign",
      description: "Bootcamp applicant acquisition, campaigns and performance tracking",
      members: [
        seededUsers[8].id,
        seededUsers[9].id,
        seededUsers[10].id,
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
    const proj = await prisma.project.create({
      data: {
        name: p.name,
        description: p.description,
        isActive: true,
        createdById: superAdmin.id,
      },
    });

    for (const userId of p.members) {
      await prisma.projectMember.create({
        data: { projectId: proj.id, userId },
      });
    }
    seededProjects.push(proj);
    console.log(`   ✓ Project: "${proj.name}" (${p.members.length} members assigned)`);
  }

  // 6. Seed Sample Attendance for Today
  console.log("\n⏰ Seeding today's attendance sample records...");
  // 101101: Present, PENDING (ready for admin approval)
  const att1 = await prisma.attendance.create({
    data: {
      userId: seededUsers[0].id,
      date: today,
      status: "PRESENT",
      approval: "PENDING",
      source: "USER",
    },
  });

  // 101102: Present, PENDING (ready for admin approval)
  await prisma.attendance.create({
    data: {
      userId: seededUsers[1].id,
      date: today,
      status: "PRESENT",
      approval: "PENDING",
      source: "USER",
    },
  });

  // 101103: Present, APPROVED (approved by Operations Admin)
  const att3 = await prisma.attendance.create({
    data: {
      userId: seededUsers[2].id,
      date: today,
      status: "PRESENT",
      approval: "APPROVED",
      source: "ADMIN",
      decidedById: simpleAdmin.id,
      decidedAt: new Date(),
    },
  });

  // 201101: Present, APPROVED (approved by Operations Admin)
  const att4 = await prisma.attendance.create({
    data: {
      userId: seededUsers[5].id,
      date: today,
      status: "PRESENT",
      approval: "APPROVED",
      source: "ADMIN",
      decidedById: simpleAdmin.id,
      decidedAt: new Date(),
    },
  });
  console.log("   ✓ 4 sample attendances seeded (2 PENDING, 2 APPROVED).");

  // 7. Seed Sample 25-minute Pomodoro Work Sessions (1500s each)
  console.log("\n⏳ Seeding sample focus work sessions (25-min Pomodoro)...");
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
  console.log("   ✓ 4 work sessions registered (1500s each).");

  console.log("\n=======================================================");
  console.log("🎉 All Seed Data Successfully Created & Verified!");
  console.log("=======================================================");
  console.log("🔑 All Login Codes (6 Digits Numeric):");
  console.log(`   👑 Super Admin:        [${superAdmin.code}] - ${superAdmin.name}`);
  console.log(`   🛡️  Operations Admin:   [${simpleAdmin.code}] - ${simpleAdmin.name}`);
  console.log("\n   👥 Personnel Login Codes:");
  seededUsers.forEach((u) => {
    console.log(`      • [${u.code}] - ${u.name.padEnd(24)} (${u.department})`);
  });
  console.log(`\n   📁 Projects Created:   ${seededProjects.length}`);
  console.log("   ⏰ Attendances:        4 records for today (2 PENDING, 2 APPROVED)");
  console.log("   ⏳ Focus Sessions:     4 Pomodoro sessions (25 mins each)");
  console.log("=======================================================\n");

  return { superAdmin, simpleAdmin, seededUsers, seededProjects };
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
