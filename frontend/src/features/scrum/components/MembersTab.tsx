import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserPlus, Trash2, Edit3, Check, Shield } from 'lucide-react';
import {
  Button,
  Input,
  Card,
  ConfirmDialog,
  Modal,
  Badge,
  EmptyState,
  ErrorState,
} from '@/shared/ui';
import { searchActiveUsers } from '@/features/users/api/users-api';
import { useSyncScrumMembers } from '../hooks/use-scrum';
import { SCRUM_COLOR_MAP, type Scrum } from '../types/scrum-types';
import { cn } from '@/shared/lib/utils';
import { toPersianDigits } from '@/shared/lib/formatters';

interface MembersTabProps {
  scrum: Scrum;
  canEdit: boolean;
}

export const MembersTab: React.FC<MembersTabProps> = ({ scrum, canEdit }) => {
  const colorMeta = SCRUM_COLOR_MAP[scrum.color] || SCRUM_COLOR_MAP.ECOSYSTEM;
  const admins = scrum.admins || [];
  const members = scrum.members || [];
  const adminIdSet = new Set(admins.map((a) => a.id));
  const syncMut = useSyncScrumMembers(scrum.id);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserToAdd, setSelectedUserToAdd] = useState<{ id: number; name: string } | null>(null);
  const [newMemberLabel, setNewMemberLabel] = useState('');

  const [editingMember, setEditingMember] = useState<{ userId: number; label: string } | null>(null);
  const [removingMember, setRemovingMember] = useState<{ userId: number; name: string } | null>(null);

  const {
    data: searchResults = [],
    isLoading: isSearching,
    isError: isSearchError,
    error: searchErr,
    refetch: refetchSearch,
  } = useQuery({
    queryKey: ['users-search', searchQuery],
    queryFn: () => searchActiveUsers(searchQuery),
    enabled: isAddModalOpen,
  });

  // Filter out existing members from search results
  const existingMemberIds = new Set(members.map((m) => m.id));
  const availableUsers = searchResults.filter((u) => !existingMemberIds.has(u.id));

  const handleAddMember = async () => {
    if (!selectedUserToAdd) return;
    const currentList = members.map((m) => ({
      userId: m.id,
      label: m.label || null,
    }));

    currentList.push({
      userId: selectedUserToAdd.id,
      label: newMemberLabel.trim() || null,
    });

    try {
      await syncMut.mutateAsync(currentList);
      setIsAddModalOpen(false);
      setSelectedUserToAdd(null);
      setNewMemberLabel('');
      setSearchQuery('');
    } catch {
      // Handled by hook toast
    }
  };

  const handleUpdateLabel = async (userId: number, label: string) => {
    const updatedList = members.map((m) => ({
      userId: m.id,
      label: m.id === userId ? label.trim() || null : m.label || null,
    }));

    try {
      await syncMut.mutateAsync(updatedList);
      setEditingMember(null);
    } catch {
      // Handled by hook toast
    }
  };

  const handleRemoveMember = async () => {
    if (!removingMember) return;
    const remaining = members
      .filter((m) => m.id !== removingMember.userId)
      .map((m) => ({
        userId: m.id,
        label: m.label || null,
      }));

    try {
      await syncMut.mutateAsync(remaining);
      setRemovingMember(null);
    } catch {
      // Handled by hook toast
    }
  };

  return (
    <div className="space-y-6">
      {/* Assigned Scrum Admins Section (Read-Only, managed by SUPER_ADMIN) */}
      <Card className="p-4 sm:p-5 rounded-3xl border-[1.5px] border-sec/20 dark:border-primary/30 shadow-hard-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-sec/10 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-sec dark:text-primary shrink-0" />
            <h3 className="text-sm font-black text-sec dark:text-white">
              ادمین‌های اسکرام ({toPersianDigits(admins.length)} نفر)
            </h3>
          </div>
          <Badge variant="neutral">مدیریت توسط مدیر کل</Badge>
        </div>

        {admins.length === 0 ? (
          <p className="text-xs font-bold text-ink-normal/55 dark:text-gray-400 py-1">
            هنوز ادمین اسکرامی برای این تیم تعیین نشده است.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2.5">
            {admins.map((admin) => (
              <div
                key={admin.id}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-gray-50 dark:bg-[#182030] border-[1.5px] border-sec/15 dark:border-gray-700"
              >
                <span
                  className={cn(
                    'w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black border border-sec/20 shrink-0',
                    colorMeta.solidBg,
                    colorMeta.solidText
                  )}
                >
                  {admin.name.slice(0, 1)}
                </span>
                <span className="text-xs font-bold text-sec dark:text-white">{admin.name}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Top action & header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sec/15 dark:border-gray-800">
        <div>
          <h3 className="text-base sm:text-lg font-black text-sec dark:text-white">
            اعضای تیم اسکرام ({toPersianDigits(members.length)} نفر)
          </h3>
          <p className="text-xs text-ink-normal/65 dark:text-gray-400 mt-0.5 leading-relaxed">
            اعضای این اسکرام به اسپرینت‌ها، پروژه‌ها، جلسات، رتبه‌بندی و شاخص‌های کلیدی دسترسی خواهند داشت.
          </p>
        </div>

        {canEdit && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="gap-1.5 shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>افزودن عضو جدید</span>
          </Button>
        )}
      </div>

      {/* Members Grid */}
      {members.length === 0 ? (
        <EmptyState
          title="هنوز عضوی به این اسکرام اضافه نشده است"
          description={
            canEdit
              ? 'با کلیک روی «افزودن عضو جدید»، اعضای تیم را به اسکرام اضافه کنید.'
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((member) => {
            const isScrumAdmin = adminIdSet.has(member.id);
            const isEditingThis = editingMember?.userId === member.id;

            return (
              <Card
                key={member.id}
                className="p-4 sm:p-5 rounded-3xl border-[1.5px] border-sec/20 dark:border-primary/25 shadow-hard-sm flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm border border-sec/25 shadow-hard-sm shrink-0',
                        colorMeta.solidBg,
                        colorMeta.solidText
                      )}
                    >
                      {member.name.slice(0, 1)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-black text-sec dark:text-white truncate">
                          {member.name}
                        </h4>
                        {isScrumAdmin && (
                          <span className="p-0.5 rounded text-sec dark:text-primary shrink-0" title="ادمین اسکرام">
                            <Shield className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>

                      {/* Member Label */}
                      {isEditingThis ? (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <input
                            value={editingMember.label}
                            onChange={(e) =>
                              setEditingMember({ ...editingMember, label: e.target.value })
                            }
                            placeholder="عنوان نقش..."
                            className="h-9 text-xs px-2.5 rounded-xl border-[1.5px] border-sec/35 dark:border-primary bg-white dark:bg-[#182030] text-sec dark:text-white w-32 focus:outline-none focus:border-primary"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateLabel(member.id, editingMember.label)}
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-[#007A52] dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer shrink-0"
                            title="ذخیره"
                            aria-label={`ذخیره برچسب ${member.name}`}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-ink-normal/65 dark:text-gray-400 font-bold mt-0.5 truncate">
                          {member.label || 'عضو تیم'}
                        </p>
                      )}
                    </div>
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-1 shrink-0">
                      {!isEditingThis && (
                        <button
                          type="button"
                          onClick={() =>
                            setEditingMember({
                              userId: member.id,
                              label: member.label || '',
                            })
                          }
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-sec dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                          title="ویرایش برچسب نقش"
                          aria-label={`ویرایش برچسب ${member.name}`}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setRemovingMember({ userId: member.id, name: member.name })}
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-[#C60036] hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="حذف از اسکرام"
                        aria-label={`حذف ${member.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Member Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setSelectedUserToAdd(null);
        }}
        title="افزودن عضو به اسکرام"
      >
        <div className="space-y-4">
          <Input
            placeholder="جستجوی نام پرسنل..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {/* User selection list */}
          <div className="max-h-52 overflow-y-auto space-y-1.5 p-1.5 rounded-2xl border-[1.5px] border-sec/20 dark:border-gray-700 bg-gray-50 dark:bg-[#151C28]">
            {isSearching ? (
              <p className="p-3 text-center text-xs text-gray-400">در حال جستجو...</p>
            ) : isSearchError ? (
              <ErrorState
                compact
                title="خطا در جستجوی کاربران"
                message={searchErr instanceof Error ? searchErr.message : undefined}
                onRetry={() => refetchSearch()}
              />
            ) : availableUsers.length === 0 ? (
              <p className="p-3 text-center text-xs text-gray-400">کاربری یافت نشد</p>
            ) : (
              availableUsers.map((u) => {
                const isSelected = selectedUserToAdd?.id === u.id;
                return (
                  <button
                    type="button"
                    key={u.id}
                    onClick={() => setSelectedUserToAdd({ id: u.id, name: u.name })}
                    className={cn(
                      'w-full min-h-[44px] px-3 py-2 rounded-xl text-start text-xs font-black transition-all flex items-center justify-between cursor-pointer border',
                      isSelected
                        ? 'bg-primary text-sec border-sec/40 shadow-[1.5px_1.5px_0_#202A5A]'
                        : 'border-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-sec dark:text-white'
                    )}
                  >
                    <span>{u.name}</span>
                    {isSelected && <Check className="w-4 h-4 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          {selectedUserToAdd && (
            <div className="space-y-1.5 pt-1">
              <Input
                label={`برچسب / عنوان نقش برای ${selectedUserToAdd.name} (اختیاری)`}
                placeholder="مثال: توسعه‌دهنده فرانت‌اند، طراح محصول"
                value={newMemberLabel}
                onChange={(e) => setNewMemberLabel(e.target.value)}
              />
            </div>
          )}

          <div className="flex items-center gap-2.5 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setIsAddModalOpen(false)}
            >
              انصراف
            </Button>
            <Button
              variant="primary"
              className="flex-[2]"
              disabled={!selectedUserToAdd || syncMut.isPending}
              isLoading={syncMut.isPending}
              onClick={handleAddMember}
            >
              افزودن به تیم
            </Button>
          </div>
        </div>
      </Modal>

      {/* Remove Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(removingMember)}
        title="حذف عضو از اسکرام"
        message={`آیا از حذف «${removingMember?.name}» از این اسکرام اطمینان دارید؟ در صورت داشتن آیتم‌های اختصاص‌یافته در اسپرینت‌ها، آن آیتم‌ها به وضعیت «بدون مسئول» تغییر خواهند کرد ولی سشن‌های کاری قبلی دست‌نخورده باقی می‌مانند.`}
        variant="danger"
        isLoading={syncMut.isPending}
        onConfirm={handleRemoveMember}
        onCancel={() => setRemovingMember(null)}
      />
    </div>
  );
};
