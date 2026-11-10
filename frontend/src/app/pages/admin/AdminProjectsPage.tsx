import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Users, Edit2, Trash2, CheckCircle2, RotateCcw, Eye } from 'lucide-react';
import {
  Card,
  Button,
  Input,
  Checkbox,
  Select,
  Modal,
  ConfirmDialog,
  Skeleton,
  EmptyState,
  ErrorState,
  Badge,
  SegmentedControl,
  toast,
} from '@/shared/ui';
import { projectKeys } from '@/features/projects';
import { fetchAllProjects } from '@/features/projects/api/projects-api';
import {
  createProject,
  updateProject,
  deleteProject,
  fetchProjectDetails,
  syncMembers,
  type UpdateProjectPayload,
} from '@/features/projects/api/projects-crud-api';
import { WorkTargetSessionsModal } from '@/features/timer';
import { searchActiveUsers } from '@/features/users/api/users-api';
import { useAuthStore } from '@/features/auth';
import { cn } from '@/shared/lib/utils';
import { toPersianDigits } from '@/shared/lib/formatters';
import type { Project, User } from '@/shared/types/models';

interface ProjectsListCache {
  data: Project[];
  meta?: unknown;
}

export const AdminProjectsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');

  const [viewingProject, setViewingProject] = useState<Project | null>(null);
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
  const [togglingProject, setTogglingProject] = useState<{
    id: number;
    name: string;
    toActive: boolean;
  } | null>(null);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin-projects'],
    queryFn: () => fetchAllProjects(),
    staleTime: 30_000,
  });

  const { data: activeUsers = [], isLoading: isActiveUsersLoading } = useQuery({
    queryKey: ['active-users'],
    queryFn: () => searchActiveUsers(),
    enabled: Boolean(membersProject && isSuperAdmin),
    staleTime: 30_000,
  });

  const projects = data?.data || [];

  const invalidateProjectRelatedQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
    queryClient.invalidateQueries({ queryKey: projectKeys.minePrefix() });
    queryClient.invalidateQueries({ queryKey: ['work-targets', 'mine'] });
    queryClient.invalidateQueries({ queryKey: ['work-target-sessions', 'PROJECT'] });
    queryClient.invalidateQueries({ queryKey: ['work-session-targets'] });
    queryClient.invalidateQueries({ queryKey: ['my-sessions-today'] });
    queryClient.invalidateQueries({ queryKey: ['admin-attendance'] });
  };

  const createMut = useMutation({
    mutationFn: () =>
      createProject({
        name: formName.trim(),
        description: formDesc.trim() || undefined,
      }),
    onSuccess: (newProject: Project) => {
      queryClient.setQueriesData<ProjectsListCache>({ queryKey: ['admin-projects'] }, (old) => {
        if (!old?.data) return { data: [newProject] };
        return {
          ...old,
          data: [newProject, ...old.data.filter((p: Project) => p.id !== newProject.id)],
        };
      });
      invalidateProjectRelatedQueries();
      setIsAddOpen(false);
      setFormName('');
      setFormDesc('');
      toast.success('پروژه ساخته شد');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateProjectPayload }) =>
      updateProject(id, payload),
    onSuccess: (updated: Project) => {
      queryClient.setQueriesData<ProjectsListCache>({ queryKey: ['admin-projects'] }, (old) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((p: Project) => (p.id === updated.id ? { ...p, ...updated } : p)),
        };
      });
      invalidateProjectRelatedQueries();
      setEditingProject(null);
      toast.success('پروژه ویرایش شد');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteProject(id),
    onMutate: async (deletedId: number) => {
      setDeletingId(null);
      queryClient.setQueriesData<ProjectsListCache>({ queryKey: ['admin-projects'] }, (old) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((p: Project) => p.id !== deletedId),
        };
      });
    },
    onSuccess: () => {
      toast.success('پروژه و سشن‌های مربوط به آن با موفقیت حذف شدند');
      invalidateProjectRelatedQueries();
      queryClient.invalidateQueries({ queryKey: ['admin-work-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['reports-summary'] });
    },
    onError: (err: unknown) => {
      queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
      toast.error(err instanceof Error ? err.message : 'خطا در حذف پروژه');
    },
  });

  const syncMembersMut = useMutation({
    mutationFn: ({ id, userIds }: { id: number; userIds: number[] }) => syncMembers(id, userIds),
    onSuccess: (_, variables) => {
      queryClient.setQueriesData<ProjectsListCache>({ queryKey: ['admin-projects'] }, (old) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((p: Project) =>
            p.id === variables.id ? { ...p, memberCount: variables.userIds.length } : p
          ),
        };
      });
      invalidateProjectRelatedQueries();
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
        <SegmentedControl<'ALL' | 'ACTIVE' | 'COMPLETED'>
          value={statusFilter}
          onChange={setStatusFilter}
          aria-label="فیلتر وضعیت پروژه‌ها"
          className="overflow-x-auto no-scrollbar max-w-full shrink-0"
          options={[
            { value: 'ALL', label: `همه (${toPersianDigits(projects.length)})` },
            { value: 'ACTIVE', label: `در حال اجرا (${toPersianDigits(activeCount)})` },
            { value: 'COMPLETED', label: `تمام شده (${toPersianDigits(completedCount)})` },
          ]}
        />

        {isSuperAdmin && (
          <Button
            variant="primary"
            onClick={() => {
              setFormName('');
              setFormDesc('');
              setIsAddOpen(true);
            }}
            className="w-full sm:w-auto shrink-0 gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>پروژه جدید</span>
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array(3)
            .fill(0)
            .map((_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-3xl" />
            ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="خطا در دریافت پروژه‌ها"
          message={error instanceof Error ? error.message : 'دریافت فهرست پروژه‌ها با خطا مواجه شد.'}
          onRetry={() => refetch()}
        />
      ) : filteredProjects.length === 0 ? (
        <EmptyState title="هیچ پروژه‌ای در این بخش یافت نشد" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProjects.map((p: Project) => (
            <Card
              key={p.id}
              hoverable
              onClick={() => setViewingProject(p)}
              className="p-5 rounded-3xl border-[1.5px] border-sec/20 dark:border-primary/25 flex flex-col justify-between space-y-4 cursor-pointer"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <h3 className="text-sm sm:text-base font-black text-sec dark:text-white leading-snug break-words">
                    {p.name}
                  </h3>
                  <Badge dot variant={p.isActive ? 'ecosystem' : 'neutral'} className="shrink-0">
                    {p.isActive ? 'در حال اجرا' : 'تمام شده'}
                  </Badge>
                </div>

                <p className="text-xs text-ink-normal/65 dark:text-gray-400 line-clamp-2 min-h-[32px] leading-relaxed">
                  {p.description || 'بدون توضیحات'}
                </p>
              </div>

              <div
                className="pt-3 border-t border-sec/10 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setViewingProject(p)}
                    className="gap-1 border-primary/50 text-sec dark:text-primary hover:bg-primary/15"
                  >
                    <Eye className="w-3.5 h-3.5 shrink-0" />
                    <span>مشاهده</span>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openMembersModal(p)} className="gap-1.5">
                    <Users className="w-3.5 h-3.5 text-sec dark:text-primary" />
                    <span className="tabular-nums">اعضا ({toPersianDigits(p.memberCount || 0)})</span>
                  </Button>
                </div>

                {isSuperAdmin && (
                  <div className="flex items-center gap-1.5">
                    {p.isActive ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setTogglingProject({ id: p.id, name: p.name, toActive: false })
                        }
                        title="ثبت به عنوان تمام شده"
                        aria-label="ثبت به عنوان تمام شده"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#007A52] dark:text-primary" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setTogglingProject({ id: p.id, name: p.name, toActive: true })
                        }
                        title="فعال‌سازی مجدد پروژه"
                        aria-label="فعال‌سازی مجدد پروژه"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-sec/70 dark:text-gray-300" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditModal(p)}
                      aria-label="ویرایش"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setDeletingId(p.id)}
                      aria-label="حذف"
                    >
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
            <Input
              label="نام پروژه"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
            />
            <Input
              label="توضیحات (اختیاری)"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
            />
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-ink-normal/80 dark:text-gray-300">
                وضعیت پروژه
              </label>
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
                />
                <div className="flex items-center justify-between text-xs text-ink-normal/70 dark:text-gray-300 px-1">
                  <span>
                    تعداد اعضای انتخاب شده:{' '}
                    <strong className="text-sec dark:text-primary font-black tabular-nums">
                      {toPersianDigits(selectedUserIds.length)}
                    </strong>{' '}
                    نفر
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
                      className="text-sec dark:text-primary hover:underline font-bold text-xs cursor-pointer"
                    >
                      {selectedUserIds.length === activeUsers.length
                        ? 'لغو انتخاب همه'
                        : 'انتخاب همه'}
                    </button>
                  )}
                </div>
              </div>

              {/* Users List */}
              {filteredActiveUsers.length === 0 ? (
                <EmptyState
                  title={
                    memberSearchQuery ? 'کاربری با این مشخصات یافت نشد' : 'هیچ کاربر فعالی یافت نشد'
                  }
                />
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto p-1">
                  {filteredActiveUsers.map((u: User) => {
                    const isSelected = selectedUserIds.includes(u.id);
                    const roleLabel =
                      u.role === 'SUPER_ADMIN'
                        ? 'مدیر ارشد'
                        : u.role === 'SCRUM_ADMIN'
                          ? 'مدیر اسکرام'
                          : u.role === 'ADMIN'
                            ? 'ادمین'
                            : 'کاربر';

                    return (
                      <label
                        key={u.id}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-2xl border-[1.5px] transition-all cursor-pointer select-none',
                          isSelected
                            ? 'border-sec/40 dark:border-primary bg-ecosystem-light/70 dark:bg-ecosystem-darker/40 shadow-sm'
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
                                  {roleLabel}
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
                onClick={() =>
                  syncMembersMut.mutate({ id: membersProject.id, userIds: selectedUserIds })
                }
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
                      <span className="text-xs sm:text-sm font-bold text-sec dark:text-white">
                        {m.name}
                      </span>
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
                invalidateProjectRelatedQueries();
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

      {/* Project Work Logs & Moderation Modal */}
      <WorkTargetSessionsModal
        isOpen={Boolean(viewingProject)}
        onClose={() => setViewingProject(null)}
        targetKind="PROJECT"
        targetId={viewingProject?.id ?? null}
        initialTitle={viewingProject?.name}
        initialDescription={viewingProject?.description}
      />
    </div>
  );
};

export default AdminProjectsPage;
