import "dotenv/config";
import prisma from "../config/prisma.js";
import { todayDate } from "../Utils/date.js";

export const runSeed = async () => {
  const envSuperAdminCode = process.env.SEED_SUPERADMIN_CODE || "super_admin_2026";
  const envSuperAdminName = process.env.SEED_SUPERADMIN_NAME || "مدیر ارشد سیستم";
  const today = todayDate();

  console.log("\n=======================================================");
  console.log("🌱 آغاز فرآیند سیدینگ داده‌های اولیه پلتفرم رکاد (Seed Database)");
  console.log("=======================================================\n");

  // 1. Seed Main Super Admin from ENV
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

  // 1.1 Also ensure short code SP0001 exists as Super Admin for easy manual/UI testing
  let shortCodeSuperAdmin = superAdmin;
  if (envSuperAdminCode !== "SP0001") {
    shortCodeSuperAdmin = await prisma.user.upsert({
      where: { code: "SP0001" },
      update: {
        name: "مدیر ارشد استودیو (SP0001)",
        role: "SUPER_ADMIN",
        isActive: true,
      },
      create: {
        code: "SP0001",
        name: "مدیر ارشد استودیو (SP0001)",
        role: "SUPER_ADMIN",
        isActive: true,
      },
    });
  }

  // 2. Seed Simple Admin (ADMIN)
  const simpleAdmin = await prisma.user.upsert({
    where: { code: "AD0001" },
    update: {
      name: "مدیر اجرایی استودیو (AD0001)",
      role: "ADMIN",
      isActive: true,
    },
    create: {
      code: "AD0001",
      name: "مدیر اجرایی استودیو (AD0001)",
      role: "ADMIN",
      isActive: true,
    },
  });

  // 3. Remove old regular users (non-admin)
  console.log("🧹 پاکسازی کاربران عادی قدیمی برای بازنشانی تمیز...");
  await prisma.user.deleteMany({
    where: {
      role: { notIn: ["ADMIN", "SUPER_ADMIN"] },
    },
  });

  // 4. Seed Regular Personnel Users (USER) partitioned by Department
  // IT: مهندسا (Engineers)
  // AR: آرتیستا (Artists)
  // AF: آچارفرانسه‌ها (Generalists)
  const usersData = [
    // مهندسا (IT)
    { code: "IT1101", name: "آرتین امیری" },
    { code: "IT1102", name: "محمدمهدی صادقی" },
    { code: "IT1103", name: "ارسلان ابراهیمی" },
    { code: "IT1104", name: "مهدیار توکلی" },
    { code: "IT1105", name: "ستاره صیاد" },
    // آرتیستا (AR)
    { code: "AR1101", name: "مهدیار حسن‌زاده" },
    { code: "AR1102", name: "پارسا رحمانی" },
    { code: "AR1103", name: "متین قانعی" },
    // آچارفرانسه‌ها (AF)
    { code: "AF1101", name: "سروش حسنی" },
    { code: "AF1102", name: "حسین خوشرفتار" },
    { code: "AF1103", name: "الیسا ولی‌زاده" },
    { code: "AF1104", name: "ملیکا ترک" },
    { code: "AF1105", name: "محمدرضا نبوی" },
    { code: "AF1106", name: "بهار بذرافشان" },
  ];

  console.log("👥 ثبت پرسنل استودیو به تفکیک دپارتمان‌ها...");
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
  console.log("📁 ایجاد پروژه‌های فعال استودیو و انتساب اعضا...");
  const projectsData = [
    {
      name: "توسعه رکاد استودیو OS",
      description: "سامانه حضور و غیاب، تایمر متمرکز و پلتفرم داخلی تیم",
      members: [
        seededUsers[0].id,
        seededUsers[1].id,
        seededUsers[2].id,
        seededUsers[3].id,
        seededUsers[4].id,
      ],
    },
    {
      name: "طراحی دیزاین سیستم و هویت بصری",
      description: "مستندسازی توکن‌ها، فونت‌ها و کامپوننت‌های نئوبروتالیسم",
      members: [
        seededUsers[5].id,
        seededUsers[6].id,
        seededUsers[7].id,
        seededUsers[8].id,
      ],
    },
    {
      name: "کمپین دیجیتال مارکتینگ کالج",
      description: "برنامه‌ریزی و اجرای کمپین‌های جذب متقاضیان بوت‌کمپ",
      members: [
        seededUsers[9].id,
        seededUsers[10].id,
        seededUsers[11].id,
      ],
    },
    {
      name: "پلتفرم منتورینگ و دوره‌ها",
      description: "سیستم مدیریت مصاحبه‌ها، مشاوره و بررسی تمارین",
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

  // 6. Seed Attendance for Today (for testing admin approvals & dashboard)
  console.log("⏰ ثبت رکوردهای نمونه حضور و غیاب امروز...");
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

  // AR1101: Present, APPROVED
  const att4 = await prisma.attendance.upsert({
    where: { userId_date: { userId: seededUsers[5].id, date: today } },
    update: { status: "PRESENT", approval: "APPROVED", source: "ADMIN", decidedById: simpleAdmin.id, decidedAt: new Date() },
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
  console.log("⏳ ثبت سشن‌های کاری نمونه (Work Sessions)...");
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
  console.log("✅ فرآیند سیدینگ با موفقیت کامل شد!");
  console.log("=======================================================");
  console.log("🔑 کدهای ورود برای تست سامانه:");
  console.log(`   👑 سوپر ادمین اصلی:  کد "${superAdmin.code}" (${superAdmin.name})`);
  if (envSuperAdminCode !== "SP0001") {
    console.log(`   👑 سوپر ادمین آزمایشی: کد "${shortCodeSuperAdmin.code}" (${shortCodeSuperAdmin.name})`);
  }
  console.log(`   🛡️  ادمین اجرایی:    کد "${simpleAdmin.code}" (${simpleAdmin.name})`);
  console.log("\n   👥 پرسنل عادی (کد و نام):");
  seededUsers.forEach((u) => {
    console.log(`      • [${u.code}] - ${u.name}`);
  });
  console.log(`\n   📁 تعداد ${seededProjects.length} پروژه فعال ایجاد و منتسب شد.`);
  console.log("   ⏰ رکوردهای حضور و تایمر برای تاریخ امروز با وضعیت‌های تایید شده و در انتظار ثبت شدند.");
  console.log("=======================================================\n");

  return { superAdmin, shortCodeSuperAdmin, simpleAdmin, seededUsers, seededProjects };
};

if (process.argv[1] && (process.argv[1].endsWith("seed.js") || process.argv[1].endsWith("seed.ts"))) {
  runSeed()
    .catch((e) => {
      console.error("❌ خطا در اجرای سید دیتابیس:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
