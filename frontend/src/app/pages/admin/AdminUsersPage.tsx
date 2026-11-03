import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Copy, Check } from 'lucide-react';
import { Card, Button, Input, Modal, ConfirmDialog, Skeleton, EmptyState, Badge, toast } from '@/shared/ui';
import { fetchUsers, createUser, updateUser, deleteUser } from '../api/users-api';
import { suggestNextUserCode } from '../lib/code-generator';
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
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [formName, setFormName] = useState('');
  const [formPrefix, setFormPrefix] = useState('IT');
  const [formCode, setFormCode] = useState('');
  const [formRole, setFormRole] = useState<Role>('USER');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', searchTerm],
    queryFn: () => fetchUsers({ search: searchTerm || undefined }),
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
    onSuccess: (newUser) => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setEditingUser(null);
      toast.success('تغییرات ذخیره شد');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setDeletingId(null);
      toast.success('کاربر حذف شد');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleCopyCode = () => {
    if (createdCode) {
      navigator.clipboard.writeText(createdCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-lg font-black text-sec dark:text-white">مدیریت پرسنل</h1>
        <div className="flex items-center gap-2">
          <Input
            placeholder="جستجوی نام..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-44 py-1.5 text-xs"
          />
          <Button size="sm" variant="primary" onClick={handleOpenAdd}>
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
        <div className="space-y-2.5">
          {users.map((u) => {
            const isSelf = currentUser?.id === u.id;
            return (
              <Card key={u.id} className="p-3.5 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-sec dark:text-white">{u.name}</p>
                    <Badge variant={u.role === 'SUPER_ADMIN' ? 'female' : u.role === 'ADMIN' ? 'college' : 'male'}>
                      {u.role === 'SUPER_ADMIN' ? 'مدیر ارشد' : u.role === 'ADMIN' ? 'ادمین' : 'کاربر'}
                    </Badge>
                    {!u.isActive && <Badge variant="neutral">غیرفعال</Badge>}
                  </div>
                  <p className="text-xs text-ink-normal/50 dark:text-gray-400 font-mono" dir="ltr">{u.code}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => setEditingUser(u)}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="danger" disabled={isSelf} onClick={() => setDeletingId(u.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
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
              label="پیشوند کد"
              maxLength={2}
              value={formPrefix}
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                setFormPrefix(val);
                setFormCode(suggestNextUserCode(users, val));
              }}
            />
            <Input label="کد پرسنلی پیشنهادی" value={formCode} onChange={(e) => setFormCode(e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-bold text-ink-normal/80 dark:text-gray-300">نقش کاربر</label>
            <select
              value={formRole}
              onChange={(e) => setFormRole(e.target.value as Role)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C2536] text-xs font-bold"
            >
              <option value="USER">کاربر عادی</option>
              <option value="ADMIN">ادمین</option>
              <option value="SUPER_ADMIN">مدیر ارشد</option>
            </select>
          </div>
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
            <Input label="نام کامل" defaultValue={editingUser.name} onChange={(e) => (editingUser.name = e.target.value)} />
            <div className="space-y-1">
              <label className="block text-xs font-bold">نقش</label>
              <select
                defaultValue={editingUser.role}
                disabled={currentUser?.id === editingUser.id}
                onChange={(e) => (editingUser.role = e.target.value as Role)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C2536] text-xs font-bold"
              >
                <option value="USER">کاربر عادی</option>
                <option value="ADMIN">ادمین</option>
                <option value="SUPER_ADMIN">مدیر ارشد</option>
              </select>
            </div>
            <Button
              variant="primary"
              className="w-full mt-4"
              isLoading={updateMut.isPending}
              onClick={() => updateMut.mutate({ id: editingUser.id, payload: { name: editingUser.name, role: editingUser.role } })}
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
