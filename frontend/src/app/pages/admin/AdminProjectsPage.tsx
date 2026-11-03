import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Users, Edit2, Trash2 } from 'lucide-react';
import { Card, Button, Input, Modal, ConfirmDialog, Skeleton, EmptyState, Badge, toast } from '@/shared/ui';
import { fetchAllProjects } from '../api/projects-api';
import { createProject, updateProject, deleteProject, fetchProjectDetails, syncMembers } from '../api/projects-crud-api';
import { searchActiveUsers } from '@/features/users/api/users-api';
import { ApiError } from '@/shared/types/api';
import type { Project, User } from '@/shared/types/models';

export const AdminProjectsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');

  const [membersProject, setMembersProject] = useState<Project | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-projects'],
    queryFn: () => fetchAllProjects(),
  });

  const { data: activeUsers = [] } = useQuery({
    queryKey: ['active-users'],
    queryFn: () => searchActiveUsers(),
    enabled: Boolean(membersProject),
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
      setDeletingId(null);
      toast.success('پروژه حذف شد');
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.status === 409) {
        toast.error('پروژه دارای سشن کاری است؛ می‌توانید آن را غیرفعال کنید.');
      } else {
        toast.error(err instanceof Error ? err.message : 'خطا در حذف پروژه');
      }
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
    try {
      const details = await fetchProjectDetails(project.id);
      setSelectedUserIds(details.members.map((m) => m.id));
    } catch {
      setSelectedUserIds([]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-black text-sec dark:text-white">مدیریت پروژه‌ها</h1>
        <Button size="sm" variant="primary" onClick={() => setIsAddOpen(true)}>
          <Plus className="w-4 h-4 me-1" />
          پروژه جدید
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : projects.length === 0 ? (
        <EmptyState title="هیچ پروژه‌ای ایجاد نشده است" />
      ) : (
        <div className="space-y-2.5">
          {projects.map((p) => (
            <Card key={p.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-sec dark:text-white">{p.name}</h3>
                  <Badge variant={p.isActive ? 'ecosystem' : 'neutral'}>
                    {p.isActive ? 'فعال' : 'غیرفعال'}
                  </Badge>
                  <span className="text-xs text-ink-normal/50 dark:text-gray-400">({p.memberCount || 0} عضو)</span>
                </div>
                {p.description && <p className="text-xs text-ink-normal/60 dark:text-gray-400 mt-1">{p.description}</p>}
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => openMembersModal(p)}>
                  <Users className="w-3.5 h-3.5 me-1" />
                  اعضا
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingProject(p)}>
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="danger" onClick={() => setDeletingId(p.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Project Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="ایجاد پروژه">
        <div className="space-y-3.5">
          <Input label="نام پروژه" value={formName} onChange={(e) => setFormName(e.target.value)} />
          <Input label="توضیحات (اختیاری)" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
          <Button variant="primary" className="w-full mt-3" isLoading={createMut.isPending} onClick={() => createMut.mutate()}>
            ثبت پروژه
          </Button>
        </div>
      </Modal>

      {/* Manage Members Modal */}
      {membersProject && (
        <Modal isOpen onClose={() => setMembersProject(null)} title={`اعضای پروژه ${membersProject.name}`}>
          <div className="space-y-3 max-h-80 overflow-y-auto p-1">
            {activeUsers.map((u: User) => {
              const isSelected = selectedUserIds.includes(u.id);
              return (
                <label key={u.id} className="flex items-center justify-between p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer">
                  <span className="text-xs sm:text-sm font-bold text-sec dark:text-white">{u.name}</span>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedUserIds([...selectedUserIds, u.id]);
                      else setSelectedUserIds(selectedUserIds.filter((id) => id !== u.id));
                    }}
                    className="w-4 h-4 text-primary rounded"
                  />
                </label>
              );
            })}
          </div>
          <Button
            variant="primary"
            className="w-full mt-4"
            isLoading={syncMembersMut.isPending}
            onClick={() => syncMembersMut.mutate({ id: membersProject.id, userIds: selectedUserIds })}
          >
            ذخیره اعضا ({selectedUserIds.length})
          </Button>
        </Modal>
      )}

      {/* Delete Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingId)}
        title="حذف پروژه"
        message="آیا از حذف این پروژه اطمینان دارید؟ اگر سشنی ثبت شده باشد پروژه حذف نخواهد شد."
        variant="danger"
        isLoading={deleteMut.isPending}
        onConfirm={() => deletingId && deleteMut.mutate(deletingId)}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
};

export default AdminProjectsPage;
