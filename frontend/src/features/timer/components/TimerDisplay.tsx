import React, { useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Button } from '@/shared/ui';
import { formatSecondsToTime, toPersianDigits } from '@/shared/lib/formatters';
import { WORK_DURATION_SECONDS, BREAK_DURATION_SECONDS } from '@/shared/config/constants';
import type { TimerState } from '../hooks/use-timer';
import { cn } from '@/shared/lib/utils';

interface TimerDisplayProps {
  remaining: number;
  state: TimerState;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  canStart: boolean;
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({
  remaining,
  state,
  onStart,
  onPause,
  onReset,
  canStart,
}) => {
  const isRunning = state === 'RUNNING';
  const isDone = state === 'DONE';
  const prevStateRef = useRef<TimerState>(state);

  // Trigger celebration confetti when session completes or transitions to break/done
  useEffect(() => {
    if (prevStateRef.current === 'RUNNING' && (state === 'BREAK' || state === 'DONE')) {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.65 },
        colors: ['#59BBAF', '#E0195B', '#F8A41D', '#612B89', '#202A5A'],
        shapes: ['square', 'circle'],
        ticks: 200,
      });
    }
    prevStateRef.current = state;
  }, [state]);

  const totalDuration = state === 'BREAK' ? BREAK_DURATION_SECONDS : WORK_DURATION_SECONDS;
  const progress = Math.max(0, Math.min(1, remaining / totalDuration));
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const strokeColor =
    state === 'BREAK'
      ? '#E0195B'
      : state === 'PAUSED'
      ? '#F8A41D'
      : isRunning
      ? '#59BBAF'
      : '#CBD5E1';

  return (
    <div className="flex flex-col items-center justify-center p-2 sm:p-6 lg:p-8 space-y-6">
      <div className="relative w-64 h-64 sm:w-72 sm:h-72 lg:w-80 lg:h-80 flex items-center justify-center select-none">
        {/* Ambient Glow */}
        {isRunning && (
          <div className="absolute inset-4 rounded-full bg-primary/10 dark:bg-primary/15 blur-2xl animate-pulse pointer-events-none" />
        )}
        {state === 'BREAK' && (
          <div className="absolute inset-4 rounded-full bg-girl/15 dark:bg-girl/20 blur-2xl animate-pulse pointer-events-none" />
        )}

        {/* SVG Progress Ring */}
        <svg className="w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 280 280">
          {/* Background track */}
          <circle
            cx="140"
            cy="140"
            r={radius}
            fill="none"
            strokeWidth="10"
            className="stroke-gray-100 dark:stroke-[#1A2333] transition-colors"
          />
          {/* Active progress stroke */}
          <circle
            cx="140"
            cy="140"
            r={radius}
            fill="none"
            strokeWidth="11"
            strokeLinecap="round"
            stroke={strokeColor}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Inner Card Content */}
        <div
          className={cn(
            'absolute inset-5 rounded-full flex flex-col items-center justify-center shadow-hard-lg transition-all',
            'bg-white dark:bg-[#151C28] border-2 border-[#121824] dark:border-gray-700',
            isRunning && 'border-primary dark:border-primary shadow-ecosystem',
            state === 'PAUSED' && 'border-third dark:border-third shadow-college',
            state === 'BREAK' && 'border-girl dark:border-girl shadow-female'
          )}
        >
          <span
            className="text-4xl min-[400px]:text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight tabular-nums text-sec dark:text-white"
            dir="ltr"
          >
            {toPersianDigits(formatSecondsToTime(remaining))}
          </span>

          <div className="mt-2 sm:mt-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 dark:bg-[#1C2536] border border-gray-200 dark:border-gray-700 text-xs font-bold">
            {state === 'BREAK' ? (
              <span className="text-girl flex items-center gap-1 font-extrabold">
                <Sparkles className="w-3 h-3" />
                استراحت
              </span>
            ) : state === 'PAUSED' ? (
              <span className="text-third font-extrabold">توقف موقت</span>
            ) : isDone ? (
              <span className="text-primary font-extrabold">تکمیل شد</span>
            ) : (
              <span className="text-ink-normal/70 dark:text-gray-300">تمرکز</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isRunning ? (
          <Button variant="secondary" size="lg" onClick={onPause} className="w-32 sm:w-36">
            <Pause className="w-4 h-4 me-1.5" />
            توقف
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            onClick={onStart}
            disabled={!canStart || state === 'BREAK' || isDone}
            className="w-32 sm:w-36"
          >
            <Play className="w-4 h-4 me-1.5" />
            شروع
          </Button>
        )}

        <Button
          variant="outline"
          size="lg"
          onClick={onReset}
          disabled={!isDone}
          className="w-28 sm:w-32"
        >
          <RotateCcw className="w-4 h-4 me-1.5" />
          ریست
        </Button>
      </div>
    </div>
  );
};

