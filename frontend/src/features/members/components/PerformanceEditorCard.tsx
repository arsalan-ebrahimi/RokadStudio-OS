import React, { useEffect, useState } from 'react';
import { Edit3, Trash2, Check, X } from 'lucide-react';
import { Button, ConfirmDialog, Badge } from '@/shared/ui';
import { cn } from '@/shared/lib/utils';
import { formatToJalali } from '@/shared/lib/date';
import { toPersianDigits } from '@/shared/lib/formatters';
import {
  PERFORMANCE_LEVELS,
  PERFORMANCE_META,
  type PerformanceLevel,
} from '../types';
import { PerformanceBadge } from './PerformanceBadge';

interface PerformanceEditorCardProps {
  title: string;
  subtitle?: string;
  badgeSlot?: React.ReactNode;
  level: PerformanceLevel | null;
  note: string | null;
  updatedAt: string | null;
  canEdit?: boolean;
  isSaving?: boolean;
  onSave?: (payload: { level: PerformanceLevel | null; note?: string | null }) => Promise<unknown>;
}

const MAX_NOTE_LENGTH = 500;

export const PerformanceEditorCard: React.FC<PerformanceEditorCardProps> = ({
  title,
  subtitle,
  badgeSlot,
  level,
  note,
  updatedAt,
  canEdit = true,
  isSaving = false,
  onSave,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftLevel, setDraftLevel] = useState<PerformanceLevel | null>(level);
  const [draftNote, setDraftNote] = useState<string>(note || '');
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setDraftLevel(level);
      setDraftNote(note || '');
    }
  }, [level, note, isEditing]);

  const trimmedNote = draftNote.trim();
  const isOverLimit = trimmedNote.length > MAX_NOTE_LENGTH;

  const handleOpenEdit = () => {
    setDraftLevel(level);
    setDraftNote(note || '');
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!onSave || isSaving || isOverLimit) return;
    if (!draftLevel) {
      if (note?.trim()) {
        setIsConfirmClearOpen(true);
        return;
      }
      await onSave({ level: null, note: null });
      setIsEditing(false);
      return;
    }

    await onSave({
      level: draftLevel,
      note: trimmedNote || null,
    });
    setIsEditing(false);
  };

  const handleRequestClear = async () => {
    if (!onSave || isSaving) return;
    if (note?.trim()) {
      setIsConfirmClearOpen(true);
      return;
    }
    await onSave({ level: null, note: null });
    setDraftLevel(null);
    setDraftNote('');
    setIsEditing(false);
  };

  const handleConfirmClear = async () => {
    if (!onSave || isSaving) return;
    await onSave({ level: null, note: null });
    setIsConfirmClearOpen(false);
    setDraftLevel(null);
    setDraftNote('');
    setIsEditing(false);
  };

  return (
    <>
      <div className="p-3.5 rounded-2xl border-[1.5px] border-sec/15 dark:border-gray-700 bg-gray-50/75 dark:bg-[#151C28] space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            {badgeSlot}
            <div className="min-w-0">
              <span className="text-xs font-black text-sec dark:text-white">{title}</span>
              {subtitle && (
                <span className="block text-[10px] font-bold text-ink-normal/60 dark:text-gray-400">
                  {subtitle}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <PerformanceBadge level={level} showEmpty />
            {canEdit && onSave && !isEditing && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleOpenEdit}
                className="min-h-[32px] px-2.5 text-[11px] font-bold gap-1"
              >
                <Edit3 className="w-3 h-3" />
                <span>{level ? 'ویرایش' : 'ثبت وضعیت'}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Read-only note + updatedAt display */}
        {!isEditing && (note || updatedAt) && (
          <div className="space-y-1 pt-1 border-t border-sec/10 dark:border-gray-800">
            {note && (
              <p className="text-xs text-ink-normal/80 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                {note}
              </p>
            )}
            {updatedAt && (
              <p className="text-[10px] font-bold text-ink-normal/50 dark:text-gray-400 tabular-nums">
                آخرین بروزرسانی: {formatToJalali(updatedAt.slice(0, 10))}
              </p>
            )}
          </div>
        )}

        {/* Interactive editor */}
        {isEditing && (
          <div className="space-y-3 pt-2 border-t border-sec/10 dark:border-gray-800">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {PERFORMANCE_LEVELS.map((lvl) => {
                const meta = PERFORMANCE_META[lvl];
                const isSelected = draftLevel === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    disabled={isSaving}
                    onClick={() => setDraftLevel(lvl)}
                    title={meta.description}
                    aria-pressed={isSelected}
                    className={cn(
                      'min-h-[38px] px-2 py-1.5 rounded-xl border-[1.5px] text-[11px] font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer',
                      isSelected
                        ? meta.activeCardClass
                        : 'bg-white dark:bg-[#182030] border-sec/15 dark:border-gray-700 text-sec/75 dark:text-gray-300 hover:border-sec/40'
                    )}
                  >
                    <span className={cn('w-2 h-2 rounded-full shrink-0', meta.dotClass)} />
                    <span className="truncate">{meta.label}</span>
                  </button>
                );
              })}
            </div>

            {draftLevel && (
              <p className="text-[11px] font-medium text-ink-normal/65 dark:text-gray-400">
                {PERFORMANCE_META[draftLevel].description}
              </p>
            )}

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-ink-normal/65 dark:text-gray-400">
                <label>یادداشت ارزیابی (اختیاری)</label>
                <span
                  className={cn(
                    'tabular-nums',
                    isOverLimit && 'text-[#C60036] dark:text-rose-400 font-black'
                  )}
                >
                  {toPersianDigits(trimmedNote.length)} / {toPersianDigits(MAX_NOTE_LENGTH)}
                </span>
              </div>
              <textarea
                rows={2}
                value={draftNote}
                disabled={isSaving || !draftLevel}
                onChange={(e) => setDraftNote(e.target.value)}
                placeholder={
                  draftLevel
                    ? 'توضیحات یا نکات کلیدی درباره عملکرد...'
                    : 'ابتدا یکی از سطوح بالا را انتخاب کنید'
                }
                className="w-full px-3 py-2 rounded-xl border-[1.5px] border-sec/20 dark:border-gray-700 bg-white dark:bg-[#182030] text-xs font-medium text-sec dark:text-white placeholder:text-ink-normal/40 dark:placeholder:text-gray-500 focus:outline-none focus:border-primary disabled:opacity-50"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                {level && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isSaving}
                    onClick={handleRequestClear}
                    className="text-[#C60036] dark:text-rose-400 border-rose-300 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/30 gap-1 text-[11px] font-bold"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>پاک کردن وضعیت</span>
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isSaving}
                  onClick={() => {
                    setDraftLevel(level);
                    setDraftNote(note || '');
                    setIsEditing(false);
                  }}
                  className="gap-1 text-[11px]"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>انصراف</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  isLoading={isSaving}
                  disabled={isSaving || isOverLimit || (!draftLevel && !level)}
                  onClick={handleSave}
                  className="gap-1 text-[11px] font-black"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>ذخیره</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={isConfirmClearOpen}
        title="پاک کردن وضعیت عملکرد"
        message="با پاک کردن وضعیت عملکرد، یادداشت ثبت‌شده برای آن نیز حذف می‌شود. آیا ادامه می‌دهید؟"
        confirmLabel="پاک کن"
        variant="danger"
        isLoading={isSaving}
        onConfirm={handleConfirmClear}
        onCancel={() => {
          if (!isSaving) setIsConfirmClearOpen(false);
        }}
      />
    </>
  );
};

export function PerformanceCardBadge({ label }: { label: string }) {
  return <Badge variant="neutral" className="text-[10px] py-0.5 px-2">{label}</Badge>;
}

