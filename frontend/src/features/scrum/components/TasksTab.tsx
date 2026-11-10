import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Edit2,
  Eye,
  ListChecks,
  Plus,
  Search,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  AvatarStack,
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  SegmentedControl,
  Skeleton,
} from '@/shared/ui';
import { WorkTargetSessionsModal } from '@/features/timer';
import { cn } from '@/shared/lib/utils';
import { formatDurationToHoursMins, toPersianDigits } from '@/shared/lib/formatters';
import {
  useCreateScrumTask,
  useDeleteScrumTask,
  useScrumTasks,
  useSyncTaskMembers,
  useUpdateScrumTask,
} from '../hooks/use-scrum';
import { SCRUM_COLOR_MAP, type Scrum, type ScrumTask, type ScrumUserRef } from '../types/scrum-types';

interface TasksTabProps {
  scrum: Scrum;
  canEdit: boolean;
}

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

const QUICK_POINTS = [0, 1, 2, 3, 5, 8, 13];

export const TasksTab: React.FC<TasksTabProps> = ({ scrum, canEdit }) => {
  const colorMeta = SCRUM_COLOR_MAP[scrum.color] || SCRUM_COLOR_MAP.ECOSYSTEM;

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const {
    data: tasks = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useScrumTasks(scrum.id, {
    isActive:
      statusFilter === 'ALL' ? undefined : statusFilter === 'ACTIVE',
    search: searchTerm.trim() || undefined,
  });

  const createMut = useCreateScrumTask(scrum.id);
  const updateMut = useUpdateScrumTask(scrum.id);
  const syncMembersMut = useSyncTaskMembers(scrum.id);
  const deleteMut = useDeleteScrumTask(scrum.id);

  // Deduplicated candidate assignees: Scrum members + admins
  const candidateAssignees = useMemo<ScrumUserRef[]>(() => {
    const map = new Map<number, ScrumUserRef>();
    for (const m of scrum.members || []) {
      map.set(m.id, { id: m.id, name: m.name });
    }
    for (const a of scrum.admins || []) {
      if (!map.has(a.id)) map.set(a.id, { id: a.id, name: a.name });
    }
    return Array.from(map.values());
  }, [scrum.members, scrum.admins]);

  // View sessions modal state
  const [viewingTask, setViewingTask] = useState<ScrumTask | null>(null);

  // Create modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createPoints, setCreatePoints] = useState<number>(3);
  const [createMemberIds, setCreateMemberIds] = useState<number[]>([]);

  // Edit modal state
  const [editingTask, setEditingTask] = useState<ScrumTask | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPoints, setEditPoints] = useState<number>(0);
  const [editActive, setEditActive] = useState<boolean>(true);

  // Members modal state
  const [membersTask, setMembersTask] = useState<ScrumTask | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);

  // Delete modal state
  const [deletingTask, setDeletingTask] = useState<ScrumTask | null>(null);
  const [deleteErrMsg, setDeleteErrMsg] = useState<string | null>(null);

  const openCreateModal = () => {
    setCreateName('');
    setCreateDesc('');
    setCreatePoints(3);
    setCreateMemberIds([]);
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || createMut.isPending) return;
    const safePoints = Math.max(0, Math.min(1000, Math.round(Number(createPoints) || 0)));
    await createMut.mutateAsync({
      name: createName.trim(),
      description: createDesc.trim() || undefined,
      points: safePoints,
      isActive: true,
      memberIds: createMemberIds.length > 0 ? createMemberIds : undefined,
    });
    setIsCreateOpen(false);
  };

  const openEditModal = (task: ScrumTask) => {
    setEditingTask(task);
    setEditName(task.name);
    setEditDesc(task.description || '');
    setEditPoints(task.points);
    setEditActive(task.isActive);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editName.trim() || updateMut.isPending) return;
    const safePoints = Math.max(0, Math.min(1000, Math.round(Number(editPoints) || 0)));
    await updateMut.mutateAsync({
      taskId: editingTask.id,
      payload: {
        name: editName.trim(),
        description: editDesc.trim() ? editDesc.trim() : null,
        points: safePoints,
        isActive: editActive,
      },
    });
    setEditingTask(null);
  };

  const openMembersModal = (task: ScrumTask) => {
    setMembersTask(task);
    setSelectedMemberIds(task.members.map((m) => m.id));
  };

  const handleSaveMembers = async () => {
    if (!membersTask || syncMembersMut.isPending) return;
    await syncMembersMut.mutateAsync({
      taskId: membersTask.id,
      userIds: selectedMemberIds,
    });
    setMembersTask(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingTask || deleteMut.isPending) return;
    setDeleteErrMsg(null);
    try {
      await deleteMut.mutateAsync(deletingTask.id);
      setDeletingTask(null);
    } catch (err) {
      setDeleteErrMsg(
        err instanceof Error ? err.message : 'حذف تسک امکان‌پذیر نیست.'
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sec/15 dark:border-gray-800">
        <div>
          <h3 className="text-base sm:text-lg font-black text-sec dark:text-white">
            تسک‌های اسکرام ({toPersianDigits(tasks.length)})
          </h3>
          <p className="text-xs text-ink-normal/65 dark:text-gray-400 mt-0.5 leading-relaxed">
            تسک‌های این اسکرام با امتیاز و اعضای مشخص؛ روی هر تسک کلیک کنید تا گزارش کارکرد افراد را بر اساس تاریخ مشاهده و بررسی کنید.
          </p>
        </div>

        {canEdit && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={openCreateModal}
            className="gap-1.5 text-xs font-extrabold shadow-hard-sm shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>تسک جدید</span>
          </Button>
        )}
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex items-center w-full sm:max-w-xs">
          <Search className="w-4 h-4 text-sec/45 dark:text-gray-400 absolute start-3 pointer-events-none" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="جستجوی عنوان یا توضیحات تسک..."
            className="ps-9 pe-8 text-xs"
            containerClassName="w-full"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-sec/50 hover:text-sec dark:hover:text-white absolute end-2 cursor-pointer"
              aria-label="پاک کردن جستجو"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <SegmentedControl<StatusFilter>
          size="sm"
          aria-label="فیلتر وضعیت تسک‌ها"
          options={[
            { value: 'ALL', label: 'همه' },
            { value: 'ACTIVE', label: 'فعال' },
            { value: 'INACTIVE', label: 'غیرفعال' },
          ]}
          value={statusFilter}
          onChange={setStatusFilter}
        />
      </div>

      {/* Loading / Error / Empty / Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-52 w-full rounded-3xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="خطا در دریافت تسک‌های اسکرام"
          message={error instanceof Error ? error.message : 'در دریافت اطلاعات مشکلی پیش آمد.'}
          onRetry={() => refetch()}
        />
      ) : tasks.length === 0 ? (
        <EmptyState
          title="تسکی یافت نشد"
          description={
            searchTerm || statusFilter !== 'ALL'
              ? 'فیلتر جستجو یا وضعیت را تغییر دهید تا تسک‌های دیگر نمایش داده شوند.'
              : canEdit
              ? 'برای تعریف اولین تسک در این اسکرام روی دکمه «تسک جدید» کلیک کنید.'
              : 'هنوز تسکی در این اسکرام تعریف نشده است.'
          }
          action={
            canEdit && !searchTerm && statusFilter === 'ALL' ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={openCreateModal}
                className="gap-1.5 text-xs font-extrabold"
              >
                <Plus className="w-4 h-4" />
                <span>ایجاد اولین تسک</span>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tasks.map((task) => {
            const approvedSec = task.trackedSeconds?.approved || 0;
            const pendingSec = task.trackedSeconds?.pending || 0;
            const rejectedSec = task.trackedSeconds?.rejected || 0;

            return (
              <Card
                key={task.id}
                hoverable
                onClick={() => setViewingTask(task)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setViewingTask(task);
                  }
                }}
                className={cn(
                  'p-5 rounded-3xl border-[1.5px] border-sec/25 dark:border-primary/30 shadow-hard-sm flex flex-col justify-between space-y-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  !task.isActive && 'opacity-75 bg-gray-50/70 dark:bg-[#111722]'
                )}
              >
                <div className="space-y-3">
                  {/* Top Title + Points + Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className={cn(
                          'w-9 h-9 rounded-2xl border border-sec/20 flex items-center justify-center shrink-0 mt-0.5',
                          colorMeta.chipBg,
                          colorMeta.text
                        )}
                      >
                        <ListChecks className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <h4 className="text-sm font-black text-sec dark:text-white leading-snug break-words">
                          {task.name}
                        </h4>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="college" className="tabular-nums">
                            {toPersianDigits(task.points)} پوینت
                          </Badge>
                          <Badge dot variant={task.isActive ? 'ecosystem' : 'neutral'}>
                            {task.isActive ? 'فعال' : 'غیرفعال'}
                          </Badge>
                          {task.isAssignedToMe && (
                            <Badge variant="male">
                              <UserCheck className="w-3 h-3 me-1" />
                              تسک شما
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {task.description && (
                    <p className="text-xs text-sec/65 dark:text-gray-400 line-clamp-2 leading-relaxed">
                      {task.description}
                    </p>
                  )}
                </div>

                <div className="space-y-3 pt-3 border-t border-sec/10 dark:border-gray-800">
                  {/* Assigned Members */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-sec/60 dark:text-gray-400">
                      مسئولین تسک:
                    </span>
                    <AvatarStack
                      users={task.members || []}
                      max={4}
                      size="sm"
                      emptyLabel="بدون مسئول"
                    />
                  </div>

                  {/* Tracked time summary */}
                  <div className="p-2.5 rounded-2xl bg-[#F8FAFC] dark:bg-[#182030] border border-sec/10 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold">
                    <span className="flex items-center gap-1 text-sec/70 dark:text-gray-300">
                      <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>{canEdit ? 'کل کارکرد:' : 'کارکرد شما:'}</span>
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
                      <span className="text-sec dark:text-primary font-black">
                        {formatDurationToHoursMins(approvedSec)} تاییدشده
                      </span>
                      {pendingSec > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-college-light dark:bg-amber-950/60 text-[#704A0D] dark:text-amber-200 border border-college-normal/40">
                          +{formatDurationToHoursMins(pendingSec)} در انتظار
                        </span>
                      )}
                      {rejectedSec > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-female-light dark:bg-rose-950/60 text-[#A81344] dark:text-rose-200 border border-female-normal/35">
                          {formatDurationToHoursMins(rejectedSec)} ردشده
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div
                    className="flex flex-wrap items-center justify-between gap-1.5 pt-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setViewingTask(task)}
                      className="text-xs font-black gap-1 border-primary/50 text-sec dark:text-primary hover:bg-primary/15"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>مشاهده</span>
                    </Button>

                    {canEdit && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openMembersModal(task)}
                          title="تخصیص افراد"
                          className="text-xs px-2.5"
                        >
                          <Users className="w-3.5 h-3.5 me-1" />
                          افراد
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openEditModal(task)}
                          title="ویرایش تسک"
                          className="text-xs px-2.5"
                        >
                          <Edit2 className="w-3.5 h-3.5 me-1" />
                          ویرایش
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            updateMut.mutate({
                              taskId: task.id,
                              payload: { isActive: !task.isActive },
                            })
                          }
                          title={task.isActive ? 'غیرفعال کردن' : 'فعال کردن'}
                          className="text-xs px-2.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 me-1" />
                          {task.isActive ? 'توقف' : 'فعال‌سازی'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-[#C60036] dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-300 dark:border-rose-900/50 px-2.5"
                          onClick={() => {
                            setDeleteErrMsg(null);
                            setDeletingTask(task);
                          }}
                          aria-label={`حذف تسک ${task.name}`}
                          title="حذف تسک"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Task Modal */}
      {canEdit && (
        <Modal
          isOpen={isCreateOpen}
          onClose={() => !createMut.isPending && setIsCreateOpen(false)}
          title="ایجاد تسک جدید در اسکرام"
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <Input
              label="عنوان تسک"
              required
              placeholder="مثال: طراحی صفحه پرداخت"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              autoFocus
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-sec/80 dark:text-gray-300">
                توضیحات (اختیاری)
              </label>
              <textarea
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                rows={2}
                placeholder="جزئیات انجام کار و خروجی مورد انتظار..."
                className="w-full px-3.5 py-2.5 rounded-xl border-[1.5px] border-sec/25 dark:border-gray-700 bg-white dark:bg-[#182030] text-xs font-medium text-sec dark:text-white focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-2">
              <Input
                label="امتیاز (پوینت: ۰ تا ۱۰۰۰)"
                type="number"
                min={0}
                max={1000}
                value={String(createPoints)}
                onChange={(e) => setCreatePoints(Number(e.target.value))}
              />
              <div className="flex flex-wrap items-center gap-1.5">
                {QUICK_POINTS.map((pt) => (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => setCreatePoints(pt)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-[11px] font-black border tabular-nums cursor-pointer',
                      createPoints === pt
                        ? 'bg-primary text-sec border-sec shadow-[1.5px_1.5px_0_#202A5A]'
                        : 'bg-[#F8FAFC] dark:bg-gray-800 text-sec/75 dark:text-gray-300 border-sec/15'
                    )}
                  >
                    {toPersianDigits(pt)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-sec/80 dark:text-gray-300">
                  تخصیص افراد (اختیاری)
                </label>
                {createMemberIds.length > 0 && (
                  <span className="text-[11px] font-bold text-primary">
                    {toPersianDigits(createMemberIds.length)} نفر
                  </span>
                )}
              </div>

              {candidateAssignees.length === 0 ? (
                <p className="p-3 rounded-xl bg-gray-50 dark:bg-[#182030] border border-sec/15 dark:border-gray-700 text-[11px] font-bold text-sec/60 dark:text-gray-400">
                  ابتدا از تب اعضا، نفرات تیم را به این اسکرام اضافه کنید.
                </p>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 rounded-xl border-[1.5px] border-sec/20 dark:border-gray-700 bg-gray-50 dark:bg-[#151C28]">
                  {candidateAssignees.map((m) => {
                    const checked = createMemberIds.includes(m.id);
                    return (
                      <label
                        key={m.id}
                        className={cn(
                          'flex items-center justify-between px-2.5 py-2 rounded-lg border text-xs font-bold cursor-pointer select-none',
                          checked
                            ? 'border-primary bg-primary/15 text-sec dark:text-white'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C2536] text-sec/80 dark:text-gray-300'
                        )}
                      >
                        <span className="truncate">{m.name}</span>
                        <Checkbox
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCreateMemberIds((prev) => [...prev, m.id]);
                            } else {
                              setCreateMemberIds((prev) => prev.filter((id) => id !== m.id));
                            }
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setIsCreateOpen(false)}
                disabled={createMut.isPending}
              >
                انصراف
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="flex-[2] font-extrabold shadow-hard"
                isLoading={createMut.isPending}
                disabled={createName.trim().length < 2 || createMut.isPending}
              >
                ایجاد تسک
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Task Modal */}
      {canEdit && (
        <Modal
          isOpen={Boolean(editingTask)}
          onClose={() => !updateMut.isPending && setEditingTask(null)}
          title="ویرایش تسک"
        >
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <Input
              label="عنوان تسک"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-sec/80 dark:text-gray-300">
                توضیحات
              </label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={2}
                placeholder="توضیحات تسک..."
                className="w-full px-3.5 py-2.5 rounded-xl border-[1.5px] border-sec/25 dark:border-gray-700 bg-white dark:bg-[#182030] text-xs font-medium text-sec dark:text-white focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-2">
              <Input
                label="امتیاز (پوینت: ۰ تا ۱۰۰۰)"
                type="number"
                min={0}
                max={1000}
                value={String(editPoints)}
                onChange={(e) => setEditPoints(Number(e.target.value))}
              />
              <div className="flex flex-wrap items-center gap-1.5">
                {QUICK_POINTS.map((pt) => (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => setEditPoints(pt)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-[11px] font-black border tabular-nums cursor-pointer',
                      editPoints === pt
                        ? 'bg-primary text-sec border-sec shadow-[1.5px_1.5px_0_#202A5A]'
                        : 'bg-[#F8FAFC] dark:bg-gray-800 text-sec/75 dark:text-gray-300 border-sec/15'
                    )}
                  >
                    {toPersianDigits(pt)}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center justify-between px-3 py-2.5 rounded-xl border-[1.5px] border-sec/20 dark:border-gray-700 bg-[#F8FAFC] dark:bg-[#182030] cursor-pointer">
              <span className="text-xs font-bold text-sec dark:text-white">
                تسک فعال است (قابل انتخاب در تایمر)
              </span>
              <Checkbox
                checked={editActive}
                onChange={(e) => setEditActive(e.target.checked)}
              />
            </label>

            <div className="flex items-center gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setEditingTask(null)}
                disabled={updateMut.isPending}
              >
                انصراف
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="flex-[2] font-extrabold shadow-hard"
                isLoading={updateMut.isPending}
                disabled={editName.trim().length < 2 || updateMut.isPending}
              >
                ذخیره تغییرات
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Assign Members Modal */}
      {canEdit && (
        <Modal
          isOpen={Boolean(membersTask)}
          onClose={() => !syncMembersMut.isPending && setMembersTask(null)}
          title={`تخصیص افراد: ${membersTask?.name || ''}`}
        >
          <div className="space-y-4">
            {candidateAssignees.length === 0 ? (
              <p className="text-xs font-bold text-sec/60 dark:text-gray-400 text-center py-4">
                هیچ عضوی در این اسکرام ثبت نشده است. ابتدا از تب اعضا عضو اضافه کنید.
              </p>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-1.5 p-1.5 rounded-2xl border-[1.5px] border-sec/20 dark:border-gray-700 bg-gray-50 dark:bg-[#151C28]">
                {candidateAssignees.map((member) => {
                  const checked = selectedMemberIds.includes(member.id);
                  return (
                    <label
                      key={member.id}
                      className={cn(
                        'min-h-[42px] flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer select-none transition-colors',
                        checked
                          ? 'border-sec/40 bg-ecosystem-light/70 dark:bg-ecosystem-darker/50 text-sec dark:text-white'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#182030] hover:bg-gray-50 dark:hover:bg-gray-800 text-sec/80 dark:text-gray-300'
                      )}
                    >
                      <span className="truncate">{member.name}</span>
                      <Checkbox
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedMemberIds((prev) => [...prev, member.id]);
                          } else {
                            setSelectedMemberIds((prev) => prev.filter((id) => id !== member.id));
                          }
                        }}
                      />
                    </label>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setMembersTask(null)}
                disabled={syncMembersMut.isPending}
              >
                انصراف
              </Button>
              <Button
                type="button"
                variant="primary"
                className="flex-[2]"
                isLoading={syncMembersMut.isPending}
                onClick={handleSaveMembers}
              >
                ذخیره ({toPersianDigits(selectedMemberIds.length)} نفر)
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Task Modal (shows 409 error nicely if sessions exist) */}
      <Modal
        isOpen={Boolean(deletingTask)}
        onClose={() => {
          if (!deleteMut.isPending) {
            setDeletingTask(null);
            setDeleteErrMsg(null);
          }
        }}
        title="حذف تسک"
      >
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-sec/80 dark:text-gray-300 leading-relaxed">
            آیا از حذف تسک «<strong className="text-sec dark:text-white">{deletingTask?.name}</strong>» اطمینان دارید؟ در صورت ثبت سشن کاری روی این تسک، به جای حذف می‌توانید آن را غیرفعال کنید.
          </p>

          {deleteErrMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-2xl border-[1.5px] border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-xs font-bold text-[#C60036] dark:text-rose-300 flex items-start gap-2 leading-relaxed"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{deleteErrMsg}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeletingTask(null);
                setDeleteErrMsg(null);
              }}
              disabled={deleteMut.isPending}
            >
              انصراف
            </Button>
            {deleteErrMsg && deletingTask?.isActive && (
              <Button
                type="button"
                variant="primary"
                onClick={async () => {
                  if (!deletingTask) return;
                  await updateMut.mutateAsync({
                    taskId: deletingTask.id,
                    payload: { isActive: false },
                  });
                  setDeletingTask(null);
                  setDeleteErrMsg(null);
                }}
              >
                غیرفعال کردن تسک
              </Button>
            )}
            <Button
              type="button"
              variant="danger"
              isLoading={deleteMut.isPending}
              disabled={deleteMut.isPending}
              onClick={handleConfirmDelete}
            >
              حذف نهایی
            </Button>
          </div>
        </div>
      </Modal>

      {/* Work Sessions View Modal */}
      <WorkTargetSessionsModal
        isOpen={Boolean(viewingTask)}
        onClose={() => setViewingTask(null)}
        targetKind="TASK"
        targetId={viewingTask?.id ?? null}
        initialTitle={viewingTask?.name}
        initialDescription={viewingTask?.description}
        scrumName={scrum.name}
        scrumColor={scrum.color}
        points={viewingTask?.points}
      />
    </div>
  );
};

