import React from 'react';
import { ConfirmDialog } from '@/shared/ui';

interface DeleteSessionDialogProps {
  isOpen: boolean;
  targetInfo: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteSessionDialog: React.FC<DeleteSessionDialogProps> = ({
  isOpen,
  targetInfo,
  isLoading,
  onConfirm,
  onCancel,
}) => {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      title="حذف سشن کاری"
      message={`آیا از حذف دائم سشن کاری ${targetInfo} اطمینان دارید؟ این عملیات غیرقابل بازگشت است.`}
      confirmLabel="حذف قطعی"
      variant="danger"
      isLoading={isLoading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
};

