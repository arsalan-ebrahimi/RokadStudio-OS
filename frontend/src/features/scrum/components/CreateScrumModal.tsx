import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal, Input, Button, Select } from '@/shared/ui';
import { useAuthStore } from '@/features/auth';
import { searchActiveUsers } from '@/features/users/api/users-api';
import { SCRUM_COLOR_MAP, type ScrumColor } from '../types/scrum-types';
import { useCreateScrum } from '../hooks/use-scrum';
import { cn } from '@/shared/lib/utils';

interface CreateScrumModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const COLOR_KEYS: ScrumColor[] = ['ECOSYSTEM', 'MALE', 'FEMALE', 'COLLEGE', 'CLUB'];

export const CreateScrumModal: React.FC<CreateScrumModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<ScrumColor>('ECOSYSTEM');
  const [ownerId, setOwnerId] = useState<number | undefined>(undefined);

  const { data: users = [] } = useQuery({
    queryKey: ['users-search-all'],
    queryFn: () => searchActiveUsers(),
    enabled: isOpen && isSuperAdmin,
  });

  const createMut = useCreateScrum();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await createMut.mutateAsync({
      name: name.trim(),
      description: description.trim() || undefined,
      color,
      ownerId: isSuperAdmin && ownerId ? ownerId : undefined,
    });

    setName('');
    setDescription('');
    setColor('ECOSYSTEM');
    setOwnerId(undefined);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="ایجاد اسکرام جدید">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="نام اسکرام"
          required
          placeholder="مثال: اسکرام توسعه پلتفرم"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-ink-normal/80 dark:text-gray-300">
            توضیحات (اختیاری)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="اهداف و مسئولیت‌های این اسکرام..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#182030] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all shadow-hard-sm"
          />
        </div>

        {/* Color Swatches */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-ink-normal/80 dark:text-gray-300">
            رنگ سازمانی اسکرام
          </label>
          <div className="grid grid-cols-5 gap-2 pt-1">
            {COLOR_KEYS.map((key) => {
              const meta = SCRUM_COLOR_MAP[key];
              const isSelected = color === key;
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setColor(key)}
                  className={cn(
                    'h-11 rounded-xl border-2 flex flex-col items-center justify-center transition-all cursor-pointer shadow-hard-sm',
                    isSelected
                      ? 'border-sec dark:border-white scale-105 shadow-hard'
                      : 'border-transparent hover:scale-102'
                  )}
                  style={{ backgroundColor: meta.accent }}
                  title={meta.label}
                >
                  {isSelected && (
                    <div className="w-2.5 h-2.5 rounded-full bg-white shadow-sm" />
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-ink-normal/50 dark:text-gray-400 font-bold mt-1">
            {SCRUM_COLOR_MAP[color].label}
          </p>
        </div>

        {/* Owner select for Super Admin */}
        {isSuperAdmin && (
          <div className="space-y-1.5 pt-1">
            <Select
              label="مالک اسکرام (اختیاری - پیش‌فرض خودتان)"
              value={ownerId || ''}
              onChange={(e) => setOwnerId(e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">پیش‌فرض (خودم)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="flex items-center gap-2 pt-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={createMut.isPending}
          >
            انصراف
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="flex-[2] font-extrabold shadow-hard"
            isLoading={createMut.isPending}
            disabled={!name.trim()}
          >
            ایجاد اسکرام
          </Button>
        </div>
      </form>
    </Modal>
  );
};

