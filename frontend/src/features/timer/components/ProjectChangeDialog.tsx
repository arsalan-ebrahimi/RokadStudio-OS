import React from 'react';
import { Modal, Button } from '@/shared/ui';
import { formatDurationToHumanPersian } from '@/shared/lib/formatters';

interface ProjectChangeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentProjectName: string;
  newProjectName: string;
  durationSeconds: number;
  isLoading: boolean;
  onConfirmContinue: () => void;
  onConfirmFinish: () => void;
}

export const ProjectChangeDialog: React.FC<ProjectChangeDialogProps> = ({
  isOpen,
  onClose,
  currentProjectName,
  newProjectName,
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
      title="تغییر پروژه"
      dismissible={!isLoading}
    >
      <div className="space-y-5 py-1">
        <p className="text-xs sm:text-sm text-ink-normal/80 dark:text-gray-300 leading-relaxed">
          با تغییر پروژه، {durationText} زمان کار روی پروژه «
          <span className="font-bold text-sec dark:text-white">{currentProjectName}</span>» ثبت می‌شود و پروژه به «
          <span className="font-bold text-sec dark:text-white">{newProjectName}</span>» تغییر می‌یابد.
        </p>

        <div className="flex flex-col gap-2.5 pt-2">
          <Button
            variant="primary"
            onClick={onConfirmContinue}
            isLoading={isLoading}
            disabled={isLoading}
            className="w-full text-xs sm:text-sm py-2.5"
          >
            ثبت و ادامه پومودورو در این پروژه
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
