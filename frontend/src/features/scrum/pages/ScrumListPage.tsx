import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Layers } from 'lucide-react';
import { Button } from '@/shared/ui';
import { useAuthStore } from '@/features/auth';
import { useScrums } from '../hooks/use-scrum';
import { ScrumCard } from '../components/ScrumCard';
import { CreateScrumModal } from '../components/CreateScrumModal';

export const ScrumListPage: React.FC = () => {
  const { user } = useAuthStore();
  const location = useLocation();
  const isPanel = location.pathname.startsWith('/panel');
  const basePath = isPanel ? '/panel/scrums' : '/my-scrums';

  const canCreate = user?.role === 'SUPER_ADMIN' || user?.role === 'SCRUM_ADMIN';
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: scrums = [], isLoading } = useScrums();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-hard-sm">
              <Layers className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-sec dark:text-white">
              {isPanel ? 'مدیریت اسکرام‌ها' : 'اسکرام‌های من'}
            </h1>
          </div>
          <p className="text-xs text-ink-normal/60 dark:text-gray-400 mt-1 leading-relaxed">
            فضای کاری چابک، مدیریت اسپرینت‌ها، تخمین پوینت و پیگیری شاخص‌های کلیدی عملکرد
          </p>
        </div>

        {canCreate && (
          <Button
            variant="primary"
            onClick={() => setIsCreateOpen(true)}
            className="text-xs font-extrabold gap-1.5 shadow-hard self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>اسکرام جدید</span>
          </Button>
        )}
      </div>

      {/* Scrums List Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-44 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse border-2 border-transparent"
            />
          ))}
        </div>
      ) : scrums.length === 0 ? (
        <div className="py-16 text-center space-y-4 max-w-md mx-auto">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-primary/10 border-2 border-primary/30 flex items-center justify-center text-primary text-3xl shadow-hard">
            🚀
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-sec dark:text-white">
              هیچ اسکرامی یافت نشد
            </h3>
            <p className="text-xs text-ink-normal/60 dark:text-gray-400">
              {canCreate
                ? 'برای ایجاد اولین تیم اسکرام روی دکمه «اسکرام جدید» کلیک کنید.'
                : 'شما در حال حاضر عضو هیچ تیم اسکرامی نیستید.'}
            </p>
          </div>
          {canCreate && (
            <Button
              variant="primary"
              onClick={() => setIsCreateOpen(true)}
              className="text-xs font-extrabold shadow-hard gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>ایجاد اولین اسکرام</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {scrums.map((scrum) => (
            <ScrumCard key={scrum.id} scrum={scrum} basePath={basePath} />
          ))}
        </div>
      )}

      {/* Create Scrum Modal */}
      <CreateScrumModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </div>
  );
};
