import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X, Unlock } from 'lucide-react';
import { Card, Button, Skeleton, EmptyState, toast, PersianDatePicker, Select, ConfirmDialog } from '@/shared/ui';
import { AttendanceBadge } from '@/features/attendance/components/AttendanceBadge';
import { AttendanceDecisionDialog } from '@/features/attendance/components/AttendanceDecisionDialog';
import { fetchAdminAttendance, decideAttendance, unlockUserTimer } from '@/features/attendance/api/admin-attendance-api';
import { getTehranTodayString, formatToJalali } from '@/shared/lib/date';
import { toPersianDigits, formatDurationToHoursMins } from '@/shared/lib/formatters';
import type { Attendance } from '@/shared/types/models';

export const AdminAttendancePage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<string>(getTehranTodayString());
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [activeDecision, setActiveDecision] = useState<{ id: number; decision: 'APPROVED' | 'REJECTED'; name: string } | null>(null);
  const [unlockingRecord, setUnlockingRecord] = useState<{ id: number; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-attendance', selectedDate, statusFilter],
    queryFn: () => fetchAdminAttendance({
      date: selectedDate,
      approval: statusFilter === 'ALL' ? undefined : (statusFilter as 'PENDING' | 'APPROVED' | 'REJECTED'),
    }),
  });

  const mutation = useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: 'APPROVED' | 'REJECTED' }) => decideAttendance(id, decision),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-attendance'] });
      toast.success('تصمیم با موفقیت ثبت شد');
      setActiveDecision(null);
    },
    onError: (err: Error) => toast.error(err.message || 'خطا در ثبت تصمیم'),
  });

  const unlockMut = useMutation({
    mutationFn: (id: number) => unlockUserTimer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-attendance'] });
      toast.success('قفل پروژه باز شد و تایمر ریست گردید');
      setUnlockingRecord(null);
    },
    onError: (err: Error) => toast.error(err.message || 'خطا در ریست تایمر'),
  });

  const records = data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-lg font-black text-sec dark:text-white">کارتابل حضور و غیاب</h1>
        <div className="flex items-center gap-2">
          <PersianDatePicker value={selectedDate} onChange={setSelectedDate} />
          <div className="w-36">
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
              className="p-4 md:p-5 flex flex-col md:grid md:grid-cols-12 md:items-center gap-3 md:gap-4 transition-all"
            >
              <div className="md:col-span-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 text-sec dark:text-white flex items-center justify-center font-black text-sm shrink-0 border border-gray-200 dark:border-gray-700">
                  {r.user?.name?.slice(0, 1) || 'ک'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-sec dark:text-white">{r.user?.name || 'کاربر'}</p>
                    <AttendanceBadge attendance={r} />
                  </div>
                  <p className="text-xs text-ink-normal/60 dark:text-gray-400 mt-0.5">{formatToJalali(r.date)}</p>
                </div>
              </div>

              <div className="md:col-span-3 flex items-center">
                <div className="inline-flex items-center gap-1.5 bg-gray-50 dark:bg-[#182030] px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold text-ink-normal/80 dark:text-gray-300">
                  <span className="tabular-nums text-sec dark:text-white font-extrabold">{toPersianDigits(r.sessionsCount || 0)}</span> دور
                  <span className="mx-1 opacity-40">•</span>
                  <span className="text-primary font-extrabold">{formatDurationToHoursMins(r.totalSeconds || 0)}</span>
                </div>
              </div>

              <div className="md:col-span-4 flex items-center justify-start md:justify-end gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setUnlockingRecord({ id: r.id, name: r.user?.name || 'کاربر' })}
                  title="برداشتن قفل پروژه و ریست تایمر"
                >
                  <Unlock className="w-3.5 h-3.5 me-1 text-primary" />
                  ریست تایمر
                </Button>

                {r.approval === 'PENDING' && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => setActiveDecision({ id: r.id, decision: 'APPROVED', name: r.user?.name || '' })}
                    >
                      <Check className="w-3.5 h-3.5" />
                      تایید
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setActiveDecision({ id: r.id, decision: 'REJECTED', name: r.user?.name || '' })}
                    >
                      <X className="w-3.5 h-3.5" />
                      رد
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(unlockingRecord)}
        title="ریست تایمر و قفل پروژه"
        message={`آیا از باز کردن قفل پروژه و ریست تایمر برای ${unlockingRecord?.name} اطمینان دارید؟`}
        variant="primary"
        isLoading={unlockMut.isPending}
        onConfirm={() => unlockingRecord && unlockMut.mutate(unlockingRecord.id)}
        onCancel={() => setUnlockingRecord(null)}
      />

      <AttendanceDecisionDialog
        isOpen={Boolean(activeDecision)}
        decision={activeDecision?.decision || null}
        targetName={activeDecision?.name || ''}
        isLoading={mutation.isPending}
        onConfirm={() => activeDecision && mutation.mutate(activeDecision)}
        onCancel={() => setActiveDecision(null)}
      />
    </div>
  );
};

export default AdminAttendancePage;
