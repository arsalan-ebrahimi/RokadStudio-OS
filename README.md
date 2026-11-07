# Rokad Studio OS (Attendance & Focus Platform)

پلتفرم یکپارچه حضور و غیاب، تایمر متمرکز ۲۵ دقیقه‌ای (پومودورو) و مدیریت پروژه‌ها برای استودیو رکاد.

این پروژه اکنون به دو بخش کاملاً مجزا و ساختاریافته تقسیم شده است:
- `backend/`: سرور Node.js 22 + Express 5 + Prisma 7 + PostgreSQL + Redis
- `frontend/`: وب‌اپلیکیشن مدرن React 19 + TypeScript + Vite + Tailwind CSS + Zustand + TanStack Query

---

## ساختار دایرکتوری (Project Structure)

```text
RokadStudio OS/
├── backend/                  # سورس‌کد کامل سرور و دیتابیس
│   ├── config/               # تنظیمات Prisma، Redis و متغیرهای محیطی
│   ├── docs/                 # مستندات OpenAPI 3.0، Swagger و API.md
│   ├── Jobs/                 # جاب‌های زمان‌بندی‌شده Cron و Daily Close
│   ├── Middlewares/          # احراز هویت (JWT/RBAC)، Rate Limit و اعتبارسنجی
│   ├── Modules/              # ماژول‌های Auth, Users, Project, Attendance, WorkSession
│   ├── prisma/               # اسکیما و مایگریشن‌های PostgreSQL
│   ├── scripts/              # تست‌های Smoke و اسکریپت‌های سیستمی
│   ├── tests/                # تست‌های داخلی و Unit Tests
│   ├── Utils/                # توابع کمکی تاریخ شمسی/میلادی، کش و خطاهای پریزما
│   ├── app.js                # کانفیگ اکسپرس و پایپ‌لاین میدلورها
│   ├── server.js             # راه‌اندازی سرور، اتصالات دیتابیس و Graceful Shutdown
│   ├── seed.js               # اسکریپت اصلی سیدینگ دیتابیس و داده‌های اولیه
│   ├── package.json          # پکیج‌ها و اسکریپت‌های اختصاصی بک‌اند
│   └── Dockerfile            # داکرفایل محیط پروداکشن بک‌اند
│
├── frontend/                 # سورس‌کد کامل کلاینت وب
│   ├── public/               # فونت‌های ایران‌سنس، آیکون‌ها و است‌های استاتیک
│   ├── src/
│   │   ├── app/              # لی‌آوت‌ها، روتینگ و صفحات اصلی ادمین و پرسنل
│   │   ├── features/         # ماژول‌های auth, attendance, timer, pet, projects, reports
│   │   ├── shared/           # کامپوننت‌های UI، توابع کمکی، کلاینت axios و types
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json          # پکیج‌ها و اسکریپت‌های فرانت‌اند
│   └── vite.config.ts        # کانفیگ Vite با پراکسی خودکار به پورت 5000 بک‌اند
│
├── docs/                     # مستندات معماری و قراردادهای فنی پروژه
├── docker-compose.yml        # سرویس‌های زیرساختی PostgreSQL 16 و Redis 7
├── package.json              # مدیریت ورک‌اسپیس‌ها و اسکریپت‌های یکپارچه از روت
└── README.md
```

---

## راه‌اندازی سریع (Quick Start)

### ۱. اجرای سرویس‌های دیتابیس و ردیس
```bash
docker compose up -d
```

### ۲. راه‌اندازی بک‌اند (Backend)
```bash
cd backend
npm install
cp .env.example .env
npm run db:migrate
npm run seed
npm run dev
```
سرور بر روی آدرس `http://localhost:5000` و مستندات تعاملی Swagger در آدرس `http://localhost:5000/api-docs` در دسترس خواهد بود.

### ۳. راه‌اندازی فرانت‌اند (Frontend)
```bash
cd frontend
npm install
npm run dev
```
کلاینت بر روی آدرس `http://localhost:3000` (یا 5173) اجرا می‌شود و به طور خودکار به بک‌اند وصل است.

---

## اسکریپت سیدینگ دیتابیس (Database Seed)

برای مقداردهی اولیه پایگاه‌داده با کاربران نمونه، پروژه‌ها و رکوردهای تایید شده/در انتظار:
```bash
# از داخل پوشه backend
npm run seed

# یا با دستور پریزما
npx prisma db seed

# یا از ریشه پروژه
npm run seed:backend
```

### کدهای ورود پیش‌فرض پس از اجرای Seed:
- **سوپر ادمین (Super Admin)**: کد `super_admin_2026` یا `SP0001`
- **ادمین اجرایی (Admin)**: کد `AD0001`
- **پرسنل مهندسی (IT)**: کد `IT1101` تا `IT1105`
- **پرسنل آرتیست (AR)**: کد `AR1101` تا `AR1103`
- **پرسنل آچارفرانسه (AF)**: کد `AF1101` تا `AF1106`

---

## اجرای تست‌ها
```bash
# تست‌های بک‌اند
npm run test:backend

# تست کامل Smoke بک‌اند
npm run smoke:backend
```
