import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'danger';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'تایید',
  cancelLabel = 'انصراف',
  variant = 'primary',
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title}>
      <p className="text-xs sm:text-sm text-ink-normal/80 dark:text-gray-300 mb-6 leading-relaxed">
        {message}
      </p>
      <div className="flex flex-row justify-end gap-2.5 mt-4">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={isLoading} className="flex-1 sm:flex-initial">
          {cancelLabel}
        </Button>
        <Button variant={variant} size="sm" onClick={onConfirm} isLoading={isLoading} className="flex-1 sm:flex-initial">
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
};

