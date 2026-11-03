import "dotenv/config";
import prisma from "../config/prisma.js";
import { todayDate } from "../Utils/date.js";

export const runSeed = async () => {
  const adminCode = process.env.SEED_SUPERADMIN_CODE || "SP0001";
  const today = todayDate();

  console.log("🌱 Starting seed...");

  // 1. Seed Super Admin (SUPER_ADMIN)
  const superAdmin = await prisma.user.upsert({
    where: { code: adminCode },
    update: {
      name: "مدیر ارشد استودیو",
      role: "SUPER_ADMIN",
      isActive: true,
    },
    create: {
      code: adminCode,
      name: "مدیر ارشد استودیو",
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });

  // 2. Seed Simple Admin (ADMIN)
  const simpleAdmin = await prisma.user.upsert({
    where: { code: "AD0001" },
    update: {
      name: "مدیر اجرایی استودیو",
      role: "ADMIN",
      isActive: true,
    },
    create: {
      code: "AD0001",
      name: "مدیر اجرایی استودیو",
      role: "ADMIN",
      isActive: true,
    },
  });

  // 3. Seed Regular Personnel Users (USER)
  const usersData = [
    { code: "RK1101", name: "علی محمدی" },
    { code: "RK1102", name: "سارا احمدی" },
    { code: "RK1103", name: "مهدی اکبری" },
    { code: "RK1104", name: "مریم رضایی" },
  ];

  const seededUsers = [];
  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { code: u.code },
      update: { name: u.name, role: "USER", isActive: true },
      create: { code: u.code, name: u.name, role: "USER", isActive: true },
    });
    seededUsers.push(user);
  }

  // 4. Seed Projects
  const projectsData = [
    {
      name: "توسعه راکاد استودیو OS",
      description: "سامانه حضور و غیاب، تایمر متمرکز و پلتفرم داخلی تیم",
      members: [seededUsers[0].id, seededUsers[2].id, seededUsers[1].id],
    },
    {
      name: "طراحی دیزاین سیستم و هویت بصری",
      description: "مستندسازی توکن‌ها، فونت‌ها و کامپوننت‌های نئوبروتالیسم",
      members: [seededUsers[1].id, seededUsers[0].id],
    },
    {
      name: "کمپین دیجیتال مارکتینگ کالج",
      description: "برنامه‌ریزی و اجرای کمپین‌های جذب متقاضیان بوت‌کمپ",
      members: [seededUsers[3].id, seededUsers[1].id],
    },
    {
      name: "پلتفرم منتورینگ و دوره‌ها",
      description: "سیستم مدیریت مصاحبه‌ها، مشاوره و بررسی تمارین",
      members: [seededUsers[0].id, seededUsers[2].id, seededUsers[3].id],
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

  // 5. Seed Attendance for Today (for testing admin approvals)
  // RK1101: Present, PENDING (ready for admin approval)
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

  // RK1102: Present, PENDING (ready for admin approval)
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

  // RK1103: Present, APPROVED (already approved by admin)
  const att3 = await prisma.attendance.upsert({
    where: { userId_date: { userId: seededUsers[2].id, date: today } },
    update: { status: "PRESENT", approval: "APPROVED", source: "ADMIN", decidedById: simpleAdmin.id, decidedAt: new Date() },
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

  // 6. Seed Sample Work Sessions for Today (1500s each = 25 mins)
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
      ],
    });
  }

  console.log("✅ Seed completed successfully!");
  console.log(`   👑 Super Admin: ${superAdmin.name} (Code: ${superAdmin.code})`);
  console.log(`   🛡️  Simple Admin: ${simpleAdmin.name} (Code: ${simpleAdmin.code})`);
  console.log("   👥 Personnel Users:");
  seededUsers.forEach((u) => console.log(`      - ${u.name} (Code: ${u.code})`));
  console.log(`   📁 Projects: ${seededProjects.length} projects created and assigned.`);
  console.log("   ⏰ Sample Attendances and Work Sessions generated for today.");

  return { superAdmin, simpleAdmin, seededUsers, seededProjects };
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
