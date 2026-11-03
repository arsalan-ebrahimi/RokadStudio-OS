import React from 'react';
import { Modal, Button } from '@/shared/ui';

interface AttendanceModalProps {
  isOpen: boolean;
  userName: string;
  onConfirm: () => void;
  isLoading?: boolean;
}

export const AttendanceModal: React.FC<AttendanceModalProps> = ({
  isOpen,
  userName,
  onConfirm,
  isLoading,
}) => {
  return (
    <Modal isOpen={isOpen} dismissible={false} title="حضور امروز">
      <div className="space-y-4 text-center py-2">
        <p className="text-sm font-bold text-ink-normal/80 dark:text-gray-200">
          سلام {userName}، اعلام حضور می‌کنید؟
        </p>
        <Button
          variant="primary"
          className="w-full py-3"
          onClick={onConfirm}
          isLoading={isLoading}
        >
          حاضرم
        </Button>
      </div>
    </Modal>
  );
};

