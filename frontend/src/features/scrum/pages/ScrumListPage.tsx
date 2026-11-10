import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Layers, ArrowRight, AlertCircle } from 'lucide-react';
import { Button, Skeleton, EmptyState, ErrorState, Modal, ConfirmDialog, toast } from '@/shared/ui';
import { useAuthStore } from '@/features/auth';
import { useScrums, useDeleteScrum } from '../hooks/use-scrum';
import { updateScrum } from '../services/scrum-api';
import type { Scrum } from '../types/scrum-types';
import { ScrumCard } from '../components/ScrumCard';
import { CreateScrumModal } from '../components/CreateScrumModal';
import { EditScrumModal } from '../components/EditScrumModal';
import { ManageScrumAdminsModal } from '../components/ManageScrumAdminsModal';

export const ScrumListPage: React.FC = () => {
  const { user } = useAuthStore();
  const location = useLocation();
  const queryClient = useQueryClient();

  const isPanel = location.pathname.startsWith('/panel');
  const isScrumAdminArea = location.pathname.startsWith('/scrum-admin');
  const basePath = isPanel
    ? '/panel/scrums'
    : isScrumAdminArea
    ? '/scrum-admin/scrums'
    : '/my-scrums';

  const showManagementControls = isPanel && user?.role === 'SUPER_ADMIN';

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingScrum, setEditingScrum] = useState<Scrum | null>(null);
  const [adminsScrum, setAdminsScrum] = useState<Scrum | null>(null);
  const [togglingScrum, setTogglingScrum] = useState<Scrum | null>(null);
  const [deletingScrum, setDeletingScrum] = useState<Scrum | null>(null);
  const [deleteErrorMsg, setDeleteErrorMsg] = useState<string | null>(null);

  const { data: scrums = [], isLoading, isError, error, refetch } = useScrums();

  const deleteMut = useDeleteScrum();

  const toggleArchiveMut = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      updateScrum(id, { isActive }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['scrums'] });
      queryClient.invalidateQueries({ queryKey: ['my-scrum-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['scrum', updated.id] });
      queryClient.invalidateQueries({ queryKey: ['scrum-admin', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['work-targets', 'mine'] });
      toast.success(updated.isActive ? 'اسکرام فعال شد' : 'اسکرام به بایگانی منتقل شد');
      setTogglingScrum(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در تغییر وضعیت اسکرام');
    },
  });

  const handleConfirmDelete = async () => {
    if (!deletingScrum || deleteMut.isPending) return;
    setDeleteErrorMsg(null);
    try {
      await deleteMut.mutateAsync(deletingScrum.id);
      setDeletingScrum(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطا در حذف اسکرام';
      setDeleteErrorMsg(msg);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sec/15 dark:border-gray-800">
        <div className="space-y-1.5">
          {!isPanel && !isScrumAdminArea && (
            <Link
              to="/app"
              className="inline-flex items-center gap-1.5 min-h-[36px] px-2.5 -ms-2.5 rounded-xl text-xs font-bold text-ink-normal/75 dark:text-gray-300 hover:text-sec dark:hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
              <span>بازگشت به پیشخوان تایمر</span>
            </Link>
          )}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-ecosystem-light dark:bg-ecosystem-darker/60 border-[1.5px] border-sec/30 dark:border-primary/40 text-sec dark:text-primary flex items-center justify-center shadow-hard-sm shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-sec dark:text-white">
              {isPanel ? 'مدیریت اسکرام‌ها' : 'اسکرام‌های من'}
            </h1>
          </div>
          <p className="text-xs text-ink-normal/65 dark:text-gray-400 leading-relaxed">
            فضای کاری چابک، مدیریت اسپرینت‌ها، تسک‌ها و پیگیری شاخص‌های عملکرد
          </p>
        </div>

        {showManagementControls && (
          <Button
            variant="primary"
            onClick={() => setIsCreateOpen(true)}
            className="gap-1.5 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>اسکرام جدید</span>
          </Button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="خطا در دریافت لیست اسکرام‌ها"
          message={error instanceof Error ? error.message : 'در دریافت اطلاعات مشکلی پیش آمد.'}
          onRetry={() => refetch()}
        />
      ) : scrums.length === 0 ? (
        <EmptyState
          title="هیچ اسکرامی یافت نشد"
          description={
            showManagementControls
              ? 'برای ایجاد اولین تیم اسکرام روی دکمه «اسکرام جدید» کلیک کنید.'
              : isScrumAdminArea
              ? 'هنوز اسکرامی به شما اختصاص داده نشده است. با مدیر کل در تماس باشید.'
              : 'شما در حال حاضر عضو هیچ تیم اسکرامی نیستید.'
          }
          action={
            showManagementControls ? (
              <Button
                variant="primary"
                onClick={() => setIsCreateOpen(true)}
                className="text-xs font-extrabold shadow-hard gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>ایجاد اولین اسکرام</span>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {scrums.map((scrum) => (
            <ScrumCard
              key={scrum.id}
              scrum={scrum}
              basePath={basePath}
              showManagementMenu={showManagementControls}
              onEdit={(s) => setEditingScrum(s)}
              onManageAdmins={(s) => setAdminsScrum(s)}
              onToggleArchive={(s) => setTogglingScrum(s)}
              onDelete={(s) => {
                setDeleteErrorMsg(null);
                setDeletingScrum(s);
              }}
            />
          ))}
        </div>
      )}

      {/* Create Modal (SA only on /panel/scrums) */}
      {showManagementControls && (
        <CreateScrumModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      )}

      {/* Edit Modal */}
      <EditScrumModal scrum={editingScrum} onClose={() => setEditingScrum(null)} />

      {/* Manage Admins Modal */}
      <ManageScrumAdminsModal scrum={adminsScrum} onClose={() => setAdminsScrum(null)} />

      {/* Archive / Unarchive Confirm */}
      <ConfirmDialog
        isOpen={Boolean(togglingScrum)}
        title={togglingScrum?.isActive ? 'بایگانی اسکرام' : 'فعال‌سازی مجدد اسکرام'}
        message={
          togglingScrum?.isActive
            ? `آیا از بایگانی کردن اسکرام «${togglingScrum?.name}» اطمینان دارید؟ داده‌های قبلی حفظ می‌شوند اما امکان ثبت سشن جدید روی آن متوقف می‌شود.`
            : `آیا از فعال‌سازی مجدد اسکرام «${togglingScrum?.name}» اطمینان دارید؟`
        }
        confirmLabel={togglingScrum?.isActive ? 'بایگانی کن' : 'فعال کن'}
        variant="primary"
        isLoading={toggleArchiveMut.isPending}
        onConfirm={() => {
          if (!togglingScrum || toggleArchiveMut.isPending) return;
          toggleArchiveMut.mutate({ id: togglingScrum.id, isActive: !togglingScrum.isActive });
        }}
        onCancel={() => {
          if (!toggleArchiveMut.isPending) setTogglingScrum(null);
        }}
      />

      {/* Delete Confirm Dialog with 409 server error feedback */}
      <Modal
        isOpen={Boolean(deletingScrum)}
        onClose={() => {
          if (!deleteMut.isPending) {
            setDeletingScrum(null);
            setDeleteErrorMsg(null);
          }
        }}
        title="حذف اسکرام"
      >
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-ink-normal/80 dark:text-gray-300 leading-relaxed">
            آیا از حذف اسکرام «<strong className="text-sec dark:text-white">{deletingScrum?.name}</strong>» اطمینان دارید؟ در صورت وجود سشن کاری روی این اسکرام، حذف انجام نمی‌شود.
          </p>

          {deleteErrorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-2xl border-[1.5px] border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-xs font-bold text-[#C60036] dark:text-rose-300 flex items-start gap-2 leading-relaxed"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{deleteErrorMsg}</span>
            </div>
          )}

          <div className="flex flex-row justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeletingScrum(null);
                setDeleteErrorMsg(null);
              }}
              disabled={deleteMut.isPending}
              className="flex-1 sm:flex-initial"
            >
              انصراف
            </Button>
            <Button
              type="button"
              variant="danger"
              isLoading={deleteMut.isPending}
              disabled={deleteMut.isPending}
              onClick={handleConfirmDelete}
              className="flex-1 sm:flex-initial"
            >
              حذف نهایی
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
