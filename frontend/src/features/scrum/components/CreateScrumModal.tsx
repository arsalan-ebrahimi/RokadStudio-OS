import React, { useState } from 'react';
import { Modal, Input, Button } from '@/shared/ui';
import { SCRUM_COLOR_MAP, type ScrumAdminInput, type ScrumColor } from '../types/scrum-types';
import { useCreateScrum } from '../hooks/use-scrum';
import { ScrumAdminsSelector, type ScrumAdminSelection } from './ScrumAdminsSelector';
import { cn } from '@/shared/lib/utils';

interface CreateScrumModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const COLOR_KEYS: ScrumColor[] = ['ECOSYSTEM', 'MALE', 'FEMALE', 'COLLEGE', 'CLUB'];

export const CreateScrumModal: React.FC<CreateScrumModalProps> = ({ isOpen, onClose }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<ScrumColor>('ECOSYSTEM');
  const [adminSelections, setAdminSelections] = useState<ScrumAdminSelection[]>([]);

  const createMut = useCreateScrum();

  const hasIncompleteAdminChoice = adminSelections.some((s) => s.alsoMember === null);

  const handleClose = () => {
    if (createMut.isPending) return;
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || createMut.isPending || hasIncompleteAdminChoice) return;

    const adminsPayload: ScrumAdminInput[] = adminSelections
      .filter((s): s is { userId: number; alsoMember: boolean } => s.alsoMember !== null)
      .map((s) => ({ userId: s.userId, alsoMember: s.alsoMember }));

    await createMut.mutateAsync({
      name: name.trim(),
      description: description.trim() || undefined,
      color,
      admins: adminsPayload.length > 0 ? adminsPayload : undefined,
    });

    setName('');
    setDescription('');
    setColor('ECOSYSTEM');
    setAdminSelections([]);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="ایجاد اسکرام جدید">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="نام اسکرام"
          required
          placeholder="مثال: اسکرام توسعه پلتفرم"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-ink-normal/80 dark:text-gray-300">
            توضیحات (اختیاری)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="اهداف و مسئولیت‌های این اسکرام..."
            className="w-full px-3.5 py-2.5 rounded-2xl border-[1.5px] border-sec/20 dark:border-gray-700 bg-white dark:bg-[#182030] text-xs font-medium text-sec dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all shadow-hard-sm"
          />
        </div>

        {/* Color Swatches */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-ink-normal/80 dark:text-gray-300">
            رنگ سازمانی اسکرام
          </label>
          <div className="grid grid-cols-5 gap-2 pt-1">
            {COLOR_KEYS.map((key) => {
              const meta = SCRUM_COLOR_MAP[key];
              const isSelected = color === key;
              const useDarkDot = key === 'ECOSYSTEM' || key === 'COLLEGE';
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setColor(key)}
                  className={cn(
                    'h-11 rounded-2xl border-[1.5px] flex items-center justify-center transition-all cursor-pointer shadow-hard-sm',
                    meta.solidBg,
                    isSelected
                      ? 'border-sec dark:border-white scale-105 shadow-hard'
                      : 'border-transparent opacity-85 hover:opacity-100'
                  )}
                  title={meta.label}
                  aria-label={meta.label}
                  aria-pressed={isSelected}
                >
                  {isSelected && (
                    <div
                      className={cn(
                        'w-3 h-3 rounded-full shadow-sm',
                        useDarkDot ? 'bg-sec' : 'bg-white'
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-ink-normal/60 dark:text-gray-400 font-bold mt-1">
            {SCRUM_COLOR_MAP[color].label}
          </p>
        </div>

        {/* Scrum Admins Multi-Select with explicit membership choice */}
        <ScrumAdminsSelector
          selections={adminSelections}
          onChange={setAdminSelections}
          enabled={isOpen}
          label="ادمین‌های اسکرام (اختیاری)"
        />

        {hasIncompleteAdminChoice && (
          <p className="text-[11px] font-bold text-[#704A0D] dark:text-amber-300">
            لطفاً برای همه ادمین‌های انتخاب‌شده وضعیت عضویت در اسکرام را مشخص کنید.
          </p>
        )}

        <div className="flex items-center gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={handleClose}
            disabled={createMut.isPending}
          >
            انصراف
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="flex-[2] font-extrabold shadow-hard"
            isLoading={createMut.isPending}
            disabled={!name.trim() || createMut.isPending || hasIncompleteAdminChoice}
          >
            ایجاد اسکرام
          </Button>
        </div>
      </form>
    </Modal>
  );
};
