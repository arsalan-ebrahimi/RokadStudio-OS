import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  FolderKanban,
  ListChecks,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Modal,
  PersianDatePicker,
  SegmentedControl,
  Select,
  Skeleton,
  toast,
} from '@/shared/ui';
import { SessionBadge } from './SessionBadge';
import { SessionDecisionDialog } from './SessionDecisionDialog';
import { DeleteSessionDialog } from './DeleteSessionDialog';
import {
  decideWorkSession,
  deleteWorkSession,
  fetchWorkTargetSessions,
} from '../api/timer-api';
import { formatDurationToHoursMins, toPersianDigits } from '@/shared/lib/formatters';
import {
  formatToJalali,
  getJalaliMonthRange,
  getJalaliWeekRange,
  getTehranTodayString,
} from '@/shared/lib/date';
import { cn } from '@/shared/lib/utils';
import type {
  ApprovalStatus,
  ScrumColor,
  WorkSession,
  WorkTargetKind,
} from '@/shared/types/models';

export interface WorkTargetSessionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetKind: WorkTargetKind;
  targetId: number | null;
  initialTitle?: string;
  initialDescription?: string | null;
  scrumName?: string;
  scrumColor?: ScrumColor;
  points?: number;
}

type DatePreset = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'SINGLE' | 'RANGE';
type ApprovalFilter = 'ALL' | ApprovalStatus;

const SCRUM_COLOR_BADGE_VARIANT: Record<
  ScrumColor,
  'ecosystem' | 'male' | 'female' | 'college' | 'club'
> = {
  ECOSYSTEM: 'ecosystem',
  MALE: 'male',
  FEMALE: 'female',
  COLLEGE: 'college',
  CLUB: 'club',
};

const DATE_PRESET_OPTIONS: { value: DatePreset; label: string }[] = [
  { value: 'ALL', label: 'همه تاریخ‌ها' },
  { value: 'TODAY', label: 'امروز' },
  { value: 'WEEK', label: 'این هفته' },
  { value: 'MONTH', label: 'این ماه' },
  { value: 'SINGLE', label: 'یک روز خاص' },
  { value: 'RANGE', label: 'بازه زمانی' },
];

export const WorkTargetSessionsModal: React.FC<WorkTargetSessionsModalProps> = ({
  isOpen,
  onClose,
  targetKind,
  targetId,
  initialTitle,
  initialDescription,
  scrumName,
  scrumColor,
  points,
}) => {
  const queryClient = useQueryClient();
  const todayIso = useMemo(() => getTehranTodayString(), []);
  const weekRange = useMemo(() => getJalaliWeekRange(todayIso), [todayIso]);

  const [datePreset, setDatePreset] = useState<DatePreset>('ALL');
  const [singleDate, setSingleDate] = useState<string>(todayIso);
  const [rangeFrom, setRangeFrom] = useState<string>(weekRange.from);
  const [rangeTo, setRangeTo] = useState<string>(todayIso);
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>('ALL');
  const [selectedUserId, setSelectedUserId] = useState<number | undefined>(undefined);
  const [page, setPage] = useState<number>(1);

  const [activeDecision, setActiveDecision] = useState<{
    id: number;
    decision: 'APPROVED' | 'REJECTED';
    info: string;
  } | null>(null);
  const [deletingSession, setDeletingSession] = useState<{
    id: number;
    info: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDatePreset('ALL');
    setSingleDate(todayIso);
    setRangeFrom(weekRange.from);
    setRangeTo(todayIso);
    setApprovalFilter('ALL');
    setSelectedUserId(undefined);
    setPage(1);
    setActiveDecision(null);
    setDeletingSession(null);
  }, [isOpen, targetKind, targetId, todayIso, weekRange.from]);

  const queryParams = useMemo(() => {
    let date: string | undefined;
    let dateFrom: string | undefined;
    let dateTo: string | undefined;

    if (datePreset === 'TODAY') {
      date = todayIso;
    } else if (datePreset === 'WEEK') {
      const range = getJalaliWeekRange(todayIso);
      dateFrom = range.from;
      dateTo = range.to;
    } else if (datePreset === 'MONTH') {
      const range = getJalaliMonthRange(todayIso);
      dateFrom = range.from;
      dateTo = range.to;
    } else if (datePreset === 'SINGLE') {
      date = singleDate;
    } else if (datePreset === 'RANGE') {
      if (rangeFrom <= rangeTo) {
        dateFrom = rangeFrom;
        dateTo = rangeTo;
      } else {
        dateFrom = rangeTo;
        dateTo = rangeFrom;
      }
    }

    return {
      date,
      dateFrom,
      dateTo,
      approval: approvalFilter !== 'ALL' ? approvalFilter : undefined,
      userId: selectedUserId,
      page,
      limit: 20,
    };
  }, [datePreset, todayIso, singleDate, rangeFrom, rangeTo, approvalFilter, selectedUserId, page]);

  const sessionsQuery = useQuery({
    queryKey: ['work-target-sessions', targetKind, targetId, queryParams],
    queryFn: () => fetchWorkTargetSessions(targetKind, targetId as number, queryParams),
    enabled: isOpen && Boolean(targetId),
  });

  const invalidateAfterMutation = () => {
    queryClient.invalidateQueries({ queryKey: ['work-target-sessions'] });
    queryClient.invalidateQueries({ queryKey: ['scrum-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['scrum'] });
    queryClient.invalidateQueries({ queryKey: ['scrums'] });
    queryClient.invalidateQueries({ queryKey: ['scrum-admin', 'dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['admin-work-sessions'] });
    queryClient.invalidateQueries({ queryKey: ['admin-attendance'] });
    queryClient.invalidateQueries({ queryKey: ['reports-summary'] });
    queryClient.invalidateQueries({ queryKey: ['my-sessions-today'] });
  };

  const decideMut = useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: 'APPROVED' | 'REJECTED' }) =>
      decideWorkSession(id, decision),
    onSuccess: () => {
      setActiveDecision(null);
      invalidateAfterMutation();
      toast.success('وضعیت سشن با موفقیت تغییر کرد');
    },
    onError: (err: Error) => {
      setActiveDecision(null);
      toast.error(err.message || 'خطا در تغییر وضعیت سشن');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteWorkSession(id),
    onSuccess: () => {
      setDeletingSession(null);
      invalidateAfterMutation();
      toast.success('سشن کاری با موفقیت حذف شد');
    },
    onError: (err: Error) => {
      setDeletingSession(null);
      toast.error(err.message || 'خطا در حذف سشن کاری');
    },
  });

  const payload = sessionsQuery.data?.data;
  const meta = sessionsQuery.data?.meta;
  const targetInfo = payload?.target;
  const permissions = payload?.permissions;
  const summary = payload?.summary;
  const sessions = payload?.sessions || [];

  const title = targetInfo?.name || initialTitle || (targetKind === 'PROJECT' ? 'پروژه' : 'تسک');
  const description = targetInfo?.description ?? initialDescription;
  const effectiveScrum = targetInfo?.scrum ?? (scrumName ? { id: 0, name: scrumName, color: scrumColor || 'ECOSYSTEM' } : undefined);
  const effectivePoints = targetInfo?.points ?? points;

  const approvalOptions = useMemo(
    () => [
      {
        value: 'ALL' as const,
        label: `همه (${toPersianDigits(summary?.sessionCount ?? 0)})`,
      },
      {
        value: 'APPROVED' as const,
        label: `تایید شده (${toPersianDigits(summary?.approvedCount ?? 0)})`,
      },
      {
        value: 'PENDING' as const,
        label: `در انتظار (${toPersianDigits(summary?.pendingCount ?? 0)})`,
      },
      {
        value: 'REJECTED' as const,
        label: `رد شده (${toPersianDigits(summary?.rejectedCount ?? 0)})`,
      },
    ],
    [summary],
  );

  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    setPage(1);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`گزارش کار روی ${targetKind === 'PROJECT' ? 'پروژه' : 'تسک'}: ${title}`}
        className="max-w-3xl"
      >
        <div className="space-y-4 max-h-[76vh] overflow-y-auto pe-1">
          {/* Target header metadata */}
          <div className="p-3.5 rounded-2xl border-[1.5px] border-sec/15 dark:border-gray-700 bg-[#F8FAFC] dark:bg-[#182030] space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/40 flex items-center justify-center shrink-0">
                  {targetKind === 'PROJECT' ? (
                    <FolderKanban className="w-4 h-4 text-sec dark:text-primary" />
                  ) : (
                    <ListChecks className="w-4 h-4 text-sec dark:text-primary" />
                  )}
                </span>
                <span className="text-sm font-black text-sec dark:text-white truncate">{title}</span>
                {targetKind === 'PROJECT' ? (
                  <Badge variant="neutral">پروژه استودیو</Badge>
                ) : (
                  effectiveScrum && (
                    <Badge variant={SCRUM_COLOR_BADGE_VARIANT[effectiveScrum.color]} dot>
                      {effectiveScrum.name}
                    </Badge>
                  )
                )}
                {targetKind === 'TASK' && typeof effectivePoints === 'number' && (
                  <Badge variant="college">{toPersianDigits(effectivePoints)} پوینت</Badge>
                )}
              </div>

              {targetInfo && (
                <Badge variant={targetInfo.isActive ? 'ecosystem' : 'neutral'}>
                  {targetInfo.isActive ? 'فعال' : 'غیرفعال'}
                </Badge>
              )}
            </div>

            {description && (
              <p className="text-xs text-sec/70 dark:text-gray-300 leading-relaxed">{description}</p>
            )}
          </div>

          {/* Date filters */}
          <div className="space-y-2.5 p-3.5 rounded-2xl border-[1.5px] border-sec/15 dark:border-gray-700 bg-white dark:bg-[#151C28]">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-black text-sec/70 dark:text-gray-400 me-1">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                بازه تاریخ:
              </span>
              {DATE_PRESET_OPTIONS.map((opt) => {
                const active = datePreset === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleDatePresetChange(opt.value)}
                    className={cn(
                      'px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer',
                      active
                        ? 'bg-primary text-sec border-sec shadow-[1.5px_1.5px_0_#202A5A]'
                        : 'bg-[#F8FAFC] dark:bg-gray-800 text-sec/75 dark:text-gray-300 border-sec/15 dark:border-gray-700 hover:bg-primary/15',
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {datePreset === 'SINGLE' && (
              <div className="pt-1 flex flex-wrap items-end gap-3">
                <PersianDatePicker
                  label="انتخاب تاریخ"
                  size="sm"
                  value={singleDate}
                  onChange={(d) => {
                    setSingleDate(d);
                    setPage(1);
                  }}
                />
              </div>
            )}

            {datePreset === 'RANGE' && (
              <div className="pt-1 flex flex-wrap items-end gap-3">
                <PersianDatePicker
                  label="از تاریخ"
                  size="sm"
                  value={rangeFrom}
                  onChange={(d) => {
                    setRangeFrom(d);
                    setPage(1);
                  }}
                />
                <PersianDatePicker
                  label="تا تاریخ"
                  size="sm"
                  value={rangeTo}
                  onChange={(d) => {
                    setRangeTo(d);
                    setPage(1);
                  }}
                />
              </div>
            )}

            {/* Approval + Contributor filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-sec/10 dark:border-gray-800">
              <div className="overflow-x-auto pb-0.5">
                <SegmentedControl
                  size="sm"
                  aria-label="فیلتر وضعیت تایید"
                  options={approvalOptions}
                  value={approvalFilter}
                  onChange={(val) => {
                    setApprovalFilter(val);
                    setPage(1);
                  }}
                />
              </div>

              {permissions?.canViewAllUsers && summary && summary.byUser.length > 0 && (
                <div className="w-full sm:w-52">
                  <Select
                    selectSize="sm"
                    value={selectedUserId ? String(selectedUserId) : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedUserId(val ? Number(val) : undefined);
                      setPage(1);
                    }}
                    aria-label="فیلتر بر اساس فرد"
                  >
                    <option value="">همه افراد ({toPersianDigits(summary.byUser.length)})</option>
                    {summary.byUser.map((u) => (
                      <option key={u.user.id} value={u.user.id}>
                        {u.user.name} ({formatDurationToHoursMins(u.totalSeconds)})
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Loading / Error / Content */}
          {sessionsQuery.isLoading ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Array(4)
                  .fill(0)
                  .map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-2xl" />
                  ))}
              </div>
              {Array(3)
                .fill(0)
                .map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-2xl" />
                ))}
            </div>
          ) : sessionsQuery.isError ? (
            <ErrorState
              message={(sessionsQuery.error as Error)?.message || 'خطا در دریافت سشن‌های کاری'}
              onRetry={() => sessionsQuery.refetch()}
            />
          ) : (
            <>
              {/* Summary totals */}
              {summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-2xl border-[1.5px] border-sec/15 dark:border-gray-700 bg-[#F8FAFC] dark:bg-[#182030]">
                    <p className="text-[11px] font-bold text-sec/60 dark:text-gray-400">کل زمان ثبت‌شده</p>
                    <p className="text-sm font-black text-sec dark:text-white mt-0.5 tabular-nums">
                      {formatDurationToHoursMins(summary.totalSeconds)}
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl border-[1.5px] border-ecosystem-normal/40 bg-ecosystem-light/50 dark:bg-ecosystem-darker/30">
                    <p className="text-[11px] font-bold text-sec/70 dark:text-ecosystem-light/80">تایید شده</p>
                    <p className="text-sm font-black text-sec dark:text-ecosystem-light mt-0.5 tabular-nums">
                      {formatDurationToHoursMins(summary.approvedSeconds)}
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl border-[1.5px] border-college-normal/40 bg-college-light/50 dark:bg-college-darker/30">
                    <p className="text-[11px] font-bold text-[#704A0D] dark:text-amber-200/80">در انتظار</p>
                    <p className="text-sm font-black text-[#704A0D] dark:text-amber-200 mt-0.5 tabular-nums">
                      {formatDurationToHoursMins(summary.pendingSeconds)}
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl border-[1.5px] border-female-normal/35 bg-female-light/50 dark:bg-female-darker/30">
                    <p className="text-[11px] font-bold text-[#A81344] dark:text-rose-200/80">رد شده</p>
                    <p className="text-sm font-black text-[#A81344] dark:text-rose-200 mt-0.5 tabular-nums">
                      {formatDurationToHoursMins(summary.rejectedSeconds)}
                    </p>
                  </div>
                </div>
              )}

              {/* Contributors summary strip */}
              {permissions?.canViewAllUsers && summary && summary.byUser.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-black text-sec/75 dark:text-gray-300">مشارکت افراد در این بازه:</p>
                  <div className="flex flex-wrap gap-2">
                    {summary.byUser.map((entry) => {
                      const isSelected = selectedUserId === entry.user.id;
                      return (
                        <button
                          key={entry.user.id}
                          type="button"
                          onClick={() => {
                            setSelectedUserId(isSelected ? undefined : entry.user.id);
                            setPage(1);
                          }}
                          className={cn(
                            'px-3 py-1.5 rounded-xl border-[1.5px] text-xs transition-all cursor-pointer flex items-center gap-2',
                            isSelected
                              ? 'bg-primary text-sec border-sec shadow-[1.5px_1.5px_0_#202A5A]'
                              : 'bg-white dark:bg-[#182030] border-sec/20 dark:border-gray-700 text-sec dark:text-white hover:border-primary',
                          )}
                        >
                          <UserIcon className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-black">{entry.user.name}</span>
                          <span className="text-[11px] font-bold opacity-80 tabular-nums">
                            {formatDurationToHoursMins(entry.totalSeconds)}
                          </span>
                          <span className="text-[10px] font-bold opacity-65 tabular-nums">
                            ({toPersianDigits(entry.sessionCount)} سشن)
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sessions list */}
              {sessions.length === 0 ? (
                <EmptyState
                  title="سشن کاری یافت نشد"
                  description="در این بازه و فیلتر انتخاب‌شده، کارکردی ثبت نشده است."
                />
              ) : (
                <div className="space-y-2.5">
                  {sessions.map((s: WorkSession) => {
                    const ownerName = s.user?.name || 'کاربر';
                    const sessionInfo = `${ownerName} (${formatDurationToHoursMins(s.durationSeconds)})`;
                    const jalaliDate = s.workDate ? formatToJalali(s.workDate, true) : '—';
                    const startTime = s.startedAt
                      ? new Date(s.startedAt).toLocaleTimeString('fa-IR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—';

                    return (
                      <div
                        key={s.id}
                        className="p-3.5 rounded-2xl border-[1.5px] border-sec/20 dark:border-gray-700 bg-[#F8FAFC] dark:bg-[#182030] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <UserIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="text-xs font-black text-sec dark:text-white truncate">
                              {ownerName}
                            </span>
                            <SessionBadge approval={s.approval} />
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-sec/70 dark:text-gray-400 font-bold tabular-nums">
                            <span className="inline-flex items-center gap-1 text-sec dark:text-primary font-black">
                              <Clock className="w-3.5 h-3.5 text-primary" />
                              {formatDurationToHoursMins(s.durationSeconds)}
                            </span>
                            <span>•</span>
                            <span>{jalaliDate}</span>
                            <span>•</span>
                            <span>ساعت {toPersianDigits(startTime)}</span>
                          </div>

                          {s.decidedBy && (
                            <p className="text-[10px] font-bold text-sec/55 dark:text-gray-400">
                              بررسی‌شده توسط {s.decidedBy.name}
                            </p>
                          )}
                        </div>

                        {(s.canModerate || s.canDelete) && (
                          <div className="flex items-center justify-end gap-1.5 shrink-0 pt-2 sm:pt-0 border-t border-sec/10 dark:border-gray-700 sm:border-0 flex-wrap">
                            {s.canModerate && s.approval !== 'APPROVED' && (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() =>
                                  setActiveDecision({
                                    id: s.id,
                                    decision: 'APPROVED',
                                    info: sessionInfo,
                                  })
                                }
                                className="text-xs font-bold"
                              >
                                <Check className="w-3.5 h-3.5 me-1" />
                                {s.approval === 'REJECTED' ? 'تغییر به تایید' : 'تایید'}
                              </Button>
                            )}
                            {s.canModerate && s.approval !== 'REJECTED' && (
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() =>
                                  setActiveDecision({
                                    id: s.id,
                                    decision: 'REJECTED',
                                    info: sessionInfo,
                                  })
                                }
                                className="text-xs font-bold"
                              >
                                <X className="w-3.5 h-3.5 me-1" />
                                {s.approval === 'APPROVED' ? 'تغییر به رد' : 'رد'}
                              </Button>
                            )}
                            {s.canDelete && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-[#C60036] dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-300 dark:border-rose-900/50 text-xs font-bold"
                                onClick={() => setDeletingSession({ id: s.id, info: sessionInfo })}
                                aria-label="حذف سشن"
                              >
                                <Trash2 className="w-3.5 h-3.5 me-1" />
                                حذف
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {meta && meta.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 border-t border-sec/10 dark:border-gray-800">
                  <span className="text-xs font-bold text-sec/65 dark:text-gray-400 tabular-nums">
                    صفحه {toPersianDigits(meta.page)} از {toPersianDigits(meta.totalPages)} ({toPersianDigits(meta.total)} سشن)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={meta.page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronRight className="w-4 h-4 me-1" />
                      قبلی
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={meta.page >= meta.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      بعدی
                      <ChevronLeft className="w-4 h-4 ms-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>

      <SessionDecisionDialog
        isOpen={Boolean(activeDecision)}
        decision={activeDecision?.decision || null}
        targetInfo={activeDecision?.info || ''}
        isLoading={decideMut.isPending}
        onConfirm={() => activeDecision && decideMut.mutate(activeDecision)}
        onCancel={() => setActiveDecision(null)}
      />

      <DeleteSessionDialog
        isOpen={Boolean(deletingSession)}
        targetInfo={deletingSession?.info || ''}
        isLoading={deleteMut.isPending}
        onConfirm={() => deletingSession && deleteMut.mutate(deletingSession.id)}
        onCancel={() => setDeletingSession(null)}
      />
    </>
  );
};

