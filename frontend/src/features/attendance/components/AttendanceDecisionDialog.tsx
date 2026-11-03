import React from 'react';
import { ConfirmDialog } from '@/shared/ui';

interface AttendanceDecisionDialogProps {
  isOpen: boolean;
  decision: 'APPROVED' | 'REJECTED' | null;
  targetName: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const AttendanceDecisionDialog: React.FC<AttendanceDecisionDialogProps> = ({
  isOpen,
  decision,
  targetName,
  isLoading,
  onConfirm,
  onCancel,
}) => {
  const isReject = decision === 'REJECTED';

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title={isReject ? 'رد حضور' : 'تایید حضور'}
      message={
        isReject
          ? `آیا از رد حضور ${targetName} اطمینان دارید؟ با رد حضور، تمامی سشن‌های کاری ثبت‌شده امروز این فرد حذف شده و وضعیت به غایب تغییر می‌کند.`
          : `آیا حضور امروز ${targetName} تایید می‌شود؟`
      }
      confirmLabel={isReject ? 'رد قطعی' : 'تایید'}
      variant={isReject ? 'danger' : 'primary'}
      isLoading={isLoading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
};

