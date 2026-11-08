import React, { useState } from 'react';
import { Modal, Button } from '@/shared/ui';
import { CheckCircle2, CalendarX2, ArrowRight, AlertCircle, HeartHandshake } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface AttendanceModalProps {
  isOpen: boolean;
  userName: string;
  onConfirmPresent: () => void;
  onConfirmAbsent: (reason: string) => void;
  isLoading?: boolean;
}

const QUICK_REASONS = [
  { id: 'leave', label: 'مرخصی روزانه', icon: '🏖️' },
  { id: 'sick', label: 'استعلاجی / بیماری', icon: '🤒' },
  { id: 'personal', label: 'کار شخصی و امور اداری', icon: '💼' },
  { id: 'mission', label: 'ماموریت کاری / خارج از دفتر', icon: '🚗' },
  { id: 'other', label: 'سایر موارد', icon: '✏️' },
];

export const AttendanceModal: React.FC<AttendanceModalProps> = ({
  isOpen,
  userName,
  onConfirmPresent,
  onConfirmAbsent,
  isLoading = false,
}) => {
  const [step, setStep] = useState<'INITIAL' | 'REASON'>('INITIAL');
  const [selectedTag, setSelectedTag] = useState<string>('مرخصی روزانه');
  const [customNote, setCustomNote] = useState<string>('');

  const handleBack = () => {
    setStep('INITIAL');
  };

  const handleConfirmAbsent = () => {
    let finalReason = selectedTag;
    if (customNote.trim()) {
      finalReason = selectedTag === 'سایر موارد' ? customNote.trim() : `${selectedTag} (${customNote.trim()})`;
    }
    onConfirmAbsent(finalReason);
  };

  return (
    <Modal
      isOpen={isOpen}
      dismissible={false}
      title={step === 'INITIAL' ? 'اعلام وضعیت روزانه' : 'ثبت عدم حضور امروز'}
    >
      {step === 'INITIAL' ? (
        <div className="space-y-5 text-center py-2">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/15 dark:bg-primary/20 flex items-center justify-center text-primary shadow-sm">
            <HeartHandshake className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h4 className="text-base font-extrabold text-sec dark:text-white">
              سلام {userName} عزیز! 👋
            </h4>
            <p className="text-xs sm:text-sm text-ink-normal/70 dark:text-gray-300 font-medium leading-relaxed">
              برنامه‌ات برای امروز چیه؟ لطفاً وضعیتت رو مشخص کن تا بریم سراغ کارها.
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            <Button
              variant="primary"
              className="w-full py-3 sm:py-3.5 flex items-center justify-center gap-2 text-sm font-bold shadow-hard"
              onClick={onConfirmPresent}
              isLoading={isLoading}
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>حاضرم و شروع کار</span>
            </Button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => setStep('REASON')}
              className="w-full py-3 px-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-rose-400 dark:hover:border-rose-600 bg-transparent text-gray-600 dark:text-gray-300 hover:text-rose-600 dark:hover:text-rose-400 font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <CalendarX2 className="w-4 h-4 text-rose-500" />
              <span>امروز نمی‌آیم</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 py-1 text-right">
          <div className="flex items-center gap-2 text-xs font-bold text-ink-normal/70 dark:text-gray-300">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>علت عدم حضور خود را انتخاب کنید:</span>
          </div>

          {/* Quick Reason Chips */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {QUICK_REASONS.map((r) => {
              const isSelected = selectedTag === r.label;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedTag(r.label)}
                  className={cn(
                    'p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all text-right cursor-pointer',
                    isSelected
                      ? 'border-primary bg-primary/10 dark:bg-primary/20 text-sec dark:text-white shadow-sm ring-1 ring-primary'
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-[#182030] text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  )}
                >
                  <span className="text-base">{r.icon}</span>
                  <span className="truncate">{r.label}</span>
                </button>
              );
            })}
          </div>

          {/* Extra Notes Input */}
          <div className="space-y-1.5 pt-1">
            <label className="text-[11px] font-bold text-ink-normal/60 dark:text-gray-400 block">
              {selectedTag === 'سایر موارد' ? 'شرح علت عدم حضور (الزامی):' : 'توضیحات تکمیلی (اختیاری):'}
            </label>
            <textarea
              rows={2}
              maxLength={200}
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="مثلاً: هماهنگ‌شده با مدیر یا جزئیات مرخصی..."
              className="w-full text-xs p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#182030] text-sec dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-primary resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isLoading}
              className="flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <ArrowRight className="w-4 h-4" />
              <span>بازگشت</span>
            </Button>

            <Button
              variant="danger"
              onClick={handleConfirmAbsent}
              isLoading={isLoading}
              disabled={selectedTag === 'سایر موارد' && !customNote.trim()}
              className="flex-[2] py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
            >
              <CalendarX2 className="w-4 h-4" />
              <span>ثبت عدم حضور</span>
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
