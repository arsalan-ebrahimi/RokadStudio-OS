import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  FolderKanban,
  ListChecks,
  MessageSquareText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Badge, EmptyState, ErrorState, Skeleton } from '@/shared/ui';
import { SessionBadge } from '@/features/timer/components/SessionBadge';
import { SCRUM_COLOR_MAP } from '@/features/scrum/types/scrum-types';
import { formatToJalali, formatTehranTime } from '@/shared/lib/date';
import { formatDurationToHoursMins, toPersianDigits } from '@/shared/lib/formatters';
import type { DecisionSource } from '@/shared/types/models';
import type { MemberCalendarDayState, MemberDayResponse } from '../types';

interface MemberDayPanelProps {
  date: string;
  dayData?: MemberDayResponse;
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  onRetry?: () => void;
  showAttendance?: boolean;
  canViewProjects?: boolean;
}

function renderAttendanceStateBadge(state?: MemberCalendarDayState) {
  switch (state) {
    case 'PRESENT_APPROVED':
      return <Badge variant="ecosystem" dot>حاضر تأییدشده</Badge>;
    case 'PRESENT_PENDING':
      return <Badge variant="college" dot>حاضر (در انتظار تأیید)</Badge>;
    case 'ABSENT':
      return <Badge variant="female" dot>غایب</Badge>;
    case 'REJECTED':
      return <Badge variant="female" dot>حضور ردشده</Badge>;
    default:
      return <Badge variant="neutral">ثبت نشده</Badge>;
  }
}

function formatSourceLabel(source?: DecisionSource): string {
  switch (source) {
    case 'USER':
      return 'ثبت توسط کاربر';
    case 'ADMIN':
      return 'ثبت/تغییر توسط ادمین';
    case 'SYSTEM':
      return 'ثبت سیستمی';
    default:
      return '';
  }
}

export const MemberDayPanel: React.FC<MemberDayPanelProps> = ({
  date,
  dayData,
  isLoading = false,
  isError = false,
  error,
  onRetry,
  showAttendance = true,
  canViewProjects = true,
}) => {
  const [noteExpanded, setNoteExpanded] = useState(false);

  const sessions = dayData?.sessions || [];
  const tasks = dayData?.tasks || [];
  const projects = canViewProjects ? dayData?.projects || [] : [];
  const attendance = dayData?.attendance;

  const nonRejectedSeconds = sessions
    .filter((s) => s.approval !== 'REJECTED')
    .reduce((acc, s) => acc + (s.durationSeconds || 0), 0);

  const workNoteText = attendance?.workNote?.trim() || '';
  const isLongNote = workNoteText.length > 110 || workNoteText.includes('\n');

  return (
    <div className="space-y-4 rounded-2xl border-[1.5px] border-sec/15 dark:border-gray-700 bg-gray-50/70 dark:bg-[#151C28] p-3.5 sm:p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-sec/10 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs sm:text-sm font-black text-sec dark:text-white">
            {formatToJalali(date, true)}
          </span>
        </div>

        {!isLoading && !isError && dayData && (
          <div className="flex items-center gap-2 text-xs font-bold tabular-nums">
            <span className="px-2.5 py-0.5 rounded-full bg-white dark:bg-[#182030] border border-sec/15 dark:border-gray-700 text-sec dark:text-gray-200">
              {toPersianDigits(sessions.length)} سشن
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-ecosystem-light dark:bg-ecosystem-darker/50 border border-primary/35 text-sec dark:text-primary font-black">
              {formatDurationToHoursMins(nonRejectedSeconds)}
            </span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2.5">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : isError ? (
        <ErrorState
          compact
          title="خطا در دریافت جزئیات این روز"
          message={error instanceof Error ? error.message : 'لطفاً دوباره تلاش کنید.'}
          onRetry={onRetry}
        />
      ) : !dayData ? null : (
        <div className="space-y-4">
          {/* Attendance & Work Note */}
          {showAttendance && (
            <div className="rounded-2xl bg-white dark:bg-[#182030] border border-sec/15 dark:border-gray-700 p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-ink-normal/65 dark:text-gray-400">
                    وضعیت حضور:
                  </span>
                  {renderAttendanceStateBadge(attendance?.state)}
                </div>
                {attendance?.source && (
                  <span className="text-[11px] font-bold text-ink-normal/55 dark:text-gray-400">
                    {formatSourceLabel(attendance.source)}
                  </span>
                )}
              </div>

              {workNoteText && (
                <div className="p-2.5 rounded-xl bg-amber-50/75 dark:bg-amber-950/25 border border-college-normal/35 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-[11px] font-black text-[#704A0D] dark:text-amber-300">
                    <span className="inline-flex items-center gap-1.5">
                      <MessageSquareText className="w-3.5 h-3.5 shrink-0" />
                      <span>موانع و چالش‌های ثبت‌شده</span>
                    </span>
                    {attendance?.workNoteAt && (
                      <span className="text-[10px] font-bold opacity-80 tabular-nums">
                        ساعت {toPersianDigits(formatTehranTime(attendance.workNoteAt))}
                      </span>
                    )}
                  </div>
                  <p
                    className={
                      noteExpanded
                        ? 'text-xs text-sec dark:text-gray-200 leading-relaxed whitespace-pre-line'
                        : 'text-xs text-sec dark:text-gray-200 leading-relaxed line-clamp-2'
                    }
                  >
                    {workNoteText}
                  </p>
                  {isLongNote && (
                    <button
                      type="button"
                      onClick={() => setNoteExpanded((v) => !v)}
                      className="inline-flex items-center gap-1 text-[10px] font-black text-sec dark:text-primary hover:underline cursor-pointer"
                    >
                      {noteExpanded ? (
                        <>
                          <span>نمایش کمتر</span>
                          <ChevronUp className="w-3 h-3" />
                        </>
                      ) : (
                        <>
                          <span>نمایش کامل</span>
                          <ChevronDown className="w-3 h-3" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tasks Breakdown */}
          {tasks.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-[11px] font-black text-sec/75 dark:text-gray-300 flex items-center gap-1.5">
                <ListChecks className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>تسک‌های اسکرام ({toPersianDigits(tasks.length)})</span>
              </h5>
              <div className="space-y-1.5">
                {tasks.map((t) => {
                  const colorMeta = SCRUM_COLOR_MAP[t.scrum.color] || SCRUM_COLOR_MAP.ECOSYSTEM;
                  return (
                    <div
                      key={t.task.id}
                      className="p-2.5 rounded-xl bg-white dark:bg-[#182030] border border-sec/15 dark:border-gray-700 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="text-xs font-black text-sec dark:text-white truncate">
                          {t.task.name}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant={colorMeta.badgeVariant} className="text-[10px] py-0 px-2">
                            {t.scrum.name}
                          </Badge>
                          {t.sprint && (
                            <Badge variant="neutral" className="text-[10px] py-0 px-2 tabular-nums">
                              S{toPersianDigits(t.sprint.number)}
                            </Badge>
                          )}
                          <span className="text-[10px] font-bold text-ink-normal/60 dark:text-gray-400 tabular-nums">
                            {toPersianDigits(t.points)} پوینت
                          </span>
                        </div>
                      </div>
                      <div className="text-end shrink-0 tabular-nums">
                        <span className="block text-xs font-black text-sec dark:text-primary">
                          {formatDurationToHoursMins(t.totalSeconds)}
                        </span>
                        <span className="block text-[10px] font-bold text-ink-normal/55 dark:text-gray-400">
                          {toPersianDigits(t.sessionCount)} سشن
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Studio Projects Breakdown */}
          {projects.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-[11px] font-black text-sec/75 dark:text-gray-300 flex items-center gap-1.5">
                <FolderKanban className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>پروژه‌های استودیو ({toPersianDigits(projects.length)})</span>
              </h5>
              <div className="space-y-1.5">
                {projects.map((p) => (
                  <div
                    key={p.project.id}
                    className="p-2.5 rounded-xl bg-white dark:bg-[#182030] border border-sec/15 dark:border-gray-700 flex items-center justify-between gap-2"
                  >
                    <span className="text-xs font-black text-sec dark:text-white truncate">
                      {p.project.name}
                    </span>
                    <div className="text-end shrink-0 tabular-nums">
                      <span className="block text-xs font-black text-sec dark:text-primary">
                        {formatDurationToHoursMins(p.totalSeconds)}
                      </span>
                      <span className="block text-[10px] font-bold text-ink-normal/55 dark:text-gray-400">
                        {toPersianDigits(p.sessionCount)} سشن
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sessions List */}
          <div className="space-y-2">
            <h5 className="text-[11px] font-black text-sec/75 dark:text-gray-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>سشن‌های این روز ({toPersianDigits(sessions.length)})</span>
            </h5>

            {sessions.length === 0 ? (
              <EmptyState
                className="p-5 sm:p-6"
                title="در این روز فعالیتی ثبت نشده است"
                description="سشن کاری برای این تاریخ وجود ندارد."
              />
            ) : (
              <div className="space-y-1.5">
                {sessions.map((s) => {
                  const isTask = s.target.kind === 'TASK';
                  const scrumMeta =
                    s.target.kind === 'TASK'
                      ? SCRUM_COLOR_MAP[s.target.scrum.color] || SCRUM_COLOR_MAP.ECOSYSTEM
                      : null;

                  return (
                    <div
                      key={s.id}
                      className="p-2.5 rounded-xl bg-white dark:bg-[#182030] border border-sec/15 dark:border-gray-700 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isTask ? (
                            <ListChecks className="w-3.5 h-3.5 text-primary shrink-0" />
                          ) : (
                            <FolderKanban className="w-3.5 h-3.5 text-primary shrink-0" />
                          )}
                          <span className="text-xs font-black text-sec dark:text-white truncate">
                            {s.target.name}
                          </span>
                          {s.target.kind === 'TASK' && scrumMeta && (
                            <Badge variant={scrumMeta.badgeVariant} className="text-[10px] py-0 px-2">
                              {s.target.scrum.name}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap text-[10px] font-bold text-ink-normal/60 dark:text-gray-400 tabular-nums">
                          <SessionBadge approval={s.approval} className="text-[10px] py-0 px-2" />
                          <span>•</span>
                          <span>ثبت: {toPersianDigits(formatTehranTime(s.createdAt))}</span>
                        </div>
                      </div>

                      <span className="text-xs font-black text-sec dark:text-primary shrink-0 tabular-nums">
                        {formatDurationToHoursMins(s.durationSeconds)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
