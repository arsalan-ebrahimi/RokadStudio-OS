import type { TimerTargetKind } from './timer-engine';

export interface MappedWorkSessionError {
  message: string;
  isUnauthorized: boolean;
  /** True when the current timer target itself can never be logged (deleted, deactivated, or unassigned). */
  canDiscardTarget: boolean;
}

export function mapWorkSessionError(
  err: unknown,
  targetKind?: TimerTargetKind,
  targetLabel?: string
): MappedWorkSessionError {
  const status =
    err &&
    typeof err === 'object' &&
    'status' in err &&
    typeof (err as { status?: unknown }).status === 'number'
      ? (err as { status: number }).status
      : undefined;

  const rawMessage =
    err instanceof Error
      ? err.message
      : err &&
          typeof err === 'object' &&
          'message' in err &&
          typeof (err as { message?: unknown }).message === 'string'
        ? (err as { message: string }).message
        : '';

  const lower = rawMessage.toLowerCase();
  const quotedLabel = targetLabel?.trim() ? ` («${targetLabel.trim()}»)` : '';

  // 1. Network error (status === 0 or browser fetch network failure)
  if (
    status === 0 ||
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network error')
  ) {
    return {
      message: 'عدم اتصال به سرور. لطفا اتصال اینترنت یا سرور را بررسی کنید.',
      isUnauthorized: false,
      canDiscardTarget: false,
    };
  }

  // 2. Authentication / deactivated user account (401)
  if (
    status === 401 ||
    lower.includes('not logged in') ||
    lower.includes('account is inactive') ||
    lower.includes('invalid token')
  ) {
    return {
      message: 'نشست کاربری شما منقضی شده یا حساب کاربری غیرفعال است. لطفا دوباره وارد شوید.',
      isUnauthorized: true,
      canDiscardTarget: false,
    };
  }

  // 3. Specific inactive / legacy combined project message (check before generic "project not found")
  if (
    lower.includes('project not found or inactive') ||
    lower.includes('project is inactive')
  ) {
    return {
      message: lower.includes('project not found or inactive')
        ? `این پروژه${quotedLabel} یافت نشد یا غیرفعال شده است.`
        : `این پروژه${quotedLabel} غیرفعال شده است.`,
      isUnauthorized: false,
      canDiscardTarget: true,
    };
  }

  if (rawMessage.includes('اسکرام مربوطه غیرفعال است')) {
    return {
      message: 'اسکرام مربوط به این تسک غیرفعال شده است.',
      isUnauthorized: false,
      canDiscardTarget: true,
    };
  }

  if (rawMessage.includes('این تسک غیرفعال است')) {
    return {
      message: `این تسک${quotedLabel} غیرفعال شده است.`,
      isUnauthorized: false,
      canDiscardTarget: true,
    };
  }

  // 4. Explicit target not found (404 from Project/Task lookup — never conflate with generic 404 Route not found)
  if (lower.includes('project not found')) {
    return {
      message: `پروژه انتخاب‌شده${quotedLabel} یافت نشد (ممکن است حذف شده باشد).`,
      isUnauthorized: false,
      canDiscardTarget: true,
    };
  }

  if (rawMessage.includes('تسک یافت نشد')) {
    return {
      message: `تسک انتخاب‌شده${quotedLabel} یافت نشد (ممکن است حذف شده باشد).`,
      isUnauthorized: false,
      canDiscardTarget: true,
    };
  }

  // 5. Forbidden / membership / assignment error (403)
  if (
    status === 403 ||
    lower.includes('not an assigned member') ||
    rawMessage.includes('این تسک به شما اختصاص ندارد') ||
    rawMessage.includes('دسترسی به ماژول اسکرام')
  ) {
    if (rawMessage.includes('دسترسی به ماژول اسکرام')) {
      return {
        message: 'نقش کاربری شما اجازه ثبت زمان روی تسک اسکرام را ندارد.',
        isUnauthorized: false,
        canDiscardTarget: true,
      };
    }
    if (targetKind === 'TASK' || rawMessage.includes('تسک')) {
      return {
        message: `این تسک${quotedLabel} دیگر به شما اختصاص ندارد.`,
        isUnauthorized: false,
        canDiscardTarget: true,
      };
    }
    return {
      message: `شما عضو این پروژه${quotedLabel} نیستید.`,
      isUnauthorized: false,
      canDiscardTarget: true,
    };
  }

  // 6. Attendance errors (must run before generic 404 fallback in case attendance row returned 404)
  if (lower.includes('attendance')) {
    if (lower.includes('rejected')) {
      return {
        message: 'حضور شما برای این تاریخ رد شده است.',
        isUnauthorized: false,
        canDiscardTarget: false,
      };
    }
    if (lower.includes('must be present')) {
      return {
        message: 'وضعیت حضور شما برای ثبت زمان باید «حاضر» باشد.',
        isUnauthorized: false,
        canDiscardTarget: false,
      };
    }
    return {
      message: 'حضور شما برای امروز ثبت نشده است.',
      isUnauthorized: false,
      canDiscardTarget: false,
    };
  }

  // 7. Other 404 errors (route mismatch, proxy issue, etc.) must NOT blame the user's selected project
  if (status === 404) {
    if (lower.includes('route not found')) {
      return {
        message: 'مسیر ثبت سشن در سرور یافت نشد. لطفا اتصال و نسخه سرور را بررسی کنید.',
        isUnauthorized: false,
        canDiscardTarget: false,
      };
    }
    return {
      message: rawMessage || 'مورد درخواستی در سرور یافت نشد.',
      isUnauthorized: false,
      canDiscardTarget: false,
    };
  }

  // 8. Payload / timestamp validation errors
  if (rawMessage.includes('باید دقیقاً یکی از projectId یا taskId ارسال شود')) {
    return {
      message: 'لطفا ابتدا یک پروژه یا تسک معتبر انتخاب کنید.',
      isUnauthorized: false,
      canDiscardTarget: false,
    };
  }

  if (lower.includes('older than 2 days')) {
    return {
      message: 'زمان شروع این سشن مربوط به بیش از ۲ روز پیش است و قابل ثبت نیست.',
      isUnauthorized: false,
      canDiscardTarget: true,
    };
  }

  if (lower.includes('cannot be in the future')) {
    return {
      message: 'ساعت سیستم با سرور هماهنگ نیست (زمان شروع در آینده است). لطفا ساعت دستگاه را بررسی کنید.',
      isUnauthorized: false,
      canDiscardTarget: false,
    };
  }

  return {
    message: rawMessage || 'ثبت انجام نشد. زمان شما حفظ شده است؛ دوباره تلاش کنید.',
    isUnauthorized: false,
    canDiscardTarget: false,
  };
}

