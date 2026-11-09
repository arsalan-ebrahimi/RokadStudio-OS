import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Play,
  CheckCircle,
  Clock,
  Trash2,
  ChevronLeft,
} from 'lucide-react';
import { Button, Input, Select, ConfirmDialog, PersianDatePicker } from '@/shared/ui';
import { cn } from '@/shared/lib/utils';
import { toPersianDigits, formatDurationToHoursMins } from '@/shared/lib/formatters';
import { useAuthStore } from '@/features/auth';
import {
  useSprints,
  useSprint,
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
  const colorMeta = SCRUM_COLOR_MAP[scrum.color] || SCRUM_COLOR_MAP.ECOSYSTEM;

  const { data: sprints = [], isLoading: sprintsLoading } = useSprints(scrum.id);
  const [selectedSprintId, setSelectedSprintId] = useState<number | null>(null);

  // Auto-select active sprint or first sprint
  useEffect(() => {
    if (sprints.length > 0 && selectedSprintId === null) {
      const active = sprints.find((s) => s.status === 'ACTIVE');
      setSelectedSprintId(active ? active.id : sprints[sprints.length - 1].id);
    }
  }, [sprints, selectedSprintId]);

  const { data: sprintDetails } = useSprint(selectedSprintId);

  // Mutations
  const createSprintMut = useCreateSprint(scrum.id);
  const updateSprintMut = useUpdateSprint(selectedSprintId || 0, scrum.id);
  const updateStatusMut = useUpdateSprintStatus(selectedSprintId || 0, scrum.id);
  const deleteSprintMut = useDeleteSprint(scrum.id);
  const createProjectMut = useCreateSprintProject(selectedSprintId || 0);
  const updateProjectMut = useUpdateSprintProject(selectedSprintId || 0);
  const deleteProjectMut = useDeleteSprintProject(selectedSprintId || 0);

  // UI state
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDesc, setEditedDesc] = useState('');
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
  const [deleteSprintConfirmOpen, setDeleteSprintConfirmOpen] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<number | null>(null);

  // Inline project creator per lane (laneKey -> { name, points })
  const [laneInlineCreate, setLaneInlineCreate] = useState<{
    laneKey: number | 'unassigned';
    name: string;
    points: number;
  } | null>(null);

  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sprintDetails) {
      setEditedTitle(sprintDetails.title);
      setEditedDesc(sprintDetails.description || '');
    }
  }, [sprintDetails]);

  const handleCreateSprint = async () => {
    const newSprint = await createSprintMut.mutateAsync();
    setSelectedSprintId(newSprint.id);
    setIsTitleEditing(true);
    setTimeout(() => {
      titleInputRef.current?.focus();
    }, 100);
  };

  const handleSaveSprintHeader = async () => {
    if (!selectedSprintId || !editedTitle.trim()) return;
    await updateSprintMut.mutateAsync({
      title: editedTitle.trim(),
      description: editedDesc.trim() || undefined,
    });
    setIsTitleEditing(false);
  };

  const handleDateChange = async (field: 'startDate' | 'endDate', val: string) => {
    if (!selectedSprintId) return;
    await updateSprintMut.mutateAsync({
      [field]: val || null,
    });
  };

  const handleCreateInlineProject = async (assigneeId: number | null) => {
    if (!laneInlineCreate || !laneInlineCreate.name.trim()) return;
    await createProjectMut.mutateAsync({
      name: laneInlineCreate.name.trim(),
      points: laneInlineCreate.points,
      assigneeId,
    });
    setLaneInlineCreate(null);
  };

  if (sprintsLoading) {
    return (
      <div className="py-12 text-center text-xs font-bold text-ink-normal/50 dark:text-gray-400 animate-pulse">
        در حال بارگذاری اسپرینت‌ها...
      </div>
    );
  }

  if (sprints.length === 0) {
    return (
      <div className="py-16 text-center space-y-4 max-w-md mx-auto">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-primary/10 border-2 border-primary/30 flex items-center justify-center text-primary text-2xl shadow-hard">
          ⚡
        </div>
        <div className="space-y-1">
          <h4 className="text-base font-black text-sec dark:text-white">هنوز اسپرینتی ایجاد نشده است</h4>
          <p className="text-xs text-ink-normal/60 dark:text-gray-400">
            برای شروع کار تیمی و مدیریت تسک‌ها، اولین اسپرینت این اسکرام را ایجاد کنید.
          </p>
        </div>
        {canEdit && (
          <Button
            variant="primary"
            onClick={handleCreateSprint}
            isLoading={createSprintMut.isPending}
            className="font-extrabold shadow-hard text-xs gap-1.5"
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

  // Group projects by lane: unassigned (null) + member lanes
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
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {sprints.map((s) => {
          const isSelected = s.id === selectedSprintId;
          const isActive = s.status === 'ACTIVE';
          return (
            <button
              key={s.id}
              onClick={() => setSelectedSprintId(s.id)}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border-2 shadow-hard-sm',
                isSelected
                  ? 'border-sec dark:border-white shadow-hard text-white scale-102'
                  : 'bg-white dark:bg-[#182030] text-ink-normal/80 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-400'
              )}
              style={isSelected ? { backgroundColor: colorMeta.accent } : undefined}
            >
              <span>S{toPersianDigits(s.number)}</span>
              {isActive && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-white animate-pulse" />
              )}
              {s.title && <span className="text-[11px] font-normal opacity-90 truncate max-w-[120px]">{s.title}</span>}
            </button>
          );
        })}

        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleCreateSprint}
            isLoading={createSprintMut.isPending}
            className="text-xs font-bold gap-1 shadow-hard-sm whitespace-nowrap h-9 px-3"
          >
            <Plus className="w-3.5 h-3.5 text-primary" />
            <span>اسپرینت جدید</span>
          </Button>
        )}
      </div>

      {/* 2. Sprint Header Card */}
      {currentSprint && (
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#121824] border-2 border-primary/25 shadow-hard space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Left: Badge + Title + Desc */}
            <div className="flex items-start gap-3.5 min-w-0">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg text-white shadow-hard shrink-0"
                style={{ backgroundColor: colorMeta.accent }}
              >
                S{toPersianDigits(currentSprint.number)}
              </div>

              <div className="min-w-0 flex-1">
                {isTitleEditing ? (
                  <div className="space-y-2">
                    <input
                      ref={titleInputRef}
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      className="text-base font-black px-2 py-1 rounded-lg border border-primary bg-white dark:bg-[#182030] text-sec dark:text-white w-full"
                    />
                    <input
                      value={editedDesc}
                      onChange={(e) => setEditedDesc(e.target.value)}
                      placeholder="توضیحات اختیاری اسپرینت..."
                      className="text-xs px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#182030] text-ink-normal dark:text-gray-300 w-full"
                    />
                    <div className="flex items-center gap-1.5 pt-1">
                      <Button size="sm" variant="primary" onClick={handleSaveSprintHeader} className="text-xs py-1">
                        ذخیره
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setIsTitleEditing(false)} className="text-xs py-1">
                        انصراف
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-black text-sec dark:text-white truncate">
                        {currentSprint.title}
                      </h2>
                      {canEdit && (
                        <button
                          onClick={() => setIsTitleEditing(true)}
                          className="text-[11px] text-primary hover:underline font-bold"
                        >
                          ویرایش
                        </button>
                      )}
                    </div>
                    {currentSprint.description && (
                      <p className="text-xs text-ink-normal/60 dark:text-gray-400 mt-1 leading-relaxed">
                        {currentSprint.description}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Stepper + Status actions */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Status stepper: برنامه‌ریزی -> فعال -> تمام‌شده */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-gray-100 dark:bg-[#182030] text-xs font-bold border border-gray-200 dark:border-gray-700">
                <span
                  className={cn(
                    'px-2.5 py-1 rounded-lg transition-all',
                    currentSprint.status === 'PLANNED'
                      ? 'bg-white dark:bg-gray-800 text-sec dark:text-white shadow-sm font-black'
                      : 'text-ink-normal/50 dark:text-gray-400'
                  )}
                >
                  برنامه‌ریزی
                </span>
                <ChevronLeft className="w-3.5 h-3.5 text-gray-400" />
                <span
                  className={cn(
                    'px-2.5 py-1 rounded-lg transition-all',
                    currentSprint.status === 'ACTIVE'
                      ? 'bg-emerald-500 text-white shadow-sm font-black'
                      : 'text-ink-normal/50 dark:text-gray-400'
                  )}
                >
                  فعال
                </span>
                <ChevronLeft className="w-3.5 h-3.5 text-gray-400" />
                <span
                  className={cn(
                    'px-2.5 py-1 rounded-lg transition-all',
                    currentSprint.status === 'COMPLETED'
                      ? 'bg-blue-600 text-white shadow-sm font-black'
                      : 'text-ink-normal/50 dark:text-gray-400'
                  )}
                >
                  تمام‌شده
                </span>
              </div>

              {/* Status transition button for owner/SA */}
              {canEdit && currentSprint.status === 'PLANNED' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => updateStatusMut.mutate('ACTIVE')}
                  isLoading={updateStatusMut.isPending}
                  className="gap-1.5 font-extrabold text-xs shadow-hard-sm"
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
                  className="gap-1.5 font-bold text-xs border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-50 shadow-hard-sm"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>پایان اسپرینت</span>
                </Button>
              )}

              {canEdit && (
                <button
                  onClick={() => setDeleteSprintConfirmOpen(true)}
                  className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  title="حذف اسپرینت"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Dates & Stats bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs">
            {/* Jalali Start Date */}
            <div>
              <span className="block text-[11px] text-ink-normal/50 dark:text-gray-400 font-bold mb-1">
                تاریخ شروع
              </span>
              {canEdit ? (
                <PersianDatePicker
                  value={currentSprint.startDate || ''}
                  onChange={(d) => handleDateChange('startDate', d)}
                  allowStep={false}
                />
              ) : (
                <span className="font-bold text-sec dark:text-white">
                  {currentSprint.startDate || 'تعیین نشده'}
                </span>
              )}
            </div>

            {/* Jalali End Date */}
            <div>
              <span className="block text-[11px] text-ink-normal/50 dark:text-gray-400 font-bold mb-1">
                تاریخ پایان
              </span>
              {canEdit ? (
                <PersianDatePicker
                  value={currentSprint.endDate || ''}
                  onChange={(d) => handleDateChange('endDate', d)}
                  allowStep={false}
                />
              ) : (
                <span className="font-bold text-sec dark:text-white">
                  {currentSprint.endDate || 'تعیین نشده'}
                </span>
              )}
            </div>

            {/* Points Progress */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                <span className="text-ink-normal/50 dark:text-gray-400">پیشرفت پوینت</span>
                <span className="text-sec dark:text-white">
                  {toPersianDigits(currentSprint.donePoints || 0)} از {toPersianDigits(currentSprint.totalPoints || 0)} پوینت
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{
                    width: `${currentSprint.totalPoints > 0 ? (currentSprint.donePoints / currentSprint.totalPoints) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Total Tracked Time */}
            <div>
              <span className="block text-[11px] text-ink-normal/50 dark:text-gray-400 font-bold mb-1">
                مجموع زمان ثبت‌شده
              </span>
              <div className="flex items-center gap-1.5 font-black text-sec dark:text-white">
                <Clock className="w-4 h-4 text-primary" />
                <span>
                  {formatDurationToHoursMins(currentSprint.totalTrackedSeconds || 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Lanes (One per Member + Unassigned on top) */}
      <div className="space-y-4">
        {/* Lane: بدون مسئول */}
        <div className="rounded-2xl border-2 border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-[#101622] p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
              <h4 className="text-xs sm:text-sm font-black text-sec dark:text-white">
                پروژه‌های بدون مسئول
              </h4>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-800 text-ink-normal/70 dark:text-gray-300">
                {toPersianDigits(unassignedProjects.length)} تسک
              </span>
            </div>

            <div className="text-xs font-bold text-ink-normal/60 dark:text-gray-400">
              {toPersianDigits(unassignedProjects.reduce((a, b) => a + b.points, 0))} پوینت
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {unassignedProjects.map((item) => (
              <SprintItemCard
                key={item.id}
                item={item}
                canEdit={canEdit}
                currentUserId={user?.id}
                members={members}
                onStatusChange={(newStatus) =>
                  updateProjectMut.mutate({ id: item.id, payload: { status: newStatus } })
                }
                onAssigneeChange={(aid) =>
                  updateProjectMut.mutate({ id: item.id, payload: { assigneeId: aid } })
                }
                onPointsChange={(pts) =>
                  updateProjectMut.mutate({ id: item.id, payload: { points: pts } })
                }
                onDelete={() => setDeletingProjectId(item.id)}
              />
            ))}
          </div>

          {/* Footer: + پروژه button */}
          {canEdit && (
            <div className="pt-2">
              {laneInlineCreate?.laneKey === 'unassigned' ? (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-[#182030] border border-primary">
                  <Input
                    placeholder="نام پروژه/تسک..."
                    value={laneInlineCreate.name}
                    onChange={(e) =>
                      setLaneInlineCreate({ ...laneInlineCreate, name: e.target.value })
                    }
                    className="flex-1 text-xs"
                    autoFocus
                  />
                  <Select
                    value={laneInlineCreate.points}
                    onChange={(e) =>
                      setLaneInlineCreate({
                        ...laneInlineCreate,
                        points: Number(e.target.value),
                      })
                    }
                    className="w-24 text-xs"
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
                    disabled={!laneInlineCreate.name.trim()}
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
                    })
                  }
                  className="text-xs font-bold gap-1 shadow-hard-sm"
                >
                  <Plus className="w-3.5 h-3.5 text-primary" />
                  <span>پروژه جدید بدون مسئول</span>
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Member Lanes */}
        {members.map((member) => {
          const mProjects = memberProjectsMap.get(member.id) || [];
          const mPoints = mProjects.reduce((acc, p) => acc + p.points, 0);
          const mSeconds = mProjects.reduce((acc, p) => acc + (p.totalTrackedSeconds || 0), 0);

          return (
            <div
              key={member.id}
              className="rounded-2xl border-2 border-primary/15 bg-white dark:bg-[#121824] p-4 space-y-3 shadow-hard-sm"
            >
              {/* Lane Header */}
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs text-white"
                    style={{ backgroundColor: colorMeta.accent }}
                  >
                    {member.name.slice(0, 1)}
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-sec dark:text-white">
                      {member.name}
                    </h4>
                    {member.label && (
                      <span className="text-[10px] text-ink-normal/50 dark:text-gray-400 font-bold">
                        {member.label}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs font-bold">
                  <span className="text-sec dark:text-gray-300">
                    {toPersianDigits(mPoints)} پوینت
                  </span>
                  {(canEdit || user?.id === member.id) && mSeconds > 0 && (
                    <span className="text-primary font-mono text-[11px] bg-primary/10 px-2 py-0.5 rounded-full">
                      {formatDurationToHoursMins(mSeconds)}
                    </span>
                  )}
                </div>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {mProjects.map((item) => (
                  <SprintItemCard
                    key={item.id}
                    item={item}
                    canEdit={canEdit}
                    currentUserId={user?.id}
                    members={members}
                    onStatusChange={(newStatus) =>
                      updateProjectMut.mutate({ id: item.id, payload: { status: newStatus } })
                    }
                    onAssigneeChange={(aid) =>
                      updateProjectMut.mutate({ id: item.id, payload: { assigneeId: aid } })
                    }
                    onPointsChange={(pts) =>
                      updateProjectMut.mutate({ id: item.id, payload: { points: pts } })
                    }
                    onDelete={() => setDeletingProjectId(item.id)}
                  />
                ))}
              </div>

              {/* Lane Footer: + پروژه already assigned to this member */}
              {canEdit && (
                <div className="pt-2">
                  {laneInlineCreate?.laneKey === member.id ? (
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-gray-50 dark:bg-[#182030] border border-primary">
                      <Input
                        placeholder={`تسک برای ${member.name}...`}
                        value={laneInlineCreate.name}
                        onChange={(e) =>
                          setLaneInlineCreate({ ...laneInlineCreate, name: e.target.value })
                        }
                        className="flex-1 text-xs"
                        autoFocus
                      />
                      <Select
                        value={laneInlineCreate.points}
                        onChange={(e) =>
                          setLaneInlineCreate({
                            ...laneInlineCreate,
                            points: Number(e.target.value),
                          })
                        }
                        className="w-24 text-xs"
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
                        disabled={!laneInlineCreate.name.trim()}
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
                        })
                      }
                      className="text-xs font-bold gap-1 shadow-hard-sm"
                    >
                      <Plus className="w-3.5 h-3.5 text-primary" />
                      <span>افزودن پروژه برای {member.name}</span>
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirm Dialog: Complete Sprint */}
      <ConfirmDialog
        isOpen={confirmCompleteOpen}
        title="پایان اسپرینت"
        message="آیا از پایان این اسپرینت اطمینان دارید؟ وضعیت اسپرینت به تمام‌شده تغییر می‌یابد و تاریخ اتمام ثبت خواهد شد."
        variant="primary"
        isLoading={updateStatusMut.isPending}
        onConfirm={async () => {
          await updateStatusMut.mutateAsync('COMPLETED');
          setConfirmCompleteOpen(false);
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
          await deleteSprintMut.mutateAsync(selectedSprintId);
          setDeleteSprintConfirmOpen(false);
          setSelectedSprintId(null);
        }}
        onCancel={() => setDeleteSprintConfirmOpen(false)}
      />

      {/* Confirm Dialog: Delete Sprint Project Item */}
      <ConfirmDialog
        isOpen={Boolean(deletingProjectId)}
        title="حذف پروژه اسپرینت"
        message="آیا از حذف این پروژه اسپرینت اطمینان دارید؟ در صورت داشتن سشن کاری ثبت‌شده، حذف آن مجاز نخواهد بود."
        variant="danger"
        isLoading={deleteProjectMut.isPending}
        onConfirm={async () => {
          if (!deletingProjectId) return;
          await deleteProjectMut.mutateAsync(deletingProjectId);
          setDeletingProjectId(null);
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
  onStatusChange: (newStatus: ItemStatus) => void;
  onAssigneeChange: (assigneeId: number | null) => void;
  onPointsChange: (points: number) => void;
  onDelete: () => void;
}

const SprintItemCard: React.FC<SprintItemCardProps> = ({
  item,
  canEdit,
  currentUserId,
  members,
  onStatusChange,
  onAssigneeChange,
  onPointsChange,
  onDelete,
}) => {
  const isAssignee = item.assignee?.id === currentUserId;
  const canChangeStatus = canEdit || isAssignee;
  const isTimeVisible = canEdit || isAssignee;

  return (
    <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#182030] shadow-hard-sm space-y-3 flex flex-col justify-between hover:shadow-hard transition-all">
      <div className="space-y-2">
        {/* Name + Delete */}
        <div className="flex items-start justify-between gap-1">
          <h5 className="text-xs font-black text-sec dark:text-white leading-snug">
            {item.name}
          </h5>
          {canEdit && (
            <button
              onClick={onDelete}
              className="text-gray-400 hover:text-rose-500 p-0.5 rounded transition-colors"
              title="حذف"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Assignee Select for reassignment */}
        {canEdit && (
          <div className="pt-1">
            <select
              value={item.assignee?.id || ''}
              onChange={(e) => onAssigneeChange(e.target.value ? Number(e.target.value) : null)}
              className="w-full text-[11px] font-bold px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#121824] text-ink-normal/80 dark:text-gray-300 focus:outline-none"
            >
              <option value="">بدون مسئول</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
        {/* Points Chip & Status Select */}
        <div className="flex items-center justify-between gap-2">
          {/* Points chips */}
          {canEdit ? (
            <div className="flex items-center gap-1">
              {POINT_OPTIONS.map((pt) => (
                <button
                  key={pt}
                  type="button"
                  onClick={() => onPointsChange(pt)}
                  className={cn(
                    'w-6 h-6 rounded-md text-[10px] font-black transition-all cursor-pointer',
                    item.points === pt
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-800 text-ink-normal/60 dark:text-gray-400 hover:bg-gray-200'
                  )}
                >
                  {toPersianDigits(pt)}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-primary/10 text-primary">
              {toPersianDigits(item.points)} پوینت
            </span>
          )}

          {/* Status Select */}
          <select
            value={item.status}
            disabled={!canChangeStatus}
            onChange={(e) => onStatusChange(e.target.value as ItemStatus)}
            className={cn(
              'text-[11px] font-black px-2 py-1 rounded-lg border transition-all cursor-pointer focus:outline-none',
              item.status === 'DONE' && 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border-emerald-300',
              item.status === 'DOING' && 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 border-amber-300',
              item.status === 'TODO' && 'bg-gray-50 dark:bg-gray-800 text-gray-600 border-gray-300'
            )}
          >
            <option value="TODO">در انتظار</option>
            <option value="DOING">در حال انجام</option>
            <option value="DONE">انجام‌شده</option>
          </select>
        </div>

        {/* Tracked Time (Visible to owner/SA and assignee only) */}
        {isTimeVisible && (item.totalTrackedSeconds || 0) > 0 && (
          <div className="text-[10px] font-bold text-ink-normal/60 dark:text-gray-400 flex items-center justify-between pt-1">
            <span>زمان ثبت‌شده:</span>
            <span className="text-primary font-mono font-bold">
              {formatPomodoroTracked(item.totalTrackedSeconds || 0)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
