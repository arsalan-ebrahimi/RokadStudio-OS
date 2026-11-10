import type { TimerTargetKind } from './timer-engine';

export interface MappedWorkSessionError {
  message: string;
  isUnauthorized: boolean;
  /** True when the current timer target itself can never be logged (deleted, deactivated, or unassigned). */
  canDiscardTarget: boolean;
}

export function mapWorkSessionError(
  err: unknown,
  targetKind?: TimerTargetKind
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

  // 3. Not found (404)
  if (
    status === 404 ||
    lower.includes('project not found') ||
    rawMessage.includes('تسک یافت نشد')
  ) {
    if (
      (targetKind === 'TASK' && !lower.includes('project not found')) ||
      rawMessage.includes('تسک یافت نشد')
    ) {
      return {
        message: 'تسک انتخاب‌شده یافت نشد (ممکن است حذف شده باشد).',
        isUnauthorized: false,
        canDiscardTarget: true,
      };
    }
    return {
      message: 'پروژه انتخاب‌شده یافت نشد (ممکن است حذف شده باشد).',
      isUnauthorized: false,
      canDiscardTarget: true,
    };
  }

  // 4. Forbidden / membership / assignment error (403)
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
        message: 'این تسک دیگر به شما اختصاص ندارد.',
        isUnauthorized: false,
        canDiscardTarget: true,
      };
    }
    return {
      message: 'شما عضو این پروژه نیستید.',
      isUnauthorized: false,
      canDiscardTarget: true,
    };
  }

  // 5. Attendance errors
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

  // 6. Specific inactive target / scrum errors
  if (rawMessage.includes('اسکرام مربوطه غیرفعال است')) {
    return {
      message: 'اسکرام مربوط به این تسک غیرفعال شده است.',
      isUnauthorized: false,
      canDiscardTarget: true,
    };
  }

  if (rawMessage.includes('این تسک غیرفعال است')) {
    return {
      message: 'این تسک غیرفعال شده است.',
      isUnauthorized: false,
      canDiscardTarget: true,
    };
  }

  if (
    lower.includes('project not found or inactive') ||
    lower.includes('project is inactive')
  ) {
    return {
      message: lower.includes('project not found or inactive')
        ? 'این پروژه یافت نشد یا غیرفعال شده است.'
        : 'این پروژه غیرفعال شده است.',
      isUnauthorized: false,
      canDiscardTarget: true,
    };
  }

  return {
    message: rawMessage || 'ثبت انجام نشد. زمان شما حفظ شده است؛ دوباره تلاش کنید.',
    isUnauthorized: false,
    canDiscardTarget: false,
  };
}

