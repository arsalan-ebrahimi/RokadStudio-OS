import React from 'react';
import { cn } from '../lib/utils';
import { toPersianDigits } from '../lib/formatters';

export interface ProgressBarProps {
  value: number;
  max?: number;
  barClassName?: string;
  trackClassName?: string;
  size?: 'xs' | 'sm' | 'md';
  status?: 'default' | 'success' | 'warning' | 'danger';
  showLabel?: boolean;
  labelClassName?: string;
  className?: string;
  'aria-label'?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  barClassName,
  trackClassName = 'bg-sec/[0.08] dark:bg-gray-800',
  size = 'sm',
  status = 'default',
  showLabel = false,
  labelClassName,
  className,
  'aria-label': ariaLabel,
}) => {
  const safeMax = max > 0 ? max : 100;
  const ratio = Math.max(0, Math.min(1, value / safeMax));
  const percent = Math.round(ratio * 1000) / 10;

  const statusColor =
    barClassName ||
    (status === 'danger'
      ? 'text-[#E0195B]'
      : status === 'warning'
      ? 'text-[#F8A41D]'
      : status === 'success'
      ? 'text-[#009966]'
      : 'text-primary');

  const statusTextColor =
    status === 'danger'
      ? 'text-[#C60036] dark:text-rose-300'
      : status === 'warning'
      ? 'text-[#704A0D] dark:text-amber-300'
      : status === 'success'
      ? 'text-[#007A52] dark:text-emerald-300'
      : 'text-sec dark:text-white';

  const heightClass = size === 'xs' ? 'h-1.5' : size === 'md' ? 'h-3' : 'h-2';

  const bar = (
    <div
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
      className={cn('w-full rounded-full overflow-hidden flex-1', trackClassName, heightClass, !showLabel && className)}
    >
      <svg
        viewBox="0 0 100 10"
        preserveAspectRatio="none"
        className="w-full h-full block -scale-x-100"
        aria-hidden="true"
      >
        <rect
          x="0"
          y="0"
          width={percent}
          height="10"
          rx="5"
          className={cn('fill-current transition-all duration-300', statusColor)}
        />
      </svg>
    </div>
  );

  if (!showLabel) {
    return bar;
  }

  return (
    <div className={cn('flex items-center gap-2.5 w-full', className)}>
      {bar}
      <span className={cn('text-xs font-black tabular-nums shrink-0', statusTextColor, labelClassName)}>
        {toPersianDigits(percent.toFixed(1))}٪
      </span>
    </div>
  );
};
