import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, MessageSquareText } from 'lucide-react';
import { Button, Modal } from '@/shared/ui';
import { ApiError } from '@/shared/types/api';
import { toPersianDigits } from '@/shared/lib/formatters';
import { cn } from '@/shared/lib/utils';

const MAX_NOTE_LENGTH = 1000;

interface WorkNoteModalProps {
  isOpen: boolean;
  mode: 'prompt' | 'edit';
  initialText?: string | null;
  isSaving?: boolean;
  onClose: () => void;
  onPromptSave?: (text: string) => void;
  onPromptSkip?: () => void;
  onEditSave?: (text: string) => Promise<void>;
}

export const WorkNoteModal: React.FC<WorkNoteModalProps> = ({
  isOpen,
  mode,
  initialText,
  isSaving = false,
  onClose,
  onPromptSave,
  onPromptSkip,
  onEditSave,
}) => {
  const [text, setText] = useState(initialText || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDayLocked, setIsDayLocked] = useState(false);
  const handledPromptActionRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setText(initialText || '');
      setErrorMsg(null);
      setIsDayLocked(false);
      handledPromptActionRef.current = false;
    }
  }, [isOpen, initialText, mode]);

  const trimmed = text.trim();
  const isTooLong = trimmed.length > MAX_NOTE_LENGTH;
  const canSubmit = !isDayLocked && !isSaving && trimmed.length >= 1 && !isTooLong;

  const handleCloseAction = () => {
    if (mode === 'prompt') {
      if (!handledPromptActionRef.current) {
        handledPromptActionRef.current = true;
        onPromptSkip?.();
      }
      onClose();
      return;
    }
    if (!isSaving) {
      onClose();
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    if (mode === 'prompt') {
      if (!handledPromptActionRef.current) {
        handledPromptActionRef.current = true;
        onPromptSave?.(trimmed);
      }
      onClose();
      return;
    }

    if (!onEditSave) return;
    setErrorMsg(null);
    try {
      await onEditSave(trimmed);
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        setIsDayLocked(true);
        setErrorMsg(err.message || 'مهلت ویرایش یادداشت برای این روز به پایان رسیده است.');
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'خطا در ذخیره یادداشت');
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCloseAction}
      dismissible={mode === 'prompt' || !isSaving}
      title={mode === 'prompt' ? 'یادداشت پایان کار امروز' : 'موانع و چالش‌های امروز'}
      className="max-w-lg"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-ecosystem-light/70 dark:bg-ecosystem-darker/40 border border-primary/35">
          <div className="w-9 h-9 rounded-xl bg-primary text-sec flex items-center justify-center shrink-0">
            <MessageSquareText className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <p className="text-xs sm:text-sm font-black text-sec dark:text-white leading-snug">
              {mode === 'prompt'
                ? 'خسته نباشید! موانع و چالش‌های کار امروزتون چی بود؟'
                : 'می‌توانید موانع و چالش‌های امروز خود را تا پایان همین روز ثبت یا ویرایش کنید.'}
            </p>
            <p className="text-[11px] font-bold text-sec/65 dark:text-gray-300">
              این یادداشت برای مدیر اسکرام و استودیو در گزارش حضور نمایش داده می‌شود.
            </p>
          </div>
        </div>

        {isDayLocked && (
          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/35 border border-rose-300 dark:border-rose-800/60 text-xs font-bold text-[#A81344] dark:text-rose-200">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg || 'مهلت ویرایش یادداشت برای این روز به پایان رسیده است.'}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-ink-normal/65 dark:text-gray-400">
            <label htmlFor="work-note-textarea">متن یادداشت</label>
            <span className={cn('tabular-nums', isTooLong && 'text-[#C60036] dark:text-rose-400 font-black')}>
              {toPersianDigits(trimmed.length)} / {toPersianDigits(MAX_NOTE_LENGTH)}
            </span>
          </div>
          <textarea
            id="work-note-textarea"
            rows={4}
            autoFocus
            disabled={isDayLocked || isSaving}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (errorMsg && !isDayLocked) setErrorMsg(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="مثلاً: منتظر تایید طراحی صفحه پروفایل یا مشکل اتصال به سرور تست..."
            className="w-full px-3.5 py-2.5 rounded-2xl border-[1.5px] border-sec/25 dark:border-gray-700 bg-white dark:bg-[#182030] text-xs sm:text-sm font-medium text-sec dark:text-white placeholder:text-ink-normal/40 dark:placeholder:text-gray-500 focus:outline-none focus:border-primary disabled:opacity-65 leading-relaxed"
          />
          {!isDayLocked && errorMsg && (
            <p className="text-[11px] font-bold text-[#C60036] dark:text-rose-400">{errorMsg}</p>
          )}
          {isTooLong && (
            <p className="text-[11px] font-bold text-[#C60036] dark:text-rose-400">
              متن یادداشت نمی‌تواند بیشتر از {toPersianDigits(MAX_NOTE_LENGTH)} کاراکتر باشد.
            </p>
          )}
          <p className="text-[10px] font-bold text-ink-normal/45 dark:text-gray-500">
            میانبر ثبت سریع: Ctrl + Enter
          </p>
        </div>

        <div className="flex items-center gap-2.5 pt-1">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={mode === 'edit' && isSaving}
            onClick={handleCloseAction}
          >
            {mode === 'prompt' ? 'رد شدن' : isDayLocked ? 'بستن' : 'انصراف'}
          </Button>
          {!isDayLocked && (
            <Button
              type="button"
              variant="primary"
              className="flex-[2] gap-1.5 font-black"
              isLoading={mode === 'edit' && isSaving}
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              <Check className="w-4 h-4" />
              <span>ثبت یادداشت</span>
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

