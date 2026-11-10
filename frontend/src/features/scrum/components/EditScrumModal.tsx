import React, { useEffect, useState } from 'react';
import { Modal, Input, Button } from '@/shared/ui';
import { SCRUM_COLOR_MAP, type Scrum, type ScrumColor } from '../types/scrum-types';
import { useUpdateScrum } from '../hooks/use-scrum';
import { cn } from '@/shared/lib/utils';

interface EditScrumModalProps {
  scrum: Scrum | null;
  onClose: () => void;
}

const COLOR_KEYS: ScrumColor[] = ['ECOSYSTEM', 'MALE', 'FEMALE', 'COLLEGE', 'CLUB'];

export const EditScrumModal: React.FC<EditScrumModalProps> = ({ scrum, onClose }) => {
  const [name, setName] = useState(scrum?.name || '');
  const [description, setDescription] = useState(scrum?.description || '');
  const [color, setColor] = useState<ScrumColor>(scrum?.color || 'ECOSYSTEM');

  useEffect(() => {
    if (scrum) {
      setName(scrum.name);
      setDescription(scrum.description || '');
      setColor(scrum.color);
    }
  }, [scrum]);

  const updateMut = useUpdateScrum(scrum?.id || 0);

  if (!scrum) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || updateMut.isPending) return;

    try {
      await updateMut.mutateAsync({
        name: name.trim(),
        description: description.trim() ? description.trim() : null,
        color,
      });
      onClose();
    } catch {
      // Handled by mutation hook toast
    }
  };

  return (
    <Modal
      isOpen={Boolean(scrum)}
      onClose={() => {
        if (!updateMut.isPending) onClose();
      }}
      title={`ویرایش اسکرام «${scrum.name}»`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="نام اسکرام"
          required
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
            rows={3}
            placeholder="اهداف و مسئولیت‌های این اسکرام..."
            className="w-full px-3.5 py-2.5 rounded-2xl border-[1.5px] border-sec/20 dark:border-gray-700 bg-white dark:bg-[#182030] text-xs font-medium text-sec dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all shadow-hard-sm"
          />
        </div>

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

        <div className="flex items-center gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={updateMut.isPending}
          >
            انصراف
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="flex-[2] font-extrabold shadow-hard"
            isLoading={updateMut.isPending}
            disabled={!name.trim() || updateMut.isPending}
          >
            ذخیره تغییرات
          </Button>
        </div>
      </form>
    </Modal>
  );
};
