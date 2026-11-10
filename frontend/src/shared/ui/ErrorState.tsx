import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../lib/utils';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'خطا در دریافت اطلاعات',
  message = 'در برقراری ارتباط با سرور مشکلی پیش آمد. لطفاً دوباره تلاش کنید.',
  onRetry,
  retryLabel = 'تلاش مجدد',
  action,
  compact = false,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center rounded-2xl border-2 border-rose-200 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/20',
        compact ? 'p-3 sm:p-4 space-y-2' : 'p-6 sm:p-8 space-y-3',
        className
      )}
      role="alert"
    >
      <div
        className={cn(
          'rounded-2xl bg-rose-100 dark:bg-rose-900/40 text-[#C60036] dark:text-rose-300 flex items-center justify-center shadow-hard-sm',
          compact ? 'w-9 h-9' : 'w-12 h-12'
        )}
      >
        <AlertTriangle className={compact ? 'w-4 h-4' : 'w-6 h-6'} />
      </div>
      <div className="space-y-1 max-w-md">
        <h3 className={cn('font-black text-sec dark:text-white', compact ? 'text-xs' : 'text-sm sm:text-base')}>
          {title}
        </h3>
        {message && (
          <p className="text-xs text-ink-normal/70 dark:text-gray-300 leading-relaxed">{message}</p>
        )}
      </div>
      {(onRetry || action) && (
        <div className="pt-1 flex items-center gap-2 flex-wrap justify-center">
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5 text-xs font-bold">
              <RotateCcw className="w-3.5 h-3.5 text-primary" />
              <span>{retryLabel}</span>
            </Button>
          )}
          {action}
        </div>
      )}
    </div>
  );
};
