import "dotenv/config";
import prisma from "../config/prisma.js";
import { todayDate, addDays, formatDate } from "../Utils/date.js";

const seedUuid = (num) => `00000000-0000-4000-8000-${String(num).padStart(12, "0")}`;

const upsertUser = async ({ code, name, role, isActive = true }) =>
  prisma.user.upsert({
    where: { code },
    update: { name, role, isActive },
    create: { code, name, role, isActive },
  });

const upsertProject = async ({ name, description, isActive = true, createdById }) => {
  const existing = await prisma.project.findFirst({ where: { name } });
  if (existing) {
    return prisma.project.update({
      where: { id: existing.id },
      data: { description, isActive, createdById },
    });
  }
  return prisma.project.create({
    data: { name, description, isActive, createdById },
  });
};

const upsertProjectMember = async ({ projectId, userId }) =>
  prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    update: {},
    create: { projectId, userId },
  });

const upsertScrum = async ({ name, description, color, isActive = true }) => {
  const existing = await prisma.scrum.findFirst({ where: { name } });
  if (existing) {
    return prisma.scrum.update({
      where: { id: existing.id },
      data: { description, color, isActive },
    });
  }
  return prisma.scrum.create({
    data: { name, description, color, isActive },
  });
};

const upsertScrumAdmin = async ({ scrumId, userId, assignedById }) =>
  prisma.scrumAdmin.upsert({
    where: { scrumId_userId: { scrumId, userId } },
    update: { assignedById },
    create: { scrumId, userId, assignedById },
  });

const upsertScrumMember = async ({
  scrumId,
  userId,
  label = null,
  performance = null,
  performanceNote = null,
  performanceUpdatedAt = null,
  performanceUpdatedById = null,
}) =>
  prisma.scrumMember.upsert({
    where: { scrumId_userId: { scrumId, userId } },
    update: {
      label,
      performance,
      performanceNote,
      performanceUpdatedAt,
      performanceUpdatedById,
    },
    create: {
      scrumId,
      userId,
      label,
      performance,
      performanceNote,
      performanceUpdatedAt,
      performanceUpdatedById,
    },
  });

const upsertStudioPerformance = async ({ userId, level, note = null, updatedById = null }) =>
  prisma.studioPerformance.upsert({
    where: { userId },
    update: { level, note, updatedById },
    create: { userId, level, note, updatedById },
  });

const upsertSprint = async ({
  scrumId,
  number,
  title,
  description,
  status,
  progressPercent,
  startDate,
  endDate,
  completedAt = null,
}) =>
  prisma.sprint.upsert({
    where: { scrumId_number: { scrumId, number } },
    update: {
      title,
      description,
      status,
      progressPercent,
      startDate,
      endDate,
      completedAt,
    },
    create: {
      scrumId,
      number,
      title,
      description,
      status,
      progressPercent,
      startDate,
      endDate,
      completedAt,
    },
  });

const upsertTask = async ({ scrumId, sprintId = null, name, description, points, isActive = true }) => {
  const existing = await prisma.task.findFirst({ where: { scrumId, name } });
  if (existing) {
    return prisma.task.update({
      where: { id: existing.id },
      data: { sprintId, description, points, isActive },
    });
  }
  return prisma.task.create({
    data: { scrumId, sprintId, name, description, points, isActive },
  });
};

const upsertTaskMember = async ({ taskId, userId, assignedById = null }) =>
  prisma.taskMember.upsert({
    where: { taskId_userId: { taskId, userId } },
    update: { assignedById },
    create: { taskId, userId, assignedById },
  });

const upsertScrumKpi = async ({ scrumId, sortOrder, ...data }) => {
  const existing = await prisma.scrumKpi.findFirst({ where: { scrumId, sortOrder } });
  if (existing) {
    return prisma.scrumKpi.update({
      where: { id: existing.id },
      data,
    });
  }
  return prisma.scrumKpi.create({
    data: { scrumId, sortOrder, ...data },
  });
};

const upsertScrumEvent = async ({ scrumId, sortOrder, ...data }) => {
  const existing = await prisma.scrumEvent.findFirst({ where: { scrumId, sortOrder } });
  if (existing) {
    return prisma.scrumEvent.update({
      where: { id: existing.id },
      data,
    });
  }
  return prisma.scrumEvent.create({
    data: { scrumId, sortOrder, ...data },
  });
};

const upsertAttendance = async ({
  userId,
  date,
  status,
  approval,
  source,
  decidedById = null,
  decidedAt = null,
  reason = null,
  workNote = null,
  workNoteAt = null,
  workNotePromptedAt = null,
}) =>
  prisma.attendance.upsert({
    where: { userId_date: { userId, date } },
    update: {
      status,
      approval,
      source,
      decidedById,
      decidedAt,
      reason,
      workNote,
      workNoteAt,
      workNotePromptedAt,
    },
    create: {
      userId,
      date,
      status,
      approval,
      source,
      decidedById,
      decidedAt,
      reason,
      workNote,
      workNoteAt,
      workNotePromptedAt,
    },
  });

const upsertWorkSession = async ({
  userId,
  clientRequestId,
  projectId = null,
  taskId = null,
  attendanceId,
  workDate,
  durationSeconds,
  approval = "PENDING",
  source = "USER",
  decidedById = null,
  decidedAt = null,
  startedAt = null,
}) =>
  prisma.workSession.upsert({
    where: { userId_clientRequestId: { userId, clientRequestId } },
    update: {
      projectId,
      taskId,
      attendanceId,
      workDate,
      durationSeconds,
      approval,
      source,
      decidedById,
      decidedAt,
      startedAt,
    },
    create: {
      userId,
      clientRequestId,
      projectId,
      taskId,
      attendanceId,
      workDate,
      durationSeconds,
      approval,
      source,
      decidedById,
      decidedAt,
      startedAt,
    },
  });

export const runSeed = async () => {
  const superAdminCode = process.env.SEED_SUPERADMIN_CODE || "SP0001";
  const superAdminName = process.env.SEED_SUPERADMIN_NAME || "Studio Super Admin";
  const today = todayDate();
  const yesterday = addDays(today, -1);
  const nowTs = new Date();

  console.log("\n=======================================================");
  console.log("Database Seeder (Idempotent) - Rokad Studio OS");
  console.log("=======================================================\n");

  // 1. Seed Super Admin & Studio Admins (ADMIN)
  const superAdmin = await upsertUser({
    code: superAdminCode,
    name: superAdminName,
    role: "SUPER_ADMIN",
  });

  // AD0001: unrelated studio ADMIN (0 Scrums)
  const simpleAdmin = await upsertUser({
    code: "AD0001",
    name: "Studio Operations Admin",
    role: "ADMIN",
  });

  // AD0002: studio ADMIN who is Admin + Member of Scrum 1 (participates on leaderboard)
  const adminScrumMember = await upsertUser({
    code: "AD0002",
    name: "Admin Scrum Contributor",
    role: "ADMIN",
  });

  // AD0003: studio ADMIN who administers Scrum 3 WITHOUT membership
  const adminScrumOnly = await upsertUser({
    code: "AD0003",
    name: "Admin Scrum Observer",
    role: "ADMIN",
  });

  // 2. Seed Scrum Admins (SCRUM_ADMIN)
  // SC1101: Admin + Member of Scrum 1
  const scrumAdmin1 = await upsertUser({
    code: "SC1101",
    name: "Studio Scrum Master",
    role: "SCRUM_ADMIN",
  });

  // SC1102: Admin of Scrum 1 & Scrum 2; Member ONLY of Scrum 2
  const scrumAdmin2 = await upsertUser({
    code: "SC1102",
    name: "Second Scrum Master",
    role: "SCRUM_ADMIN",
  });

  // SC1103: Admin of Scrum 2 WITHOUT membership
  const scrumAdmin3 = await upsertUser({
    code: "SC1103",
    name: "College Scrum Lead",
    role: "SCRUM_ADMIN",
  });

  console.log(
    `   Seeded admins: ${superAdmin.code}, ${simpleAdmin.code}, ${adminScrumMember.code}, ${adminScrumOnly.code}, ${scrumAdmin1.code}, ${scrumAdmin2.code}, ${scrumAdmin3.code}`
  );

  // 3. Seed Personnel Users (USER) across Departments
  const usersSpec = [
    { code: "IT1101", name: "Artin Amiri", department: "Engineering (IT)" },
    { code: "IT1102", name: "MohammadMehdi Sadeghi", department: "Engineering (IT)" }, // shared Scrum 1 & Scrum 2
    { code: "IT1103", name: "Arsalan Ebrahimi", department: "Engineering (IT)" }, // outside all Scrums
    { code: "IT1104", name: "Mahdiar Tavakoli", department: "Engineering (IT)" },
    { code: "IT1105", name: "Setareh Sayyad", department: "Engineering (IT)" },
    { code: "AR1101", name: "Mahdiar Hassanzadeh", department: "Creative / Artists (AR)" },
    { code: "AR1102", name: "Parsa Rahmani", department: "Creative / Artists (AR)" },
    { code: "AR1103", name: "Matin Ghanei", department: "Creative / Artists (AR)" },
    { code: "AF1101", name: "Soroush Hassani", department: "Operations / Generalists (AF)" },
    { code: "AF1102", name: "Hossein Khoshraftar", department: "Operations / Generalists (AF)" },
    { code: "AF1103", name: "Elisa Valizadeh", department: "Operations / Generalists (AF)" },
    { code: "AF1104", name: "Melika Tork", department: "Operations / Generalists (AF)" },
    { code: "AF1105", name: "MohammadReza Nabavi", department: "Operations / Generalists (AF)" },
    { code: "AF1106", name: "Bahar Bazrafshan", department: "Operations / Generalists (AF)" },
  ];

  const seededUsers = [];
  for (const spec of usersSpec) {
    const user = await upsertUser({
      code: spec.code,
      name: spec.name,
      role: "USER",
    });
    seededUsers.push({ ...user, department: spec.department });
  }
  const byCode = new Map(
    [
      superAdmin,
      simpleAdmin,
      adminScrumMember,
      adminScrumOnly,
      scrumAdmin1,
      scrumAdmin2,
      scrumAdmin3,
      ...seededUsers,
    ].map((u) => [u.code, u])
  );

  console.log(`   Seeded ${seededUsers.length} regular users.`);

  // 4. Seed Scrums (3 Scrums showcasing all admin/member matrix combinations)
  const scrum1 = await upsertScrum({
    name: "اسکرام توسعه پلتفرم",
    description: "اسکرام تیم فنی برای توسعه و بهبود پلتفرم استودیو رکاد",
    color: "ECOSYSTEM",
    isActive: true,
  });

  const scrum2 = await upsertScrum({
    name: "اسکرام کالج و کمپین",
    description: "اسکرام رشد مخاطب، کمپین‌های دیجیتال و عملیات کالج",
    color: "COLLEGE",
    isActive: true,
  });

  const scrum3 = await upsertScrum({
    name: "اسکرام طراحی و هویت بصری",
    description: "اسکرام طراحی سیستم دیزاین، برندینگ و خروجی‌های بصری استودیو",
    color: "CLUB",
    isActive: true,
  });

  // Scrum Admins:
  // - Scrum 1: SC1101 (also member), SC1102 (NOT member), AD0002 (also member)
  // - Scrum 2: SC1102 (also member), SC1103 (NOT member)
  // - Scrum 3: AD0003 (NOT member)
  await Promise.all([
    upsertScrumAdmin({ scrumId: scrum1.id, userId: scrumAdmin1.id, assignedById: superAdmin.id }),
    upsertScrumAdmin({ scrumId: scrum1.id, userId: scrumAdmin2.id, assignedById: superAdmin.id }),
    upsertScrumAdmin({ scrumId: scrum1.id, userId: adminScrumMember.id, assignedById: superAdmin.id }),
    upsertScrumAdmin({ scrumId: scrum2.id, userId: scrumAdmin2.id, assignedById: superAdmin.id }),
    upsertScrumAdmin({ scrumId: scrum2.id, userId: scrumAdmin3.id, assignedById: superAdmin.id }),
    upsertScrumAdmin({ scrumId: scrum3.id, userId: adminScrumOnly.id, assignedById: superAdmin.id }),
  ]);

  // Remove any stale ScrumMember rows from previous seed versions for non-member admins
  await prisma.scrumMember.deleteMany({
    where: {
      OR: [
        { scrumId: scrum1.id, userId: scrumAdmin2.id },
        { scrumId: scrum2.id, userId: scrumAdmin3.id },
        { scrumId: scrum3.id, userId: adminScrumOnly.id },
      ],
    },
  });

  // Scrum Members + Scrum-level performance (§6)
  // Keep IT1103 outside ALL Scrums as reference outsider.
  // IT1102 is a member of BOTH Scrum 1 and Scrum 2.
  const scrumMembersSpec = [
    {
      scrumId: scrum1.id,
      userId: scrumAdmin1.id,
      label: "اسکرام مستر",
      performance: null,
      performanceNote: null,
      performanceUpdatedAt: null,
      performanceUpdatedById: null,
    },
    {
      scrumId: scrum1.id,
      userId: adminScrumMember.id,
      label: "ناظر فنی و مشارکت‌کننده",
      performance: "STRONG",
      performanceNote: "همکاری موثر در بررسی تسک‌های زیرساخت",
      performanceUpdatedAt: nowTs,
      performanceUpdatedById: superAdmin.id,
    },
    {
      scrumId: scrum1.id,
      userId: byCode.get("IT1101").id,
      label: "توسعه‌دهنده فرانت‌اند",
      performance: "STRONG",
      performanceNote: "سرعت تحویل و کیفیت کد بسیار خوب در اسپرینت جاری",
      performanceUpdatedAt: nowTs,
      performanceUpdatedById: scrumAdmin1.id,
    },
    {
      scrumId: scrum1.id,
      userId: byCode.get("IT1102").id,
      label: "توسعه‌دهنده بک‌اند",
      performance: "EXCELLENT",
      performanceNote: "مالکیت کامل APIهای گزارش و بهینه‌سازی کوئری‌ها",
      performanceUpdatedAt: nowTs,
      performanceUpdatedById: scrumAdmin1.id,
    },
    {
      scrumId: scrum1.id,
      userId: byCode.get("IT1104").id,
      label: "تضمین کیفیت",
      performance: "AVERAGE",
      performanceNote: "نیاز به پوشش تست بیشتر برای سناریوهای لبه",
      performanceUpdatedAt: nowTs,
      performanceUpdatedById: scrumAdmin1.id,
    },
    {
      scrumId: scrum2.id,
      userId: scrumAdmin2.id,
      label: "لید کمپین",
      performance: null,
      performanceNote: null,
      performanceUpdatedAt: null,
      performanceUpdatedById: null,
    },
    {
      scrumId: scrum2.id,
      userId: byCode.get("IT1102").id,
      label: "پشتیبان فنی کمپین",
      performance: "STRONG",
      performanceNote: "یکپارچه‌سازی فرم‌های ثبت‌نام بدون خطا",
      performanceUpdatedAt: nowTs,
      performanceUpdatedById: scrumAdmin2.id,
    },
    {
      scrumId: scrum2.id,
      userId: byCode.get("AF1101").id,
      label: "کارشناس بازاریابی",
      performance: "EXCELLENT",
      performanceNote: "نرخ تبدیل فراتر از هدف ماه اول",
      performanceUpdatedAt: nowTs,
      performanceUpdatedById: scrumAdmin2.id,
    },
    {
      scrumId: scrum2.id,
      userId: byCode.get("AF1102").id,
      label: "طراح کمپین",
      performance: "WEAK",
      performanceNote: "تاخیر در تحویل بنرهای اسپرینت اخیر",
      performanceUpdatedAt: nowTs,
      performanceUpdatedById: scrumAdmin2.id,
    },
    {
      scrumId: scrum3.id,
      userId: byCode.get("AR1101").id,
      label: "طراح ارشد رابط کاربری",
      performance: "EXCELLENT",
      performanceNote: "تعریف دقیق توکن‌های طراحی",
      performanceUpdatedAt: nowTs,
      performanceUpdatedById: adminScrumOnly.id,
    },
    {
      scrumId: scrum3.id,
      userId: byCode.get("AR1102").id,
      label: "گرافیست محصول",
      performance: "NEEDS_ATTENTION",
      performanceNote: "نیاز به هم‌راستایی بیشتر با تایم‌باکس دیلی",
      performanceUpdatedAt: nowTs,
      performanceUpdatedById: adminScrumOnly.id,
    },
  ];
  for (const m of scrumMembersSpec) {
    await upsertScrumMember(m);
  }

  // Studio-level performance (§6, separate from ScrumMember)
  await Promise.all([
    upsertStudioPerformance({
      userId: byCode.get("IT1101").id,
      level: "EXCELLENT",
      note: "نظم حضور بالا و تحویل مستمر",
      updatedById: simpleAdmin.id,
    }),
    upsertStudioPerformance({
      userId: byCode.get("IT1102").id,
      level: "STRONG",
      note: "عملکرد متعادل در پروژه‌های استودیویی و اسکرام",
      updatedById: superAdmin.id,
    }),
    upsertStudioPerformance({
      userId: byCode.get("IT1103").id,
      level: "AVERAGE",
      note: "فعال در پروژه پلتفرم، نیازمند ثبت منظم‌تر یادداشت پایان کار",
      updatedById: simpleAdmin.id,
    }),
    upsertStudioPerformance({
      userId: adminScrumMember.id,
      level: "STRONG",
      note: "همکاری مدیریتی و اجرایی هم‌زمان",
      updatedById: superAdmin.id,
    }),
    upsertStudioPerformance({
      userId: scrumAdmin1.id,
      level: "STRONG",
      note: "هدایت منظم اسکرام توسعه پلتفرم",
      updatedById: superAdmin.id,
    }),
    upsertStudioPerformance({
      userId: byCode.get("AR1102").id,
      level: "WEAK",
      note: "نیاز به بهبود پایبندی به ساعت حضور",
      updatedById: simpleAdmin.id,
    }),
  ]);

  // 5. Seed Standalone Studio Projects (completely separate from Scrum Tasks)
  const projectsSpec = [
    {
      name: "Rokad Studio OS Platform",
      description: "Central attendance, focus timer and team workspace portal",
      members: [
        superAdmin.id,
        simpleAdmin.id,
        adminScrumMember.id,
        scrumAdmin1.id,
        byCode.get("IT1101").id,
        byCode.get("IT1102").id,
        byCode.get("IT1103").id,
        byCode.get("IT1104").id,
        byCode.get("IT1105").id,
      ],
    },
    {
      name: "Design System & Visual Identity",
      description: "Design tokens, typography and neo-brutalist UI components",
      members: [
        byCode.get("AR1101").id,
        byCode.get("AR1102").id,
        byCode.get("AR1103").id,
        byCode.get("IT1105").id,
      ],
    },
    {
      name: "College Digital Marketing Campaign",
      description: "Bootcamp applicant acquisition, campaigns and performance tracking",
      members: [
        byCode.get("AF1101").id,
        byCode.get("AF1102").id,
        byCode.get("AF1103").id,
      ],
    },
    {
      name: "Mentoring & Courses Platform",
      description: "Interview management, mentoring sessions and student homework reviews",
      members: [
        byCode.get("AF1104").id,
        byCode.get("AF1105").id,
        byCode.get("AF1106").id,
        byCode.get("IT1101").id,
      ],
    },
  ];

  const seededProjects = [];
  for (const p of projectsSpec) {
    const proj = await upsertProject({
      name: p.name,
      description: p.description,
      isActive: true,
      createdById: superAdmin.id,
    });
    for (const userId of p.members) {
      await upsertProjectMember({ projectId: proj.id, userId });
    }
    seededProjects.push(proj);
  }
  console.log(`   Seeded ${seededProjects.length} standalone studio projects.`);

  // 6. Seed Sprints, Tasks, KPIs, and Ceremonies
  const scrum1Sprint0 = await upsertSprint({
    scrumId: scrum1.id,
    number: 1,
    title: "اسپرینت ۱",
    description: "راه‌اندازی پایه اسکرام، گزارش‌ها و سطوح دسترسی",
    status: "COMPLETED",
    progressPercent: 100,
    startDate: addDays(today, -28),
    endDate: addDays(today, -15),
    completedAt: addDays(today, -15),
  });

  const scrum1SprintActive = await upsertSprint({
    scrumId: scrum1.id,
    number: 2,
    title: "اسپرینت ۲",
    description: "پیاده‌سازی تقویم کارکرد، دسترسی رابطه‌ای ادمین و یادداشت پایان روز",
    status: "ACTIVE",
    progressPercent: 65,
    startDate: addDays(today, -14),
    endDate: addDays(today, 12),
    completedAt: null,
  });

  await upsertSprint({
    scrumId: scrum1.id,
    number: 3,
    title: "اسپرینت ۳",
    description: "بهینه‌سازی تجربه کاربری و گزارش‌های تحلیلی پیشرفته",
    status: "PLANNED",
    progressPercent: 0,
    startDate: addDays(today, 13),
    endDate: addDays(today, 27),
    completedAt: null,
  });

  const scrum2Sprint1 = await upsertSprint({
    scrumId: scrum2.id,
    number: 1,
    title: "اسپرینت ۱ کمپین",
    description: "اجرای کمپین پاییز کالج رکاد",
    status: "ACTIVE",
    progressPercent: 45,
    startDate: addDays(today, -14),
    endDate: addDays(today, 10),
    completedAt: null,
  });

  const scrum3Sprint1 = await upsertSprint({
    scrumId: scrum3.id,
    number: 1,
    title: "اسپرینت ۱ هویت بصری",
    description: "استانداردسازی کامپوننت‌های داشبورد و کارت‌های تقویم",
    status: "ACTIVE",
    progressPercent: 55,
    startDate: addDays(today, -10),
    endDate: addDays(today, 10),
    completedAt: null,
  });

  const task1 = await upsertTask({
    scrumId: scrum1.id,
    sprintId: scrum1SprintActive.id,
    name: "طراحی مدل داده و APIهای اسکرام",
    description: "طراحی و پیاده‌سازی مدل تسک‌ها، گزارش‌های تجمیعی و سطوح دسترسی",
    points: 5,
    isActive: true,
  });
  await upsertTaskMember({ taskId: task1.id, userId: byCode.get("IT1102").id, assignedById: scrumAdmin1.id });
  await upsertTaskMember({ taskId: task1.id, userId: byCode.get("IT1101").id, assignedById: scrumAdmin1.id });
  await upsertTaskMember({ taskId: task1.id, userId: adminScrumMember.id, assignedById: scrumAdmin1.id });

  const task2 = await upsertTask({
    scrumId: scrum1.id,
    sprintId: scrum1SprintActive.id,
    name: "پیاده‌سازی کامپوننت‌های فرانت‌اند اسکرام",
    description: "پیاده‌سازی تب تسک‌ها، اسپرینت‌ها و تقویم جزئیات اعضا",
    points: 8,
    isActive: true,
  });
  await upsertTaskMember({ taskId: task2.id, userId: byCode.get("IT1101").id, assignedById: scrumAdmin1.id });
  await upsertTaskMember({ taskId: task2.id, userId: byCode.get("IT1104").id, assignedById: scrumAdmin1.id });

  const task3 = await upsertTask({
    scrumId: scrum1.id,
    sprintId: scrum1Sprint0.id,
    name: "مستندسازی معماری اولیه اسکرام",
    description: "مستندسازی جریان کار تایمر و تایید سشن‌ها",
    points: 3,
    isActive: false,
  });
  await upsertTaskMember({ taskId: task3.id, userId: byCode.get("IT1102").id, assignedById: scrumAdmin1.id });

  const taskUnlinked = await upsertTask({
    scrumId: scrum1.id,
    sprintId: null,
    name: "پشتیبانی فنی و رفع باگ‌های روزانه",
    description: "تسک مستمر غیرمتصل به اسپرینت مشخص",
    points: 2,
    isActive: true,
  });
  await upsertTaskMember({ taskId: taskUnlinked.id, userId: adminScrumMember.id, assignedById: superAdmin.id });
  await upsertTaskMember({ taskId: taskUnlinked.id, userId: byCode.get("IT1102").id, assignedById: scrumAdmin1.id });

  const scrum2Task1 = await upsertTask({
    scrumId: scrum2.id,
    sprintId: scrum2Sprint1.id,
    name: "طراحی لندینگ و قیف جذب بوت‌کمپ",
    description: "طراحی صفحه فرود کمپین پاییز کالج و پیگیری تبدیل لیدها",
    points: 5,
    isActive: true,
  });
  await upsertTaskMember({ taskId: scrum2Task1.id, userId: byCode.get("AF1101").id, assignedById: scrumAdmin2.id });
  await upsertTaskMember({ taskId: scrum2Task1.id, userId: byCode.get("AF1102").id, assignedById: scrumAdmin2.id });
  await upsertTaskMember({ taskId: scrum2Task1.id, userId: byCode.get("IT1102").id, assignedById: scrumAdmin2.id });

  const scrum3Task1 = await upsertTask({
    scrumId: scrum3.id,
    sprintId: scrum3Sprint1.id,
    name: "بازطراحی کارت وضعیت حضور و تقویم ماهانه",
    description: "طراحی حالت‌های روزانه تقویم و بج‌های وضعیت عملکرد",
    points: 5,
    isActive: true,
  });
  await upsertTaskMember({ taskId: scrum3Task1.id, userId: byCode.get("AR1101").id, assignedById: adminScrumOnly.id });
  await upsertTaskMember({ taskId: scrum3Task1.id, userId: byCode.get("AR1102").id, assignedById: adminScrumOnly.id });

  // KPIs & Ceremonies
  await Promise.all([
    upsertScrumKpi({
      scrumId: scrum1.id,
      sortOrder: 0,
      indicator: "نرخ تحویل تسک‌های اسپرینت",
      formula: "تعداد تسک‌های انجام‌شده / کل تسک‌ها * ۱۰۰",
      strategicGoal: "افزایش بهره‌وری و تعهد تیم در پایان هر اسپرینت",
      unit: "درصد",
      firstMonthTarget: "۷۰ درصد",
      target: "۸۵ درصد",
      finalTarget: "۹۵ درصد",
      progressPercent: 80,
      status: "IN_RANGE",
      minExpected: 65,
    }),
    upsertScrumKpi({
      scrumId: scrum2.id,
      sortOrder: 0,
      indicator: "نرخ تبدیل لید کالج",
      formula: "ثبت‌نامی نهایی / کل لیدها * ۱۰۰",
      strategicGoal: "افزایش کیفیت ورودی بوت‌کمپ‌ها",
      unit: "درصد",
      firstMonthTarget: "۱۲ درصد",
      target: "۲۰ درصد",
      finalTarget: "۲۵ درصد",
      progressPercent: 100,
      status: "ON_TARGET",
      minExpected: 10,
    }),
    upsertScrumKpi({
      scrumId: scrum3.id,
      sortOrder: 0,
      indicator: "نرخ انطباق کامپوننت‌های دیزاین سیستم",
      formula: "کامپوننت‌های استانداردشده / کل کامپوننت‌ها * ۱۰۰",
      strategicGoal: "یکپارچه‌سازی زبان بصری کل محصولات استودیو",
      unit: "درصد",
      firstMonthTarget: "۵۰ درصد",
      target: "۸۰ درصد",
      finalTarget: "۱۰۰ درصد",
      progressPercent: 60,
      status: "IN_RANGE",
      minExpected: 45,
    }),
  ]);

  const scrum1Events = [
    {
      name: "دیلی اسکرام",
      scheduleType: "WEEKLY",
      dayOfWeek: 0,
      startTime: "09:30",
      durationMinutes: 15,
      inputs: "کارهای دیروز، موانع",
      outputs: "همگامی تیم برای امروز",
    },
    {
      name: "برنامه‌ریزی اسپرینت",
      scheduleType: "WEEKLY",
      dayOfWeek: 0,
      startTime: "10:00",
      durationMinutes: 60,
      inputs: "بک‌لاگ اولویت‌بندی‌شده",
      outputs: "اسپرینت گل و تسک‌ها",
    },
    {
      name: "پالایش بک‌لاگ",
      scheduleType: "WEEKLY",
      dayOfWeek: 2,
      startTime: "14:00",
      durationMinutes: 45,
      inputs: "ایده‌ها و تسک‌های جدید",
      outputs: "تسک‌های شفاف و تخمین‌خورده",
    },
    {
      name: "بررسی اسپرینت (دمو)",
      scheduleType: "WEEKLY",
      dayOfWeek: 4,
      startTime: "15:00",
      durationMinutes: 45,
      inputs: "محصول قابل‌ارائه",
      outputs: "بازخورد ذینفعان",
    },
    {
      name: "بازنگری اسپرینت (رترو)",
      scheduleType: "WEEKLY",
      dayOfWeek: 4,
      startTime: "16:00",
      durationMinutes: 45,
      inputs: "تجربیات اسپرینت اخیر",
      outputs: "اقدامات بهبود برای اسپرینت بعد",
    },
  ];
  for (let i = 0; i < scrum1Events.length; i += 1) {
    await upsertScrumEvent({ scrumId: scrum1.id, sortOrder: i, ...scrum1Events[i] });
  }
  await upsertScrumEvent({
    scrumId: scrum2.id,
    sortOrder: 0,
    name: "هم‌ترازی کمپین هفتگی",
    scheduleType: "WEEKLY",
    dayOfWeek: 1,
    startTime: "11:00",
    durationMinutes: 30,
    inputs: "آمار کمپین",
    outputs: "برنامه محتوای هفته",
  });
  await upsertScrumEvent({
    scrumId: scrum3.id,
    sortOrder: 0,
    name: "مرور دیزاین سیستم",
    scheduleType: "WEEKLY",
    dayOfWeek: 3,
    startTime: "13:30",
    durationMinutes: 45,
    inputs: "اسکرین‌های جدید",
    outputs: "تایید توکن‌ها و اجزا",
  });

  // 7. Seed ~30 days of mixed Attendance & WorkSessions across roles, tasks, projects & work notes
  let attCount = 0;
  let wsCount = 0;
  let wsSeq = 1;
  const nextSessionUuid = () => seedUuid(wsSeq++);

  const persianNotes = [
    "پیاده‌سازی تست‌های یکپارچه و رفع باگ کش ردیس با موفقیت انجام شد.",
    "در انتظار بررسی مستندات API توسط تیم محصول برای نهایی‌سازی بخش فیلتر تقویم.",
    "هماهنگی با تیم طراحی جهت نهایی‌سازی رنگ‌بندی وضعیت‌های عملکرد انجام شد.",
    "بهینه‌سازی کوئری‌های گروهی تجمیع حضور و غیاب تکمیل شد؛ مانعی وجود نداشت.",
  ];

  // Key users for rich 30-day calendar history: IT1101, IT1102, IT1103, AD0002, SC1101, AF1101, AR1101
  const historyUsers = [
    byCode.get("IT1101"),
    byCode.get("IT1102"),
    byCode.get("IT1103"),
    adminScrumMember,
    scrumAdmin1,
    byCode.get("AF1101"),
    byCode.get("AR1101"),
  ];

  for (let offset = -29; offset <= -2; offset += 1) {
    const d = addDays(today, offset);
    const dayIndex = Math.abs(offset);

    for (let uIdx = 0; uIdx < historyUsers.length; uIdx += 1) {
      const targetUser = historyUsers[uIdx];
      const pattern = (dayIndex + uIdx) % 7;

      // Leave Fridays / certain gaps as NONE (no attendance record)
      if (pattern === 6) {
        continue;
      }

      const workNoteTs = new Date(`${formatDate(d)}T14:30:00.000Z`);
      let attPayload;

      if (pattern === 4) {
        // User-declared ABSENT with reason
        attPayload = {
          userId: targetUser.id,
          date: d,
          status: "ABSENT",
          approval: "APPROVED",
          source: "USER",
          reason: "مرخصی ساعتی / روزانه هماهنگ‌شده",
        };
      } else if (pattern === 5) {
        // System auto-closed ABSENT (dailyClose)
        attPayload = {
          userId: targetUser.id,
          date: d,
          status: "ABSENT",
          approval: "APPROVED",
          source: "SYSTEM",
        };
      } else if (dayIndex % 11 === 0 && uIdx === 2) {
        // Occasional REJECTED attendance record on IT1103 (no sessions linked)
        attPayload = {
          userId: targetUser.id,
          date: d,
          status: "PRESENT",
          approval: "REJECTED",
          source: "ADMIN",
          decidedById: simpleAdmin.id,
          decidedAt: workNoteTs,
        };
      } else {
        // PRESENT + APPROVED (historical records older than T-1)
        const hasNote = (dayIndex + uIdx) % 3 !== 0;
        attPayload = {
          userId: targetUser.id,
          date: d,
          status: "PRESENT",
          approval: "APPROVED",
          source: "ADMIN",
          decidedById: simpleAdmin.id,
          decidedAt: workNoteTs,
          workNote: hasNote ? persianNotes[(dayIndex + uIdx) % persianNotes.length] : null,
          workNoteAt: hasNote ? workNoteTs : null,
          workNotePromptedAt: hasNote ? workNoteTs : null,
        };
      }

      const att = await upsertAttendance(attPayload);
      attCount += 1;

      if (att.status === "PRESENT" && att.approval !== "REJECTED") {
        // Attach deterministic historical sessions matched to user's scrums/projects
        if (targetUser.code === "IT1102" && offset >= -14 && offset <= -10) {
          await upsertWorkSession({
            userId: targetUser.id,
            clientRequestId: nextSessionUuid(),
            taskId: task1.id,
            attendanceId: att.id,
            workDate: d,
            durationSeconds: 1800,
            approval: "APPROVED",
            source: "ADMIN",
            decidedById: scrumAdmin1.id,
            decidedAt: workNoteTs,
            startedAt: new Date(`${formatDate(d)}T07:30:00.000Z`),
          });
          await upsertWorkSession({
            userId: targetUser.id,
            clientRequestId: nextSessionUuid(),
            taskId: scrum2Task1.id,
            attendanceId: att.id,
            workDate: d,
            durationSeconds: 1200,
            approval: "APPROVED",
            source: "ADMIN",
            decidedById: scrumAdmin2.id,
            decidedAt: workNoteTs,
            startedAt: new Date(`${formatDate(d)}T09:00:00.000Z`),
          });
          await upsertWorkSession({
            userId: targetUser.id,
            clientRequestId: nextSessionUuid(),
            projectId: seededProjects[0].id,
            attendanceId: att.id,
            workDate: d,
            durationSeconds: 900,
            approval: "APPROVED",
            source: "ADMIN",
            decidedById: simpleAdmin.id,
            decidedAt: workNoteTs,
            startedAt: new Date(`${formatDate(d)}T11:00:00.000Z`),
          });
          wsCount += 3;
        } else if (targetUser.code === "IT1102" && offset < -14 && offset >= -25) {
          // Sprint 1 (COMPLETED) historical work for IT1102
          await upsertWorkSession({
            userId: targetUser.id,
            clientRequestId: nextSessionUuid(),
            taskId: task3.id,
            attendanceId: att.id,
            workDate: d,
            durationSeconds: 1500,
            approval: "APPROVED",
            source: "ADMIN",
            decidedById: scrumAdmin1.id,
            decidedAt: workNoteTs,
            startedAt: new Date(`${formatDate(d)}T08:00:00.000Z`),
          });
          wsCount += 1;
        } else if (targetUser.code === "IT1101" && offset >= -14 && offset <= -10) {
          await upsertWorkSession({
            userId: targetUser.id,
            clientRequestId: nextSessionUuid(),
            taskId: task2.id,
            attendanceId: att.id,
            workDate: d,
            durationSeconds: 1500,
            approval: "APPROVED",
            source: "ADMIN",
            decidedById: scrumAdmin1.id,
            decidedAt: workNoteTs,
            startedAt: new Date(`${formatDate(d)}T08:30:00.000Z`),
          });
          await upsertWorkSession({
            userId: targetUser.id,
            clientRequestId: nextSessionUuid(),
            projectId: seededProjects[0].id,
            attendanceId: att.id,
            workDate: d,
            durationSeconds: 900,
            approval: "APPROVED",
            source: "ADMIN",
            decidedById: simpleAdmin.id,
            decidedAt: workNoteTs,
            startedAt: new Date(`${formatDate(d)}T10:30:00.000Z`),
          });
          wsCount += 2;
        } else if (targetUser.code === "AD0002" && offset >= -12 && offset <= -8) {
          // AD0002 (ADMIN + Scrum 1 member) logs approved task sessions so ranks on Scrum 1 leaderboard
          await upsertWorkSession({
            userId: targetUser.id,
            clientRequestId: nextSessionUuid(),
            taskId: task1.id,
            attendanceId: att.id,
            workDate: d,
            durationSeconds: 1200,
            approval: "APPROVED",
            source: "ADMIN",
            decidedById: superAdmin.id,
            decidedAt: workNoteTs,
            startedAt: new Date(`${formatDate(d)}T08:00:00.000Z`),
          });
          wsCount += 1;
        } else if (targetUser.code === "IT1103" && offset >= -12 && offset <= -7) {
          // IT1103 logs only studio project sessions
          await upsertWorkSession({
            userId: targetUser.id,
            clientRequestId: nextSessionUuid(),
            projectId: seededProjects[0].id,
            attendanceId: att.id,
            workDate: d,
            durationSeconds: 1500,
            approval: "APPROVED",
            source: "ADMIN",
            decidedById: simpleAdmin.id,
            decidedAt: workNoteTs,
            startedAt: new Date(`${formatDate(d)}T09:00:00.000Z`),
          });
          wsCount += 1;
        } else if (targetUser.code === "AR1101" && offset >= -8 && offset <= -5) {
          await upsertWorkSession({
            userId: targetUser.id,
            clientRequestId: nextSessionUuid(),
            taskId: scrum3Task1.id,
            attendanceId: att.id,
            workDate: d,
            durationSeconds: 1500,
            approval: "APPROVED",
            source: "ADMIN",
            decidedById: adminScrumOnly.id,
            decidedAt: workNoteTs,
            startedAt: new Date(`${formatDate(d)}T10:00:00.000Z`),
          });
          wsCount += 1;
        }
      }
    }
  }

  // Deterministic Yesterday & Today records for smoke tests and UI testing
  const attIt1101Today = await upsertAttendance({
    userId: byCode.get("IT1101").id,
    date: today,
    status: "PRESENT",
    approval: "PENDING",
    source: "USER",
  });

  const attIt1102Today = await upsertAttendance({
    userId: byCode.get("IT1102").id,
    date: today,
    status: "PRESENT",
    approval: "PENDING",
    source: "USER",
    workNote: "ادامه توسعه تست‌های اسپرینت ۲",
    workNoteAt: nowTs,
    workNotePromptedAt: nowTs,
  });

  const attIt1103Today = await upsertAttendance({
    userId: byCode.get("IT1103").id,
    date: today,
    status: "PRESENT",
    approval: "APPROVED",
    source: "ADMIN",
    decidedById: simpleAdmin.id,
    decidedAt: nowTs,
  });

  const attAr1101Today = await upsertAttendance({
    userId: byCode.get("AR1101").id,
    date: today,
    status: "PRESENT",
    approval: "APPROVED",
    source: "ADMIN",
    decidedById: simpleAdmin.id,
    decidedAt: nowTs,
  });

  const attYesterdayIt1 = await upsertAttendance({
    userId: byCode.get("IT1101").id,
    date: yesterday,
    status: "PRESENT",
    approval: "APPROVED",
    source: "ADMIN",
    decidedById: simpleAdmin.id,
    decidedAt: nowTs,
    workNote: "تحویل بخش فرانت‌اند تقویم اعضا",
    workNoteAt: nowTs,
    workNotePromptedAt: nowTs,
  });

  const attYesterdayIt2 = await upsertAttendance({
    userId: byCode.get("IT1102").id,
    date: yesterday,
    status: "PRESENT",
    approval: "APPROVED",
    source: "ADMIN",
    decidedById: simpleAdmin.id,
    decidedAt: nowTs,
    workNote: "اتمام اندپوینت گزارش عملکرد اسکرام",
    workNoteAt: nowTs,
    workNotePromptedAt: nowTs,
  });

  const attYesterdayAf1 = await upsertAttendance({
    userId: byCode.get("AF1101").id,
    date: yesterday,
    status: "PRESENT",
    approval: "APPROVED",
    source: "ADMIN",
    decidedById: simpleAdmin.id,
    decidedAt: nowTs,
  });

  const attYesterdayAd2 = await upsertAttendance({
    userId: adminScrumMember.id,
    date: yesterday,
    status: "PRESENT",
    approval: "APPROVED",
    source: "ADMIN",
    decidedById: superAdmin.id,
    decidedAt: nowTs,
    workNote: "بررسی کد و هماهنگی اسپرینت ۲",
    workNoteAt: nowTs,
    workNotePromptedAt: nowTs,
  });
  attCount += 8;

  // Deterministic Today & Yesterday WorkSessions (including PENDING, APPROVED, REJECTED across Task & Project)
  const fixedSessions = [
    {
      userId: byCode.get("IT1101").id,
      clientRequestId: seedUuid(9001),
      projectId: seededProjects[0].id,
      attendanceId: attIt1101Today.id,
      workDate: today,
      durationSeconds: 1500,
      approval: "PENDING",
    },
    {
      userId: byCode.get("IT1101").id,
      clientRequestId: seedUuid(9002),
      projectId: seededProjects[1].id,
      attendanceId: attIt1101Today.id,
      workDate: today,
      durationSeconds: 1500,
      approval: "PENDING",
    },
    {
      userId: byCode.get("IT1101").id,
      clientRequestId: seedUuid(9003),
      taskId: task2.id,
      attendanceId: attIt1101Today.id,
      workDate: today,
      durationSeconds: 900,
      approval: "PENDING",
    },
    {
      userId: byCode.get("IT1101").id,
      clientRequestId: seedUuid(9004),
      taskId: task2.id,
      attendanceId: attIt1101Today.id,
      workDate: today,
      durationSeconds: 600,
      approval: "REJECTED",
      source: "ADMIN",
      decidedById: scrumAdmin1.id,
      decidedAt: nowTs,
    },
    {
      userId: byCode.get("IT1103").id,
      clientRequestId: seedUuid(9005),
      projectId: seededProjects[0].id,
      attendanceId: attIt1103Today.id,
      workDate: today,
      durationSeconds: 1500,
      approval: "PENDING",
    },
    {
      userId: byCode.get("AR1101").id,
      clientRequestId: seedUuid(9006),
      projectId: seededProjects[1].id,
      attendanceId: attAr1101Today.id,
      workDate: today,
      durationSeconds: 1500,
      approval: "PENDING",
    },
    {
      userId: byCode.get("IT1102").id,
      clientRequestId: seedUuid(9007),
      taskId: task1.id,
      attendanceId: attYesterdayIt2.id,
      workDate: yesterday,
      durationSeconds: 1800,
      approval: "APPROVED",
      source: "ADMIN",
      decidedById: scrumAdmin1.id,
      decidedAt: nowTs,
    },
    {
      userId: byCode.get("IT1102").id,
      clientRequestId: seedUuid(9008),
      taskId: taskUnlinked.id,
      attendanceId: attYesterdayIt2.id,
      workDate: yesterday,
      durationSeconds: 900,
      approval: "APPROVED",
      source: "ADMIN",
      decidedById: scrumAdmin1.id,
      decidedAt: nowTs,
    },
    {
      userId: byCode.get("IT1102").id,
      clientRequestId: seedUuid(9009),
      projectId: seededProjects[0].id,
      attendanceId: attYesterdayIt2.id,
      workDate: yesterday,
      durationSeconds: 900,
      approval: "APPROVED",
      source: "ADMIN",
      decidedById: simpleAdmin.id,
      decidedAt: nowTs,
    },
    {
      userId: byCode.get("IT1101").id,
      clientRequestId: seedUuid(9010),
      taskId: task2.id,
      attendanceId: attYesterdayIt1.id,
      workDate: yesterday,
      durationSeconds: 1500,
      approval: "APPROVED",
      source: "ADMIN",
      decidedById: scrumAdmin1.id,
      decidedAt: nowTs,
    },
    {
      userId: byCode.get("IT1101").id,
      clientRequestId: seedUuid(9011),
      projectId: seededProjects[0].id,
      attendanceId: attYesterdayIt1.id,
      workDate: yesterday,
      durationSeconds: 1200,
      approval: "REJECTED",
      source: "ADMIN",
      decidedById: simpleAdmin.id,
      decidedAt: nowTs,
    },
    {
      userId: byCode.get("AF1101").id,
      clientRequestId: seedUuid(9012),
      taskId: scrum2Task1.id,
      attendanceId: attYesterdayAf1.id,
      workDate: yesterday,
      durationSeconds: 1200,
      approval: "APPROVED",
      source: "ADMIN",
      decidedById: scrumAdmin2.id,
      decidedAt: nowTs,
    },
    {
      userId: adminScrumMember.id,
      clientRequestId: seedUuid(9013),
      taskId: taskUnlinked.id,
      attendanceId: attYesterdayAd2.id,
      workDate: yesterday,
      durationSeconds: 900,
      approval: "APPROVED",
      source: "ADMIN",
      decidedById: superAdmin.id,
      decidedAt: nowTs,
    },
    {
      userId: byCode.get("IT1102").id,
      clientRequestId: seedUuid(9014),
      taskId: task1.id,
      attendanceId: attIt1102Today.id,
      workDate: today,
      durationSeconds: 600,
      approval: "PENDING",
    },
  ];

  for (const ws of fixedSessions) {
    await upsertWorkSession(ws);
    wsCount += 1;
  }

  console.log("\n=======================================================");
  console.log("Idempotent Seed Complete!");
  console.log("=======================================================");
  console.log(`   Super Admin:        ${superAdmin.code}`);
  console.log(
    `   Studio ADMINs:      ${simpleAdmin.code} (unrelated), ${adminScrumMember.code} (Scrum1 admin+member), ${adminScrumOnly.code} (Scrum3 admin-only)`
  );
  console.log(
    `   SCRUM_ADMINs:       ${scrumAdmin1.code} (Scrum1 admin+member), ${scrumAdmin2.code} (Scrum1 admin + Scrum2 admin+member), ${scrumAdmin3.code} (Scrum2 admin-only)`
  );
  console.log(`   Scrums:             3 (Scrum 1=${scrum1.id}, Scrum 2=${scrum2.id}, Scrum 3=${scrum3.id})`);
  console.log(`   Projects:           ${seededProjects.length}`);
  console.log(`   Attendance rows:    ${attCount} (upserted across ~30 days)`);
  console.log(`   WorkSessions:       ${wsCount} (upserted)`);
  console.log("=======================================================\n");

  return {
    superAdmin,
    simpleAdmin,
    adminScrumMember,
    adminScrumOnly,
    scrumAdmin1,
    scrumAdmin2,
    scrumAdmin3,
    seededUsers,
    seededProjects,
    scrums: [scrum1, scrum2, scrum3],
  };
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
      console.error("Database seed failed:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
