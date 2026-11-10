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

  const renderTargetName = (name: string) => {
    const match = name.match(/^\[(.*?)\]\s*(.*)$/);
    if (match) {
      return (
        <span className="inline-flex items-center gap-1 flex-wrap align-middle">
          <span className="px-2 py-0.5 rounded-lg bg-ecosystem-light dark:bg-ecosystem-darker/60 border border-primary/35 text-sec dark:text-ecosystem-light text-xs font-black">
            {match[1]}
          </span>
          <span className="font-black text-sec dark:text-white">{match[2]}</span>
        </span>
      );
    }
    return <span className="font-bold text-sec dark:text-white">{name}</span>;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="تغییر پروژه / هدف کاری"
      dismissible={!isLoading}
    >
      <div className="space-y-5 py-1">
        <p className="text-xs sm:text-sm text-ink-normal/80 dark:text-gray-300 leading-relaxed">
          با تغییر پروژه، {durationText} زمان کار روی {renderTargetName(currentProjectName)} ثبت می‌شود و هدف کاری به {renderTargetName(newProjectName)} تغییر می‌یابد.
        </p>

        <div className="flex flex-col gap-2.5 pt-2">
          <Button
            variant="primary"
            onClick={onConfirmContinue}
            isLoading={isLoading}
            disabled={isLoading}
            className="w-full text-xs sm:text-sm"
          >
            ثبت و ادامه پومودورو در این پروژه
          </Button>

          <Button
            variant="outline"
            onClick={onConfirmFinish}
            disabled={isLoading}
            className="w-full text-xs sm:text-sm"
          >
            ثبت و پایان کار (ریست پومودورو)
          </Button>

          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
            className="w-full text-xs sm:text-sm text-sec/70 dark:text-gray-300"
          >
            انصراف
          </Button>
        </div>
      </div>
    </Modal>
  );
};
