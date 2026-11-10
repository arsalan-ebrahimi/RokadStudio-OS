import React, { useEffect, useState } from 'react';
import { Shield, Trash2, UserCheck, UserMinus, Plus } from 'lucide-react';
import { Modal, Button, Badge, ConfirmDialog, Skeleton, Checkbox } from '@/shared/ui';
import { cn } from '@/shared/lib/utils';
import type { Scrum, ScrumAdminRef } from '../types/scrum-types';
import {
  useScrum,
  useAddScrumAdmin,
  useRemoveScrumAdmin,
  useUpdateScrumAdminMembership,
} from '../hooks/use-scrum';
import { ScrumAdminsSelector, type ScrumAdminSelection } from './ScrumAdminsSelector';

interface ManageScrumAdminsModalProps {
  scrum: Scrum | null;
  onClose: () => void;
}

export const ManageScrumAdminsModal: React.FC<ManageScrumAdminsModalProps> = ({
  scrum,
  onClose,
}) => {
  const scrumId = scrum?.id || 0;
  const { data: detailedScrum, isLoading: isDetailLoading } = useScrum(scrumId);

  const activeScrum = detailedScrum && detailedScrum.id === scrumId ? detailedScrum : scrum;
  const admins = activeScrum?.admins || [];

  const [newSelections, setNewSelections] = useState<ScrumAdminSelection[]>([]);
  const [isAddingBatch, setIsAddingBatch] = useState(false);

  // Confirm turn OFF membership (`isMember: true -> false`)
  const [confirmUnmemberAdmin, setConfirmUnmemberAdmin] = useState<ScrumAdminRef | null>(null);

  // Confirm removing a SCRUM_ADMIN who is currently also a member (must choose keepMembership)
  const [removeScrumAdminPrompt, setRemoveScrumAdminPrompt] = useState<ScrumAdminRef | null>(null);
  const [keepMembershipChoice, setKeepMembershipChoice] = useState<boolean | null>(null);

  // Confirm removing an ADMIN (auto-removes membership) or a non-member admin
  const [confirmRemoveAdmin, setConfirmRemoveAdmin] = useState<ScrumAdminRef | null>(null);

  useEffect(() => {
    if (!scrum) {
      setNewSelections([]);
      setConfirmUnmemberAdmin(null);
      setRemoveScrumAdminPrompt(null);
      setKeepMembershipChoice(null);
      setConfirmRemoveAdmin(null);
    }
  }, [scrum]);

  const addMut = useAddScrumAdmin(scrumId);
  const removeMut = useRemoveScrumAdmin(scrumId);
  const membershipMut = useUpdateScrumAdminMembership(scrumId);

  if (!scrum) return null;

  const isBusy =
    isAddingBatch || addMut.isPending || removeMut.isPending || membershipMut.isPending;

  const hasIncompleteNewChoice = newSelections.some((s) => s.alsoMember === null);

  const handleAddSelectedAdmins = async () => {
    if (isBusy || newSelections.length === 0 || hasIncompleteNewChoice) return;
    setIsAddingBatch(true);
    try {
      for (const item of newSelections) {
        if (item.alsoMember === null) continue;
        await addMut.mutateAsync({ userId: item.userId, alsoMember: item.alsoMember });
      }
      setNewSelections([]);
    } catch {
      // Handled by hook toast; stop loop so user can adjust remaining items
    } finally {
      setIsAddingBatch(false);
    }
  };

  const handleToggleMembership = (admin: ScrumAdminRef) => {
    if (isBusy) return;
    if (admin.isMember) {
      setConfirmUnmemberAdmin(admin);
    } else {
      membershipMut.mutate({ userId: admin.id, isMember: true });
    }
  };

  const handleClickRemoveAdmin = (admin: ScrumAdminRef) => {
    if (isBusy) return;
    if (admin.role === 'SCRUM_ADMIN' && admin.isMember) {
      setKeepMembershipChoice(null);
      setRemoveScrumAdminPrompt(admin);
    } else {
      setConfirmRemoveAdmin(admin);
    }
  };

  return (
    <>
      <Modal
        isOpen={Boolean(scrum)}
        onClose={() => {
          if (!isBusy) onClose();
        }}
        title={`مدیریت ادمین‌های «${activeScrum?.name || scrum.name}»`}
        className="max-w-xl"
      >
        <div className="space-y-5 max-h-[75vh] overflow-y-auto pe-1">
          <p className="text-xs text-ink-normal/65 dark:text-gray-400 leading-relaxed">
            ادمین‌های اسکرام می‌توانند اسپرینت‌ها، تسک‌ها، KPIها، جلسات و گزارش‌های این اسکرام را مدیریت کنند. عضویت هر ادمین به صورت مجزا قابل فعال یا غیرفعال‌سازی است.
          </p>

          {/* Existing Admins Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-sec dark:text-white flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-club-normal dark:text-purple-300" />
                <span>ادمین‌های فعلی</span>
              </h4>
            </div>

            {isDetailLoading && !detailedScrum ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full rounded-2xl" />
                <Skeleton className="h-14 w-full rounded-2xl" />
              </div>
            ) : admins.length === 0 ? (
              <div className="p-3.5 rounded-2xl border border-dashed border-sec/20 dark:border-gray-700 text-center text-xs font-bold text-ink-normal/55 dark:text-gray-400">
                هنوز ادمینی به این اسکرام اختصاص داده نشده است.
              </div>
            ) : (
              <div className="space-y-2">
                {admins.map((admin) => {
                  const roleLabel = admin.role === 'ADMIN' ? 'ادمین استودیو' : 'مدیر اسکرام';
                  const isAdminMember = Boolean(admin.isMember);

                  return (
                    <div
                      key={admin.id}
                      className="p-3 rounded-2xl border-[1.5px] border-sec/15 dark:border-gray-700 bg-gray-50/80 dark:bg-[#182030] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-8 h-8 rounded-xl bg-club-normal text-white text-xs font-black flex items-center justify-center shrink-0">
                          {admin.name.slice(0, 1)}
                        </span>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-black text-sec dark:text-white truncate">
                              {admin.name}
                            </span>
                            {admin.role && (
                              <Badge
                                variant={admin.role === 'ADMIN' ? 'college' : 'club'}
                                className="text-[10px] py-0.5 px-2"
                              >
                                {roleLabel}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {isAdminMember ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#007A52] dark:text-emerald-300">
                                <UserCheck className="w-3 h-3" />
                                عضو اسکرام هم هست
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-ink-normal/60 dark:text-gray-400">
                                <UserMinus className="w-3 h-3" />
                                فقط مدیریت (بدون عضویت)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t border-sec/10 dark:border-gray-700 sm:border-0 shrink-0">
                        <Checkbox
                          checked={isAdminMember}
                          disabled={isBusy}
                          onChange={() => handleToggleMembership(admin)}
                          label={<span className="text-[11px] font-bold">عضو اسکرام هم هست</span>}
                        />

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleClickRemoveAdmin(admin)}
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-[#C60036] hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer disabled:opacity-50"
                          title="حذف از ادمین‌ها"
                          aria-label={`حذف ${admin.name} از ادمین‌ها`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add New Admin Section */}
          <div className="pt-3 border-t border-sec/10 dark:border-gray-800 space-y-3">
            <ScrumAdminsSelector
              selections={newSelections}
              onChange={setNewSelections}
              excludeIds={admins.map((a) => a.id)}
              knownUsers={admins}
              enabled={Boolean(scrum)}
              label="افزودن ادمین جدید"
              helperText="پس از انتخاب فرد، مشخص کنید که آیا عضو تیم هم هست یا فقط نقش مدیریتی دارد."
            />

            {newSelections.length > 0 && (
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={hasIncompleteNewChoice || isBusy}
                  isLoading={isAddingBatch}
                  onClick={handleAddSelectedAdmins}
                  className="gap-1.5 font-extrabold"
                >
                  <Plus className="w-4 h-4" />
                  <span>افزودن به ادمین‌ها</span>
                </Button>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-sec/10 dark:border-gray-800">
            <Button type="button" variant="outline" onClick={onClose} disabled={isBusy}>
              بستن
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm turning OFF membership (`isMember: true -> false`) */}
      <ConfirmDialog
        isOpen={Boolean(confirmUnmemberAdmin)}
        title="لغو عضویت ادمین در اسکرام"
        message={`با غیرفعال کردن عضویت «${confirmUnmemberAdmin?.name}»، تمام تسک‌های اختصاص‌یافته به ایشان در این اسکرام نیز از حالت انتساب خارج می‌شود و ایشان دیگر در فهرست اعضا و لیدربورد نمایش داده نمی‌شود. ادامه می‌دهید؟`}
        confirmLabel="لغو عضویت"
        variant="danger"
        isLoading={membershipMut.isPending}
        onConfirm={async () => {
          if (!confirmUnmemberAdmin) return;
          try {
            await membershipMut.mutateAsync({
              userId: confirmUnmemberAdmin.id,
              isMember: false,
            });
            setConfirmUnmemberAdmin(null);
          } catch {
            // Handled by hook toast
          }
        }}
        onCancel={() => {
          if (!membershipMut.isPending) setConfirmUnmemberAdmin(null);
        }}
      />

      {/* Remove SCRUM_ADMIN who is also a member -> explicit keepMembership choice */}
      <Modal
        isOpen={Boolean(removeScrumAdminPrompt)}
        onClose={() => {
          if (!removeMut.isPending) setRemoveScrumAdminPrompt(null);
        }}
        dismissible={!removeMut.isPending}
        title="حذف مدیر اسکرام"
      >
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-ink-normal/80 dark:text-gray-300 leading-relaxed">
            «<strong className="text-sec dark:text-white">{removeScrumAdminPrompt?.name}</strong>» علاوه بر ادمین بودن، عضو این اسکرام نیز هست. پس از حذف نقش ادمین، عضویت ایشان در این اسکرام چه وضعیتی داشته باشد؟
          </p>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setKeepMembershipChoice(true)}
              aria-pressed={keepMembershipChoice === true}
              className={cn(
                'w-full p-3 rounded-2xl border-[1.5px] text-start transition-all cursor-pointer space-y-0.5',
                keepMembershipChoice === true
                  ? 'border-sec dark:border-primary bg-primary/15 shadow-hard-sm'
                  : 'border-sec/15 dark:border-gray-700 hover:border-sec/40'
              )}
            >
              <span className="block text-xs font-black text-sec dark:text-white">
                بله، به عنوان عضو معمولی بماند
              </span>
              <span className="block text-[11px] text-ink-normal/65 dark:text-gray-400">
                دسترسی مدیریتی برداشته می‌شود ولی عضویت و تسک‌های ایشان حفظ می‌شود.
              </span>
            </button>

            <button
              type="button"
              onClick={() => setKeepMembershipChoice(false)}
              aria-pressed={keepMembershipChoice === false}
              className={cn(
                'w-full p-3 rounded-2xl border-[1.5px] text-start transition-all cursor-pointer space-y-0.5',
                keepMembershipChoice === false
                  ? 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/30 shadow-hard-sm'
                  : 'border-sec/15 dark:border-gray-700 hover:border-rose-300'
              )}
            >
              <span className="block text-xs font-black text-[#C60036] dark:text-rose-300">
                نه، از اعضای اسکرام هم حذف شود
              </span>
              <span className="block text-[11px] text-ink-normal/65 dark:text-gray-400">
                هم مدیریت و هم عضویت و انتساب تسک‌های ایشان در این اسکرام حذف می‌شود.
              </span>
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRemoveScrumAdminPrompt(null)}
              disabled={removeMut.isPending}
            >
              انصراف
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={keepMembershipChoice === null || removeMut.isPending}
              isLoading={removeMut.isPending}
              onClick={async () => {
                if (!removeScrumAdminPrompt || keepMembershipChoice === null) return;
                try {
                  await removeMut.mutateAsync({
                    userId: removeScrumAdminPrompt.id,
                    keepMembership: keepMembershipChoice,
                  });
                  setRemoveScrumAdminPrompt(null);
                  setKeepMembershipChoice(null);
                } catch {
                  // Handled by hook toast
                }
              }}
            >
              حذف نهایی
            </Button>
          </div>
        </div>
      </Modal>

      {/* Remove ADMIN (or non-member SCRUM_ADMIN) */}
      <ConfirmDialog
        isOpen={Boolean(confirmRemoveAdmin)}
        title="حذف ادمین اسکرام"
        message={
          confirmRemoveAdmin?.role === 'ADMIN'
            ? `با حذف ادمین استودیو «${confirmRemoveAdmin?.name}» از مدیریت این اسکرام، عضویت و انتساب تسک‌های ایشان در این اسکرام نیز به صورت خودکار برداشته می‌شود. ادامه می‌دهید؟`
            : `آیا از حذف «${confirmRemoveAdmin?.name}» از ادمین‌های این اسکرام اطمینان دارید؟`
        }
        confirmLabel="حذف ادمین"
        variant="danger"
        isLoading={removeMut.isPending}
        onConfirm={async () => {
          if (!confirmRemoveAdmin) return;
          try {
            await removeMut.mutateAsync({
              userId: confirmRemoveAdmin.id,
              keepMembership: confirmRemoveAdmin.role === 'ADMIN' ? false : undefined,
            });
            setConfirmRemoveAdmin(null);
          } catch {
            // Handled by hook toast
          }
        }}
        onCancel={() => {
          if (!removeMut.isPending) setConfirmRemoveAdmin(null);
        }}
      />
    </>
  );
};
