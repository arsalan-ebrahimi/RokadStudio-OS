import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Copy, Check, Search } from 'lucide-react';
import {
  Card,
  Button,
  Input,
  Select,
  Modal,
  ConfirmDialog,
  Skeleton,
  EmptyState,
  ErrorState,
  Badge,
  toast,
} from '@/shared/ui';
import { fetchUsers, createUser, updateUser, deleteUser } from '@/features/users/api/users-api';
import { suggestNextUserCode } from '@/features/users/lib/code-generator';
import { useAuthStore } from '@/features/auth';
import type { User, Role } from '@/shared/types/models';

interface UsersListCache {
  data: User[];
  meta?: unknown;
}

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

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
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
    mutationFn: () =>
      createUser({ name: formName.trim(), code: formCode.trim(), role: formRole }),
    onSuccess: (newUser: User) => {
      queryClient.setQueriesData<UsersListCache>({ queryKey: ['admin-users'] }, (old) => {
        if (!old?.data) return { data: [newUser] };
        return {
          ...old,
          data: [newUser, ...old.data.filter((u: User) => u.id !== newUser.id)],
        };
      });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['scrum-admins'] });
      setIsAddOpen(false);
      setCreatedCode(newUser.code || formCode);
      toast.success('کاربر ایجاد شد');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMut = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: { name?: string; role?: Role; isActive?: boolean };
    }) => updateUser(id, payload),
    onSuccess: (updated: User) => {
      queryClient.setQueriesData<UsersListCache>({ queryKey: ['admin-users'] }, (old) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((u: User) => (u.id === updated.id ? { ...u, ...updated } : u)),
        };
      });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['scrum-admins'] });
      queryClient.invalidateQueries({ queryKey: ['scrums'] });
      queryClient.invalidateQueries({ queryKey: ['scrum'] });
      setEditingUser(null);
      toast.success('تغییرات ذخیره شد');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onMutate: async (deletedId: number) => {
      setDeletingId(null);
      queryClient.setQueriesData<UsersListCache>({ queryKey: ['admin-users'] }, (old) => {
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
      queryClient.invalidateQueries({ queryKey: ['scrum-admins'] });
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

  const renderRoleBadge = (role: Role) => {
    if (role === 'SUPER_ADMIN') return <Badge variant="female">مدیر ارشد</Badge>;
    if (role === 'SCRUM_ADMIN') return <Badge variant="club">مدیر اسکرام</Badge>;
    if (role === 'ADMIN') return <Badge variant="college">ادمین</Badge>;
    return <Badge variant="male">کاربر</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <h1 className="text-lg sm:text-xl font-black text-sec dark:text-white">مدیریت پرسنل</h1>
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-4 h-4 text-sec/45 dark:text-gray-400 pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="جستجوی نام..."
              aria-label="جستجوی نام کاربر"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ps-10"
              containerClassName="w-full"
            />
          </div>
          <Button variant="primary" onClick={handleOpenAdd} className="shrink-0 gap-1.5">
            <Plus className="w-4 h-4" />
            <span>افزودن کاربر</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array(4)
            .fill(0)
            .map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-3xl" />
            ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="خطا در دریافت لیست پرسنل"
          message={error instanceof Error ? error.message : 'دریافت فهرست کاربران با خطا مواجه شد.'}
          onRetry={() => refetch()}
        />
      ) : users.length === 0 ? (
        <EmptyState title="کاربری یافت نشد" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {users.map((u: User) => {
            const isSelf = currentUser?.id === u.id;
            return (
              <Card
                key={u.id}
                className="p-5 rounded-3xl border-[1.5px] border-sec/20 dark:border-primary/25 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <p
                      className="text-sm sm:text-base font-black text-sec dark:text-white truncate"
                      title={u.name}
                    >
                      {u.name}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {renderRoleBadge(u.role)}
                      {!u.isActive && <Badge variant="neutral">غیرفعال</Badge>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-gray-50 dark:bg-[#182030] px-3.5 py-2 rounded-2xl border border-sec/15 dark:border-gray-700">
                    <span className="text-xs text-ink-normal/65 dark:text-gray-400 font-bold">
                      کد پرسنلی:
                    </span>
                    <span
                      className="text-xs font-mono font-black text-sec dark:text-white tracking-wide"
                      dir="ltr"
                    >
                      {u.code}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-sec/10 dark:border-gray-800 flex items-center justify-end">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditModal(u)}
                      aria-label={`ویرایش ${u.name}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={isSelf}
                      onClick={() => setDeletingId(u.id)}
                      aria-label={`حذف ${u.name}`}
                    >
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
          <Input
            label="نام و نام خانوادگی"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
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
          <Button
            variant="primary"
            className="w-full mt-4"
            isLoading={createMut.isPending}
            onClick={() => createMut.mutate()}
          >
            ثبت کاربر
          </Button>
        </div>
      </Modal>

      {/* Created Code Presentation Modal */}
      <Modal isOpen={Boolean(createdCode)} onClose={() => setCreatedCode(null)} title="کد ورود پرسنل">
        <div className="text-center space-y-4 py-2">
          <p className="text-xs text-ink-normal/60 dark:text-gray-400">
            کد زیر را جهت ورود به کاربر تحویل دهید:
          </p>
          <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-2xl border-[1.5px] border-sec/15 dark:border-gray-700 flex items-center justify-center gap-3">
            <span
              className="text-2xl font-black font-mono tracking-widest text-sec dark:text-primary"
              dir="ltr"
            >
              {createdCode}
            </span>
            <button
              type="button"
              onClick={handleCopyCode}
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-white dark:bg-[#151C28] border border-sec/20 dark:border-gray-700 text-sec dark:text-white shadow-hard-sm cursor-pointer"
              aria-label="کپی کد پرسنلی"
            >
              {copied ? <Check className="w-4 h-4 text-[#007A52] dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      {editingUser && (
        <Modal isOpen onClose={() => setEditingUser(null)} title="ویرایش کاربر">
          <div className="space-y-3.5">
            <Input
              label="نام کامل"
              value={editUserName}
              onChange={(e) => setEditUserName(e.target.value)}
            />
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
              onClick={() =>
                updateMut.mutate({
                  id: editingUser.id,
                  payload: { name: editUserName, role: editUserRole },
                })
              }
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
