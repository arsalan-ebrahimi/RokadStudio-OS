import React from 'react';
import { cn } from '@/shared/lib/utils';
import { toPersianDigits } from '@/shared/lib/formatters';
import type { AttendanceTotals } from '../types';

interface AttendanceTotalsPillsProps {
  totals?: AttendanceTotals | null;
  compact?: boolean;
  className?: string;
}

export const AttendanceTotalsPills: React.FC<AttendanceTotalsPillsProps> = ({
  totals,
  compact = false,
  className,
}) => {
  if (!totals) return null;

  if (compact) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gray-50 dark:bg-[#182030] border border-sec/15 dark:border-gray-700 text-[11px] font-bold text-ink-normal/80 dark:text-gray-300 tabular-nums whitespace-nowrap',
          className
        )}
      >
        <span className="text-[#007A52] dark:text-emerald-400">
          {toPersianDigits(totals.present)} روز حاضر
        </span>
        {totals.pending > 0 && (
          <>
            <span className="opacity-40">·</span>
            <span className="text-[#9C660D] dark:text-amber-300">
              {toPersianDigits(totals.pending)} در انتظار
            </span>
          </>
        )}
        <span className="opacity-40">·</span>
        <span className="text-[#C60036] dark:text-rose-400">
          {toPersianDigits(totals.absent)} روز غایب
        </span>
      </span>
    );
  }

  return (
    <div className={cn('flex items-center gap-1.5 flex-wrap tabular-nums', className)}>
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-ecosystem-light/80 dark:bg-emerald-950/40 text-[#007A52] dark:text-emerald-300 border border-[#007A52]/25 text-[11px] font-black">
        <span className="w-1.5 h-1.5 rounded-full bg-[#007A52] dark:bg-emerald-400" />
        <span>{toPersianDigits(totals.present)} روز حاضر</span>
      </span>
      {totals.pending > 0 && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-college-light/80 dark:bg-amber-950/40 text-[#704A0D] dark:text-amber-200 border border-college-normal/40 text-[11px] font-black">
          <span className="w-1.5 h-1.5 rounded-full bg-college-normal" />
          <span>{toPersianDigits(totals.pending)} در انتظار</span>
        </span>
      )}
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-[#C60036] dark:text-rose-300 border border-rose-300/60 dark:border-rose-800/60 text-[11px] font-black">
        <span className="w-1.5 h-1.5 rounded-full bg-[#C60036] dark:bg-rose-400" />
        <span>{toPersianDigits(totals.absent)} روز غایب</span>
      </span>
    </div>
  );
};

