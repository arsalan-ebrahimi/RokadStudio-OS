import React, { useMemo } from 'react';
import {
  Check,
  Clock,
  X,
  ChevronRight,
  ChevronLeft,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { toPersianDigits } from '@/shared/lib/formatters';
import { type JalaliMonthCalendarInfo } from '@/shared/lib/date';
import { ErrorState, Skeleton } from '@/shared/ui';
import type {
  AttendanceTotals,
  MemberCalendarDay,
  MemberCalendarDayState,
} from '../types';
import { AttendanceTotalsPills } from './AttendanceTotalsPills';

const WEEKDAYS_FULL = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنج‌شنبه',
  'جمعه',
] as const;

const WEEKDAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] as const;

interface ActivityCalendarProps {
  calendarInfo: JalaliMonthCalendarInfo;
  days?: MemberCalendarDay[];
  totals?: AttendanceTotals;
  todayIso: string;
  selectedDate: string | null;
  onSelect: (isoDate: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday?: () => void;
  onPresetWeek?: () => void;
  onPresetMonth?: () => void;
  activePreset?: 'TODAY' | 'WEEK' | 'MONTH' | null;
  showAttendance?: boolean;
  compact?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  onRetry?: () => void;
}

function getStateCellClasses(state: MemberCalendarDayState | undefined, showAttendance: boolean): string {
  if (!showAttendance || !state || state === 'NONE') {
    return 'bg-white dark:bg-[#151C28] border-sec/15 dark:border-gray-800 hover:border-sec/40 dark:hover:border-gray-600';
  }
  switch (state) {
    case 'PRESENT_APPROVED':
      return 'bg-ecosystem-light/55 dark:bg-emerald-950/25 border-[#007A52]/30 dark:border-emerald-700/50 hover:border-[#007A52]/60';
    case 'PRESENT_PENDING':
      return 'bg-college-light/55 dark:bg-amber-950/25 border-college-normal/45 dark:border-amber-700/50 hover:border-college-normal';
    case 'ABSENT':
    case 'REJECTED':
      return 'bg-rose-50/70 dark:bg-rose-950/25 border-rose-300/60 dark:border-rose-800/50 hover:border-rose-400';
    default:
      return 'bg-white dark:bg-[#151C28] border-sec/15 dark:border-gray-800';
  }
}

function getStateTitle(state: MemberCalendarDayState | undefined): string {
  switch (state) {
    case 'PRESENT_APPROVED':
      return 'حاضر (تایید شده)';
    case 'PRESENT_PENDING':
      return 'حاضر (در انتظار تایید)';
    case 'ABSENT':
      return 'غایب';
    case 'REJECTED':
      return 'حضور ردشده';
    default:
      return 'وضعیت ثبت نشده';
  }
}

export const ActivityCalendar: React.FC<ActivityCalendarProps> = ({
  calendarInfo,
  days = [],
  totals,
  todayIso,
  selectedDate,
  onSelect,
  onPrevMonth,
  onNextMonth,
  onToday,
  onPresetWeek,
  onPresetMonth,
  activePreset = null,
  showAttendance = true,
  compact = false,
  isLoading = false,
  isError = false,
  error,
  onRetry,
}) => {
  const dayMap = useMemo(() => {
    const map = new Map<string, MemberCalendarDay>();
    for (const d of days) {
      map.set(d.date, d);
    }
    return map;
  }, [days]);

  return (
    <div className="space-y-3">
      {/* Month Bar & Quick Jumps */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onPrevMonth}
            className="min-h-[38px] px-2.5 rounded-xl border-[1.5px] border-sec/20 dark:border-gray-700 bg-white dark:bg-[#182030] text-xs font-black text-sec dark:text-white hover:border-sec/50 flex items-center gap-1 cursor-pointer transition-colors"
            aria-label="ماه قبل"
            title="ماه قبل"
          >
            <ChevronRight className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">ماه قبل</span>
          </button>

          <div className="px-3 min-h-[38px] rounded-xl bg-gray-50 dark:bg-[#182030] border border-sec/15 dark:border-gray-700 flex items-center gap-1.5">
            <CalendarIcon className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-xs sm:text-sm font-black text-sec dark:text-white whitespace-nowrap tabular-nums">
              {calendarInfo.monthName} {toPersianDigits(calendarInfo.jy)}
            </span>
          </div>

          <button
            type="button"
            onClick={onNextMonth}
            className="min-h-[38px] px-2.5 rounded-xl border-[1.5px] border-sec/20 dark:border-gray-700 bg-white dark:bg-[#182030] text-xs font-black text-sec dark:text-white hover:border-sec/50 flex items-center gap-1 cursor-pointer transition-colors"
            aria-label="ماه بعد"
            title="ماه بعد"
          >
            <span className="hidden sm:inline">ماه بعد</span>
            <ChevronLeft className="w-4 h-4 shrink-0" />
          </button>
        </div>

        {(onToday || onPresetWeek || onPresetMonth) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {onToday && (
              <button
                type="button"
                onClick={onToday}
                className={cn(
                  'min-h-[36px] px-2.5 rounded-xl border text-[11px] font-black transition-all cursor-pointer',
                  activePreset === 'TODAY'
                    ? 'bg-primary text-sec border-sec shadow-hard-sm'
                    : 'bg-white dark:bg-[#182030] border-sec/20 dark:border-gray-700 text-sec dark:text-gray-200 hover:border-primary'
                )}
              >
                امروز
              </button>
            )}
            {onPresetWeek && (
              <button
                type="button"
                onClick={onPresetWeek}
                className={cn(
                  'min-h-[36px] px-2.5 rounded-xl border text-[11px] font-black transition-all cursor-pointer',
                  activePreset === 'WEEK'
                    ? 'bg-primary text-sec border-sec shadow-hard-sm'
                    : 'bg-white dark:bg-[#182030] border-sec/20 dark:border-gray-700 text-sec dark:text-gray-200 hover:border-primary'
                )}
              >
                این هفته
              </button>
            )}
            {onPresetMonth && (
              <button
                type="button"
                onClick={onPresetMonth}
                className={cn(
                  'min-h-[36px] px-2.5 rounded-xl border text-[11px] font-black transition-all cursor-pointer',
                  activePreset === 'MONTH'
                    ? 'bg-primary text-sec border-sec shadow-hard-sm'
                    : 'bg-white dark:bg-[#182030] border-sec/20 dark:border-gray-700 text-sec dark:text-gray-200 hover:border-primary'
                )}
              >
                این ماه
              </button>
            )}
          </div>
        )}
      </div>

      {/* Monthly Attendance Totals Strip */}
      {showAttendance && totals && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <AttendanceTotalsPills totals={totals} compact />
          <span className="text-[10px] font-bold text-ink-normal/55 dark:text-gray-400">
            برای مشاهده جزئیات روی هر روز کلیک کنید
          </span>
        </div>
      )}

      {/* Calendar Grid or Error/Loading */}
      {isError ? (
        <ErrorState
          compact
          title="خطا در دریافت تقویم فعالیت"
          message={error instanceof Error ? error.message : 'لطفاً دوباره تلاش کنید.'}
          onRetry={onRetry}
        />
      ) : (
        <div className="space-y-1.5">
          {/* Weekday Headers (Sat..Fri) */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {WEEKDAYS_FULL.map((fullLabel, idx) => (
              <div
                key={fullLabel}
                className={cn(
                  'py-1.5 text-center text-[10px] sm:text-[11px] font-black rounded-lg',
                  idx === 6
                    ? 'text-[#C60036] dark:text-rose-300 bg-rose-50/60 dark:bg-rose-950/20'
                    : 'text-sec/70 dark:text-gray-400 bg-gray-100/70 dark:bg-[#182030]'
                )}
              >
                <span className={compact ? 'hidden sm:inline' : 'hidden sm:inline'}>
                  {fullLabel}
                </span>
                <span className="sm:hidden">{WEEKDAYS_SHORT[idx]}</span>
              </div>
            ))}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {calendarInfo.cells.map((cell) => (
                <Skeleton
                  key={cell.iso}
                  className={cn(
                    'w-full rounded-xl',
                    compact ? 'h-[50px] sm:h-[58px]' : 'h-[56px] sm:h-[68px]'
                  )}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {calendarInfo.cells.map((cell) => {
                const dayData = dayMap.get(cell.iso);
                const state = dayData?.state;
                const isSelected = selectedDate === cell.iso;
                const isToday = todayIso === cell.iso;
                const sessionCount = dayData?.sessionCount ?? 0;
                const taskCount = dayData?.taskCount ?? 0;
                const projectCount = dayData?.projectCount ?? 0;

                const tooltipParts = [
                  `${toPersianDigits(cell.jd)} ${calendarInfo.monthName}`,
                  showAttendance ? getStateTitle(state) : null,
                  sessionCount > 0 ? `${toPersianDigits(sessionCount)} سشن` : null,
                  taskCount > 0 ? `${toPersianDigits(taskCount)} تسک` : null,
                  projectCount > 0 ? `${toPersianDigits(projectCount)} پروژه` : null,
                ].filter(Boolean);

                return (
                  <button
                    key={cell.iso}
                    type="button"
                    onClick={() => onSelect(cell.iso)}
                    title={tooltipParts.join(' · ')}
                    aria-pressed={isSelected}
                    className={cn(
                      'relative rounded-xl border-[1.5px] p-1 sm:p-1.5 flex flex-col justify-between text-start transition-all cursor-pointer select-none overflow-hidden',
                      compact ? 'min-h-[50px] sm:min-h-[58px]' : 'min-h-[56px] sm:min-h-[68px]',
                      getStateCellClasses(state, showAttendance),
                      !cell.inMonth && 'opacity-45',
                      isToday && !isSelected && 'ring-1 ring-primary border-primary',
                      isSelected &&
                        'ring-2 ring-sec dark:ring-primary border-sec dark:border-primary shadow-hard-sm z-10'
                    )}
                  >
                    {/* Top Row: Day number + Attendance Corner Icon */}
                    <div className="flex items-start justify-between gap-0.5 w-full">
                      <span
                        className={cn(
                          'text-[11px] sm:text-xs font-black tabular-nums leading-none px-1 py-0.5 rounded-md',
                          isToday
                            ? 'bg-primary text-sec'
                            : cell.dayOfWeekSat0 === 6
                              ? 'text-[#C60036] dark:text-rose-300'
                              : 'text-sec dark:text-white'
                        )}
                      >
                        {toPersianDigits(cell.jd)}
                      </span>

                      {showAttendance && state && state !== 'NONE' && (
                        <span
                          className={cn(
                            'w-4 h-4 rounded-full flex items-center justify-center shrink-0',
                            state === 'PRESENT_APPROVED' &&
                              'bg-[#007A52]/15 text-[#007A52] dark:text-emerald-300',
                            state === 'PRESENT_PENDING' &&
                              'bg-college-normal/25 text-[#9C5700] dark:text-amber-300',
                            (state === 'ABSENT' || state === 'REJECTED') &&
                              'bg-[#C60036]/15 text-[#C60036] dark:text-rose-300'
                          )}
                          aria-label={getStateTitle(state)}
                        >
                          {state === 'PRESENT_APPROVED' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          {state === 'PRESENT_PENDING' && <Clock className="w-2.5 h-2.5 stroke-[2.5]" />}
                          {(state === 'ABSENT' || state === 'REJECTED') && (
                            <X className="w-2.5 h-2.5 stroke-[3]" />
                          )}
                        </span>
                      )}
                    </div>

                    {/* Bottom Row: Activity counters */}
                    {sessionCount > 0 ? (
                      <div className="flex items-center gap-1 flex-wrap mt-auto pt-1 w-full">
                        <span className="inline-flex items-center px-1 sm:px-1.5 py-0.5 rounded-md bg-sec/10 dark:bg-white/10 text-[9px] sm:text-[10px] font-black text-sec dark:text-primary tabular-nums leading-none">
                          {toPersianDigits(sessionCount)} س
                        </span>
                        {!compact && taskCount > 0 && (
                          <span className="hidden sm:inline-flex items-center px-1 py-0.5 rounded-md bg-club-light/80 dark:bg-club-darker/50 text-[9px] font-black text-club-normal dark:text-purple-200 tabular-nums leading-none">
                            {toPersianDigits(taskCount)} ت
                          </span>
                        )}
                        {!compact && projectCount > 0 && (
                          <span className="hidden sm:inline-flex items-center px-1 py-0.5 rounded-md bg-ecosystem-light dark:bg-ecosystem-darker/50 text-[9px] font-black text-sec dark:text-ecosystem-light tabular-nums leading-none">
                            {toPersianDigits(projectCount)} پ
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="h-3" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Compact Legend */}
          {showAttendance && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1.5 text-[10px] font-bold text-ink-normal/65 dark:text-gray-400">
              <span className="inline-flex items-center gap-1">
                <Check className="w-3 h-3 text-[#007A52] dark:text-emerald-400 stroke-[3]" />
                <span>حاضر تأییدشده</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3 text-college-normal stroke-[2.5]" />
                <span>در انتظار تأیید</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <X className="w-3 h-3 text-[#C60036] dark:text-rose-400 stroke-[3]" />
                <span>غایب / ردشده</span>
              </span>
              <span className="text-ink-normal/45 dark:text-gray-500 tabular-nums">
                س: سشن · ت: تسک · پ: پروژه
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

