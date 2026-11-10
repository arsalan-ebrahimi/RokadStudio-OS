import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Plus,
  Play,
  CheckCircle,
  Clock,
  Trash2,
  ChevronLeft,
  FolderKanban,
} from 'lucide-react';
import {
  Button,
  Input,
  Select,
  ConfirmDialog,
  PersianDatePicker,
  ErrorState,
  ProgressBar,
  Skeleton,
  Badge,
  SegmentedControl,
} from '@/shared/ui';
import { cn } from '@/shared/lib/utils';
import { toPersianDigits, formatDurationToHoursMins } from '@/shared/lib/formatters';
import { useAuthStore } from '@/features/auth';
import {
  useSprints,
  useSprint,
  useScrumProjects,
  useCreateSprint,
  useUpdateSprint,
  useUpdateSprintStatus,
  useDeleteSprint,
  useCreateSprintProject,
  useUpdateSprintProject,
  useDeleteSprintProject,
} from '../hooks/use-scrum';
import {
  SCRUM_COLOR_MAP,
  type Scrum,
  type SprintProject,
  type ItemStatus,
  type ScrumMember,
  type ScrumLinkedProject,
} from '../types/scrum-types';

interface SprintsTabProps {
  scrum: Scrum;
  canEdit: boolean;
}

const POINT_OPTIONS = [1, 2, 3, 5, 8, 13];

function formatPomodoroTracked(seconds: number): string {
  const pomodoros = Math.floor(seconds / 1500);
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const timeStr = `${hours}:${String(mins).padStart(2, '0')}`;
  return `${toPersianDigits(pomodoros)} پومودورو (${toPersianDigits(timeStr)})`;
}

export const SprintsTab: React.FC<SprintsTabProps> = ({ scrum, canEdit }) => {
  const { user } = useAuthStore();
  const location = useLocation();
  const hasStickyNavbar =
    location.pathname.startsWith('/panel') || location.pathname.startsWith('/scrum-admin');
  const stickyLaneTopClass = hasStickyNavbar ? 'top-16' : 'top-0';
  const colorMeta = SCRUM_COLOR_MAP[scrum.color] || SCRUM_COLOR_MAP.ECOSYSTEM;

  const {
    data: sprints = [],
    isLoading: sprintsLoading,
    isError: sprintsError,
    error: sprintsErr,
    refetch: refetchSprints,
  } = useSprints(scrum.id);

  const { data: linkedProjects = [] } = useScrumProjects(scrum.id);
  const activeLinkedProjects = linkedProjects.filter((p) => p.isActive);

  const [selectedSprintId, setSelectedSprintId] = useState<number | null>(null);

  // Reset when switching scrums
  useEffect(() => {
    setSelectedSprintId(null);
  }, [scrum.id]);

  // Auto-select active sprint or latest sprint
  useEffect(() => {
    if (sprints.length === 0) {
      if (selectedSprintId !== null) setSelectedSprintId(null);
      return;
    }
    const stillExists =
      selectedSprintId !== null && sprints.some((s) => s.id === selectedSprintId);
    if (!stillExists) {
      const active = sprints.find((s) => s.status === 'ACTIVE');
      setSelectedSprintId(active ? active.id : sprints[sprints.length - 1].id);
    }
  }, [sprints, selectedSprintId]);

  const {
    data: sprintDetails,
    isLoading: sprintDetailsLoading,
    isError: sprintDetailsError,
    error: sprintDetailsErr,
    refetch: refetchSprint,
  } = useSprint(selectedSprintId);

  // Mutations
  const createSprintMut = useCreateSprint(scrum.id);
  const updateSprintMut = useUpdateSprint(selectedSprintId || 0, scrum.id);
  const updateStatusMut = useUpdateSprintStatus(selectedSprintId || 0, scrum.id);
  const deleteSprintMut = useDeleteSprint(scrum.id);
  const createProjectMut = useCreateSprintProject(selectedSprintId || 0, scrum.id);
  const updateProjectMut = useUpdateSprintProject(selectedSprintId || 0, scrum.id);
  const deleteProjectMut = useDeleteSprintProject(selectedSprintId || 0, scrum.id);

  // UI state
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDesc, setEditedDesc] = useState('');
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
  const [deleteSprintConfirmOpen, setDeleteSprintConfirmOpen] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<number | null>(null);

  // Inline project creator per lane
  const [laneInlineCreate, setLaneInlineCreate] = useState<{
    laneKey: number | 'unassigned';
    name: string;
    points: number;
    projectId: number | null;
  } | null>(null);

  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sprintDetails) {
      setEditedTitle(sprintDetails.title);
      setEditedDesc(sprintDetails.description || '');
    }
  }, [sprintDetails]);

  const handleCreateSprint = async () => {
    try {
      const newSprint = await createSprintMut.mutateAsync();
      setSelectedSprintId(newSprint.id);
      setIsTitleEditing(true);
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
    } catch {
      // Handled by hook toast
    }
  };

  const handleSaveSprintHeader = async () => {
    if (!selectedSprintId || !editedTitle.trim()) return;
    try {
      await updateSprintMut.mutateAsync({
        title: editedTitle.trim(),
        description: editedDesc.trim() || undefined,
      });
      setIsTitleEditing(false);
    } catch {
      // Handled by hook toast
    }
  };

  const handleDateChange = async (field: 'startDate' | 'endDate', val: string) => {
    if (!selectedSprintId) return;
    try {
      await updateSprintMut.mutateAsync({
        [field]: val || null,
      });
    } catch {
      // Handled by hook toast
    }
  };

  const handleCreateInlineProject = async (assigneeId: number | null) => {
    if (!laneInlineCreate || !laneInlineCreate.name.trim()) return;
    try {
      await createProjectMut.mutateAsync({
        name: laneInlineCreate.name.trim(),
        points: laneInlineCreate.points,
        assigneeId,
        projectId: laneInlineCreate.projectId,
      });
      setLaneInlineCreate(null);
    } catch {
      // Handled by hook toast
    }
  };

  if (sprintsLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (sprintsError) {
    return (
      <ErrorState
        title="خطا در بارگذاری اسپرینت‌ها"
        message={sprintsErr instanceof Error ? sprintsErr.message : 'دریافت فهرست اسپرینت‌ها ناموفق بود.'}
        onRetry={() => refetchSprints()}
      />
    );
  }

  if (sprints.length === 0) {
    return (
      <div className="py-16 px-4 text-center space-y-4 max-w-md mx-auto">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-ecosystem-light dark:bg-ecosystem-darker/50 border-[1.5px] border-sec/35 dark:border-primary/40 flex items-center justify-center text-sec dark:text-primary text-2xl shadow-hard">
          ⚡
        </div>
        <div className="space-y-1.5">
          <h4 className="text-base font-black text-sec dark:text-white">هنوز اسپرینتی ایجاد نشده است</h4>
          <p className="text-xs text-ink-normal/65 dark:text-gray-400 leading-relaxed">
            برای شروع کار تیمی و مدیریت تسک‌ها، اولین اسپرینت این اسکرام را ایجاد کنید.
          </p>
        </div>
        {canEdit && (
          <Button
            variant="primary"
            onClick={handleCreateSprint}
            isLoading={createSprintMut.isPending}
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>ایجاد اولین اسپرینت (اسپرینت ۱)</span>
          </Button>
        )}
      </div>
    );
  }

  const projects = sprintDetails?.projects || [];
  const members = scrum.members || [];

  // Group items by lane: unassigned (null) + member lanes
  const unassignedProjects = projects.filter((p) => !p.assignee);
  const memberProjectsMap = new Map<number, SprintProject[]>();
  for (const m of members) {
    memberProjectsMap.set(m.id, []);
  }
  for (const p of projects) {
    if (p.assignee && memberProjectsMap.has(p.assignee.id)) {
      memberProjectsMap.get(p.assignee.id)!.push(p);
    }
  }

  const currentSprint = sprintDetails || sprints.find((s) => s.id === selectedSprintId);

  return (
    <div className="space-y-6">
      {/* 1. Sprints Pill Row (RTL) */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
        {sprints.map((s) => {
          const isSelected = s.id === selectedSprintId;
          const isActive = s.status === 'ACTIVE';
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedSprintId(s.id)}
              className={cn(
                'min-h-[44px] px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border-[1.5px] shrink-0',
                isSelected
                  ? cn(colorMeta.solidBg, colorMeta.solidText, 'border-sec dark:border-white shadow-hard')
                  : 'bg-white dark:bg-[#182030] text-sec/80 dark:text-gray-200 border-sec/25 dark:border-gray-700 hover:border-sec/55 shadow-hard-sm'
              )}
            >
              <span className="tabular-nums">S{toPersianDigits(s.number)}</span>
              {isActive && (
                <span
                  className={cn(
                    'w-2.5 h-2.5 rounded-full ring-2 animate-pulse shrink-0',
                    isSelected && (scrum.color === 'ECOSYSTEM' || scrum.color === 'COLLEGE')
                      ? 'bg-sec ring-white/80'
                      : 'bg-emerald-400 ring-white'
                  )}
                  aria-label="اسپرینت فعال"
                />
              )}
              {s.title && (
                <span className="text-[11px] font-bold opacity-90 truncate max-w-[140px]">
                  {s.title}
                </span>
              )}
            </button>
          );
        })}

        {canEdit && (
          <Button
            variant="outline"
            onClick={handleCreateSprint}
            isLoading={createSprintMut.isPending}
            className="text-xs font-extrabold gap-1.5 whitespace-nowrap px-4 shrink-0"
          >
            <Plus className="w-4 h-4 text-sec dark:text-primary" />
            <span>اسپرینت جدید</span>
          </Button>
        )}
      </div>

      {/* Sprint detail error state */}
      {sprintDetailsError ? (
        <ErrorState
          title="خطا در بارگذاری جزئیات اسپرینت"
          message={
            sprintDetailsErr instanceof Error
              ? sprintDetailsErr.message
              : 'اطلاعات اسپرینت انتخاب‌شده دریافت نشد.'
          }
          onRetry={() => refetchSprint()}
        />
      ) : (
        <>
          {/* 2. Sprint Header Card */}
          {currentSprint && (
            <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#121824] border-[1.5px] border-sec/25 dark:border-primary/35 shadow-hard space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Right: Badge + Title + Desc */}
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={cn(
                      'w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-hard-sm border-[1.5px] border-sec/30 dark:border-white/25 shrink-0 tabular-nums',
                      colorMeta.solidBg,
                      colorMeta.solidText
                    )}
                  >
                    S{toPersianDigits(currentSprint.number)}
                  </div>

                  <div className="min-w-0 flex-1">
                    {isTitleEditing ? (
                      <div className="space-y-2.5">
                        <input
                          ref={titleInputRef}
                          value={editedTitle}
                          onChange={(e) => setEditedTitle(e.target.value)}
                          className="h-10 text-sm sm:text-base font-black px-3 rounded-xl border-[1.5px] border-sec/40 dark:border-primary bg-white dark:bg-[#182030] text-sec dark:text-white w-full focus:outline-none focus:border-primary"
                        />
                        <input
                          value={editedDesc}
                          onChange={(e) => setEditedDesc(e.target.value)}
                          placeholder="توضیحات اختیاری اسپرینت..."
                          className="h-10 text-xs px-3 rounded-xl border-[1.5px] border-sec/20 dark:border-gray-700 bg-white dark:bg-[#182030] text-ink-normal dark:text-gray-300 w-full focus:outline-none focus:border-primary"
                        />
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={handleSaveSprintHeader}
                            isLoading={updateSprintMut.isPending}
                          >
                            ذخیره
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIsTitleEditing(false)}
                          >
                            انصراف
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-lg sm:text-xl font-black text-sec dark:text-white truncate">
                            {currentSprint.title}
                          </h2>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => setIsTitleEditing(true)}
                              className="text-xs text-sec dark:text-primary hover:underline font-extrabold cursor-pointer px-2 py-1 rounded-lg hover:bg-primary/15 transition-colors"
                            >
                              ویرایش
                            </button>
                          )}
                        </div>
                        {currentSprint.description && (
                          <p className="text-xs text-ink-normal/65 dark:text-gray-400 mt-1 leading-relaxed">
                            {currentSprint.description}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Left: Stepper + Status actions */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Status stepper: برنامه‌ریزی -> فعال -> تمام‌شده */}
                  <div className="flex items-center gap-1 p-1 rounded-2xl bg-gray-100 dark:bg-[#182030] text-xs font-bold border-[1.5px] border-sec/20 dark:border-gray-700">
                    <span
                      className={cn(
                        'px-2.5 py-1.5 rounded-xl transition-all',
                        currentSprint.status === 'PLANNED'
                          ? 'bg-white dark:bg-gray-800 text-sec dark:text-white shadow-sm font-black'
                          : 'text-ink-normal/55 dark:text-gray-400'
                      )}
                    >
                      برنامه‌ریزی
                    </span>
                    <ChevronLeft className="w-3.5 h-3.5 text-gray-400" />
                    <span
                      className={cn(
                        'px-2.5 py-1.5 rounded-xl transition-all',
                        currentSprint.status === 'ACTIVE'
                          ? 'bg-[#007A52] text-white shadow-sm font-black'
                          : 'text-ink-normal/55 dark:text-gray-400'
                      )}
                    >
                      فعال
                    </span>
                    <ChevronLeft className="w-3.5 h-3.5 text-gray-400" />
                    <span
                      className={cn(
                        'px-2.5 py-1.5 rounded-xl transition-all',
                        currentSprint.status === 'COMPLETED'
                          ? 'bg-sec text-white dark:bg-primary dark:text-sec shadow-sm font-black'
                          : 'text-ink-normal/55 dark:text-gray-400'
                      )}
                    >
                      تمام‌شده
                    </span>
                  </div>

                  {/* Status transition button for editor/SA */}
                  {canEdit && currentSprint.status === 'PLANNED' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => updateStatusMut.mutate('ACTIVE')}
                      isLoading={updateStatusMut.isPending}
                      className="gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>شروع اسپرینت</span>
                    </Button>
                  )}

                  {canEdit && currentSprint.status === 'ACTIVE' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmCompleteOpen(true)}
                      className="gap-1.5 border-[#2D68C4] text-[#1D4E9E] dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>پایان اسپرینت</span>
                    </Button>
                  )}

                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setDeleteSprintConfirmOpen(true)}
                      className="w-11 h-11 rounded-2xl flex items-center justify-center text-[#C60036] dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-800/60 transition-colors cursor-pointer"
                      title="حذف اسپرینت"
                      aria-label="حذف اسپرینت"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Dates & Stats bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-sec/10 dark:border-gray-800 text-xs">
                {/* Jalali Start Date */}
                <div>
                  <span className="block text-[11px] text-ink-normal/60 dark:text-gray-400 font-bold mb-1.5">
                    تاریخ شروع
                  </span>
                  {canEdit ? (
                    <PersianDatePicker
                      value={currentSprint.startDate || ''}
                      onChange={(d) => handleDateChange('startDate', d)}
                      allowStep={false}
                    />
                  ) : (
                    <span className="font-black text-sec dark:text-white inline-block pt-2 tabular-nums">
                      {currentSprint.startDate ? toPersianDigits(currentSprint.startDate) : 'تعیین نشده'}
                    </span>
                  )}
                </div>

                {/* Jalali End Date */}
                <div>
                  <span className="block text-[11px] text-ink-normal/60 dark:text-gray-400 font-bold mb-1.5">
                    تاریخ پایان
                  </span>
                  {canEdit ? (
                    <PersianDatePicker
                      value={currentSprint.endDate || ''}
                      onChange={(d) => handleDateChange('endDate', d)}
                      allowStep={false}
                    />
                  ) : (
                    <span className="font-black text-sec dark:text-white inline-block pt-2 tabular-nums">
                      {currentSprint.endDate ? toPersianDigits(currentSprint.endDate) : 'تعیین نشده'}
                    </span>
                  )}
                </div>

                {/* Points Progress */}
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold mb-2">
                    <span className="text-ink-normal/60 dark:text-gray-400">پیشرفت پوینت</span>
                    <span className="text-sec dark:text-white font-black tabular-nums">
                      {toPersianDigits(currentSprint.donePoints || 0)} از{' '}
                      {toPersianDigits(currentSprint.totalPoints || 0)} پوینت
                    </span>
                  </div>
                  <ProgressBar
                    value={currentSprint.donePoints || 0}
                    max={currentSprint.totalPoints > 0 ? currentSprint.totalPoints : 1}
                    barClassName={colorMeta.barText}
                    size="sm"
                    showLabel
                  />
                </div>

                {/* Total Tracked Time */}
                <div>
                  <span className="block text-[11px] text-ink-normal/60 dark:text-gray-400 font-bold mb-1.5">
                    مجموع زمان ثبت‌شده
                  </span>
                  <div className="flex items-center gap-2 pt-1.5 font-black text-sm text-sec dark:text-white tabular-nums">
                    <Clock className="w-4 h-4 text-sec dark:text-primary shrink-0" />
                    <span>
                      {formatDurationToHoursMins(currentSprint.totalTrackedSeconds || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. Lanes (One per Member + Unassigned on top) */}
          {sprintDetailsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-36 w-full rounded-3xl" />
              <Skeleton className="h-36 w-full rounded-3xl" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Lane: بدون مسئول */}
              <div className="rounded-3xl border-[1.5px] border-sec/20 dark:border-gray-800 bg-gray-50/80 dark:bg-[#101622]">
                <div
                  className={cn(
                    'sticky z-10 px-4 sm:px-5 pt-4 pb-3 flex items-center justify-between border-b border-sec/10 dark:border-gray-800 bg-[#F3F5F8] dark:bg-[#131B29] rounded-t-[22px]',
                    stickyLaneTopClass
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-400 shrink-0" />
                    <h4 className="text-xs sm:text-sm font-black text-sec dark:text-white">
                      تسک‌های بدون مسئول
                    </h4>
                    <Badge variant="neutral" className="tabular-nums">
                      {toPersianDigits(unassignedProjects.length)} تسک
                    </Badge>
                  </div>

                  <div className="text-xs font-black text-sec/70 dark:text-gray-300 tabular-nums">
                    {toPersianDigits(unassignedProjects.reduce((a, b) => a + b.points, 0))} پوینت
                  </div>
                </div>

                <div className="p-4 sm:p-5 space-y-4">
                  {/* Cards Grid */}
                  {unassignedProjects.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {unassignedProjects.map((item) => (
                        <SprintItemCard
                          key={item.id}
                          item={item}
                          canEdit={canEdit}
                          currentUserId={user?.id}
                          members={members}
                          activeLinkedProjects={activeLinkedProjects}
                          onStatusChange={(newStatus) =>
                            updateProjectMut.mutate({ id: item.id, payload: { status: newStatus } })
                          }
                          onAssigneeChange={(aid) =>
                            updateProjectMut.mutate({ id: item.id, payload: { assigneeId: aid } })
                          }
                          onProjectChange={(pid) =>
                            updateProjectMut.mutate({ id: item.id, payload: { projectId: pid } })
                          }
                          onPointsChange={(pts) =>
                            updateProjectMut.mutate({ id: item.id, payload: { points: pts } })
                          }
                          onDelete={() => setDeletingProjectId(item.id)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Footer: + تسک جدید */}
                  {canEdit && (
                    <div>
                      {laneInlineCreate?.laneKey === 'unassigned' ? (
                        <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-2xl bg-white dark:bg-[#182030] border-[1.5px] border-sec/35 dark:border-primary shadow-hard-sm">
                          <Input
                            placeholder="نام تسک / آیتم اسپرینت..."
                            value={laneInlineCreate.name}
                            onChange={(e) =>
                              setLaneInlineCreate({ ...laneInlineCreate, name: e.target.value })
                            }
                            containerClassName="flex-1 min-w-[180px]"
                            className="text-xs"
                            autoFocus
                          />
                          <Select
                            value={laneInlineCreate.projectId ?? ''}
                            onChange={(e) =>
                              setLaneInlineCreate({
                                ...laneInlineCreate,
                                projectId: e.target.value ? Number(e.target.value) : null,
                              })
                            }
                            containerClassName="w-44"
                            className="text-xs"
                          >
                            <option value="">بدون پروژه</option>
                            {activeLinkedProjects.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </Select>
                          <Select
                            value={laneInlineCreate.points}
                            onChange={(e) =>
                              setLaneInlineCreate({
                                ...laneInlineCreate,
                                points: Number(e.target.value),
                              })
                            }
                            containerClassName="w-28"
                            className="text-xs"
                          >
                            {POINT_OPTIONS.map((p) => (
                              <option key={p} value={p}>
                                {toPersianDigits(p)} پوینت
                              </option>
                            ))}
                          </Select>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleCreateInlineProject(null)}
                            isLoading={createProjectMut.isPending}
                            disabled={!laneInlineCreate.name.trim() || createProjectMut.isPending}
                          >
                            افزودن
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setLaneInlineCreate(null)}
                          >
                            لغو
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setLaneInlineCreate({
                              laneKey: 'unassigned',
                              name: '',
                              points: 3,
                              projectId: null,
                            })
                          }
                          className="gap-1.5 border-dashed border-sec/30 hover:border-solid"
                        >
                          <Plus className="w-4 h-4 text-sec dark:text-primary" />
                          <span>آیتم جدید بدون مسئول</span>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Member Lanes */}
              {members.map((member) => {
                const mProjects = memberProjectsMap.get(member.id) || [];
                const mPoints = mProjects.reduce((acc, p) => acc + p.points, 0);
                const mSeconds = mProjects.reduce((acc, p) => acc + (p.totalTrackedSeconds || 0), 0);

                return (
                  <div
                    key={member.id}
                    className="rounded-3xl border-[1.5px] border-sec/20 dark:border-primary/25 bg-white dark:bg-[#121824] shadow-hard-sm"
                  >
                    {/* Sticky Lane Header */}
                    <div
                      className={cn(
                        'sticky z-10 px-4 sm:px-5 pt-4 pb-3 flex items-center justify-between gap-3 border-b border-sec/10 dark:border-gray-800 bg-white dark:bg-[#121824] rounded-t-[22px]',
                        stickyLaneTopClass
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            'w-9 h-9 rounded-2xl flex items-center justify-center font-black text-sm border-[1.5px] border-sec/25 shadow-hard-sm shrink-0',
                            colorMeta.solidBg,
                            colorMeta.solidText
                          )}
                        >
                          {member.name.slice(0, 1)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-black text-sec dark:text-white truncate">
                            {member.name}
                          </h4>
                          {member.label && (
                            <span className="text-[11px] text-ink-normal/60 dark:text-gray-400 font-bold block truncate">
                              {member.label}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 text-xs font-black shrink-0 tabular-nums">
                        <span className="text-sec dark:text-gray-200">
                          {toPersianDigits(mPoints)} پوینت
                        </span>
                        {(canEdit || user?.id === member.id) && mSeconds > 0 && (
                          <span className="text-sec dark:text-ecosystem-light bg-ecosystem-light dark:bg-ecosystem-darker/60 border border-ecosystem-dark/30 font-mono text-[11px] px-2.5 py-1 rounded-full">
                            {formatDurationToHoursMins(mSeconds)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-4 sm:p-5 space-y-4">
                      {/* Cards Grid */}
                      {mProjects.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                          {mProjects.map((item) => (
                            <SprintItemCard
                              key={item.id}
                              item={item}
                              canEdit={canEdit}
                              currentUserId={user?.id}
                              members={members}
                              activeLinkedProjects={activeLinkedProjects}
                              onStatusChange={(newStatus) =>
                                updateProjectMut.mutate({ id: item.id, payload: { status: newStatus } })
                              }
                              onAssigneeChange={(aid) =>
                                updateProjectMut.mutate({ id: item.id, payload: { assigneeId: aid } })
                              }
                              onProjectChange={(pid) =>
                                updateProjectMut.mutate({ id: item.id, payload: { projectId: pid } })
                              }
                              onPointsChange={(pts) =>
                                updateProjectMut.mutate({ id: item.id, payload: { points: pts } })
                              }
                              onDelete={() => setDeletingProjectId(item.id)}
                            />
                          ))}
                        </div>
                      )}

                      {/* Lane Footer: + آیتم برای این عضو */}
                      {canEdit && (
                        <div>
                          {laneInlineCreate?.laneKey === member.id ? (
                            <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-2xl bg-gray-50 dark:bg-[#182030] border-[1.5px] border-sec/35 dark:border-primary shadow-hard-sm">
                              <Input
                                placeholder={`تسک برای ${member.name}...`}
                                value={laneInlineCreate.name}
                                onChange={(e) =>
                                  setLaneInlineCreate({ ...laneInlineCreate, name: e.target.value })
                                }
                                containerClassName="flex-1 min-w-[180px]"
                                className="text-xs"
                                autoFocus
                              />
                              <Select
                                value={laneInlineCreate.projectId ?? ''}
                                onChange={(e) =>
                                  setLaneInlineCreate({
                                    ...laneInlineCreate,
                                    projectId: e.target.value ? Number(e.target.value) : null,
                                  })
                                }
                                containerClassName="w-44"
                                className="text-xs"
                              >
                                <option value="">بدون پروژه</option>
                                {activeLinkedProjects.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </Select>
                              <Select
                                value={laneInlineCreate.points}
                                onChange={(e) =>
                                  setLaneInlineCreate({
                                    ...laneInlineCreate,
                                    points: Number(e.target.value),
                                  })
                                }
                                containerClassName="w-28"
                                className="text-xs"
                              >
                                {POINT_OPTIONS.map((p) => (
                                  <option key={p} value={p}>
                                    {toPersianDigits(p)} پوینت
                                  </option>
                                ))}
                              </Select>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleCreateInlineProject(member.id)}
                                isLoading={createProjectMut.isPending}
                                disabled={!laneInlineCreate.name.trim() || createProjectMut.isPending}
                              >
                                افزودن
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setLaneInlineCreate(null)}
                              >
                                لغو
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setLaneInlineCreate({
                                  laneKey: member.id,
                                  name: '',
                                  points: 3,
                                  projectId: null,
                                })
                              }
                              className="gap-1.5 border-dashed border-sec/30 hover:border-solid"
                            >
                              <Plus className="w-4 h-4 text-sec dark:text-primary" />
                              <span>افزودن تسک برای {member.name}</span>
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Confirm Dialog: Complete Sprint */}
      <ConfirmDialog
        isOpen={confirmCompleteOpen}
        title="پایان اسپرینت"
        message="آیا از پایان این اسپرینت اطمینان دارید؟ وضعیت اسپرینت به تمام‌شده تغییر می‌یابد و تاریخ اتمام ثبت خواهد شد."
        variant="primary"
        isLoading={updateStatusMut.isPending}
        onConfirm={async () => {
          try {
            await updateStatusMut.mutateAsync('COMPLETED');
            setConfirmCompleteOpen(false);
          } catch {
            // Toast handled in mutation
          }
        }}
        onCancel={() => setConfirmCompleteOpen(false)}
      />

      {/* Confirm Dialog: Delete Sprint */}
      <ConfirmDialog
        isOpen={deleteSprintConfirmOpen}
        title="حذف اسپرینت"
        message="آیا از حذف این اسپرینت اطمینان دارید؟ در صورت وجود سشن کاری، عملیات با خطا مسدود خواهد شد."
        variant="danger"
        isLoading={deleteSprintMut.isPending}
        onConfirm={async () => {
          if (!selectedSprintId) return;
          try {
            await deleteSprintMut.mutateAsync(selectedSprintId);
            setDeleteSprintConfirmOpen(false);
            setSelectedSprintId(null);
          } catch {
            // Toast handled in mutation
          }
        }}
        onCancel={() => setDeleteSprintConfirmOpen(false)}
      />

      {/* Confirm Dialog: Delete Sprint Project Item */}
      <ConfirmDialog
        isOpen={Boolean(deletingProjectId)}
        title="حذف آیتم اسپرینت"
        message="آیا از حذف این آیتم اسپرینت اطمینان دارید؟ در صورت داشتن سشن کاری ثبت‌شده، حذف آن مجاز نخواهد بود."
        variant="danger"
        isLoading={deleteProjectMut.isPending}
        onConfirm={async () => {
          if (!deletingProjectId) return;
          try {
            await deleteProjectMut.mutateAsync(deletingProjectId);
            setDeletingProjectId(null);
          } catch {
            // Toast handled in mutation
          }
        }}
        onCancel={() => setDeletingProjectId(null)}
      />
    </div>
  );
};

interface SprintItemCardProps {
  item: SprintProject;
  canEdit: boolean;
  currentUserId?: number;
  members: ScrumMember[];
  activeLinkedProjects: ScrumLinkedProject[];
  onStatusChange: (newStatus: ItemStatus) => void;
  onAssigneeChange: (assigneeId: number | null) => void;
  onProjectChange: (projectId: number | null) => void;
  onPointsChange: (points: number) => void;
  onDelete: () => void;
}

const SprintItemCard: React.FC<SprintItemCardProps> = ({
  item,
  canEdit,
  currentUserId,
  members,
  activeLinkedProjects,
  onStatusChange,
  onAssigneeChange,
  onProjectChange,
  onPointsChange,
  onDelete,
}) => {
  const isAssignee = item.assignee?.id === currentUserId;
  const canChangeStatus = canEdit || isAssignee;
  const isTimeVisible = canEdit || isAssignee;

  // Ensure current linked project appears in selector even if archived later
  const projectInActive =
    item.project && activeLinkedProjects.some((p) => p.id === item.project?.id);

  return (
    <div className="p-4 rounded-2xl border-[1.5px] border-sec/20 dark:border-gray-700 bg-white dark:bg-[#182030] shadow-hard-sm space-y-3 flex flex-col justify-between hover:shadow-hard transition-all">
      <div className="space-y-2.5">
        {/* Name + Delete */}
        <div className="flex items-start justify-between gap-2">
          <h5 className="text-xs sm:text-[13px] font-black text-sec dark:text-white leading-snug break-words min-w-0">
            {item.name}
          </h5>
          {canEdit && (
            <button
              type="button"
              onClick={onDelete}
              className="w-8 h-8 -m-1 rounded-xl flex items-center justify-center text-gray-400 hover:text-[#C60036] hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
              title="حذف"
              aria-label={`حذف ${item.name}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Linked Project Chip */}
        {item.project && (
          <div>
            <Badge variant="neutral" className="text-[11px] py-1 px-2.5 max-w-full">
              <FolderKanban className="w-3 h-3 text-sec dark:text-primary shrink-0" />
              <span className="truncate">{item.project.name}</span>
            </Badge>
          </div>
        )}

        {/* Assignee & Optional Project Selects for Editor */}
        {canEdit && (
          <div className="space-y-1.5 pt-0.5">
            <select
              value={item.assignee?.id || ''}
              onChange={(e) => onAssigneeChange(e.target.value ? Number(e.target.value) : null)}
              aria-label="تخصیص مسئول"
              className="w-full h-9 text-xs font-bold px-2.5 rounded-xl border-[1.5px] border-sec/20 dark:border-gray-700 bg-gray-50 dark:bg-[#121824] text-sec dark:text-gray-200 focus:outline-none focus:border-primary transition-colors cursor-pointer"
            >
              <option value="">بدون مسئول</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>

            {(activeLinkedProjects.length > 0 || item.project) && (
              <select
                value={item.project?.id || ''}
                onChange={(e) => onProjectChange(e.target.value ? Number(e.target.value) : null)}
                aria-label="پروژه مرتبط"
                className="w-full h-9 text-xs font-bold px-2.5 rounded-xl border-[1.5px] border-sec/20 dark:border-gray-700 bg-gray-50 dark:bg-[#121824] text-sec dark:text-gray-200 focus:outline-none focus:border-primary transition-colors cursor-pointer"
              >
                <option value="">بدون پروژه مرتبط</option>
                {item.project && !projectInActive && (
                  <option value={item.project.id}>
                    {item.project.name} (بایگانی)
                  </option>
                )}
                {activeLinkedProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    پروژه: {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2.5 pt-2.5 border-t border-sec/10 dark:border-gray-800">
        {/* Points Row */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-ink-normal/60 dark:text-gray-400 shrink-0">
            پوینت:
          </span>
          {canEdit ? (
            <div className="flex items-center gap-1 flex-wrap justify-end">
              {POINT_OPTIONS.map((pt) => (
                <button
                  key={pt}
                  type="button"
                  onClick={() => onPointsChange(pt)}
                  aria-label={`${toPersianDigits(pt)} پوینت`}
                  aria-pressed={item.points === pt}
                  className={cn(
                    'min-w-[30px] h-7 px-1.5 rounded-lg text-[11px] font-black tabular-nums transition-all cursor-pointer border',
                    item.points === pt
                      ? 'bg-primary text-sec border-sec/40 shadow-[1.5px_1.5px_0_#202A5A]'
                      : 'bg-gray-100 dark:bg-gray-800 text-sec/70 dark:text-gray-300 border-transparent hover:bg-gray-200 dark:hover:bg-gray-700'
                  )}
                >
                  {toPersianDigits(pt)}
                </button>
              ))}
            </div>
          ) : (
            <Badge variant="ecosystem" className="tabular-nums">
              {toPersianDigits(item.points)} پوینت
            </Badge>
          )}
        </div>

        {/* Status Segmented Control */}
        <SegmentedControl<ItemStatus>
          size="sm"
          disabled={!canChangeStatus}
          value={item.status}
          onChange={onStatusChange}
          aria-label={`وضعیت ${item.name}`}
          options={[
            { value: 'TODO', label: 'در انتظار' },
            { value: 'DOING', label: 'در حال انجام' },
            { value: 'DONE', label: 'انجام‌شده' },
          ]}
          className="w-full grid grid-cols-3 [&>button]:px-1.5 [&>button]:justify-center"
        />

        {/* Tracked Time (Visible to editor/SA and assignee only) */}
        {isTimeVisible && (item.totalTrackedSeconds || 0) > 0 && (
          <div className="text-[11px] font-bold text-ink-normal/65 dark:text-gray-400 flex items-center justify-between pt-0.5">
            <span>زمان ثبت‌شده:</span>
            <span className="text-sec dark:text-ecosystem-light font-mono font-black tabular-nums">
              {formatPomodoroTracked(item.totalTrackedSeconds || 0)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
