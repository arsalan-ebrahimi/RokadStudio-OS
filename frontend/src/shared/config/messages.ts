export const messages = {
  auth: {
    loginTitle: 'کد پرسنلی',
    adminLoginTitle: 'ورود مدیریت',
    invalidCode: 'کد نامعتبر است',
    rateLimited: 'تلاش بیش از حد مجاز. ۱۵ دقیقه بعد تلاش کنید.',
    unauthorized: 'نشست منقضی شد',
    forbidden: 'دسترسی ندارید',
  },
  attendance: {
    present: 'حاضر',
    absent: 'غایب',
    pending: 'در انتظار',
    approved: 'تایید شد',
    rejected: 'رد شد',
    confirmPresent: 'ثبت حضور امروز',
    alreadyMarked: 'حضور امروز ثبت شده است',
  },
  timer: {
    work: 'زمان تمرکز',
    break: 'زمان استراحت',
    completed: 'دور تکمیل شد',
    selectProjectFirst: 'ابتدا پروژه را انتخاب کنید',
    lockedDuringRun: 'پروژه در حین کار قفل است',
  },
  common: {
    save: 'ذخیره',
    cancel: 'انصراف',
    delete: 'حذف',
    confirm: 'تایید',
    retry: 'تلاش مجدد',
    search: 'جستجو',
    empty: 'موردی یافت نشد',
    error: 'خطا در برقراری ارتباط',
    loading: 'در حال بارگذاری',
  },
} as const;

