import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  X,
  Lock,
  Info,
  MessageSquareText,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  Badge,
  Card,
  Button,
  Skeleton,
  EmptyState,
  ErrorState,
  toast,
  PersianDatePicker,
  Select,
} from '@/shared/ui';
import { useAuthStore } from '@/features/auth';
import { AttendanceBadge } from '@/features/attendance/components/AttendanceBadge';
import { AttendanceDecisionDialog } from '@/features/attendance/components/AttendanceDecisionDialog';
import { AttendanceSessionsModal } from '@/features/timer/components/AttendanceSessionsModal';
import {
  fetchAdminAttendance,
  decideAttendance,
} from '@/features/attendance/api/admin-attendance-api';
import { MemberDetailDrawer } from '@/features/members';
import { SCRUM_COLOR_MAP } from '@/features/scrum/types/scrum-types';
import { getTehranTodayString, formatToJalali, formatTehranTime } from '@/shared/lib/date';
import {
  toPersianDigits,
  formatDurationToHoursMins,
  calculateCompletedRounds,
} from '@/shared/lib/formatters';
import type { ApiResponse } from '@/shared/types/api';
import type { Attendance } from '@/shared/types/models';

export const AdminAttendancePage: React.FC = () => {
  const { user } = useAuthStore();
  const isScrumAdmin = user?.role === 'SCRUM_ADMIN';
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState<string>(getTehranTodayString());
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [rejectTarget, setRejectTarget] = useState<{ id: number; name: string } | null>(null);
  const [sessionsModalUser, setSessionsModalUser] = useState<{
    userId: number;
    userName: string;
    date: string;
  } | null>(null);
  const [drawerUserId, setDrawerUserId] = useState<number | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Record<number, boolean>>({});

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin-attendance', user?.id, user?.role, selectedDate, statusFilter],
    queryFn: () =>
      fetchAdminAttendance({
        date: selectedDate,
        approval:
          statusFilter === 'ALL'
            ? undefined
            : (statusFilter as 'PENDING' | 'APPROVED' | 'REJECTED'),
      }),
    staleTime: 30_000,
  });

  const decideMut = useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: 'APPROVED' | 'REJECTED' }) =>
      decideAttendance(id, decision),
    onMutate: async ({ id, decision }) => {
      await queryClient.cancelQueries({ queryKey: ['admin-attendance'] });
      const previous = queryClient.getQueriesData<ApiResponse<Attendance[]>>({
        queryKey: ['admin-attendance'],
      });
      queryClient.setQueriesData<ApiResponse<Attendance[]>>(
        { queryKey: ['admin-attendance'] },
        (old) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((r) => (r.id === id ? { ...r, approval: decision } : r)),
          };
        }
      );
      return { previous };
    },
    onSuccess: (_res, variables) => {
      if (variables.decision === 'REJECTED') {
        setRejectTarget(null);
      }
      queryClient.invalidateQueries({ queryKey: ['admin-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['member-day'] });
      queryClient.invalidateQueries({ queryKey: ['member-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['member-profile'] });
      queryClient.invalidateQueries({ queryKey: ['member-work'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(
        variables.decision === 'APPROVED' ? 'حضور با موفقیت تأیید شد' : 'حضور با موفقیت رد شد'
      );
    },
    onError: (err: Error, _variables, context) => {
      if (context?.previous) {
        for (const [key, prevData] of context.previous) {
          queryClient.setQueryData(key, prevData);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['admin-attendance'] });
      toast.error(err.message || 'خطا در ثبت تصمیم');
    },
  });

  const records = data?.data || [];
  const approvedCount = records.filter((r) => r.approval === 'APPROVED').length;
  const pendingCount = records.filter((r) => r.approval === 'PENDING').length;
  const rejectedCount = records.filter((r) => r.approval === 'REJECTED').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-xl font-black text-sec dark:text-white">
              کارتابل حضور و غیاب
            </h1>
            {isScrumAdmin && (
              <Badge variant="club" className="text-[11px]">
                فقط اعضای اسکرام‌های شما
              </Badge>
            )}
          </div>
          {isScrumAdmin && (
            <p className="text-xs font-bold text-ink-normal/60 dark:text-gray-400">
              نمایش حضور و غیاب اعضای اسکرام‌های تحت مدیریت شما
            </p>
          )}
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="shrink-0">
            <PersianDatePicker value={selectedDate} onChange={setSelectedDate} />
          </div>
          <div className="flex-1 sm:w-44 min-w-[140px]">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">همه وضعیت‌ها</option>
              <option value="PENDING">در انتظار تایید</option>
              <option value="APPROVED">تایید شده</option>
              <option value="REJECTED">رد شده</option>
            </Select>
          </div>
        </div>
      </div>

      {isScrumAdmin && (
        <div
          role="status"
          className="p-3.5 sm:p-4 rounded-2xl bg-male-light/70 dark:bg-male-darker/35 border-[1.5px] border-male-normal/35 flex items-center gap-2.5 text-xs sm:text-sm font-bold text-male-normal dark:text-blue-200"
        >
          <Info className="w-4 h-4 shrink-0" />
          <span>
            حضور فقط برای مشاهده است. تأیید و رد سشن‌ها در صفحه گزارش انجام می‌شود.
          </span>
        </div>
      )}

      {!isLoading && !isError && records.length > 0 && (
        <Card className="p-4 sm:p-5 rounded-3xl border-[1.5px] border-sec/20 dark:border-primary/25 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold flex-wrap gap-2">
            <span className="text-sec dark:text-white font-black tabular-nums">
              وضعیت روزانه ({toPersianDigits(records.length)} نفر)
            </span>
            <div className="flex items-center gap-3 tabular-nums">
              <span className="flex items-center gap-1.5 text-[#007A52] dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-[#007A52] dark:bg-emerald-400" />
                تایید ({toPersianDigits(approvedCount)})
              </span>
              <span className="flex items-center gap-1.5 text-[#9C660D] dark:text-amber-300">
                <span className="w-2 h-2 rounded-full bg-college-normal animate-pulse" />
                انتظار ({toPersianDigits(pendingCount)})
              </span>
              {rejectedCount > 0 && (
                <span className="flex items-center gap-1.5 text-[#C60036] dark:text-rose-400">
                  <span className="w-2 h-2 rounded-full bg-[#C60036] dark:bg-rose-400" />
                  رد ({toPersianDigits(rejectedCount)})
                </span>
              )}
            </div>
          </div>

          <div className="w-full h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden flex">
            {approvedCount > 0 && (
              <div
                style={{ width: `${(approvedCount / records.length) * 100}%` }}
                className="h-full bg-[#007A52] dark:bg-emerald-500 transition-all duration-500"
              />
            )}
            {pendingCount > 0 && (
              <div
                style={{ width: `${(pendingCount / records.length) * 100}%` }}
                className="h-full bg-college-normal transition-all duration-500"
              />
            )}
            {rejectedCount > 0 && (
              <div
                style={{ width: `${(rejectedCount / records.length) * 100}%` }}
                className="h-full bg-[#C60036] dark:bg-rose-500 transition-all duration-500"
              />
            )}
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array(5)
            .fill(0)
            .map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-3xl" />
            ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="خطا در دریافت لیست حضور و غیاب"
          message={
            error instanceof Error ? error.message : 'دریافت اطلاعات حضور و غیاب ناموفق بود.'
          }
          onRetry={() => refetch()}
        />
      ) : records.length === 0 ? (
        <EmptyState title="هیچ رکوردی برای این تاریخ یافت نشد" />
      ) : (
        <div className="space-y-3">
          {records.map((r) => {
            const isOwnRecord = r.user?.id === user?.id;
            // Drive decision affordance from server `canDecide` (SCRUM_ADMIN receives canDecide: false)
            const canDecideRow = r.canDecide ?? false;
            const scrums = r.scrums || [];
            const noteText = r.workNote?.trim() || '';
            const isLongNote = noteText.length > 130 || noteText.includes('\n');
            const isNoteExpanded = Boolean(expandedNotes[r.id]);
            const isMutatingThisRow =
              decideMut.isPending && decideMut.variables?.id === r.id;

            return (
              <Card
                key={r.id}
                className="p-4 sm:p-5 rounded-3xl border-[1.5px] border-sec/20 dark:border-primary/25 space-y-3 transition-all"
              >
                <div className="flex flex-col md:grid md:grid-cols-12 md:items-center gap-3 md:gap-4">
                  <div className="md:col-span-6 flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-gray-100 dark:bg-gray-800 text-sec dark:text-white flex items-center justify-center font-black text-sm shrink-0 border border-sec/15 dark:border-gray-700 mt-0.5">
                      {r.user?.name?.slice(0, 1) || 'ک'}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {r.user?.id ? (
                          <button
                            type="button"
                            onClick={() => setDrawerUserId(r.user!.id)}
                            className="inline-flex items-center gap-1.5 text-sm font-black text-sec dark:text-white hover:text-primary dark:hover:text-primary transition-colors cursor-pointer group"
                            title="مشاهده جزئیات عضو"
                          >
                            <span className="truncate">{r.user.name || 'کاربر'}</span>
                            <Eye className="w-3.5 h-3.5 text-sec/50 dark:text-gray-400 group-hover:text-primary shrink-0" />
                          </button>
                        ) : (
                          <p className="text-sm font-black text-sec dark:text-white truncate">
                            {r.user?.name || 'کاربر'}
                          </p>
                        )}

                        {scrums.map((sc) => {
                          const cMeta = SCRUM_COLOR_MAP[sc.color] || SCRUM_COLOR_MAP.ECOSYSTEM;
                          return (
                            <Badge
                              key={sc.id}
                              variant={cMeta.badgeVariant}
                              className="text-[10px] py-0 px-2"
                            >
                              {sc.name}
                            </Badge>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <AttendanceBadge attendance={r} />
                        <span className="text-[10px] text-ink-normal/30 dark:text-gray-600 font-bold">
                          •
                        </span>
                        <span className="text-xs text-ink-normal/65 dark:text-gray-400 font-medium tabular-nums">
                          {formatToJalali(r.date)}
                        </span>
                        {r.reason && (
                          <span className="text-[11px] font-bold text-[#704A0D] dark:text-amber-200 bg-college-light dark:bg-amber-950/40 px-2.5 py-0.5 rounded-full border border-college-normal/45">
                            علت: {r.reason}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 md:pt-0 border-t border-sec/10 dark:border-gray-800 md:border-0 md:col-span-6">
                    <button
                      type="button"
                      onClick={() =>
                        r.user?.id &&
                        setSessionsModalUser({
                          userId: r.user.id,
                          userName: r.user.name || '',
                          date: r.date,
                        })
                      }
                      className="min-h-[40px] inline-flex items-center gap-1.5 bg-gray-50 dark:bg-[#182030] px-3.5 py-1.5 rounded-2xl border-[1.5px] border-sec/20 dark:border-gray-700 text-xs font-bold text-ink-normal/80 dark:text-gray-300 shrink-0 hover:border-sec/50 hover:bg-gray-100 dark:hover:bg-[#1f293d] transition-all cursor-pointer tabular-nums"
                      title={
                        isScrumAdmin
                          ? 'مشاهده، تأیید یا رد سشن‌های تسک'
                          : 'مشاهده، تأیید، رد یا حذف سشن‌های کاری'
                      }
                    >
                      <span className="text-sec dark:text-white font-black">
                        {toPersianDigits(calculateCompletedRounds(r.totalSeconds || 0))}
                      </span>{' '}
                      دور
                      <span className="mx-1 opacity-40">•</span>
                      <span className="text-sec dark:text-primary font-black">
                        {formatDurationToHoursMins(r.totalSeconds || 0)}
                      </span>
                    </button>

                    <div className="flex items-center justify-end gap-2 shrink-0">
                      {canDecideRow ? (
                        <div className="flex items-center gap-1.5">
                          {r.approval !== 'APPROVED' && (
                            <Button
                              size="sm"
                              variant="primary"
                              isLoading={
                                isMutatingThisRow &&
                                decideMut.variables?.decision === 'APPROVED'
                              }
                              disabled={isMutatingThisRow}
                              onClick={() =>
                                decideMut.mutate({ id: r.id, decision: 'APPROVED' })
                              }
                            >
                              <Check className="w-3.5 h-3.5" />
                              {r.approval === 'REJECTED' ? 'تغییر به تایید' : 'تایید'}
                            </Button>
                          )}
                          {r.approval !== 'REJECTED' && (
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={isMutatingThisRow}
                              onClick={() =>
                                setRejectTarget({ id: r.id, name: r.user?.name || '' })
                              }
                            >
                              <X className="w-3.5 h-3.5" />
                              {r.approval === 'APPROVED' ? 'تغییر به رد' : 'رد'}
                            </Button>
                          )}
                        </div>
                      ) : (
                        <Badge variant="neutral" className="text-[11px] gap-1">
                          <Lock className="w-3 h-3" />
                          <span>
                            {isOwnRecord
                              ? 'حضور خود شما'
                              : isScrumAdmin
                                ? 'فقط مشاهده'
                                : 'غیرقابل بررسی'}
                          </span>
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {noteText && (
                  <div className="p-3 rounded-2xl bg-amber-50/75 dark:bg-amber-950/25 border border-college-normal/35 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-black text-[#704A0D] dark:text-amber-300">
                      <span className="inline-flex items-center gap-1.5">
                        <MessageSquareText className="w-3.5 h-3.5 shrink-0" />
                        <span>موانع و چالش‌ها:</span>
                      </span>
                      {r.workNoteAt && (
                        <span className="text-[10px] font-bold opacity-80 tabular-nums">
                          ساعت {toPersianDigits(formatTehranTime(r.workNoteAt))}
                        </span>
                      )}
                    </div>
                    <p
                      className={
                        isNoteExpanded
                          ? 'text-xs text-sec dark:text-gray-200 leading-relaxed whitespace-pre-line'
                          : 'text-xs text-sec dark:text-gray-200 leading-relaxed line-clamp-2'
                      }
                    >
                      {noteText}
                    </p>
                    {isLongNote && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedNotes((prev) => ({
                            ...prev,
                            [r.id]: !prev[r.id],
                          }))
                        }
                        className="inline-flex items-center gap-1 text-[10px] font-black text-sec dark:text-primary hover:underline cursor-pointer"
                      >
                        {isNoteExpanded ? (
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
              </Card>
            );
          })}
        </div>
      )}

      <AttendanceDecisionDialog
        isOpen={Boolean(rejectTarget)}
        attendanceId={rejectTarget?.id ?? null}
        targetName={rejectTarget?.name || ''}
        isLoading={
          decideMut.isPending && decideMut.variables?.decision === 'REJECTED'
        }
        onConfirm={() => {
          if (rejectTarget) {
            decideMut.mutate({ id: rejectTarget.id, decision: 'REJECTED' });
          }
        }}
        onCancel={() => setRejectTarget(null)}
      />

      <AttendanceSessionsModal
        isOpen={Boolean(sessionsModalUser)}
        onClose={() => setSessionsModalUser(null)}
        userId={sessionsModalUser?.userId || null}
        userName={sessionsModalUser?.userName || ''}
        date={sessionsModalUser?.date || ''}
      />

      <MemberDetailDrawer
        userId={drawerUserId}
        onClose={() => setDrawerUserId(null)}
      />
    </div>
  );
};

export default AdminAttendancePage;
