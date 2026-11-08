import React, { useEffect, useRef } from 'react';
import { Play, Pause, CheckCircle, Coffee, Flame, AlertCircle, X, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Button } from '@/shared/ui';
import { formatSecondsToTime, formatSecondsToHms, toPersianDigits } from '@/shared/lib/formatters';
import { FOCUS_MS, BREAK_MS } from '../config/timer-constants';
import { PomodoroMode, TimerStatus } from '../lib/timer-engine';
import { cn } from '@/shared/lib/utils';

interface TimerDisplayProps {
  status: TimerStatus;
  workSeconds: number;
  pomodoroRemainingSeconds: number;
  pomodoroMode: PomodoroMode;
  mainButtonLabel: 'شروع' | 'توقف' | 'ادامه';
  mainButtonDisabled: boolean;
  mainButtonDisabledReason: string | null;
  registerButtonDisabled: boolean;
  registerButtonDisabledReason: string | null;
  onMainClick: () => void;
  onRegisterClick: () => void;
  showFocusBanner: boolean;
  onDismissFocusBanner: () => void;
  showRecoveredNotice: boolean;
  onDismissRecoveredNotice: () => void;
  isOtherTabActive: boolean;
  onDismissOtherTabLock?: () => void;
  isSubmitting: boolean;
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({
  status,
  workSeconds,
  pomodoroRemainingSeconds,
  pomodoroMode,
  mainButtonLabel,
  mainButtonDisabled,
  mainButtonDisabledReason,
  registerButtonDisabled,
  registerButtonDisabledReason,
  onMainClick,
  onRegisterClick,
  showFocusBanner,
  onDismissFocusBanner,
  showRecoveredNotice,
  onDismissRecoveredNotice,
  isOtherTabActive,
  onDismissOtherTabLock,
  isSubmitting,
}) => {
  const isRunning = status === 'RUNNING';
  const isBreak = pomodoroMode === 'BREAK';
  const prevModeRef = useRef<PomodoroMode>(pomodoroMode);

  // Confetti when transition to break occurs
  useEffect(() => {
    if (prevModeRef.current === 'FOCUS' && pomodoroMode === 'BREAK') {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.65 },
        colors: ['#59BBAF', '#E0195B', '#F8A41D', '#612B89', '#202A5A'],
        shapes: ['square', 'circle'],
        ticks: 200,
      });
    }
    prevModeRef.current = pomodoroMode;
  }, [pomodoroMode]);

  // Pomodoro SVG Progress calculation
  const totalPomodoroSeconds = isBreak ? BREAK_MS / 1000 : FOCUS_MS / 1000;
  const progress = Math.max(0, Math.min(1, pomodoroRemainingSeconds / totalPomodoroSeconds));
  const radius = 95;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const strokeColor = isBreak
    ? '#E0195B'
    : status === 'PAUSED'
    ? '#F8A41D'
    : isRunning
    ? '#59BBAF'
    : '#CBD5E1';

  // Determine active helper text under buttons
  const activeHelperText =
    isOtherTabActive
      ? 'تایمر در تب دیگری فعال است.'
      : mainButtonDisabled && mainButtonDisabledReason
      ? mainButtonDisabledReason
      : registerButtonDisabled && registerButtonDisabledReason && status === 'IDLE' && workSeconds < 1
      ? 'برای شروع، ابتدا دکمه شروع را بزنید.'
      : null;

  return (
    <div className="flex flex-col items-center justify-center p-2 sm:p-4 space-y-6">
      {/* Aria-live region for accessibility announcements on status changes */}
      <div className="sr-only" aria-live="polite">
        {isBreak
          ? 'زمان استراحت آغاز شد'
          : isRunning
          ? 'تایمر شروع به کار کرد'
          : status === 'PAUSED'
          ? 'تایمر متوقف شد'
          : 'تایمر در حالت آماده‌باش است'}
      </div>

      {/* Recovered Previous Session Notice */}
      {showRecoveredNotice && (
        <div className="w-full flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 text-xs font-bold animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>جلسه‌ی قبلی بازیابی شد.</span>
          </div>
          <button
            onClick={onDismissRecoveredNotice}
            className="p-1 hover:bg-amber-200/60 dark:hover:bg-amber-800/60 rounded-lg transition-colors"
            aria-label="بستن پیام"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Multi-Tab Lock Warning */}
      {isOtherTabActive && (
        <div className="w-full flex items-center justify-between p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200 text-xs font-bold animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>تایمر در تب دیگری فعال است.</span>
          </div>
          {onDismissOtherTabLock && (
            <button
              onClick={onDismissOtherTabLock}
              className="p-1 hover:bg-rose-200/60 dark:hover:bg-rose-800/60 rounded-lg transition-colors flex items-center gap-1 text-[11px]"
              aria-label="انتقال کنترل به این تب"
              title="انتقال کنترل به این تب"
            >
              <span className="hidden sm:inline">انتقال به این تب</span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Focus Complete Notification Banner */}
      {showFocusBanner && (
        <div className="w-full flex items-center justify-between gap-3 p-3.5 rounded-xl bg-girl/10 dark:bg-girl/20 border-2 border-girl text-sec dark:text-white text-xs font-bold shadow-female animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-girl shrink-0" />
            <span className="truncate">۲۵ دقیقه کار کردید. زمان استراحت ۵ دقیقه‌ای است.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="primary"
              onClick={onRegisterClick}
              disabled={registerButtonDisabled || isSubmitting}
              className="text-xs h-7 px-2.5 py-0"
            >
              ثبت
            </Button>
            <button
              onClick={onDismissFocusBanner}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-500 transition-colors"
              aria-label="بستن بنر"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 1. Large Work Stopwatch (HH:MM:SS) */}
      <div className="flex flex-col items-center justify-center select-none">
        <span className="text-xs font-bold text-ink-normal/60 dark:text-gray-400 flex items-center gap-1.5 mb-2.5">
          <Flame className="w-3.5 h-3.5 text-primary" />
          <span>زمان کار روی پروژه</span>
        </span>
        <div
          className="text-4xl sm:text-5xl lg:text-6xl font-black tabular-nums tracking-wider text-sec dark:text-white"
          dir="ltr"
        >
          {toPersianDigits(formatSecondsToHms(workSeconds))}
        </div>
      </div>

      {/* 2. Pomodoro Countdown Ring (MM:SS) */}
      <div className="relative w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center select-none my-1">
        {isRunning && !isBreak && (
          <div className="absolute inset-4 rounded-full bg-primary/10 dark:bg-primary/15 blur-2xl animate-pulse pointer-events-none" />
        )}
        {isBreak && (
          <div className="absolute inset-4 rounded-full bg-girl/15 dark:bg-girl/20 blur-2xl animate-pulse pointer-events-none" />
        )}

        {/* SVG Progress Ring */}
        <svg className="w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 240 240">
          <circle
            cx="120"
            cy="120"
            r={radius}
            fill="none"
            strokeWidth="9"
            className="stroke-gray-100 dark:stroke-[#1A2333] transition-colors"
          />
          <circle
            cx="120"
            cy="120"
            r={radius}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            stroke={strokeColor}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-300 ease-out"
          />
        </svg>

        {/* Inner Card Content */}
        <div
          className={cn(
            'absolute inset-4 rounded-full flex flex-col items-center justify-center shadow-hard transition-all',
            'bg-white dark:bg-[#151C28] border-2 border-[#121824] dark:border-gray-700',
            isRunning && !isBreak && 'border-primary dark:border-primary shadow-ecosystem',
            status === 'PAUSED' && !isBreak && 'border-third dark:border-third shadow-college',
            isBreak && 'border-girl dark:border-girl shadow-female'
          )}
        >
          {/* Explicit Label: Not relying on color alone */}
          <div
            className={cn(
              'px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 mb-2.5 sm:mb-3',
              isBreak
                ? 'bg-girl/15 text-girl border border-girl/30'
                : 'bg-primary/15 text-primary border border-primary/30'
            )}
          >
            {isBreak ? (
              <>
                <Coffee className="w-3.5 h-3.5 shrink-0" />
                <span>استراحت</span>
              </>
            ) : (
              <>
                <Flame className="w-3.5 h-3.5 shrink-0" />
                <span>تمرکز</span>
              </>
            )}
          </div>

          <span
            className="text-3xl min-[400px]:text-4xl sm:text-5xl font-black tracking-tight tabular-nums text-sec dark:text-white"
            dir="ltr"
          >
            {toPersianDigits(formatSecondsToTime(pomodoroRemainingSeconds))}
          </span>
        </div>
      </div>

      {/* 3. The Two Buttons (Main Button + «ثبت») */}
      <div className="flex flex-col items-center gap-3 w-full max-w-xs">
        <div className="flex items-center gap-3 w-full">
          {/* Main Button: شروع / توقف / ادامه */}
          <Button
            variant={isRunning ? 'secondary' : 'primary'}
            size="lg"
            onClick={onMainClick}
            disabled={mainButtonDisabled}
            className="flex-1 text-sm font-black h-12 shadow-hard"
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-4 me-1.5" />
                توقف
              </>
            ) : (
              <>
                <Play className="w-4 h-4 me-1.5" />
                {mainButtonLabel}
              </>
            )}
          </Button>

          {/* Register Button: ثبت */}
          <Button
            variant="outline"
            size="lg"
            onClick={onRegisterClick}
            disabled={registerButtonDisabled}
            isLoading={isSubmitting}
            className="w-28 text-sm font-black h-12 shadow-hard border-2"
          >
            <CheckCircle className="w-4 h-4 me-1.5 text-primary" />
            ثبت
          </Button>
        </div>

        {/* Helper text explaining why controls are disabled */}
        {activeHelperText && (
          <p className="text-xs text-ink-normal/60 dark:text-gray-400 text-center font-bold px-2 leading-relaxed animate-in fade-in">
            {activeHelperText}
          </p>
        )}
      </div>
    </div>
  );
};
