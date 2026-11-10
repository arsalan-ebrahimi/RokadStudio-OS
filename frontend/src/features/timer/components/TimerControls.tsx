import React from 'react';
import { Play, Pause, CheckCircle, Coffee } from 'lucide-react';
import { Button } from '@/shared/ui';
import { cn } from '@/shared/lib/utils';
import type { PomodoroMode, TimerStatus } from '../lib/timer-engine';

export interface TimerControlsProps {
  status: TimerStatus;
  workSeconds: number;
  pomodoroMode: PomodoroMode;
  mainButtonLabel: 'شروع' | 'توقف' | 'ادامه';
  mainButtonDisabled: boolean;
  mainButtonDisabledReason: string | null;
  registerButtonDisabled: boolean;
  registerButtonDisabledReason: string | null;
  isOtherTabActive: boolean;
  isSubmitting: boolean;
  onMainClick: () => void;
  onRegisterClick: () => void;
  className?: string;
}

export const TimerControls: React.FC<TimerControlsProps> = ({
  status,
  workSeconds,
  pomodoroMode,
  mainButtonLabel,
  mainButtonDisabled,
  mainButtonDisabledReason,
  registerButtonDisabled,
  registerButtonDisabledReason,
  isOtherTabActive,
  isSubmitting,
  onMainClick,
  onRegisterClick,
  className,
}) => {
  const isRunning = status === 'RUNNING';
  const isBreak = pomodoroMode === 'BREAK';
  const isPureIdle = status === 'IDLE' && workSeconds < 1 && !isBreak;

  const activeHelperText = isOtherTabActive
    ? 'تایمر در تب دیگری فعال است.'
    : mainButtonDisabled && mainButtonDisabledReason
      ? mainButtonDisabledReason
      : isRunning && registerButtonDisabled && registerButtonDisabledReason
        ? 'برای ثبت و پایان، ابتدا تایمر را متوقف کنید.'
        : registerButtonDisabled && registerButtonDisabledReason && !isPureIdle
          ? registerButtonDisabledReason
          : null;

  return (
    <div className={cn('flex flex-col items-center w-full max-w-[360px] mx-auto', className)}>
      {/* Fixed-height (56px) container guarantees zero layout shift across states */}
      <div className="h-[56px] w-full flex items-center justify-center">
        {isPureIdle ? (
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={onMainClick}
            disabled={mainButtonDisabled}
            title={mainButtonDisabled && mainButtonDisabledReason ? mainButtonDisabledReason : 'شروع تایمر'}
            className="min-h-[56px] h-[56px] min-w-[200px] sm:min-w-[228px] px-8 rounded-2xl text-base font-black gap-2"
          >
            <Play className="w-5 h-5 shrink-0 fill-current" />
            <span>{mainButtonLabel}</span>
          </Button>
        ) : (
          <div className="flex items-center justify-center gap-3 w-full">
            <Button
              type="button"
              variant={isBreak ? 'primary' : isRunning ? 'secondary' : 'primary'}
              size="lg"
              onClick={onMainClick}
              disabled={mainButtonDisabled}
              title={
                mainButtonDisabled && mainButtonDisabledReason
                  ? mainButtonDisabledReason
                  : isRunning
                    ? 'توقف موقت تایمر'
                    : 'ادامه تایمر'
              }
              className="min-h-[56px] h-[56px] flex-1 min-w-[132px] px-5 rounded-2xl text-sm sm:text-base font-black gap-2"
            >
              {isRunning ? (
                <>
                  <Pause className="w-5 h-5 shrink-0" />
                  <span>توقف</span>
                </>
              ) : isBreak ? (
                <>
                  <Coffee className="w-5 h-5 shrink-0" />
                  <span>{mainButtonLabel}</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 shrink-0 fill-current" />
                  <span>{mainButtonLabel}</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onRegisterClick}
              disabled={registerButtonDisabled}
              isLoading={isSubmitting}
              title={registerButtonDisabledReason || 'ثبت و پایان سشن'}
              className={cn(
                'min-h-[56px] h-[56px] flex-1 max-w-[148px] px-4 rounded-2xl text-sm sm:text-base font-black gap-1.5',
                !registerButtonDisabled &&
                  'hover:border-[#E0195B] hover:bg-female-light/70 hover:text-[#C60036] hover:shadow-[2.75px_2.75px_0_#E0195B] dark:hover:bg-female-darker/40 dark:hover:text-rose-200 dark:hover:border-female-normal'
              )}
            >
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>ثبت</span>
            </Button>
          </div>
        )}
      </div>

      {/* Reserved fixed height slot so helper text never shifts surrounding layout */}
      <div className="min-h-[24px] mt-2.5 flex items-center justify-center px-2">
        {activeHelperText && (
          <p
            role="status"
            className="text-[11px] sm:text-xs text-sec/70 dark:text-gray-400 text-center font-bold leading-snug"
          >
            {activeHelperText}
          </p>
        )}
      </div>
    </div>
  );
};

