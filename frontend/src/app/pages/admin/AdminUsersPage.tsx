import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Copy, Check } from 'lucide-react';
import { Card, Button, Input, Select, Modal, ConfirmDialog, Skeleton, EmptyState, Badge, toast } from '@/shared/ui';
import { fetchUsers, createUser, updateUser, deleteUser } from '@/features/users/api/users-api';
import { suggestNextUserCode } from '@/features/users/lib/code-generator';
import { useAuthStore } from '@/features/auth';
import type { User, Role } from '@/shared/types/models';

export const AdminUsersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserRole, setEditUserRole] = useState<Role>('USER');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [formName, setFormName] = useState('');
  const [formPrefix, setFormPrefix] = useState('IT');
  const [formCode, setFormCode] = useState('');
  const [formRole, setFormRole] = useState<Role>('USER');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', searchTerm],
    queryFn: () => fetchUsers({ search: searchTerm || undefined }),
    staleTime: 30_000,
  });

  const users = data?.data || [];

  const handleOpenAdd = () => {
    const next = suggestNextUserCode(users, formPrefix);
    setFormCode(next);
    setFormName('');
    setIsAddOpen(true);
  };

  const createMut = useMutation({
    mutationFn: () => createUser({ name: formName.trim(), code: formCode.trim(), role: formRole }),
    onSuccess: (newUser: User) => {
      queryClient.setQueriesData({ queryKey: ['admin-users'] }, (old: any) => {
        if (!old?.data) return { data: [newUser] };
        return {
          ...old,
          data: [newUser, ...old.data.filter((u: User) => u.id !== newUser.id)],
        };
      });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setIsAddOpen(false);
      setCreatedCode(newUser.code || formCode);
      toast.success('کاربر ایجاد شد');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { name?: string; role?: Role; isActive?: boolean } }) =>
      updateUser(id, payload),
    onSuccess: (updated: User) => {
      queryClient.setQueriesData({ queryKey: ['admin-users'] }, (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((u: User) => (u.id === updated.id ? { ...u, ...updated } : u)),
        };
      });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setEditingUser(null);
      toast.success('تغییرات ذخیره شد');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onMutate: async (deletedId: number) => {
      setDeletingId(null);
      queryClient.setQueriesData({ queryKey: ['admin-users'] }, (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((u: User) => u.id !== deletedId),
        };
      });
    },
    onSuccess: () => {
      toast.success('کاربر حذف شد');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: Error) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.error(err.message);
    },
  });

  const handleCopyCode = () => {
    if (createdCode) {
      navigator.clipboard.writeText(createdCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setEditUserName(u.name);
    setEditUserRole(u.role);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <h1 className="text-lg font-black text-sec dark:text-white">مدیریت پرسنل</h1>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Input
            placeholder="جستجوی نام..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            containerClassName="flex-1 sm:w-48"
            className="h-[38px] text-xs"
          />
          <Button size="sm" variant="primary" onClick={handleOpenAdd} className="shrink-0">
            <Plus className="w-4 h-4 me-1" />
            افزودن کاربر
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : users.length === 0 ? (
        <EmptyState title="کاربری یافت نشد" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {users.map((u: User) => {
            const isSelf = currentUser?.id === u.id;
            return (
              <Card key={u.id} className="p-4 sm:p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <p className="text-sm sm:text-base font-bold text-sec dark:text-white truncate" title={u.name}>
                      {u.name}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant={u.role === 'SUPER_ADMIN' ? 'female' : u.role === 'ADMIN' ? 'college' : 'male'}>
                        {u.role === 'SUPER_ADMIN' ? 'مدیر ارشد' : u.role === 'ADMIN' ? 'ادمین' : 'کاربر'}
                      </Badge>
                      {!u.isActive && <Badge variant="neutral">غیرفعال</Badge>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-gray-50 dark:bg-[#182030] px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
                    <span className="text-[11px] text-ink-normal/60 dark:text-gray-400 font-bold">کد پرسنلی:</span>
                    <span className="text-xs font-mono font-bold text-sec dark:text-white tracking-wide" dir="ltr">{u.code}</span>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end">
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => openEditModal(u)} aria-label="ویرایش">
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="danger" disabled={isSelf} onClick={() => setDeletingId(u.id)} aria-label="حذف">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="افزودن کاربر جدید">
        <div className="space-y-3.5">
          <Input label="نام و نام خانوادگی" value={formName} onChange={(e) => setFormName(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="پیشوند دپارتمان (۲ کاراکتر)"
              maxLength={2}
              value={formPrefix}
              onChange={(e) => {
                const val = e.target.value.toUpperCase().slice(0, 2);
                setFormPrefix(val);
                setFormCode(suggestNextUserCode(users, val));
              }}
            />
            <Input
              label="کد پرسنلی (۶ کاراکتر)"
              maxLength={6}
              value={formCode}
              onChange={(e) => setFormCode(e.target.value.toUpperCase().slice(0, 6))}
            />
          </div>
          <Select
            label="نقش کاربر"
            value={formRole}
            onChange={(e) => setFormRole(e.target.value as Role)}
          >
            <option value="USER">کاربر عادی</option>
            <option value="ADMIN">ادمین</option>
            <option value="SCRUM_ADMIN">مدیر اسکرام</option>
            <option value="SUPER_ADMIN">مدیر ارشد</option>
          </Select>
          <Button variant="primary" className="w-full mt-4" isLoading={createMut.isPending} onClick={() => createMut.mutate()}>
            ثبت کاربر
          </Button>
        </div>
      </Modal>

      {/* Created Code Presentation Modal */}
      <Modal isOpen={Boolean(createdCode)} onClose={() => setCreatedCode(null)} title="کد ورود پرسنل">
        <div className="text-center space-y-4 py-2">
          <p className="text-xs text-ink-normal/60 dark:text-gray-400">کد زیر را جهت ورود به کاربر تحویل دهید:</p>
          <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center gap-3">
            <span className="text-2xl font-black font-mono tracking-widest text-primary" dir="ltr">{createdCode}</span>
            <button onClick={handleCopyCode} className="p-2 rounded-xl bg-white dark:bg-[#151C28] text-sec dark:text-white shadow-hard-sm">
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      {editingUser && (
        <Modal isOpen onClose={() => setEditingUser(null)} title="ویرایش کاربر">
          <div className="space-y-3.5">
            <Input label="نام کامل" value={editUserName} onChange={(e) => setEditUserName(e.target.value)} />
            <Select
              label="نقش"
              value={editUserRole}
              disabled={currentUser?.id === editingUser.id}
              onChange={(e) => setEditUserRole(e.target.value as Role)}
            >
              <option value="USER">کاربر عادی</option>
              <option value="ADMIN">ادمین</option>
              <option value="SCRUM_ADMIN">مدیر اسکرام</option>
              <option value="SUPER_ADMIN">مدیر ارشد</option>
            </Select>
            <Button
              variant="primary"
              className="w-full mt-4"
              isLoading={updateMut.isPending}
              onClick={() => updateMut.mutate({ id: editingUser.id, payload: { name: editUserName, role: editUserRole } })}
            >
              ذخیره تغییرات
            </Button>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deletingId)}
        title="حذف کاربر"
        message="آیا از حذف این کاربر اطمینان دارید؟"
        variant="danger"
        isLoading={deleteMut.isPending}
        onConfirm={() => deletingId && deleteMut.mutate(deletingId)}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
};

export default AdminUsersPage;
