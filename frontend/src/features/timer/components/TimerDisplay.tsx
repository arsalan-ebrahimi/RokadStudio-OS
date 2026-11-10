import React, { useEffect, useRef } from 'react';
import { Coffee, Flame, AlertCircle, X, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { formatSecondsToTime, formatSecondsToHms, toPersianDigits } from '@/shared/lib/formatters';
import { FOCUS_MS, BREAK_MS } from '../config/timer-constants';
import { PomodoroMode, TimerStatus } from '../lib/timer-engine';
import { TimerControls } from './TimerControls';
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
  staleTargetNotice?: {
    label?: string;
    onClear: () => void;
  } | null;
  isSubmitting: boolean;
  headerSlot?: React.ReactNode;
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
  staleTargetNotice,
  isSubmitting,
  headerSlot,
}) => {
  const isRunning = status === 'RUNNING';
  const isPaused = status === 'PAUSED';
  const isBreak = pomodoroMode === 'BREAK';
  const prevModeRef = useRef<PomodoroMode>(pomodoroMode);

  // Confetti when transition to break occurs (skipped under prefers-reduced-motion)
  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    if (!prefersReducedMotion && prevModeRef.current === 'FOCUS' && pomodoroMode === 'BREAK') {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.65 },
        colors: ['#59BBAF', '#E0195B', '#F8A41D', '#652D90', '#202A5A'],
        shapes: ['square', 'circle'],
        ticks: 200,
      });
    }
    prevModeRef.current = pomodoroMode;
  }, [pomodoroMode]);

  const totalPomodoroSeconds = isBreak ? BREAK_MS / 1000 : FOCUS_MS / 1000;
  const progress = Math.max(0, Math.min(1, pomodoroRemainingSeconds / totalPomodoroSeconds));
  const radius = 95;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  // Break shifts calmly to Mint (#59BBAF)
  const strokeColor = isBreak
    ? '#59BBAF'
    : isPaused
      ? '#F8A41D'
      : isRunning
        ? '#59BBAF'
        : '#CBD5E1';

  return (
    <div className="flex flex-col items-center justify-center w-full gap-6">
      {/* Aria-live region for accessibility announcements on status changes */}
      <div className="sr-only" aria-live="polite">
        {isBreak
          ? 'زمان استراحت آغاز شد'
          : isRunning
            ? 'تایمر شروع به کار کرد'
            : isPaused
              ? 'تایمر متوقف شد'
              : 'تایمر در حالت آماده‌باش است'}
      </div>

      {/* Transient Notices Stack (when present) */}
      {(showRecoveredNotice || isOtherTabActive || showFocusBanner || staleTargetNotice) && (
        <div className="w-full space-y-2.5">
          {staleTargetNotice && (
            <div
              role="alert"
              className="w-full flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-2xl bg-college-light dark:bg-amber-950/40 border-[1.5px] border-third text-sec dark:text-amber-200 text-xs font-bold animate-in fade-in"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <AlertCircle className="w-4 h-4 text-[#9C5700] dark:text-amber-400 shrink-0" />
                <span className="leading-relaxed">
                  هدف کاری قبلی
                  {staleTargetNotice.label ? ` («${staleTargetNotice.label}»)` : ''} دیگر فعال یا در دسترس نیست. یک پروژه جدید انتخاب کنید یا تایمر را پاک‌سازی کنید.
                </span>
              </div>
              <button
                type="button"
                onClick={staleTargetNotice.onClear}
                className="px-3 py-1.5 min-h-[36px] rounded-xl bg-white dark:bg-[#182030] border-[1.5px] border-sec/30 dark:border-amber-500/40 text-sec dark:text-amber-100 hover:bg-rose-50 hover:border-rose-400 hover:text-[#C60036] dark:hover:bg-rose-950/40 dark:hover:text-rose-200 transition-colors text-[11px] font-black shrink-0 cursor-pointer"
              >
                پاک‌سازی تایمر
              </button>
            </div>
          )}

          {showRecoveredNotice && (
            <div className="w-full flex items-center justify-between p-3 rounded-2xl bg-college-light dark:bg-amber-950/40 border-[1.5px] border-college-normal/60 text-sec dark:text-amber-200 text-xs font-bold animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-college-dark dark:text-amber-400 shrink-0" />
                <span>جلسه‌ی قبلی بازیابی شد.</span>
              </div>
              <button
                type="button"
                onClick={onDismissRecoveredNotice}
                className="w-8 h-8 -m-1 flex items-center justify-center hover:bg-college-normal/20 rounded-xl transition-colors cursor-pointer"
                aria-label="بستن پیام"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {isOtherTabActive && (
            <div className="w-full flex items-center justify-between p-3 rounded-2xl bg-female-light dark:bg-rose-950/40 border-[1.5px] border-female-normal/50 text-[#A81344] dark:text-rose-200 text-xs font-bold animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#C60036] dark:text-rose-400 shrink-0" />
                <span>تایمر در تب دیگری فعال است.</span>
              </div>
              {onDismissOtherTabLock && (
                <button
                  type="button"
                  onClick={onDismissOtherTabLock}
                  className="px-2.5 py-1.5 hover:bg-female-normal/15 rounded-xl transition-colors flex items-center gap-1 text-[11px] font-black cursor-pointer"
                  aria-label="انتقال کنترل به این تب"
                  title="انتقال کنترل به این تب"
                >
                  <span className="hidden sm:inline">انتقال به این تب</span>
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {showFocusBanner && (
            <div className="w-full flex items-center justify-between gap-3 p-3 rounded-2xl bg-ecosystem-light dark:bg-ecosystem-darker/40 border-[1.5px] border-primary text-sec dark:text-white text-xs font-bold shadow-ecosystem animate-in slide-in-from-top-2">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-4 h-4 text-primary shrink-0" />
                <span className="truncate">۲۵ دقیقه کار کردید. زمان استراحت ۵ دقیقه‌ای است.</span>
              </div>
              <button
                type="button"
                onClick={onDismissFocusBanner}
                className="w-8 h-8 -m-1 flex items-center justify-center hover:bg-primary/20 rounded-xl text-sec dark:text-white transition-colors shrink-0 cursor-pointer"
                aria-label="بستن پیام"
                title="بستن"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* 1. Compact Centered Project Chip Slot (24px gap below) */}
      {headerSlot && <div className="w-full flex justify-center">{headerSlot}</div>}

      {/* 2. Countdown Ring + Total Work Stopwatch */}
      <div className="flex flex-col items-center justify-center gap-4 select-none">
        {/* Work Stopwatch Summary */}
        <div className="flex flex-col items-center justify-center">
          <span className="text-[11px] sm:text-xs font-bold text-sec/60 dark:text-gray-400 flex items-center gap-1.5 mb-1.5">
            <Flame className="w-3.5 h-3.5 text-primary" />
            <span>زمان کار روی پروژه</span>
          </span>
          <div
            className="text-3xl sm:text-5xl lg:text-6xl font-black tabular-nums tracking-wider text-sec dark:text-white"
            dir="ltr"
          >
            {toPersianDigits(formatSecondsToHms(workSeconds))}
          </div>
        </div>

        {/* Pomodoro Countdown Ring (MM:SS) */}
        <div className="relative w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center">
          {isRunning && (
            <div className="absolute inset-4 rounded-full bg-primary/15 dark:bg-primary/15 blur-2xl animate-pulse pointer-events-none" />
          )}

          {/* SVG Progress Ring */}
          <svg className="w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 240 240">
            <circle
              cx="120"
              cy="120"
              r={radius}
              fill="none"
              strokeWidth="9"
              className="stroke-sec/[0.08] dark:stroke-[#1A2333] transition-colors"
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

          {/* Inner Countdown Badge & Time */}
          <div
            className={cn(
              'absolute inset-4 rounded-full flex flex-col items-center justify-center transition-all border-[1.5px]',
              isBreak
                ? 'bg-ecosystem-light/70 dark:bg-[#132225] border-primary shadow-ecosystem'
                : isPaused
                  ? 'bg-white dark:bg-[#151C28] border-third shadow-college'
                  : isRunning
                    ? 'bg-white dark:bg-[#151C28] border-sec dark:border-primary shadow-ecosystem'
                    : 'bg-white dark:bg-[#151C28] border-sec/35 dark:border-gray-700 shadow-male dark:shadow-hard'
            )}
          >
            <div
              className={cn(
                'px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 mb-2.5 sm:mb-3 border',
                isBreak
                  ? 'bg-primary text-sec border-sec/25'
                  : isPaused
                    ? 'bg-college-light text-[#704A0D] dark:bg-college-darker/60 dark:text-amber-200 border-college-normal/50'
                    : 'bg-ecosystem-light dark:bg-ecosystem-darker/70 text-sec dark:text-ecosystem-light border-primary/40'
              )}
            >
              {isBreak ? (
                <>
                  <Coffee className="w-3.5 h-3.5 shrink-0" />
                  <span>استراحت</span>
                </>
              ) : (
                <>
                  <Flame className="w-3.5 h-3.5 shrink-0 text-primary dark:text-primary" />
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
      </div>

      {/* 3. Adjacent Centered Controls directly below Countdown (24px gap above, 12px gap between buttons) */}
      <TimerControls
        status={status}
        workSeconds={workSeconds}
        pomodoroMode={pomodoroMode}
        mainButtonLabel={mainButtonLabel}
        mainButtonDisabled={mainButtonDisabled}
        mainButtonDisabledReason={mainButtonDisabledReason}
        registerButtonDisabled={registerButtonDisabled}
        registerButtonDisabledReason={registerButtonDisabledReason}
        isOtherTabActive={isOtherTabActive}
        isSubmitting={isSubmitting}
        onMainClick={onMainClick}
        onRegisterClick={onRegisterClick}
      />
    </div>
  );
};
