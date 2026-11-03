import React from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '@/shared/ui';
import { formatSecondsToTime, toPersianDigits } from '@/shared/lib/formatters';
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

  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-6">
      <div
        className={cn(
          'w-64 h-64 rounded-full flex flex-col items-center justify-center border-4 shadow-hard-lg transition-all',
          isRunning && 'border-primary shadow-ecosystem bg-ecosystem-light/30 dark:bg-ecosystem-darker/20',
          state === 'PAUSED' && 'border-third shadow-college bg-college-light/30 dark:bg-college-darker/20',
          state === 'BREAK' && 'border-girl shadow-female bg-female-light/30 dark:bg-female-darker/20',
          state === 'IDLE' && 'border-gray-300 dark:border-gray-700 bg-white dark:bg-[#151C28]',
          isDone && 'border-primary shadow-ecosystem bg-white dark:bg-[#151C28]'
        )}
      >
        <span className="text-5xl font-black tracking-tight tabular-nums text-sec dark:text-white" dir="ltr">
          {toPersianDigits(formatSecondsToTime(remaining))}
        </span>
        <span className="text-xs font-bold text-ink-normal/60 dark:text-gray-400 mt-2">
          {state === 'BREAK' ? 'استراحت' : 'تمرکز'}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {isRunning ? (
          <Button variant="secondary" size="lg" onClick={onPause} className="w-32">
            <Pause className="w-4 h-4 me-1.5" />
            توقف
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            onClick={onStart}
            disabled={!canStart || state === 'BREAK' || isDone}
            className="w-32"
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
          className="w-28"
        >
          <RotateCcw className="w-4 h-4 me-1.5" />
          ریست
        </Button>
      </div>
    </div>
  );
};

