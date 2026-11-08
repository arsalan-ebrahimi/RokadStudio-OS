import React from 'react';
import { Modal, Button } from '@/shared/ui';
import { formatDurationToHumanPersian } from '@/shared/lib/formatters';

interface RegisterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  durationSeconds: number;
  isLoading: boolean;
  onConfirmContinue: () => void;
  onConfirmFinish: () => void;
}

export const RegisterDialog: React.FC<RegisterDialogProps> = ({
  isOpen,
  onClose,
  projectName,
  durationSeconds,
  isLoading,
  onConfirmContinue,
  onConfirmFinish,
}) => {
  const durationText = formatDurationToHumanPersian(durationSeconds);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="آیا مایل به ثبت پروژه هستید؟"
      dismissible={!isLoading}
    >
      <div className="space-y-5 py-1">
        <p className="text-xs sm:text-sm text-ink-normal/80 dark:text-gray-300 leading-relaxed">
          {durationText} روی پروژه «<span className="font-bold text-sec dark:text-white">{projectName}</span>» ثبت می‌شود.
        </p>

        <div className="flex flex-col gap-2.5 pt-2">
          <Button
            variant="primary"
            onClick={onConfirmContinue}
            isLoading={isLoading}
            disabled={isLoading}
            className="w-full text-xs sm:text-sm py-2.5"
          >
            ثبت و ادامه‌ی پومودورو روی پروژه‌ی دیگر
          </Button>

          <Button
            variant="outline"
            onClick={onConfirmFinish}
            disabled={isLoading}
            className="w-full text-xs sm:text-sm py-2.5"
          >
            ثبت و پایان کار (ریست پومودورو)
          </Button>

          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="w-full text-xs sm:text-sm py-2 text-ink-normal/60 dark:text-gray-400"
          >
            انصراف
          </Button>
        </div>
      </div>
    </Modal>
  );
};
