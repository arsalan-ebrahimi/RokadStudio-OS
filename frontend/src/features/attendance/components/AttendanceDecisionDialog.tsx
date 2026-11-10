import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, X } from 'lucide-react';
import { Button, Checkbox, ErrorState, Modal, Skeleton } from '@/shared/ui';
import { formatDurationToHoursMins, toPersianDigits } from '@/shared/lib/formatters';
import { fetchAttendanceImpact } from '../api/admin-attendance-api';

interface AttendanceDecisionDialogProps {
  isOpen: boolean;
  attendanceId: number | null;
  targetName: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const AttendanceDecisionDialog: React.FC<AttendanceDecisionDialogProps> = ({
  isOpen,
  attendanceId,
  targetName,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    setAcknowledged(false);
  }, [isOpen, attendanceId]);

  const {
    data: impact,
    isLoading: isImpactLoading,
    isError: isImpactError,
    error: impactError,
    refetch,
  } = useQuery({
    queryKey: ['attendance-impact', attendanceId],
    queryFn: () => fetchAttendanceImpact(attendanceId!),
    enabled: isOpen && Boolean(attendanceId),
    staleTime: 0,
  });

  const canConfirm =
    !isLoading &&
    !isImpactLoading &&
    !isImpactError &&
    Boolean(impact) &&
    acknowledged;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isLoading) onCancel();
      }}
      dismissible={!isLoading}
      title="رد قطعی حضور"
      className="max-w-lg"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800/60">
          <div className="w-9 h-9 rounded-xl bg-[#C60036] text-white flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-black text-[#A81344] dark:text-rose-200">
              رد حضور {targetName || 'عضو'}
            </p>
            <p className="text-xs font-bold text-[#A81344]/85 dark:text-rose-300/90 leading-relaxed">
              با رد حضور، وضعیت عضو در این روز به «غایب» تغییر کرده و تمام سشن‌های ثبت‌شده برای این رکورد حضور حذف می‌شوند.
            </p>
          </div>
        </div>

        {isImpactLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-8 w-48 rounded-xl" />
          </div>
        ) : isImpactError ? (
          <ErrorState
            compact
            title="خطا در محاسبه تأثیر رد حضور"
            message={
              impactError instanceof Error
                ? impactError.message
                : 'اطلاعات سشن‌های وابسته دریافت نشد.'
            }
            onRetry={() => refetch()}
          />
        ) : impact ? (
          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-[#182030] border border-sec/15 dark:border-gray-700 text-xs font-bold text-sec dark:text-gray-200 leading-relaxed tabular-nums">
              {impact.sessionCount > 0 ? (
                <span>
                  با رد این حضور،{' '}
                  <strong className="font-black text-[#C60036] dark:text-rose-400">
                    {toPersianDigits(impact.sessionCount)} سشن
                  </strong>{' '}
                  ({toPersianDigits(impact.taskSessionCount)} تسک اسکرام،{' '}
                  {toPersianDigits(impact.projectSessionCount)} پروژه استودیو) به مدت مجموع{' '}
                  <strong className="font-black text-sec dark:text-white">
                    {formatDurationToHoursMins(impact.totalSeconds ?? 0)}
                  </strong>{' '}
                  از این روز حذف می‌شود و قابل بازگشت نیست.
                </span>
              ) : (
                <span>
                  هیچ سشن کاری فعالی به این رکورد حضور متصل نیست. وضعیت حضور به «غایب» تغییر می‌کند.
                </span>
              )}
            </div>

            <div className="p-3 rounded-2xl border border-sec/15 dark:border-gray-700 bg-white dark:bg-[#151C28]">
              <Checkbox
                checked={acknowledged}
                disabled={isLoading}
                onChange={(e) => setAcknowledged(e.target.checked)}
                label="متوجه هستم که این اقدام غیرقابل بازگشت است"
              />
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-2.5 pt-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={isLoading}
            onClick={onCancel}
          >
            انصراف
          </Button>
          <Button
            type="button"
            variant="danger"
            className="flex-[2] gap-1.5 font-black"
            isLoading={isLoading}
            disabled={!canConfirm}
            onClick={onConfirm}
          >
            <X className="w-4 h-4" />
            <span>رد قطعی</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
};
