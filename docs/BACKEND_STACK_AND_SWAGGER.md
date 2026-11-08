# مستندات جامع معماری، استک بک‌اند و Swagger (OpenAPI) - Rokad Studio OS

این سند حاوی بررسی خط‌به‌خط، تحلیل معماری، تشریح لایه‌های امنیتی، استک فناوری، پایگاه داده، جاب‌های خودکار پس‌زمینه و راهنمای کامل تعاملی وب‌سرویس‌های **Swagger / OpenAPI** در پلتفرم **Rokad Attendance & Time Platform** (سیستم مدیریت حضور، غیاب و تایم‌ترکینگ استودیو رکاد) می‌باشد.

---

## ۱. نمای کلی و استک فناوری (Technology Stack)

پلتفرم بک‌اند بر پایه معماری ماژولار لایه‌ای (Modular Layered Architecture) در بستر **Node.js (ESM)** و فریم‌ورک **Express 5** توسعه یافته است.

| لایه / فناوری | ابزار / نسخه | نقش در سامانه |
| :--- | :--- | :--- |
| **Runtime Environment** | Node.js `>= 22.13.0` | اجرای کدهای مدرن جاوااسکریپت با پشتیبانی بومی از ماژول‌های ESM و Type Stripping |
| **Web Framework** | Express `^5.0.1` | مسیریابی سریع، مدیریت میدل‌ورها، هندلینگ ناهمگام خطاها و کنترل پایپ‌لاین HTTP |
| **Database ORM** | Prisma `^7.10.0` | مدیریت مدل داده، تایپ‌سیف بودن کوئری‌ها و مایگریشن‌های دیتابیس |
| **Database Engine** | PostgreSQL 16 (Alpine) | پایگاه داده رابطه‌ای اصلی با پشتیبانی از کلیدهای خارجی، قیدهای ترکیبی و Check Constraint |
| **DB Driver Adapter** | `@prisma/adapter-pg` / `pg` | ارتباط بهینه استخر اتصالات (Connection Pooling) با درایور سطح پایین PostgreSQL |
| **Cache & Distributed Lock** | Redis 7 (Alpine) / `redis ^4.7.0` | کش لایه دسترسی و توکن، ریت‌لیمیت اتمیک و قفل توزیع‌شده جاب‌های کرون |
| **Authentication & Tokens** | `jsonwebtoken ^9.0.2` | تولید و اعتبارسنجی توکن‌های احراز هویت بدون کلمه عبور (Passwordless Bearer JWT) |
| **Security Headers** | `helmet ^8.0.0` | تنظیم هدرهای امنیتی، ممانعت از حملات XSS و Clickjacking با CSP سفارشی |
| **CORS Management** | `cors ^2.8.5` | کنترل دقیق دامنه‌های مجاز فرانت‌اند بر اساس متغیر محیطی `CORS_ORIGINS` |
| **Validation Engine** | `express-validator ^7.2.1` | اعتبارسنجی دقیق و پاکسازی (Sanitization) پارامترها، کوئری‌ها و بدنه درخواست |
| **Task Scheduling** | `node-cron ^3.0.3` | زمان‌بندی بستن روزانه و ثبت غیبت‌ها در ساعت 00:05 بامداد به وقت تهران |
| **API Documentation** | `swagger-ui-express ^5.0.1` | رابط بصری تعاملی مستندات OpenAPI 3.0.3 در اندپوینت `/api-docs` |
| **Error & Flow Utility** | `vanta-api ^1.5.2` | کلاس‌های کمکی `catchAsync`، `HandleERROR` و متمرکزسازی پایپ‌لاین خطا |

---

## ۲. معماری ماژولار و ساختار پروژه

ساختار پروژه از اصل تفکیک وظایف (Separation of Concerns) و معماری مبتنی بر دامنه (Domain-driven Modules) تبعیت می‌کند:

```text
RokadStudio-OS/
├── config/
│   ├── env.js                # اعتبارسنجی زودهنگام و Fail-Fast متغیرهای محیطی
│   ├── prisma.js             # پیکربندی اتصال به PostgreSQL از طریق adapter-pg
│   └── redis.js              # کلاینت Redis، اتصال Fail-Open و متد امن SCAN
├── docs/
│   ├── API.md                # مستندات متنی استاندارد APIها
│   ├── swagger.js            # مشخصات کامل OpenAPI 3.0.3 به صورت آبجکت JS
│   └── swagger.json          # فایل خام JSON مشخصات OpenAPI
├── Jobs/
│   ├── dailyClose.js         # منطق اتمیک و خالص بستن روزانه و ثبت غیبت‌ها
│   └── index.js              # زمان‌بند کرون با قفل توزیع‌شده Redis و Boot Catch-up
├── Middlewares/
│   ├── allowedRoles.js       # کنترل دسترسی بر اساس نقش (RBAC)
│   ├── isLogin.js            # اعتبارسنجی توکن JWT با کش لایه ردیس
│   └── rateLimit.js          # محدودساز نرخ درخواست لاگین و سشن کاری
├── Modules/
│   ├── Attendance/           # دامنه حضور و غیاب روزانه و تأییدات مدیریت
│   ├── Auth/                 # دامنه احراز هویت کد-محور و پروفایل جاری
│   ├── Project/              # دامنه پروژه‌ها، انتساب پرسنل و همگام‌سازی اعضا
│   ├── Users/                # دامنه مدیریت کاربران و کارتابل پرسنل
│   └── WorkSession/          # دامنه سشن‌های تمرکز (Pomodoro) و تجمیع زمانی
├── prisma/
│   ├── migrations/           # فایل‌های مایگریشن SQL و قیدهای دیتابیسی
│   ├── schema.prisma         # مدل‌سازی موجودیت‌ها، روابط و ایندکس‌ها
│   └── seed.js               # ایجاد سوپرادمین اولیه سامانه
├── tests/                    # تست‌های واحد و یکپارچگی قوانین تجاری و زمان
├── Utils/
│   ├── cache.js              # متدهای ایمن کش، ابطال هوشمند و پیشگیری از کرش
│   ├── date.js               # مدیریت قطعی مرزهای تقویمی در منطقه زمانی ایران
│   ├── pagination.js         # محاسبه استاندارد صفحه‌بندی و متادیتا
│   └── prismaErrors.js       # نگاشت کدهای خطای دیتابیس به خطاهای استاندارد HTTP
├── app.js                    # تنظیم پایپ‌لاین اکسپرس، میدل‌ورها، روت‌ها و هندلر خطا
├── server.js                 # نقطه ورود اجرایی، بوت داکر/سرور و Graceful Shutdown
└── docker-compose.yml        # ارکستراسیون کانتینرهای PostgreSQL 16 و Redis 7
```

---

## ۳. بررسی خط‌به‌خط و موشکافانه بخش‌های سامانه

### ۳.۱. هسته اجرایی و راه‌اندازی (`server.js` و `app.js`)
- **اعتبارسنجی Fail-Fast**: در اولین خط `server.js` فایل `./config/env.js` لود می‌شود؛ در صورتی که در محیط Production متغیرهای `DATABASE_URL` یا `JWT_SECRET` نامعتبر باشند یا طول کلید کمتر از ۳۲ کاراکتر باشد، پروسه فوراً با خطا متوقف شده و از اجرای سرور ناامن جلوگیری می‌شود.
- **Graceful Shutdown**: ثبت شنوندگان روی سیگنال‌های `SIGINT` و `SIGTERM`. در زمان خاموش شدن یا استقرار نسخه جدید:
  1. جاب‌های زمان‌بندی‌شده Cron فوراً متوقف می‌شوند.
  2. وب‌سرور HTTP بسته می‌شود تا درخواست جدیدی پذیرفته نشود.
  3. اتصالات Prisma و کلاینت Redis با دستور `quit()` به طور تمیز بسته می‌شوند.
- **سیاست‌های امنیتی Helmet و CSP**: در `app.js` هدرهای امنیتی به گونه‌ای کانفیگ شده‌اند که اجرای اسکریپت‌ها و استایل‌های درونی Swagger UI و تصاویر validator آن دچار اختلال نشود.
- **کنترل اندازه Payload**: محدودیت بدنه درخواست‌های JSON به `10kb` جهت مقابله با حملات سرریز بافر و DoS.
- **مدیریت خطای متمرکز**: نگاشت کدهای خطای دیتابیس به HTTP (مانند تبدیل خطای یکتایی `P2002` به `409 Conflict`) و پنهان‌سازی متن خطاهای سروری داخلی در محیط Production برای حفظ امنیت ساختار دیتابیس.

### ۳.۲. زیرساخت داده و کش (`config/` و `Utils/`)
- **آداپتور PostgreSQL (`config/prisma.js`)**: بهره‌گیری از `@prisma/adapter-pg` برای برقراری ارتباط سریع‌تر بین هسته Prisma و کلاینت درایور محلی دیتابیس.
- **اتصال با استراتژی Fail-Open در Redis (`config/redis.js`)**: در صورت در دسترس نبودن موقت ردیس، سامانه کرش نمی‌کند؛ لاگ ثبت شده و سیستم بدون کش به کار خود ادامه می‌دهد.
- **حذف غیرمسدودکننده کلیدها**: تابع `deleteKeysByPattern` به جای متد بلوکه‌کننده `KEYS *` از دستور تکرارپذیر `SCAN` با شمارش ۱۰۰تایی استفاده می‌کند تا مانع از فریز شدن ترد ردیس در پروژه‌های پرتردد گردد.
- **مدیریت تقویمی تاریخ (`Utils/date.js`)**: از آنجا که فیلد تاریخ در دیتابیس از نوع `@db.Date` است، تابع `todayDate` تاریخ جاری را در منطقه زمانی `Asia/Tehran` محاسبه کرده و خروجی را دقیقاً روی ساعت 00:00:00 UTC تنظیم می‌کند تا از شیفت تاریخ و مغایرت ناشی از تغییر ساعت تابستانی جلوگیری شود.

### ۳.۳. لایه دسترسی و میدل‌ورهای امنیتی (`Middlewares/`)
- **احراز هویت و کش کاربر (`isLogin.js`)**: پس از تأیید امضای توکن JWT، اطلاعات کاربر از کلید ردیس `user:auth:<id>` واکشی می‌شود (با انقضای ۶۰ ثانیه‌ای). در صورتی که کاربر به تازگی غیرفعال شده باشد، دسترسی فوراً سلب می‌گردد و نیازی به کوئری دائمی روی جدول `User` در هر درخواست نیست.
- **کنترل نقش سازمانی (`allowedRoles.js`)**: امکان پاس دادن چندین نقش مجاز مانند `allowedRoles("ADMIN", "SUPER_ADMIN")` به صورت کامپوزبل.
- **محدودسازی نرخ لاگین و اسپم سشن (`rateLimit.js`)**:
  - ریت‌لیمیت لاگین: حداکثر ۱۰ بار تلاش ناموفق در بازه ۱۵ دقیقه بر مبنای IP درخواست‌دهنده.
  - ریت‌لیمیت سشن کاری: حداکثر ۳۰ بار ثبت سشن در هر دقیقه به ازای شناسه هر پرسنل جهت جلوگیری از خطای کاربر یا حلقه‌های نرم‌افزاری سمت کلاینت.

### ۳.۴. منطق دامنه‌ها و ماژول‌های تجاری (`Modules/`)

#### ۱. ماژول احراز هویت (`Modules/Auth/`)
- **ورود کد-محور (Code-based Login)**: کارمندان تنها با کد اختصاصی خود (مثلاً `user_102`) وارد می‌شوند.
- **مقاومت در برابر حمله شمارش کاربری (User Enumeration Defense)**: در صورت اشتباه بودن کد یا غیرفعال بودن کاربر، پیام خطای یکسان و جنریک `Invalid credentials` با کد ۴۰۱ صادر می‌شود تا امکان کشف کدهای فعال توسط مهاجم مسدود گردد.
- **عدم افشای کد کاربری**: در بدنه پاسخ اندپوینت‌های `/login` و `/me` مقدار `code` به هیچ عنوان ارسال نمی‌شود.

#### ۲. ماژول پرسنل (`Modules/Users/`)
- **نقش‌های سه‌گانه**: `USER` (پرسنل عادی)، `ADMIN` (مدیر داخلی / سرپرست تیم) و `SUPER_ADMIN` (مدیر ارشد استودیو).
- **گارد محافظت از ادمین ارشد**: سوپرادمین نمی‌تواند خودش را حذف کند، تنزل رتبه دهد، یا غیرفعال کند؛ همچنین سیستم اجازه حذف آخرین سوپرادمین فعال پلتفرم را نمی‌دهد.
- **جستجوی سریع پرسنل (`/search`)**: اندپوینت بهینه با فیلتر نام برای استفاده ادمین‌ها در زمان افزودن اعضا به پروژه‌ها بدون ارسال فیلدهای غیرضروری.

#### ۳. ماژول پروژه‌ها (`Modules/Project/`)
- **تخصیص اعضا و همگام‌سازی (`syncMembers`)**: با محاسبه تفاضل مجموعه‌ها (Set Diffing)، حذف و اضافه پرسنل به پروژه در یک تراکنش انجام شده و کش پروژه‌های پرسنل متأثر فوراً ابطال می‌شود.
- **حذف ایمن (`deleteProjectSafe`)**: اگر پروژه‌ای دارای سشن‌های کاری ثبت‌شده باشد، سامانه از حذف فیزیکی آن ممانعت به عمل آورده (کد ۴۰۹) و کاربر را به غیرفعال‌سازی (`isActive = false`) هدایت می‌کند تا تاریخچه کاری سامانه حفظ شود.

#### ۴. ماژول حضور و غیاب (`Modules/Attendance/`)
- **قید یکتایی روزانه**: هر کاربر در هر روز تقویمی تنها یک بار می‌تواند حضور خود را ثبت کند (`@@unique([userId, date])`).
- **محاسبه وضعیت مؤثر (`computeEffectiveStatus`)**: چنانچه کاربری وضعیت حضور (`PRESENT`) اعلام کند اما مدیریت آن را رد (`REJECTED`) کند، وضعیت مؤثر به صورت سیستمی `ABSENT` گزارش می‌شود.
- **جلوگیری از تغییرناپذیری رد**: رکوردهای با وضعیت `REJECTED` نهایی هستند و تغییر مجدد نمی‌پذیرند.
- **Rejection Cascading Transaction**: چنانچه ادمین حضور پرسنلی را رد کند، سیستم در یک تراکنش اتمیک هم وضعیت را به `REJECTED` تغییر می‌دهد و هم تمامی سشن‌های کاری ثبت‌شده در آن روز را از جدول `WorkSession` حذف می‌کند.
- **پیشگیری از معضل N+1 Query**: در هنگام واکشی لیست‌های مدیریتی، مجموع دقایق و تعداد سشن‌ها از طریق یک کوئری تجمیعی مجزای `groupBy` واکشی و در حافظه مپ می‌شود.

#### ۵. ماژول سشن‌های کاری تمرکز (`Modules/WorkSession/`)
- **محدودیت زمانی منطقی**: طول هر سشن بر حسب ثانیه ذخیره می‌شود و سقف پیش‌فرض آن ۱۵۰۰ ثانیه (۲۵ دقیقه) است تا ماهیت سشن‌های تمرکز پومودورو حفظ شود.
- **پشتیبانی از مهلت بامداد (Midnight Grace)**: اگر کاربری تا ۳۰ دقیقه پس از نیمه‌شب (مثلاً ساعت 00:15 بامداد) سشنی را ثبت کند و برای روز جدید حضوری نزده باشد، سیستم سشن را به صورت خودکار به رکورد حضور روز گذشته او متصل می‌کند.
- **قفل بدبینانه دیتابیس (Pessimistic Locking)**: برای جلوگیری از شرایط مسابقه (Race Condition) هنگام ثبت همزمان سشن‌ها و تغییر وضعیت حضور، از دستور دیتابیسی `SELECT ... FOR UPDATE` درون تراکنش استفاده شده است.
- **خلاصه و آمار تجمعی (`/summary`)**: امکان گزارش‌گیری تجمعی سریع بر مبنای کاربر، پروژه، یا کاربر-پروژه در بازه‌های تاریخی مختلف.

### ۳.۵. وظایف پس‌زمینه و کرون جاب‌ها (`Jobs/`)
- **بستن خودکار روزانه (`dailyClose.js`)**:
  1. بررسی بازه تاریخی گذشته بر اساس `ATTENDANCE_CATCHUP_DAYS` (پیش‌فرض ۷ روز گذشته).
  2. بررسی پرسنل فعال و ثبت خودکار وضعیت `ABSENT` با تأیید سیستمی برای روزهایی که اعلام حضور نکرده‌اند (تنها برای روزهای پس از تاریخ استخدام یا ثبت‌نام کاربر).
  3. تأیید سیستمی خودکار رکوردهای حضور تاییدنشده گذشته (`date <= T - 2`).
- **قفل توزیع‌شده با Redis (`Jobs/index.js`)**: کرون جاب با دستور `SET NX EX 600` قفل کلیدی ثبت می‌کند تا چنانچه بک‌اند در کلاسترهای چندگانه (Multi-instance / Horizontal Scaling) بالا آمده باشد، جاب بستن روزانه تنها یک بار در ساعت 00:05 بامداد اجرا گردد.
- **جبران زمان خاموشی (Boot Catch-up)**: به محض روشن شدن سرور، یک پروسه غیرمسدودکننده به سرعت روزهای از دست‌رفته ناشی از خاموشی سرور را بررسی و ثبت می‌کند.

---

## ۴. مستندات تعاملی Swagger و OpenAPI 3.0.3

مستندات API به صورت استاندارد **OpenAPI 3.0.3** در فایل‌های `docs/swagger.js` و `docs/swagger.json` پیاده‌سازی شده و از طریق کتابخانه `swagger-ui-express` در مسیرهای زیر در دسترس است:

- **رابط بصری تحت وب:** `http://localhost:5000/api-docs` (همچنین مسیر کمکی `/docs`)
- **خروجی مشخصات به فرمت JSON:** `http://localhost:5000/api-docs.json`

### ۴.۱. مکانیزم احراز هویت در Swagger (Authorize)
تمام مسیرهای محافظت‌شده از طرح امنیتی Bearer Token به شکل زیر استفاده می‌کنند:
```text
Header: Authorization
Format: Bearer <jwt_token>
```
برای استفاده در Swagger UI:
1. ابتدا اندپوینت `POST /api/auth/login` را اجرا کرده و کد پرسنلی را وارد نمایید.
2. از خروجی دریافتی، فیلد `data.token` را کپی کنید.
3. در بالای صفحه Swagger روی دکمه سبز رنگ **Authorize** کلیک کرده و توکن را در کادر وارد نمایید.

---

### ۴.۲. کاتالوگ جامع اندپوینت‌ها و نقش‌های مجاز

#### بخش ۱: وضعیت سلامت سامانه (Health Check)
| متد | مسیر | دسترسی | توضیحات |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | عمومی (بدون توکن) | بررسی وضعیت ارتباط با دیتابیس PostgreSQL (`SELECT 1`) و سرور ردیس (`PING`) |

#### بخش ۲: احراز هویت (Auth)
| متد | مسیر | دسترسی | ورودی اصلی | خروجی کلیدی |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | عمومی (دارای Rate Limit) | `{ "code": "..." }` | صدور توکن JWT و اطلاعات اولیه کاربر |
| `GET` | `/api/auth/me` | تمامی پرسنل لاگین‌شده | هدر Bearer Token | مشخصات پروفایل، نقش و نام کاربر جاری |

#### بخش ۳: مدیریت کاربران (Users)
| متد | مسیر | دسترسی مجاز | توضیحات عملکردی |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/users/search` | `ADMIN`, `SUPER_ADMIN` | جستجوی سریع کاربران فعال بر اساس نام جهت تخصیص به پروژه |
| `GET` | `/api/users` | `SUPER_ADMIN` | دریافت لیست صفحه‌بندی‌شده پرسنل همراه با فیلتر نقش و وضعیت فعالیت |
| `POST` | `/api/users` | `SUPER_ADMIN` | ایجاد کاربر جدید با تخصیص کد پرسنلی، نام و نقش |
| `GET` | `/api/users/{id}` | `SUPER_ADMIN` | دریافت اطلاعات کامل یک کاربر بر اساس شناسه عددی |
| `PATCH` | `/api/users/{id}` | `SUPER_ADMIN` | ویرایش نام، کد، نقش یا وضعیت فعال بودن کاربر با رعایت گاردهای حفاظتی |
| `DELETE`| `/api/users/{id}` | `SUPER_ADMIN` | حذف کاربر به همراه پاکسازی کش نشست‌ها (با گارد ممانعت از حذف آخرین سوپرادمین) |

#### بخش ۴: پروژه‌ها و اعضا (Projects)
| متد | مسیر | دسترسی مجاز | توضیحات عملکردی |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/projects/mine` | تمامی کاربران | واکشی پروژه‌های فعالی که کاربر در آن‌ها عضویت دارد (به همراه کش سریع Redis) |
| `GET` | `/api/projects` | `ADMIN`, `SUPER_ADMIN` | مشاهده تمام پروژه‌ها به همراه تعداد اعضای فعال هر پروژه (`memberCount`) |
| `POST` | `/api/projects` | `SUPER_ADMIN` | تعریف پروژه جدید و تخصیص اولیه اعضا در یک تراکنش دیتابیسی |
| `GET` | `/api/projects/{id}` | `SUPER_ADMIN` | دریافت مشخصات پروژه به همراه لیست نام و شناسه اعضای منتسب |
| `PATCH` | `/api/projects/{id}` | `SUPER_ADMIN` | تغییر نام، توضیحات یا وضعیت فعال/غیرفعال بودن پروژه |
| `PUT` | `/api/projects/{id}/members` | `SUPER_ADMIN` | همگام‌سازی (Sync) لیست اعضای پروژه با محاسبه Diff حذفیات و اضافات |
| `DELETE`| `/api/projects/{id}` | `SUPER_ADMIN` | حذف فیزیکی پروژه در صورت عدم وجود سشن ثبت‌شده (در غیر این صورت ۴۰۹) |

#### بخش ۵: حضور و غیاب (Attendance)
| متد | مسیر | دسترسی مجاز | توضیحات عملکردی |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/attendance/today` | تمامی کاربران | دریافت وضعیت حضور ثبت‌شده کاربر در تاریخ امروز همراه با مجموع ثانیه‌های کارکرد |
| `POST` | `/api/attendance/today` | تمامی کاربران | اعلام وضعیت حضور امروز (`PRESENT` یا `ABSENT`). غیرقابل ثبت مجدد در همان روز |
| `GET` | `/api/attendance/me` | تمامی کاربران | تاریخچه حضور و غیاب کاربر به همراه وضعیت تایید مدیریت و فیلتر بازه تاریخ |
| `GET` | `/api/attendance/admin` | `ADMIN`, `SUPER_ADMIN` | کارتابل مدیریتی برای فیلتر وضعیت‌ها (`PENDING`, `APPROVED`, `REJECTED`) |
| `PATCH` | `/api/attendance/admin/{id}/decision` | `ADMIN`, `SUPER_ADMIN` | ثبت تصمیم تایید یا رد حضور؛ در صورت رد، سشن‌های کاری روز به صورت آبشاری حذف می‌شوند |

#### بخش ۶: سشن‌های کاری و تمرکز (WorkSessions)
| متد | مسیر | دسترسی مجاز | توضیحات عملکردی |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/work-sessions` | تمامی کاربران (با عضویت پروژه) | ثبت سشن کاری با بررسی قفل بدبینانه رکورد حضور و پشتیبانی از مهلت بامداد |
| `GET` | `/api/work-sessions/me` | تمامی کاربران | لیست سشن‌های کاری کاربر جاری در امروز یا بازه تاریخی دلخواه |
| `GET` | `/api/work-sessions/summary` | `ADMIN`, `SUPER_ADMIN` | گزارش تجمیعی کارکرد بر مبنای کاربر، پروژه، یا کاربر-پروژه در بازه‌های تاریخی |
| `GET` | `/api/work-sessions` | `ADMIN`, `SUPER_ADMIN` | کارتابل نظارت بر تمامی سشن‌های لاگ‌شده در سطح کل استودیو با جزئیات کامل |

---

## ۵. ساختار مدل داده دیتابیس (ERD)

دیاگرام زیر نمایانگر مدل‌های دیتابیس PostgreSQL و نحوه وابستگی کلیدهای خارجی و رفتارهای آبشاری (Cascade / Restrict / SetNull) در سیستم است:

```mermaid
erDiagram
    USER ||--o{ PROJECT : "creates"
    USER ||--o{ PROJECT_MEMBER : "participates"
    PROJECT ||--o{ PROJECT_MEMBER : "has"
    USER ||--o{ ATTENDANCE : "declares"
    USER ||--o{ ATTENDANCE : "reviews/decides"
    USER ||--o{ WORK_SESSION : "performs"
    PROJECT ||--o{ WORK_SESSION : "associated with"
    ATTENDANCE ||--o{ WORK_SESSION : "links to"

    USER {
        int id PK
        string code UK "Unique code"
        string name
        enum role "USER | ADMIN | SUPER_ADMIN"
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }

    PROJECT {
        int id PK
        string name
        string description
        boolean isActive
        int createdById FK
        datetime createdAt
        datetime updatedAt
    }

    PROJECT_MEMBER {
        int id PK
        int projectId FK
        int userId FK
        datetime assignedAt
    }

    ATTENDANCE {
        int id PK
        int userId FK
        date date "Date only"
        enum status "PRESENT | ABSENT"
        enum approval "PENDING | APPROVED | REJECTED"
        enum source "USER | ADMIN | SYSTEM"
        int decidedById FK "Nullable"
        datetime decidedAt "Nullable"
        datetime createdAt
        datetime updatedAt
    }

    WORK_SESSION {
        int id PK
        int userId FK
        int projectId FK
        int attendanceId FK
        int durationSeconds "CHECK > 0"
        datetime createdAt
    }
```

### قیدها و شاخص‌های حیاتی پایگاه داده:
- **`User(code)`**: ایندکس منحصر‌به‌فرد (`UNIQUE`) برای لاگین فوق‌سریع.
- **`ProjectMember(projectId, userId)`**: قید ترکیبی یکتا برای جلوگیری از انتساب تکراری کاربر به یک پروژه.
- **`Attendance(userId, date)`**: قید یکتایی حضور در هر روز تقویمی برای جلوگیری مطلق از ثبت دو رکورد در یک روز.
- **`Attendance(date, approval)`**: ایندکس مرکب جهت سرعت‌بخشی به جاب بستن روزانه و کوئری‌های کارتابل ادمین.
- **`WorkSession(attendanceId)` و `WorkSession(userId, createdAt)`**: ایندکس‌های تسریع گزارش‌گیری و تجمیع زمانی.
- **`WorkSession_durationSeconds_check`**: قید دیتابیسی سطح SQL که تضمین می‌کند مقدار مدت زمان کارکرد همواره بزرگتر از صفر باشد (`durationSeconds > 0`).

---

## ۶. فرمت استاندارد پاسخ‌ها و خطاها (Envelope Pattern)

کلیه پاسخ‌های سامانه از قالب استاندارد دوگانه زیر استفاده می‌کنند:

### ۱. پاسخ موفقیت‌آمیز (Success)
```json
{
  "success": true,
  "message": "Project created successfully",
  "data": {
    "id": 4,
    "name": "Rokad Studio Redesign",
    "description": "Design system & front revamp",
    "isActive": true
  },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

### ۲. پاسخ خطا (Error)
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "code",
      "message": "Code must be between 6 and 64 characters"
    }
  ]
}
```

---

## ۷. راهنمای راه‌اندازی سریع در محیط توسعه (Local Setup)

### ۱. پیش‌نیازها
- نصب Node.js نسخه 22 به بالا
- نصب Docker و Docker Compose

### ۲. استقرار دیتابیس و ردیس
```bash
docker-compose up -d
```
کانتینرهای PostgreSQL روی پورت نگاشت‌شده `54320` و Redis روی پورت `6379` آماده خواهند شد.

### ۳. تنظیم فایل متغیرهای محیطی
یک کپی از `.env.example` ایجاد کرده و با نام `.env` ذخیره کنید:
```env
PORT=5000
NODE_ENV=development
APP_TIMEZONE=Asia/Tehran
DATABASE_URL=postgresql://rokad_user:rokad_password@localhost:54320/rokad_attendance_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=super_secret_jwt_key_with_at_least_32_chars_rokad
SESSION_MAX_SECONDS=1500
MIDNIGHT_GRACE_MINUTES=30
ATTENDANCE_CATCHUP_DAYS=7
```

### ۴. اجرای مایگریشن‌ها و ایجاد سوپرادمین اولیه
```bash
npm run db:deploy
npm run db:seed
```
*خروجی ایجاد سوپرادمین: با کد پیش‌فرض `super_admin_2026` آماده ورود خواهد بود.*

### ۵. اجرای سرور
```bash
npm run dev
```
سامانه روی آدرس `http://localhost:5000` بالا آمده و مستندات تعاملی Swagger بلافاصله در مسیر `http://localhost:5000/api-docs` قابل دسترسی و تست خواهند بود.

### ۶. اجرای تست‌ها
```bash
npm test
npm run smoke
```

