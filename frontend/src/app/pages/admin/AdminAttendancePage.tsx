import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { Card, Button, Skeleton, EmptyState, toast, PersianDatePicker, Select } from '@/shared/ui';
import { AttendanceBadge } from '@/features/attendance/components/AttendanceBadge';
import { AttendanceDecisionDialog } from '@/features/attendance/components/AttendanceDecisionDialog';
import { AttendanceSessionsModal } from '@/features/timer/components/AttendanceSessionsModal';
import { fetchAdminAttendance, decideAttendance } from '@/features/attendance/api/admin-attendance-api';
import { getTehranTodayString, formatToJalali } from '@/shared/lib/date';
import { toPersianDigits, formatDurationToHoursMins } from '@/shared/lib/formatters';
import type { Attendance } from '@/shared/types/models';

export const AdminAttendancePage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<string>(getTehranTodayString());
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [activeDecision, setActiveDecision] = useState<{ id: number; decision: 'APPROVED' | 'REJECTED'; name: string } | null>(null);
  const [sessionsModalUser, setSessionsModalUser] = useState<{ userId: number; userName: string; date: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-attendance', selectedDate, statusFilter],
    queryFn: () => fetchAdminAttendance({
      date: selectedDate,
      approval: statusFilter === 'ALL' ? undefined : (statusFilter as 'PENDING' | 'APPROVED' | 'REJECTED'),
    }),
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: 'APPROVED' | 'REJECTED' }) => decideAttendance(id, decision),
    onMutate: async ({ id, decision }) => {
      setActiveDecision(null);
      queryClient.setQueriesData({ queryKey: ['admin-attendance'] }, (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((r: Attendance) => (r.id === id ? { ...r, approval: decision } : r)),
        };
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-attendance'] });
      toast.success('تصمیم با موفقیت ثبت شد');
    },
    onError: (err: Error) => {
      queryClient.invalidateQueries({ queryKey: ['admin-attendance'] });
      toast.error(err.message || 'خطا در ثبت تصمیم');
    },
  });

  const records = data?.data || [];
  const approvedCount = records.filter((r: Attendance) => r.approval === 'APPROVED').length;
  const pendingCount = records.filter((r: Attendance) => r.approval === 'PENDING').length;
  const rejectedCount = records.filter((r: Attendance) => r.approval === 'REJECTED').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <h1 className="text-lg font-black text-sec dark:text-white">کارتابل حضور و غیاب</h1>
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="shrink-0">
            <PersianDatePicker value={selectedDate} onChange={setSelectedDate} />
          </div>
          <div className="flex-1 sm:w-44 min-w-[140px]">
            <Select
              selectSize="sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">همه وضعیت‌ها</option>
              <option value="PENDING">در انتظار تایید</option>
              <option value="APPROVED">تایید شده</option>
              <option value="REJECTED">رد شده</option>
            </Select>
          </div>
        </div>
      </div>

      {!isLoading && records.length > 0 && (
        <Card className="p-3.5 sm:p-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold flex-wrap gap-2">
            <span className="text-sec dark:text-white">وضعیت روزانه ({toPersianDigits(records.length)} نفر)</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                تایید ({toPersianDigits(approvedCount)})
              </span>
              <span className="flex items-center gap-1.5 text-amber-500">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                انتظار ({toPersianDigits(pendingCount)})
              </span>
              {rejectedCount > 0 && (
                <span className="flex items-center gap-1.5 text-rose-500">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  رد ({toPersianDigits(rejectedCount)})
                </span>
              )}
            </div>
          </div>

          <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden flex">
            {approvedCount > 0 && (
              <div
                style={{ width: `${(approvedCount / records.length) * 100}%` }}
                className="h-full bg-emerald-500 transition-all duration-500"
              />
            )}
            {pendingCount > 0 && (
              <div
                style={{ width: `${(pendingCount / records.length) * 100}%` }}
                className="h-full bg-amber-400 transition-all duration-500"
              />
            )}
            {rejectedCount > 0 && (
              <div
                style={{ width: `${(rejectedCount / records.length) * 100}%` }}
                className="h-full bg-rose-500 transition-all duration-500"
              />
            )}
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : records.length === 0 ? (
        <EmptyState title="هیچ رکوردی برای این تاریخ یافت نشد" />
      ) : (
        <div className="space-y-3">
          {records.map((r: Attendance) => (
            <Card
              key={r.id}
              className="p-3.5 sm:p-4 md:p-5 flex flex-col md:grid md:grid-cols-12 md:items-center gap-3 md:gap-4 transition-all"
            >
              <div className="md:col-span-5 flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 text-sec dark:text-white flex items-center justify-center font-black text-sm shrink-0 border border-gray-200 dark:border-gray-700">
                  {r.user?.name?.slice(0, 1) || 'ک'}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-black text-sec dark:text-white truncate" title={r.user?.name}>
                    {r.user?.name || 'کاربر'}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <AttendanceBadge attendance={r} />
                    <span className="text-[10px] text-ink-normal/30 dark:text-gray-600 font-bold">•</span>
                    <span className="text-xs text-ink-normal/60 dark:text-gray-400 font-medium">
                      {formatToJalali(r.date)}
                    </span>
                    {r.reason && (
                      <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800/80">
                        علت: {r.reason}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2.5 md:pt-0 border-t border-gray-100 dark:border-gray-800 md:border-0 md:col-span-7">
                <button
                  type="button"
                  onClick={() => r.user?.id && setSessionsModalUser({ userId: r.user.id, userName: r.user.name || '', date: r.date })}
                  className="inline-flex items-center gap-1.5 bg-gray-50 dark:bg-[#182030] px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold text-ink-normal/80 dark:text-gray-300 shrink-0 hover:border-primary/60 hover:bg-gray-100 dark:hover:bg-[#1f293d] transition-all cursor-pointer"
                  title="مشاهده، تایید، رد یا حذف سشن‌های کاری"
                >
                  <span className="tabular-nums text-sec dark:text-white font-extrabold">{toPersianDigits(r.sessionsCount || 0)}</span> دور
                  <span className="mx-1 opacity-40">•</span>
                  <span className="text-primary font-extrabold">{formatDurationToHoursMins(r.totalSeconds || 0)}</span>
                </button>

                <div className="flex items-center justify-end gap-2 shrink-0">
                  <div className="flex items-center gap-1.5">
                    {r.approval !== 'APPROVED' && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => setActiveDecision({ id: r.id, decision: 'APPROVED', name: r.user?.name || '' })}
                      >
                        <Check className="w-3.5 h-3.5" />
                        {r.approval === 'REJECTED' ? 'تغییر به تایید' : 'تایید'}
                      </Button>
                    )}
                    {r.approval !== 'REJECTED' && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setActiveDecision({ id: r.id, decision: 'REJECTED', name: r.user?.name || '' })}
                      >
                        <X className="w-3.5 h-3.5" />
                        {r.approval === 'APPROVED' ? 'تغییر به رد' : 'رد'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AttendanceDecisionDialog
        isOpen={Boolean(activeDecision)}
        decision={activeDecision?.decision || null}
        targetName={activeDecision?.name || ''}
        isLoading={mutation.isPending}
        onConfirm={() => activeDecision && mutation.mutate(activeDecision)}
        onCancel={() => setActiveDecision(null)}
      />

      <AttendanceSessionsModal
        isOpen={Boolean(sessionsModalUser)}
        onClose={() => setSessionsModalUser(null)}
        userId={sessionsModalUser?.userId || null}
        userName={sessionsModalUser?.userName || ''}
        date={sessionsModalUser?.date || ''}
      />
    </div>
  );
};

export default AdminAttendancePage;
