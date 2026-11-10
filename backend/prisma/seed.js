import "dotenv/config";
import prisma from "../config/prisma.js";
import { todayDate, addDays } from "../Utils/date.js";

export const runSeed = async () => {
  const superAdminCode = process.env.SEED_SUPERADMIN_CODE || "SP0001";
  const superAdminName = process.env.SEED_SUPERADMIN_NAME || "Studio Super Admin";
  const today = todayDate();
  const yesterday = addDays(today, -1);

  console.log("\n=======================================================");
  console.log("🌱 Database Seeder - Rokad Studio OS (Exact 6 Characters)");
  console.log("=======================================================\n");

  // 1. Clean up ALL existing data in reverse relational order
  console.log("🧹 Wiping all existing database tables for a clean slate...");
  await prisma.workSession.deleteMany({});
  await prisma.sprintProject.deleteMany({});
  await prisma.sprint.deleteMany({});
  await prisma.scrumMember.deleteMany({});
  await prisma.scrumAdmin.deleteMany({});
  await prisma.scrumKpi.deleteMany({});
  await prisma.scrumEvent.deleteMany({});
  await prisma.scrum.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.projectMember.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.user.deleteMany({});
  console.log("   ✓ All tables cleared successfully.");

  // 2. Seed Super Admin (SUPER_ADMIN) - 6 chars: SP0001
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

  // 3. Seed Operations Admin (ADMIN) - 6 chars: AD0001
  console.log("\n🛡️  Seeding Operations Admin account...");
  const simpleAdmin = await prisma.user.create({
    data: {
      code: "AD0001",
      name: "Studio Operations Admin",
      role: "ADMIN",
      isActive: true,
    },
  });
  console.log(`   ✓ Operations Admin: [${simpleAdmin.code}] - ${simpleAdmin.name}`);

  // 3.5. Seed Scrum Admins (SCRUM_ADMIN) - 6 chars: SC1101, SC1102
  console.log("\n⚡ Seeding Scrum Admin accounts...");
  const scrumAdmin = await prisma.user.create({
    data: {
      code: "SC1101",
      name: "Studio Scrum Master",
      role: "SCRUM_ADMIN",
      isActive: true,
    },
  });
  const scrumAdmin2 = await prisma.user.create({
    data: {
      code: "SC1102",
      name: "Second Scrum Master",
      role: "SCRUM_ADMIN",
      isActive: true,
    },
  });
  console.log(`   ✓ Scrum Admin 1: [${scrumAdmin.code}] - ${scrumAdmin.name}`);
  console.log(`   ✓ Scrum Admin 2: [${scrumAdmin2.code}] - ${scrumAdmin2.name}`);

  // 4. Seed Personnel Users (USER) partitioned by Department (All exactly 6 characters)
  // ITxxxx: Engineering & Development (IT)
  // ARxxxx: Creative & Artists (AR)
  // AFxxxx: Operations & Generalists (AF)
  const usersData = [
    // Engineering (IT)
    { code: "IT1101", name: "Artin Amiri", department: "Engineering (IT)" },
    { code: "IT1102", name: "MohammadMehdi Sadeghi", department: "Engineering (IT)" },
    { code: "IT1103", name: "Arsalan Ebrahimi", department: "Engineering (IT)" },
    { code: "IT1104", name: "Mahdiar Tavakoli", department: "Engineering (IT)" },
    { code: "IT1105", name: "Setareh Sayyad", department: "Engineering (IT)" },
    // Creative & Artists (AR)
    { code: "AR1101", name: "Mahdiar Hassanzadeh", department: "Creative / Artists (AR)" },
    { code: "AR1102", name: "Parsa Rahmani", department: "Creative / Artists (AR)" },
    { code: "AR1103", name: "Matin Ghanei", department: "Creative / Artists (AR)" },
    // Operations & Generalists (AF)
    { code: "AF1101", name: "Soroush Hassani", department: "Operations / Generalists (AF)" },
    { code: "AF1102", name: "Hossein Khoshraftar", department: "Operations / Generalists (AF)" },
    { code: "AF1103", name: "Elisa Valizadeh", department: "Operations / Generalists (AF)" },
    { code: "AF1104", name: "Melika Tork", department: "Operations / Generalists (AF)" },
    { code: "AF1105", name: "MohammadReza Nabavi", department: "Operations / Generalists (AF)" },
    { code: "AF1106", name: "Bahar Bazrafshan", department: "Operations / Generalists (AF)" },
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

  // 5. Seed Scrums first so Projects can optionally link via scrumId
  console.log("\n🚀 Seeding sample Scrum workspaces...");
  const sampleScrum = await prisma.scrum.create({
    data: {
      name: "اسکرام توسعه پلتفرم",
      description: "اسکرام تیم فنی برای توسعه و بهبود پلتفرم استودیو رکاد",
      color: "ECOSYSTEM",
      isActive: true,
    },
  });

  const sampleScrum2 = await prisma.scrum.create({
    data: {
      name: "اسکرام کالج و کمپین",
      description: "اسکرام رشد مخاطب، کمپین‌های دیجیتال و عملیات کالج",
      color: "COLLEGE",
      isActive: true,
    },
  });

  // Assign Scrum Admins (sampleScrum has 2 admins: SC1101 + SC1102; sampleScrum2 has SC1102)
  await prisma.scrumAdmin.createMany({
    data: [
      { scrumId: sampleScrum.id, userId: scrumAdmin.id, assignedById: superAdmin.id },
      { scrumId: sampleScrum.id, userId: scrumAdmin2.id, assignedById: superAdmin.id },
      { scrumId: sampleScrum2.id, userId: scrumAdmin2.id, assignedById: superAdmin.id },
    ],
  });

  // Scrum Members (keep IT1103 / seededUsers[2] outside both scrums as outsider reference)
  await prisma.scrumMember.createMany({
    data: [
      { scrumId: sampleScrum.id, userId: scrumAdmin.id, label: "اسکرام مستر" },
      { scrumId: sampleScrum.id, userId: seededUsers[0].id, label: "توسعه‌دهنده فرانت‌اند" },
      { scrumId: sampleScrum.id, userId: seededUsers[1].id, label: "توسعه‌دهنده بک‌اند" },
      { scrumId: sampleScrum.id, userId: seededUsers[3].id, label: "تضمین کیفیت" },
      { scrumId: sampleScrum2.id, userId: scrumAdmin2.id, label: "لید کمپین" },
      { scrumId: sampleScrum2.id, userId: seededUsers[8].id, label: "کارشناس بازاریابی" },
      { scrumId: sampleScrum2.id, userId: seededUsers[9].id, label: "طراح کمپین" },
    ],
  });

  // 6. Seed Projects and Assign Members (Projects[0] linked to sampleScrum; Projects[2] linked to sampleScrum2)
  console.log("\n📁 Seeding active studio projects...");
  const projectsData = [
    {
      name: "Rokad Studio OS Platform",
      description: "Central attendance, focus timer and team workspace portal",
      scrumId: sampleScrum.id,
      members: [
        superAdmin.id,
        simpleAdmin.id,
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
      scrumId: null,
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
      scrumId: sampleScrum2.id,
      members: [
        seededUsers[8].id,
        seededUsers[9].id,
        seededUsers[10].id,
      ],
    },
    {
      name: "Mentoring & Courses Platform",
      description: "Interview management, mentoring sessions and student homework reviews",
      scrumId: null,
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
        scrumId: p.scrumId,
        createdById: superAdmin.id,
      },
    });

    for (const userId of p.members) {
      await prisma.projectMember.create({
        data: { projectId: proj.id, userId },
      });
    }
    seededProjects.push(proj);
    console.log(
      `   ✓ Project: "${proj.name}" (${p.members.length} members, scrumId=${proj.scrumId ?? "none"})`
    );
  }

  // 7. Seed Sample Attendance for Today & Yesterday (for APPROVED leaderboard sessions)
  console.log("\n⏰ Seeding sample attendance records...");
  // IT1101 today: Present, PENDING (ready for admin approval)
  const att1 = await prisma.attendance.create({
    data: {
      userId: seededUsers[0].id,
      date: today,
      status: "PRESENT",
      approval: "PENDING",
      source: "USER",
    },
  });

  // IT1102 today: Present, PENDING (ready for admin approval)
  await prisma.attendance.create({
    data: {
      userId: seededUsers[1].id,
      date: today,
      status: "PRESENT",
      approval: "PENDING",
      source: "USER",
    },
  });

  // IT1103 today: Present, APPROVED
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

  // AR1101 today: Present, APPROVED
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

  // Yesterday approved attendances for IT1101 & IT1102 + AF1101 so Scrum leaderboard has approved history
  const attYesterday1 = await prisma.attendance.create({
    data: {
      userId: seededUsers[0].id,
      date: yesterday,
      status: "PRESENT",
      approval: "APPROVED",
      source: "ADMIN",
      decidedById: simpleAdmin.id,
      decidedAt: new Date(),
    },
  });

  const attYesterday2 = await prisma.attendance.create({
    data: {
      userId: seededUsers[1].id,
      date: yesterday,
      status: "PRESENT",
      approval: "APPROVED",
      source: "ADMIN",
      decidedById: simpleAdmin.id,
      decidedAt: new Date(),
    },
  });

  const attYesterdayAf1 = await prisma.attendance.create({
    data: {
      userId: seededUsers[8].id,
      date: yesterday,
      status: "PRESENT",
      approval: "APPROVED",
      source: "ADMIN",
      decidedById: simpleAdmin.id,
      decidedAt: new Date(),
    },
  });
  console.log("   ✓ 7 sample attendances seeded (4 today, 3 yesterday APPROVED).");

  // 8. Seed Sprints, SprintProjects, KPIs & Ceremonies
  const sprint1 = await prisma.sprint.create({
    data: {
      scrumId: sampleScrum.id,
      number: 1,
      title: "اسپرینت ۱",
      description: "راه‌اندازی ماژول اسکرام و پنل مدیریت",
      status: "ACTIVE",
      startDate: yesterday,
    },
  });

  const item1 = await prisma.sprintProject.create({
    data: {
      sprintId: sprint1.id,
      projectId: seededProjects[0].id,
      name: "طراحی مدل داده و APIهای اسکرام",
      points: 5,
      assigneeId: seededUsers[1].id,
      status: "DONE",
      sortOrder: 0,
    },
  });

  const item2 = await prisma.sprintProject.create({
    data: {
      sprintId: sprint1.id,
      projectId: seededProjects[0].id,
      name: "پیاده‌سازی کامپوننت‌های فرانت‌اند اسکرام",
      points: 8,
      assigneeId: seededUsers[0].id,
      status: "DOING",
      sortOrder: 1,
    },
  });

  const scrum2Sprint1 = await prisma.sprint.create({
    data: {
      scrumId: sampleScrum2.id,
      number: 1,
      title: "اسپرینت ۱ کمپین",
      description: "اجرای کمپین پاییز کالج رکاد",
      status: "ACTIVE",
      startDate: yesterday,
    },
  });

  const scrum2Item1 = await prisma.sprintProject.create({
    data: {
      sprintId: scrum2Sprint1.id,
      projectId: seededProjects[2].id,
      name: "طراحی لندینگ و قیف جذب بوت‌کمپ",
      points: 5,
      assigneeId: seededUsers[8].id,
      status: "DOING",
      sortOrder: 0,
    },
  });

  // Scrum KPIs
  await prisma.scrumKpi.createMany({
    data: [
      {
        scrumId: sampleScrum.id,
        indicator: "نرخ تحویل تسک‌های اسپرینت",
        formula: "تعداد تسک‌های انجام‌شده / کل تسک‌ها * ۱۰۰",
        strategicGoal: "افزایش بهره‌وری و تعهد تیم در پایان هر اسپرینت",
        unit: "درصد",
        target: 85,
        firstMonthTarget: 70,
        actualValue: 80,
        minExpected: 65,
        sortOrder: 0,
      },
      {
        scrumId: sampleScrum2.id,
        indicator: "نرخ تبدیل لید کالج",
        formula: "ثبت‌نامی نهایی / کل لیدها * ۱۰۰",
        strategicGoal: "افزایش کیفیت ورودی بوت‌کمپ‌ها",
        unit: "درصد",
        target: 20,
        firstMonthTarget: 12,
        actualValue: 22,
        minExpected: 10,
        sortOrder: 0,
      },
    ],
  });

  // Scrum Ceremonies
  await prisma.scrumEvent.createMany({
    data: [
      {
        scrumId: sampleScrum.id,
        name: "دیلی اسکرام",
        scheduleType: "WEEKLY",
        dayOfWeek: 0,
        startTime: "09:30",
        durationMinutes: 15,
        inputs: "کارهای دیروز، موانع",
        outputs: "همگامی تیم برای امروز",
        sortOrder: 0,
      },
      {
        scrumId: sampleScrum.id,
        name: "برنامه‌ریزی اسپرینت",
        scheduleType: "WEEKLY",
        dayOfWeek: 0,
        startTime: "10:00",
        durationMinutes: 60,
        inputs: "بک‌لاگ اولویت‌بندی‌شده",
        outputs: "اسپرینت گل و تسک‌ها",
        sortOrder: 1,
      },
      {
        scrumId: sampleScrum.id,
        name: "پالایش بک‌لاگ",
        scheduleType: "WEEKLY",
        dayOfWeek: 2,
        startTime: "14:00",
        durationMinutes: 45,
        inputs: "ایده‌ها و تسک‌های جدید",
        outputs: "تسک‌های شفاف و تخمین‌خورده",
        sortOrder: 2,
      },
      {
        scrumId: sampleScrum.id,
        name: "بررسی اسپرینت (دمو)",
        scheduleType: "WEEKLY",
        dayOfWeek: 4,
        startTime: "15:00",
        durationMinutes: 45,
        inputs: "محصول قابل‌ارائه",
        outputs: "بازخورد ذینفعان",
        sortOrder: 3,
      },
      {
        scrumId: sampleScrum.id,
        name: "بازنگری اسپرینت (رترو)",
        scheduleType: "WEEKLY",
        dayOfWeek: 4,
        startTime: "16:00",
        durationMinutes: 45,
        inputs: "تجربیات اسپرینت اخیر",
        outputs: "اقدامات بهبود برای اسپرینت بعد",
        sortOrder: 4,
      },
      {
        scrumId: sampleScrum2.id,
        name: "هم‌ترازی کمپین هفتگی",
        scheduleType: "WEEKLY",
        dayOfWeek: 1,
        startTime: "11:00",
        durationMinutes: 30,
        inputs: "آمار کمپین",
        outputs: "برنامه محتوای هفته",
        sortOrder: 0,
      },
    ],
  });

  // 9. Seed Sample Focus Work Sessions (including APPROVED + PENDING across linked projects & sprint items)
  console.log("\n⏳ Seeding sample focus work sessions...");
  await prisma.workSession.createMany({
    data: [
      {
        userId: seededUsers[0].id,
        projectId: seededProjects[0].id,
        attendanceId: att1.id,
        workDate: today,
        durationSeconds: 1500,
        approval: "PENDING",
      },
      {
        userId: seededUsers[0].id,
        projectId: seededProjects[1].id,
        attendanceId: att1.id,
        workDate: today,
        durationSeconds: 1500,
        approval: "PENDING",
      },
      {
        userId: seededUsers[0].id,
        sprintProjectId: item2.id,
        attendanceId: att1.id,
        workDate: today,
        durationSeconds: 900,
        approval: "PENDING",
      },
      {
        userId: seededUsers[2].id,
        projectId: seededProjects[0].id,
        attendanceId: att3.id,
        workDate: today,
        durationSeconds: 1500,
        approval: "PENDING",
      },
      {
        userId: seededUsers[5].id,
        projectId: seededProjects[1].id,
        attendanceId: att4.id,
        workDate: today,
        durationSeconds: 1500,
        approval: "PENDING",
      },
      // APPROVED sessions (counted on leaderboard)
      {
        userId: seededUsers[1].id,
        sprintProjectId: item1.id,
        attendanceId: attYesterday2.id,
        workDate: yesterday,
        durationSeconds: 1800,
        approval: "APPROVED",
        source: "ADMIN",
        decidedById: simpleAdmin.id,
        decidedAt: new Date(),
      },
      {
        userId: seededUsers[1].id,
        projectId: seededProjects[0].id,
        attendanceId: attYesterday2.id,
        workDate: yesterday,
        durationSeconds: 900,
        approval: "APPROVED",
        source: "ADMIN",
        decidedById: simpleAdmin.id,
        decidedAt: new Date(),
      },
      {
        userId: seededUsers[0].id,
        sprintProjectId: item2.id,
        attendanceId: attYesterday1.id,
        workDate: yesterday,
        durationSeconds: 1500,
        approval: "APPROVED",
        source: "ADMIN",
        decidedById: simpleAdmin.id,
        decidedAt: new Date(),
      },
      {
        userId: seededUsers[8].id,
        sprintProjectId: scrum2Item1.id,
        attendanceId: attYesterdayAf1.id,
        workDate: yesterday,
        durationSeconds: 1200,
        approval: "APPROVED",
        source: "ADMIN",
        decidedById: simpleAdmin.id,
        decidedAt: new Date(),
      },
    ],
  });
  console.log("   ✓ 9 work sessions registered (4 APPROVED + 5 PENDING).");

  console.log("\n=======================================================");
  console.log("🎉 All Seed Data Successfully Created & Verified!");
  console.log("=======================================================");
  console.log("🔑 All Login Codes (Exact 6 Characters):");
  console.log(`   👑 Super Admin:        [${superAdmin.code}] - ${superAdmin.name}`);
  console.log(`   🛡️  Operations Admin:   [${simpleAdmin.code}] - ${simpleAdmin.name}`);
  console.log(`   ⚡ Scrum Admin 1:      [${scrumAdmin.code}] - ${scrumAdmin.name}`);
  console.log(`   ⚡ Scrum Admin 2:      [${scrumAdmin2.code}] - ${scrumAdmin2.name}`);
  console.log("\n   👥 Personnel Login Codes:");
  seededUsers.forEach((u) => {
    console.log(`      • [${u.code}] - ${u.name.padEnd(24)} (${u.department})`);
  });
  console.log(`\n   📁 Projects Created:   ${seededProjects.length}`);
  console.log("   🚀 Scrums Created:     2 (with multi-admin, linked projects & leaderboard sessions)");
  console.log("   ⏰ Attendances:        7 records (4 today, 3 yesterday APPROVED)");
  console.log("   ⏳ Focus Sessions:     9 sessions (4 APPROVED, 5 PENDING)");
  console.log("=======================================================\n");

  return { superAdmin, simpleAdmin, scrumAdmin, scrumAdmin2, seededUsers, seededProjects };
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
