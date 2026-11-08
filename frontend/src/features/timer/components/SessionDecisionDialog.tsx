import React from 'react';
import { ConfirmDialog } from '@/shared/ui';

interface SessionDecisionDialogProps {
  isOpen: boolean;
  decision: 'APPROVED' | 'REJECTED' | null;
  targetInfo: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const SessionDecisionDialog: React.FC<SessionDecisionDialogProps> = ({
  isOpen,
  decision,
  targetInfo,
  isLoading,
  onConfirm,
  onCancel,
}) => {
  const isReject = decision === 'REJECTED';

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title={isReject ? 'رد سشن کاری' : 'تایید سشن کاری'}
      message={
        isReject
          ? `آیا از رد سشن کاری مربوط به ${targetInfo} اطمینان دارید؟ زمان این سشن در گزارش‌ها و ساعات کاری منظور نخواهد شد.`
          : `آیا سشن کاری مربوط به ${targetInfo} تایید می‌شود؟`
      }
      confirmLabel={isReject ? 'رد سشن' : 'تایید سشن'}
      variant={isReject ? 'danger' : 'primary'}
      isLoading={isLoading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
};

