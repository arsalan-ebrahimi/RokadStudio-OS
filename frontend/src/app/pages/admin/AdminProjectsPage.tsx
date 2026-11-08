import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Users, Edit2, Trash2, CheckCircle2, RotateCcw } from 'lucide-react';
import { Card, Button, Input, Checkbox, Select, Modal, ConfirmDialog, Skeleton, EmptyState, Badge, toast } from '@/shared/ui';
import { fetchAllProjects } from '@/features/projects/api/projects-api';
import { createProject, updateProject, deleteProject, fetchProjectDetails, syncMembers } from '@/features/projects/api/projects-crud-api';
import { searchActiveUsers } from '@/features/users/api/users-api';
import { useAuthStore } from '@/features/auth';
import { cn } from '@/shared/lib/utils';
import { toPersianDigits } from '@/shared/lib/formatters';
import type { Project, User } from '@/shared/types/models';

export const AdminProjectsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');

  const [membersProject, setMembersProject] = useState<Project | null>(null);
  const [projectMembers, setProjectMembers] = useState<{ id: number; name: string }[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingProject, setTogglingProject] = useState<{ id: number; name: string; toActive: boolean } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-projects'],
    queryFn: () => fetchAllProjects(),
  });

  const { data: activeUsers = [], isLoading: isActiveUsersLoading } = useQuery({
    queryKey: ['active-users'],
    queryFn: () => searchActiveUsers(),
    enabled: Boolean(membersProject && isSuperAdmin),
  });

  const projects = data?.data || [];

  const createMut = useMutation({
    mutationFn: () => createProject({ name: formName.trim(), description: formDesc.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
      setIsAddOpen(false);
      setFormName('');
      setFormDesc('');
      toast.success('پروژه ساخته شد');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { name?: string; description?: string; isActive?: boolean } }) =>
      updateProject(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
      setEditingProject(null);
      toast.success('پروژه ویرایش شد');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
      queryClient.invalidateQueries({ queryKey: ['admin-work-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['reports-summary'] });
      setDeletingId(null);
      toast.success('پروژه و سشن‌های مربوط به آن با موفقیت حذف شدند');
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'خطا در حذف پروژه');
    },
  });

  const syncMembersMut = useMutation({
    mutationFn: ({ id, userIds }: { id: number; userIds: number[] }) => syncMembers(id, userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
      setMembersProject(null);
      toast.success('اعضای پروژه بروزرسانی شدند');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openMembersModal = async (project: Project) => {
    setMembersProject(project);
    setIsMembersLoading(true);
    setMemberSearchQuery('');
    try {
      const details = await fetchProjectDetails(project.id);
      const members = details.members || [];
      setProjectMembers(members);
      setSelectedUserIds(members.map((m: { id: number }) => m.id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'خطا در بارگذاری اعضای پروژه');
      setProjectMembers([]);
      setSelectedUserIds([]);
    } finally {
      setIsMembersLoading(false);
    }
  };

  const openEditModal = (p: Project) => {
    setEditingProject(p);
    setEditName(p.name);
    setEditDesc(p.description || '');
    setEditIsActive(Boolean(p.isActive));
  };

  const activeCount = projects.filter((p: Project) => p.isActive).length;
  const completedCount = projects.filter((p: Project) => !p.isActive).length;

  const filteredProjects = projects.filter((p: Project) => {
    if (statusFilter === 'ACTIVE') return p.isActive;
    if (statusFilter === 'COMPLETED') return !p.isActive;
    return true;
  });

  const isMembersModalLoading = isMembersLoading || (isSuperAdmin && isActiveUsersLoading);

  const filteredActiveUsers = activeUsers.filter((u: User) => {
    if (!memberSearchQuery.trim()) return true;
    const query = memberSearchQuery.trim().toLowerCase();
    return (
      u.name?.toLowerCase().includes(query) ||
      (u.code && u.code.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="h-[38px] flex items-center gap-1 bg-white dark:bg-[#151C28] p-1 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto max-w-full shrink-0">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={cn(
              'h-full flex items-center px-2.5 sm:px-3 text-xs font-bold rounded-lg transition-all whitespace-nowrap',
              statusFilter === 'ALL'
                ? 'bg-primary text-white shadow-hard-sm'
                : 'text-ink-normal/70 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            )}
          >
            همه ({projects.length})
          </button>
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={cn(
              'h-full flex items-center px-2.5 sm:px-3 text-xs font-bold rounded-lg transition-all whitespace-nowrap',
              statusFilter === 'ACTIVE'
                ? 'bg-primary text-white shadow-hard-sm'
                : 'text-ink-normal/70 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            )}
          >
            در حال اجرا ({activeCount})
          </button>
          <button
            onClick={() => setStatusFilter('COMPLETED')}
            className={cn(
              'h-full flex items-center px-2.5 sm:px-3 text-xs font-bold rounded-lg transition-all whitespace-nowrap',
              statusFilter === 'COMPLETED'
                ? 'bg-primary text-white shadow-hard-sm'
                : 'text-ink-normal/70 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            )}
          >
            تمام شده ({completedCount})
          </button>
        </div>

        {isSuperAdmin && (
          <Button size="sm" variant="primary" onClick={() => setIsAddOpen(true)} className="w-full sm:w-auto shrink-0">
            <Plus className="w-4 h-4 me-1" />
            پروژه جدید
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : filteredProjects.length === 0 ? (
        <EmptyState title="هیچ پروژه‌ای در این بخش یافت نشد" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProjects.map((p: Project) => (
            <Card key={p.id} className="p-4 sm:p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-sec dark:text-white leading-snug break-words">
                    {p.name}
                  </h3>
                  <Badge variant={p.isActive ? 'ecosystem' : 'neutral'} className="shrink-0">
                    {p.isActive ? 'در حال اجرا' : 'تمام شده'}
                  </Badge>
                </div>
                <p className="text-xs text-ink-normal/60 dark:text-gray-400 mt-2 line-clamp-2 min-h-[32px]">
                  {p.description || 'بدون توضیحات'}
                </p>
              </div>

              <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <Button size="sm" variant="outline" onClick={() => openMembersModal(p)}>
                  <Users className="w-3.5 h-3.5 me-1 text-primary" />
                  اعضا ({toPersianDigits(p.memberCount || 0)})
                </Button>

                {isSuperAdmin && (
                  <div className="flex items-center gap-1.5">
                    {p.isActive ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setTogglingProject({ id: p.id, name: p.name, toActive: false })}
                        title="ثبت به عنوان تمام شده"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setTogglingProject({ id: p.id, name: p.name, toActive: true })}
                        title="فعال‌سازی مجدد پروژه"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-ink-normal/60" />
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => openEditModal(p)} aria-label="ویرایش">
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => setDeletingId(p.id)} aria-label="حذف">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Project Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="ایجاد پروژه">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (formName.trim() && !createMut.isPending) createMut.mutate();
          }}
          className="space-y-4"
        >
          <Input
            label="نام پروژه"
            placeholder="مثال: طراحی وب‌سایت"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            autoFocus
          />
          <Input
            label="توضیحات (اختیاری)"
            placeholder="توضیحات مختصر..."
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
          />
          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2"
            isLoading={createMut.isPending}
            disabled={!formName.trim() || createMut.isPending}
          >
            ثبت پروژه
          </Button>
        </form>
      </Modal>

      {/* Edit Project Modal */}
      {editingProject && (
        <Modal isOpen onClose={() => setEditingProject(null)} title="ویرایش پروژه">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editName.trim() && !updateMut.isPending) {
                updateMut.mutate({
                  id: editingProject.id,
                  payload: {
                    name: editName.trim(),
                    description: editDesc.trim() || undefined,
                    isActive: editIsActive,
                  },
                });
              }
            }}
            className="space-y-4"
          >
            <Input label="نام پروژه" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
            <Input label="توضیحات (اختیاری)" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-ink-normal/80 dark:text-gray-300">وضعیت پروژه</label>
              <Select
                value={editIsActive ? 'active' : 'completed'}
                onChange={(e) => setEditIsActive(e.target.value === 'active')}
              >
                <option value="active">در حال اجرا</option>
                <option value="completed">تمام شده</option>
              </Select>
            </div>
            <Button
              type="submit"
              variant="primary"
              className="w-full mt-2"
              isLoading={updateMut.isPending}
              disabled={!editName.trim() || updateMut.isPending}
            >
              ذخیره تغییرات
            </Button>
          </form>
        </Modal>
      )}

      {/* Manage Members Modal */}
      {membersProject && (
        <Modal
          isOpen
          onClose={() => {
            if (!syncMembersMut.isPending) {
              setMembersProject(null);
              setMemberSearchQuery('');
            }
          }}
          title={`اعضای پروژه «${membersProject.name}»`}
        >
          {isMembersModalLoading ? (
            <div className="space-y-3 py-3">
              <div className="flex items-center gap-2 text-xs font-bold text-ink-normal/60 dark:text-gray-400 mb-1">
                <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                <span>در حال بارگذاری لیست کاربران و اعضا...</span>
              </div>
              {Array(4)
                .fill(0)
                .map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30"
                  >
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="w-8 h-8 rounded-lg" />
                      <div className="space-y-1.5">
                        <Skeleton className="w-28 h-4 rounded" />
                        <Skeleton className="w-16 h-3 rounded" />
                      </div>
                    </div>
                    <Skeleton className="w-5 h-5 rounded" />
                  </div>
                ))}
            </div>
          ) : isSuperAdmin ? (
            <>
              {/* Search and Action Bar */}
              <div className="space-y-3 mb-3">
                <Input
                  placeholder="جستجوی نام یا کد پرسنل..."
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  className="h-9 text-xs"
                />
                <div className="flex items-center justify-between text-xs text-ink-normal/60 dark:text-gray-400 px-1">
                  <span>
                    تعداد اعضای انتخاب شده:{' '}
                    <strong className="text-primary font-black">{toPersianDigits(selectedUserIds.length)}</strong> نفر
                  </span>
                  {activeUsers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedUserIds.length === activeUsers.length) {
                          setSelectedUserIds([]);
                        } else {
                          setSelectedUserIds(activeUsers.map((u: User) => u.id));
                        }
                      }}
                      className="text-primary hover:underline font-bold text-xs"
                    >
                      {selectedUserIds.length === activeUsers.length ? 'لغو انتخاب همه' : 'انتخاب همه'}
                    </button>
                  )}
                </div>
              </div>

              {/* Users List */}
              {filteredActiveUsers.length === 0 ? (
                <EmptyState
                  title={memberSearchQuery ? 'کاربری با این مشخصات یافت نشد' : 'هیچ کاربر فعالی یافت نشد'}
                />
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto p-1">
                  {filteredActiveUsers.map((u: User) => {
                    const isSelected = selectedUserIds.includes(u.id);
                    return (
                      <label
                        key={u.id}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-xl border-2 transition-all cursor-pointer select-none',
                          isSelected
                            ? 'border-primary bg-primary/10 dark:bg-primary/15 shadow-[2px_2px_0_#202A5A] dark:shadow-[2px_2px_0_#59BBAF]'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C2536] hover:border-gray-300 dark:hover:border-gray-600'
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-sec dark:text-white flex items-center justify-center font-black text-xs shrink-0 border border-gray-200 dark:border-gray-700">
                            {u.name?.slice(0, 1) || 'ک'}
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-xs sm:text-sm font-bold text-sec dark:text-white block">
                              {u.name}
                            </span>
                            <div className="flex items-center gap-1.5 text-[10px] text-ink-normal/50 dark:text-gray-400 font-medium">
                              {u.code && <span>کد: {u.code}</span>}
                              {u.role && (
                                <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-semibold">
                                  {u.role === 'SUPER_ADMIN' ? 'مدیر ارشد' : u.role === 'ADMIN' ? 'ادمین' : 'کاربر'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Checkbox
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedUserIds([...selectedUserIds, u.id]);
                            else setSelectedUserIds(selectedUserIds.filter((id) => id !== u.id));
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              )}

              <Button
                variant="primary"
                className="w-full mt-4"
                isLoading={syncMembersMut.isPending}
                disabled={isMembersModalLoading || syncMembersMut.isPending}
                onClick={() => syncMembersMut.mutate({ id: membersProject.id, userIds: selectedUserIds })}
              >
                ذخیره اعضا ({toPersianDigits(selectedUserIds.length)})
              </Button>
            </>
          ) : (
            <div className="space-y-3">
              {projectMembers.length === 0 ? (
                <EmptyState title="عضوی برای این پروژه ثبت نشده است" />
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto p-1">
                  {projectMembers.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-[#151C28]/50"
                    >
                      <span className="text-xs sm:text-sm font-bold text-sec dark:text-white">{m.name}</span>
                      <Badge variant="neutral">عضو</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* Delete Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingId)}
        title="حذف پروژه"
        message="آیا از حذف این پروژه اطمینان دارید؟ با حذف پروژه، تمامی سشن‌های کاری مربوط به آن نیز حذف خواهند شد."
        variant="danger"
        isLoading={deleteMut.isPending}
        onConfirm={() => deletingId && deleteMut.mutate(deletingId)}
        onCancel={() => setDeletingId(null)}
      />

      {/* Toggle Completed Dialog */}
      <ConfirmDialog
        isOpen={Boolean(togglingProject)}
        title={togglingProject?.toActive ? 'فعال‌سازی مجدد پروژه' : 'اتمام پروژه'}
        message={
          togglingProject?.toActive
            ? `آیا از فعال‌سازی مجدد پروژه «${togglingProject?.name}» اطمینان دارید؟`
            : `آیا از ثبت پروژه «${togglingProject?.name}» به عنوان «تمام شده» اطمینان دارید؟ پروژه از دسترس کاربران عادی خارج خواهد شد.`
        }
        variant="primary"
        isLoading={updateMut.isPending}
        onConfirm={() => {
          if (!togglingProject) return;
          updateMut.mutate(
            {
              id: togglingProject.id,
              payload: { isActive: togglingProject.toActive },
            },
            {
              onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
                toast.success(
                  togglingProject.toActive ? 'پروژه فعال شد' : 'پروژه به عنوان تمام شده ثبت شد'
                );
                setTogglingProject(null);
              },
            }
          );
        }}
        onCancel={() => setTogglingProject(null)}
      />
    </div>
  );
};

export default AdminProjectsPage;
