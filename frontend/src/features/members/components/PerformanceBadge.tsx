import React from 'react';
import { PERFORMANCE_META, type PerformanceLevel } from '../types';
import { cn } from '@/shared/lib/utils';

interface PerformanceBadgeProps {
  level?: PerformanceLevel | null;
  className?: string;
  emptyLabel?: string;
  showEmpty?: boolean;
}

export const PerformanceBadge: React.FC<PerformanceBadgeProps> = ({
  level,
  className,
  emptyLabel = 'ارزیابی نشده',
  showEmpty = false,
}) => {
  if (!level) {
    if (!showEmpty) return null;
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-dashed border-gray-300 dark:border-gray-600 text-ink-normal/55 dark:text-gray-400 whitespace-nowrap',
          className
        )}
      >
        {emptyLabel}
      </span>
    );
  }

  const meta = PERFORMANCE_META[level];
  if (!meta) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black border whitespace-nowrap shrink-0 leading-tight',
        meta.badgeClass,
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', meta.dotClass)} aria-hidden="true" />
      <span>{meta.label}</span>
    </span>
  );
};

