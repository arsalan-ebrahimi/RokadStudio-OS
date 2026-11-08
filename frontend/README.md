# Rokad Studio OS — Frontend

فرانت‌اند مدرن سامانه حضور و غیاب و تایمر متمرکز پومودورو راکاد استودیو.

## استک فنی
- **فریم‌ورک**: React 19 + TypeScript (Strict Mode)
- **ابزار بیلد**: Vite
- **استایل‌دهی**: Tailwind CSS + سیستم طراحی مدرن نئوبروتالیسم (Hard Shadows `2.75px 2.75px 0 #202A5A`)
- **مدیریت استیت سرور**: TanStack React Query v5
- **مدیریت استیت کلاینت**: Zustand
- **مسیربابی**: React Router DOM v7 (Data Router)
- **آیکون‌ها**: Lucide React
- **تقویم و تاریخ**: jalaali-js و Intl با تایم‌زون رسمی `Asia/Tehran`

## معماری پوشه‌ها (Feature-Driven Architecture)
```
frontend/src/
├── app/
│   ├── layout/       # ساختار قالب‌ها (AdminLayout با سایدبار و دارک مود)
│   ├── pages/        # صفحات (LoginPage, AdminLoginPage, UserDashboardPage, admin/*)
│   ├── providers.tsx # پرووایدرها (QueryClient, Auth, ErrorBoundary)
│   └── router.tsx    # پیکربندی مسیرها و Role Guards
├── features/
│   ├── auth/         # ورود دو مرحله‌ای OTP، استور، نگهبان دسترسی
│   ├── attendance/   # اعلام حضور روزانه، پایش نیمه‌شب تهران، کارتابل ادمین
│   ├── timer/        # تایمر ۲۵ دقیقه‌ای پومودورو، چایم صوتی، استراحت ۵ دقیقه‌ای
│   ├── projects/     # انتخاب پروژه، مدیریت و تخصیص اعضا
│   ├── reports/      # خلاصه ساعات کاری، فیلتر بازه و خروجی CSV با UTF-8 BOM
│   └── users/        # مدیریت پرسنل، پیشنهاد کد با پیشوند
└── shared/
    ├── config/       # ثابت‌ها و پیام‌های استاندارد فارسی
    ├── lib/          # کلاینت API، تبدیل اعداد فارسی، تاریخ جلالی
    ├── types/        # مدل‌های داده و اینترفیس‌های پاسخ API
    └── ui/           # دکمه‌ها، کارت‌ها، مودال‌ها، اسکلتون‌ها و توست
```

## دستورات اجرایی
```bash
# نصب وابستگی‌ها
npm install

# اجرای سرور توسعه با پروکسی خودکار به بک‌اند (:5000)
npm run dev

# بررسی تایپ‌ها و ساخت بسته پروداکشن
npm run build
```

## متغیرهای محیطی
- به طور پیش‌فرض پروکسی Vite مسیر `/api/*` را به `http://localhost:5000` ارجاع می‌دهد.
- برای استقرار پروداکشن، آدرس پایه در صورت نیاز با متغیر `VITE_API_URL` قابل تنظیم است.
