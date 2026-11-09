import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserPlus, Trash2, Edit3, Check, Shield } from 'lucide-react';
import { Button, Input, Card, ConfirmDialog, Modal } from '@/shared/ui';
import { searchActiveUsers } from '@/features/users/api/users-api';
import { useSyncScrumMembers } from '../hooks/use-scrum';
import type { Scrum } from '../types/scrum-types';
import { cn } from '@/shared/lib/utils';
import { toPersianDigits } from '@/shared/lib/formatters';

interface MembersTabProps {
  scrum: Scrum;
  canEdit: boolean;
}

export const MembersTab: React.FC<MembersTabProps> = ({ scrum, canEdit }) => {
  const members = scrum.members || [];
  const syncMut = useSyncScrumMembers(scrum.id);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserToAdd, setSelectedUserToAdd] = useState<{ id: number; name: string } | null>(null);
  const [newMemberLabel, setNewMemberLabel] = useState('');

  const [editingMember, setEditingMember] = useState<{ userId: number; label: string } | null>(null);
  const [removingMember, setRemovingMember] = useState<{ userId: number; name: string } | null>(null);

  const { data: searchResults = [], isLoading: isSearching } = useQuery({
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

    await syncMut.mutateAsync(currentList);
    setIsAddModalOpen(false);
    setSelectedUserToAdd(null);
    setNewMemberLabel('');
    setSearchQuery('');
  };

  const handleUpdateLabel = async (userId: number, label: string) => {
    const updatedList = members.map((m) => ({
      userId: m.id,
      label: m.id === userId ? (label.trim() || null) : (m.label || null),
    }));

    await syncMut.mutateAsync(updatedList);
    setEditingMember(null);
  };

  const handleRemoveMember = async () => {
    if (!removingMember) return;
    const remaining = members
      .filter((m) => m.id !== removingMember.userId)
      .map((m) => ({
        userId: m.id,
        label: m.label || null,
      }));

    await syncMut.mutateAsync(remaining);
    setRemovingMember(null);
  };

  return (
    <div className="space-y-6">
      {/* Top action & header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h3 className="text-base sm:text-lg font-black text-sec dark:text-white">
            اعضای تیم اسکرام ({toPersianDigits(members.length)} نفر)
          </h3>
          <p className="text-xs text-ink-normal/60 dark:text-gray-400 mt-0.5">
            اعضای این اسکرام به اسپرینت‌ها، تسک‌ها، جلسات و شاخص‌های کلیدی دسترسی خواهند داشت.
          </p>
        </div>

        {canEdit && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="text-xs font-extrabold gap-1.5 shadow-hard-sm"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>افزودن عضو جدید</span>
          </Button>
        )}
      </div>

      {/* Members Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map((member) => {
          const isOwner = member.id === scrum.ownerId;
          const isEditingThis = editingMember?.userId === member.id;

          return (
            <Card
              key={member.id}
              className="p-4 border-2 border-primary/20 shadow-hard-sm flex flex-col justify-between space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#612B89] text-white flex items-center justify-center font-black text-sm shadow-hard-sm shrink-0">
                    {member.name.slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-black text-sec dark:text-white truncate">
                        {member.name}
                      </h4>
                      {isOwner && (
                        <span
                          className="p-0.5 rounded text-amber-500"
                          title="مالک اسکرام"
                        >
                          <Shield className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>

                    {/* Member Label */}
                    {isEditingThis ? (
                      <div className="flex items-center gap-1 mt-1">
                        <input
                          value={editingMember.label}
                          onChange={(e) =>
                            setEditingMember({ ...editingMember, label: e.target.value })
                          }
                          placeholder="عنوان نقش..."
                          className="text-[11px] px-2 py-0.5 rounded border border-primary bg-white dark:bg-[#182030] text-sec dark:text-white w-28"
                          autoFocus
                        />
                        <button
                          onClick={() => handleUpdateLabel(member.id, editingMember.label)}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                          title="ذخیره"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-ink-normal/60 dark:text-gray-400 font-bold mt-0.5">
                        {member.label || 'عضو تیم'}
                      </p>
                    )}
                  </div>
                </div>

                {canEdit && (
                  <div className="flex items-center gap-1">
                    {!isEditingThis && (
                      <button
                        onClick={() =>
                          setEditingMember({
                            userId: member.id,
                            label: member.label || '',
                          })
                        }
                        className="p-1 text-gray-400 hover:text-sec dark:hover:text-white rounded transition-colors"
                        title="ویرایش برچسب نقش"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => setRemovingMember({ userId: member.id, name: member.name })}
                      className="p-1 text-gray-400 hover:text-rose-500 rounded transition-colors"
                      title="حذف از اسکرام"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

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
          <div className="max-h-48 overflow-y-auto space-y-1.5 p-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#151C28]">
            {isSearching ? (
              <p className="p-3 text-center text-xs text-gray-400">در حال جستجو...</p>
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
                      'w-full p-2.5 rounded-lg text-right text-xs font-bold transition-all flex items-center justify-between',
                      isSelected
                        ? 'bg-primary text-white shadow-sm'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-sec dark:text-white'
                    )}
                  >
                    <span>{u.name}</span>
                    {isSelected && <Check className="w-4 h-4" />}
                  </button>
                );
              })
            )}
          </div>

          {selectedUserToAdd && (
            <div className="space-y-1.5 pt-2">
              <Input
                label={`برچسب / عنوان نقش برای ${selectedUserToAdd.name} (اختیاری)`}
                placeholder="مثال: توسعه‌دهنده فرانت‌اند، طراح محصول"
                value={newMemberLabel}
                onChange={(e) => setNewMemberLabel(e.target.value)}
              />
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setIsAddModalOpen(false)}
            >
              انصراف
            </Button>
            <Button
              variant="primary"
              className="flex-[2] font-extrabold shadow-hard"
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
        message={`آیا از حذف «${removingMember?.name}» از این اسکرام اطمینان دارید؟ در صورت داشتن پروژه‌ها/تسک‌های اختصاص‌یافته در اسپرینت‌ها، آن تسک‌ها به وضعیت «بدون مسئول» تغییر خواهند کرد ولی سشن‌های کاری قبلی دست‌نخورده باقی می‌مانند.`}
        variant="danger"
        isLoading={syncMut.isPending}
        onConfirm={handleRemoveMember}
        onCancel={() => setRemovingMember(null)}
      />
    </div>
  );
};
