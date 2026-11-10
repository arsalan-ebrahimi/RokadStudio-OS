import React, { useEffect, useState } from 'react';
import { Modal, Button } from '@/shared/ui';
import type { Scrum } from '../types/scrum-types';
import { useSyncScrumAdmins } from '../hooks/use-scrum';
import { ScrumAdminsSelector } from './ScrumAdminsSelector';

interface ManageScrumAdminsModalProps {
  scrum: Scrum | null;
  onClose: () => void;
}

export const ManageScrumAdminsModal: React.FC<ManageScrumAdminsModalProps> = ({
  scrum,
  onClose,
}) => {
  const [selectedIds, setSelectedIds] = useState<number[]>(
    scrum?.admins?.map((a) => a.id) || []
  );

  useEffect(() => {
    if (scrum) {
      setSelectedIds((scrum.admins || []).map((a) => a.id));
    }
  }, [scrum]);

  const syncMut = useSyncScrumAdmins(scrum?.id || 0);

  if (!scrum) return null;

  const handleSave = async () => {
    if (syncMut.isPending) return;
    try {
      await syncMut.mutateAsync(selectedIds);
      onClose();
    } catch {
      // Handled by mutation hook toast
    }
  };

  return (
    <Modal
      isOpen={Boolean(scrum)}
      onClose={() => {
        if (!syncMut.isPending) onClose();
      }}
      title={`مدیریت ادمین‌های «${scrum.name}»`}
    >
      <div className="space-y-4">
        <p className="text-xs text-ink-normal/65 dark:text-gray-400 leading-relaxed">
          ادمین‌های انتخاب‌شده به تمام اسپرینت‌ها، پروژه‌ها، KPIها، جلسات و گزارش‌های این اسکرام دسترسی مدیریتی کامل خواهند داشت.
        </p>

        <ScrumAdminsSelector
          selectedIds={selectedIds}
          onChange={setSelectedIds}
          knownUsers={scrum.admins || []}
          enabled={Boolean(scrum)}
          label="انتخاب مدیران اسکرام"
        />

        <div className="flex items-center gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={syncMut.isPending}
          >
            انصراف
          </Button>
          <Button
            type="button"
            variant="primary"
            className="flex-[2] font-extrabold shadow-hard"
            isLoading={syncMut.isPending}
            onClick={handleSave}
          >
            ذخیره ادمین‌ها
          </Button>
        </div>
      </div>
    </Modal>
  );
};
