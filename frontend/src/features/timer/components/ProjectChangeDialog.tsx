import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal, Button } from '@/shared/ui';
import { formatDurationToHumanPersian } from '@/shared/lib/formatters';

interface ProjectChangeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentProjectName: string;
  newProjectName: string;
  durationSeconds: number;
  isLoading: boolean;
  errorMessage?: string | null;
  canDiscard?: boolean;
  onDiscard?: () => void;
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
  errorMessage,
  canDiscard = false,
  onDiscard,
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

        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3 rounded-2xl border-[1.5px] border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-[#C60036] dark:text-rose-300 text-xs font-bold leading-relaxed"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

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

          {canDiscard && onDiscard && (
            <Button
              variant="danger"
              onClick={onDiscard}
              disabled={isLoading}
              className="w-full text-xs sm:text-sm"
            >
              صرف‌نظر از زمان ثبت‌نشده و تغییر به هدف جدید
            </Button>
          )}

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
