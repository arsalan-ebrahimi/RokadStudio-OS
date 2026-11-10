import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  Check,
  Edit2,
  Layers,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  ErrorState,
  Input,
  Modal,
  PersianDatePicker,
  ProgressBar,
  SegmentedControl,
  Skeleton,
} from '@/shared/ui';
import { cn } from '@/shared/lib/utils';
import { toPersianDigits } from '@/shared/lib/formatters';
import { formatToJalali, getTehranTodayString } from '@/shared/lib/date';
import {
  useCreateSprint,
  useDeleteSprint,
  useSprints,
  useUpdateSprint,
  useUpdateSprintStatus,
} from '../hooks/use-scrum';
import {
  SCRUM_COLOR_MAP,
  type Scrum,
  type Sprint,
  type SprintStatus,
} from '../types/scrum-types';

interface SprintsTabProps {
  scrum: Scrum;
  canEdit: boolean;
}

const SPRINT_PHASE_OPTIONS: { value: SprintStatus; label: string }[] = [
  { value: 'PLANNED', label: 'برنامه‌ریزی' },
  { value: 'ACTIVE', label: 'فعال' },
  { value: 'COMPLETED', label: 'تمام‌شده' },
];

const QUICK_PROGRESS_VALUES = [0, 25, 50, 75, 100];

function getSprintPhaseMeta(status: SprintStatus) {
  if (status === 'ACTIVE') {
    return { label: 'فعال', variant: 'ecosystem' as const };
  }
  if (status === 'COMPLETED') {
    return { label: 'تمام‌شده', variant: 'male' as const };
  }
  return { label: 'برنامه‌ریزی', variant: 'college' as const };
}

export const SprintsTab: React.FC<SprintsTabProps> = ({ scrum, canEdit }) => {
  const colorMeta = SCRUM_COLOR_MAP[scrum.color] || SCRUM_COLOR_MAP.ECOSYSTEM;
  const todayIso = getTehranTodayString();

  const {
    data: sprints = [],
    isLoading: sprintsLoading,
    isError: sprintsError,
    error: sprintsErr,
    refetch: refetchSprints,
  } = useSprints(scrum.id);

  const [selectedSprintId, setSelectedSprintId] = useState<number | null>(null);

  useEffect(() => {
    setSelectedSprintId(null);
  }, [scrum.id]);

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

  const currentSprint: Sprint | undefined =
    sprints.find((s) => s.id === selectedSprintId) || sprints[0];

  const createSprintMut = useCreateSprint(scrum.id);
  const updateSprintMut = useUpdateSprint(currentSprint?.id || 0, scrum.id);
  const updateStatusMut = useUpdateSprintStatus(currentSprint?.id || 0, scrum.id);
  const deleteSprintMut = useDeleteSprint(scrum.id);

  // Create Sprint modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newProgress, setNewProgress] = useState<number>(0);
  const [useNewStartDate, setUseNewStartDate] = useState(false);
  const [newStartDate, setNewStartDate] = useState(todayIso);
  const [useNewEndDate, setUseNewEndDate] = useState(false);
  const [newEndDate, setNewEndDate] = useState(todayIso);

  // Inline header edit state
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDesc, setEditedDesc] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Manual progress draft state
  const [draftProgress, setDraftProgress] = useState<number>(0);

  // Delete confirm
  const [deleteSprintConfirmOpen, setDeleteSprintConfirmOpen] = useState(false);

  useEffect(() => {
    if (currentSprint) {
      setEditedTitle(currentSprint.title);
      setEditedDesc(currentSprint.description || '');
      setDraftProgress(currentSprint.progressPercent ?? 0);
      setIsTitleEditing(false);
    }
  }, [currentSprint?.id, currentSprint?.title, currentSprint?.description, currentSprint?.progressPercent]);

  const openCreateModal = () => {
    setNewTitle('');
    setNewDesc('');
    setNewProgress(0);
    setUseNewStartDate(false);
    setNewStartDate(todayIso);
    setUseNewEndDate(false);
    setNewEndDate(todayIso);
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createSprintMut.isPending) return;
    try {
      const created = await createSprintMut.mutateAsync({
        title: newTitle.trim() || undefined,
        description: newDesc.trim() || undefined,
        startDate: useNewStartDate ? newStartDate : undefined,
        endDate: useNewEndDate ? newEndDate : undefined,
        progressPercent: Math.max(0, Math.min(100, Math.round(Number(newProgress) || 0))),
      });
      setSelectedSprintId(created.id);
      setIsCreateModalOpen(false);
    } catch {
      // Handled by hook toast
    }
  };

  const handleSaveSprintHeader = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentSprint || !editedTitle.trim()) return;
    try {
      await updateSprintMut.mutateAsync({
        title: editedTitle.trim(),
        description: editedDesc.trim() ? editedDesc.trim() : null,
      });
      setIsTitleEditing(false);
    } catch {
      // Handled by hook toast
    }
  };

  const handleDateChange = async (field: 'startDate' | 'endDate', val: string | null) => {
    if (!currentSprint) return;
    try {
      await updateSprintMut.mutateAsync({ [field]: val });
    } catch {
      // Handled by hook toast
    }
  };

  const handleSaveProgress = async () => {
    if (!currentSprint) return;
    const clamped = Math.max(0, Math.min(100, Math.round(Number(draftProgress) || 0)));
    setDraftProgress(clamped);
    try {
      await updateSprintMut.mutateAsync({ progressPercent: clamped });
    } catch {
      // Handled by hook toast
    }
  };

  const handlePhaseChange = (nextPhase: SprintStatus) => {
    if (!canEdit || !currentSprint || nextPhase === currentSprint.status) return;
    updateStatusMut.mutate(nextPhase);
  };

  if (sprintsLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28 rounded-2xl" />
          <Skeleton className="h-10 w-28 rounded-2xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }

  if (sprintsError) {
    return (
      <ErrorState
        title="خطا در بارگذاری اسپرینت‌ها"
        message={
          sprintsErr instanceof Error
            ? sprintsErr.message
            : 'دریافت فهرست اسپرینت‌ها ناموفق بود.'
        }
        onRetry={() => refetchSprints()}
      />
    );
  }

  return (
    <div className="space-y-6">
      {sprints.length === 0 ? (
        <div className="py-16 px-4 text-center space-y-4 max-w-md mx-auto">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-ecosystem-light dark:bg-ecosystem-darker/50 border-[1.5px] border-sec/35 dark:border-primary/40 flex items-center justify-center text-sec dark:text-primary shadow-hard">
            <Layers className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h4 className="text-base font-black text-sec dark:text-white">
              هنوز اسپرینتی ایجاد نشده است
            </h4>
            <p className="text-xs text-ink-normal/65 dark:text-gray-400 leading-relaxed">
              اسپرینت‌ها دوره‌های زمانی این اسکرام با توضیحات، تاریخ شروع و پایان، فاز اجرایی و درصد پیشرفت دستی هستند.
            </p>
          </div>
          {canEdit && (
            <Button
              variant="primary"
              onClick={openCreateModal}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>ایجاد اولین اسپرینت (اسپرینت ۱)</span>
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* 1. Sprints Pill Selector */}
          <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
            {sprints.map((s) => {
              const isSelected = s.id === currentSprint?.id;
              const isActive = s.status === 'ACTIVE';
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSprintId(s.id)}
                  className={cn(
                    'min-h-[44px] px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border-[1.5px] shrink-0',
                    isSelected
                      ? cn(
                          colorMeta.solidBg,
                          colorMeta.solidText,
                          'border-sec dark:border-white shadow-hard'
                        )
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
                    <span className="text-[11px] font-bold opacity-90 truncate max-w-[160px]">
                      {s.title}
                    </span>
                  )}
                </button>
              );
            })}

            {canEdit && (
              <Button
                variant="outline"
                onClick={openCreateModal}
                className="text-xs font-extrabold gap-1.5 whitespace-nowrap px-4 shrink-0"
              >
                <Plus className="w-4 h-4 text-sec dark:text-primary" />
                <span>اسپرینت جدید</span>
              </Button>
            )}
          </div>

          {/* 2. Selected Sprint Detail Card */}
          {currentSprint && (
            <Card className="p-5 sm:p-6 rounded-3xl border-[1.5px] border-sec/25 dark:border-primary/35 shadow-hard space-y-6">
              {/* Top Row: Badge, Title/Description + Bidirectional Phase Switcher + Delete */}
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
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
                      <form onSubmit={handleSaveSprintHeader} className="space-y-2.5">
                        <Input
                          ref={titleInputRef}
                          value={editedTitle}
                          onChange={(e) => setEditedTitle(e.target.value)}
                          placeholder="عنوان اسپرینت..."
                          required
                          autoFocus
                        />
                        <textarea
                          value={editedDesc}
                          onChange={(e) => setEditedDesc(e.target.value)}
                          rows={2}
                          placeholder="توضیحات اختیاری اسپرینت..."
                          className="w-full px-3 py-2 rounded-xl border-[1.5px] border-sec/20 dark:border-gray-700 bg-white dark:bg-[#182030] text-xs text-sec dark:text-gray-200 focus:outline-none focus:border-primary"
                        />
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            type="submit"
                            size="sm"
                            variant="primary"
                            isLoading={updateSprintMut.isPending}
                            disabled={!editedTitle.trim() || updateSprintMut.isPending}
                          >
                            <Check className="w-3.5 h-3.5 me-1" />
                            ذخیره
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditedTitle(currentSprint.title);
                              setEditedDesc(currentSprint.description || '');
                              setIsTitleEditing(false);
                            }}
                          >
                            انصراف
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-lg sm:text-xl font-black text-sec dark:text-white break-words">
                            {currentSprint.title}
                          </h2>
                          {canEdit && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setIsTitleEditing(true);
                                setTimeout(() => titleInputRef.current?.focus(), 60);
                              }}
                              className="text-xs px-2.5 h-8"
                            >
                              <Edit2 className="w-3.5 h-3.5 me-1 text-primary" />
                              ویرایش عنوان و توضیحات
                            </Button>
                          )}
                        </div>
                        {currentSprint.description ? (
                          <p className="text-xs sm:text-sm text-sec/75 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                            {currentSprint.description}
                          </p>
                        ) : (
                          <p className="text-xs text-sec/45 dark:text-gray-500 italic">
                            توضیحاتی برای این اسپرینت ثبت نشده است.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Phase switcher (bidirectional) + Delete */}
                <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-2 shrink-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {canEdit ? (
                      <SegmentedControl<SprintStatus>
                        aria-label="فاز اسپرینت"
                        options={SPRINT_PHASE_OPTIONS}
                        value={currentSprint.status}
                        onChange={handlePhaseChange}
                        disabled={updateStatusMut.isPending}
                      />
                    ) : (
                      <Badge dot variant={getSprintPhaseMeta(currentSprint.status).variant}>
                        {getSprintPhaseMeta(currentSprint.status).label}
                      </Badge>
                    )}

                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setDeleteSprintConfirmOpen(true)}
                        className="w-10 h-10 rounded-2xl flex items-center justify-center text-[#C60036] dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-[1.5px] border-rose-200 dark:border-rose-800/60 transition-colors cursor-pointer"
                        title="حذف اسپرینت"
                        aria-label="حذف اسپرینت"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {canEdit && (
                    <span className="text-[11px] font-bold text-sec/55 dark:text-gray-400">
                      امکان تغییر فاز به جلو و عقب وجود دارد
                    </span>
                  )}
                </div>
              </div>

              {/* Dates + Manual Progress Section */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-5 border-t border-sec/10 dark:border-gray-800">
                {/* Dates column */}
                <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Start Date */}
                  <div className="space-y-1.5">
                    <span className="block text-xs font-bold text-sec/75 dark:text-gray-300">
                      تاریخ شروع
                    </span>
                    {canEdit ? (
                      currentSprint.startDate ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <PersianDatePicker
                            size="sm"
                            value={currentSprint.startDate}
                            onChange={(d) => handleDateChange('startDate', d)}
                            allowStep={false}
                          />
                          <button
                            type="button"
                            onClick={() => handleDateChange('startDate', null)}
                            className="h-9 w-9 rounded-xl border border-sec/20 dark:border-gray-700 flex items-center justify-center text-sec/60 hover:text-[#C60036] hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                            title="پاک کردن تاریخ شروع"
                            aria-label="پاک کردن تاریخ شروع"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleDateChange('startDate', todayIso)}
                          className="gap-1.5 text-xs"
                        >
                          <Calendar className="w-3.5 h-3.5 text-primary" />
                          <span>تنظیم تاریخ شروع</span>
                        </Button>
                      )
                    ) : (
                      <div className="p-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#182030] border border-sec/15 dark:border-gray-700 text-xs font-black text-sec dark:text-white tabular-nums">
                        {currentSprint.startDate
                          ? formatToJalali(currentSprint.startDate)
                          : 'تعیین نشده'}
                      </div>
                    )}
                  </div>

                  {/* End Date */}
                  <div className="space-y-1.5">
                    <span className="block text-xs font-bold text-sec/75 dark:text-gray-300">
                      تاریخ پایان
                    </span>
                    {canEdit ? (
                      currentSprint.endDate ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <PersianDatePicker
                            size="sm"
                            value={currentSprint.endDate}
                            onChange={(d) => handleDateChange('endDate', d)}
                            allowStep={false}
                          />
                          <button
                            type="button"
                            onClick={() => handleDateChange('endDate', null)}
                            className="h-9 w-9 rounded-xl border border-sec/20 dark:border-gray-700 flex items-center justify-center text-sec/60 hover:text-[#C60036] hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                            title="پاک کردن تاریخ پایان"
                            aria-label="پاک کردن تاریخ پایان"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleDateChange('endDate', todayIso)}
                          className="gap-1.5 text-xs"
                        >
                          <Calendar className="w-3.5 h-3.5 text-primary" />
                          <span>تنظیم تاریخ پایان</span>
                        </Button>
                      )
                    ) : (
                      <div className="p-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#182030] border border-sec/15 dark:border-gray-700 text-xs font-black text-sec dark:text-white tabular-nums">
                        {currentSprint.endDate
                          ? formatToJalali(currentSprint.endDate)
                          : 'تعیین نشده'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Manual Progress column */}
                <div className="lg:col-span-7 p-4 rounded-2xl bg-[#F8FAFC] dark:bg-[#182030] border-[1.5px] border-sec/15 dark:border-gray-700 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-sec dark:text-white">
                      وضعیت پیشرفت اسپرینت (دستی)
                    </span>
                    <span className="text-sm font-black text-sec dark:text-primary tabular-nums">
                      {toPersianDigits(draftProgress)}٪
                    </span>
                  </div>

                  <ProgressBar
                    value={draftProgress}
                    max={100}
                    size="md"
                    barClassName={colorMeta.barText}
                    aria-label="پیشرفت اسپرینت"
                  />

                  {canEdit && (
                    <div className="space-y-2.5 pt-1">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={draftProgress}
                          onChange={(e) => setDraftProgress(Number(e.target.value))}
                          aria-label="اسلایدر درصد پیشرفت"
                          className="flex-1 accent-[#59BBAF] cursor-pointer"
                        />
                        <div className="flex items-center gap-2 shrink-0">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={String(draftProgress)}
                            onChange={(e) => {
                              const raw = Number(e.target.value);
                              setDraftProgress(
                                Number.isNaN(raw) ? 0 : Math.max(0, Math.min(100, Math.round(raw)))
                              );
                            }}
                            containerClassName="w-20"
                            className="h-9 text-center font-black tabular-nums"
                            aria-label="مقدار عددی پیشرفت"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            isLoading={updateSprintMut.isPending}
                            disabled={
                              draftProgress === currentSprint.progressPercent ||
                              updateSprintMut.isPending
                            }
                            onClick={handleSaveProgress}
                          >
                            <Check className="w-3.5 h-3.5 me-1" />
                            ذخیره پیشرفت
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {QUICK_PROGRESS_VALUES.map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setDraftProgress(val)}
                            className={cn(
                              'px-2.5 py-1 rounded-lg text-[11px] font-black border tabular-nums cursor-pointer',
                              draftProgress === val
                                ? 'bg-primary text-sec border-sec shadow-[1.5px_1.5px_0_#202A5A]'
                                : 'bg-white dark:bg-[#121824] text-sec/75 dark:text-gray-300 border-sec/15'
                            )}
                          >
                            {toPersianDigits(val)}٪
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* 3. All Sprints Overview Strip */}
          {sprints.length > 1 && (
            <div className="space-y-3">
              <h3 className="text-sm font-black text-sec dark:text-white">
                نمای کلی همه اسپرینت‌ها ({toPersianDigits(sprints.length)})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {sprints.map((s) => {
                  const isSelected = s.id === currentSprint?.id;
                  const phase = getSprintPhaseMeta(s.status);
                  return (
                    <Card
                      key={s.id}
                      hoverable
                      onClick={() => setSelectedSprintId(s.id)}
                      className={cn(
                        'p-4 rounded-2xl border-[1.5px] cursor-pointer space-y-3',
                        isSelected
                          ? 'border-sec dark:border-primary shadow-hard'
                          : 'border-sec/20 dark:border-gray-700'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-primary/20 text-sec dark:text-primary shrink-0">
                            S{toPersianDigits(s.number)}
                          </span>
                          <span className="text-xs font-black text-sec dark:text-white truncate">
                            {s.title}
                          </span>
                        </div>
                        <Badge dot variant={phase.variant}>
                          {phase.label}
                        </Badge>
                      </div>

                      <ProgressBar
                        value={s.progressPercent ?? 0}
                        max={100}
                        size="sm"
                        showLabel
                        barClassName={colorMeta.barText}
                      />

                      <div className="flex items-center justify-between text-[11px] font-bold text-sec/60 dark:text-gray-400 tabular-nums">
                        <span>
                          شروع: {s.startDate ? formatToJalali(s.startDate) : '—'}
                        </span>
                        <span>
                          پایان: {s.endDate ? formatToJalali(s.endDate) : '—'}
                        </span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Sprint Modal */}
      {canEdit && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => !createSprintMut.isPending && setIsCreateModalOpen(false)}
          title="ایجاد اسپرینت جدید"
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <Input
              label="عنوان اسپرینت (اختیاری)"
              placeholder="در صورت خالی بودن به صورت خودکار نام‌گذاری می‌شود"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-sec/80 dark:text-gray-300">
                توضیحات (اختیاری)
              </label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                rows={2}
                placeholder="اهداف و محورهای اصلی این اسپرینت..."
                className="w-full px-3.5 py-2.5 rounded-xl border-[1.5px] border-sec/25 dark:border-gray-700 bg-white dark:bg-[#182030] text-xs font-medium text-sec dark:text-white focus:outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-sec dark:text-gray-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useNewStartDate}
                    onChange={(e) => setUseNewStartDate(e.target.checked)}
                    className="rounded border-sec/40 accent-[#59BBAF]"
                  />
                  <span>ثبت تاریخ شروع</span>
                </label>
                {useNewStartDate && (
                  <PersianDatePicker
                    size="sm"
                    value={newStartDate}
                    onChange={setNewStartDate}
                    allowStep={false}
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-sec dark:text-gray-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useNewEndDate}
                    onChange={(e) => setUseNewEndDate(e.target.checked)}
                    className="rounded border-sec/40 accent-[#59BBAF]"
                  />
                  <span>ثبت تاریخ پایان</span>
                </label>
                {useNewEndDate && (
                  <PersianDatePicker
                    size="sm"
                    value={newEndDate}
                    onChange={setNewEndDate}
                    allowStep={false}
                  />
                )}
              </div>
            </div>

            <Input
              label="درصد پیشرفت اولیه (۰ تا ۱۰۰)"
              type="number"
              min={0}
              max={100}
              value={String(newProgress)}
              onChange={(e) => setNewProgress(Number(e.target.value))}
            />

            <div className="flex items-center gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={createSprintMut.isPending}
              >
                انصراف
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="flex-[2] font-extrabold shadow-hard"
                isLoading={createSprintMut.isPending}
                disabled={createSprintMut.isPending}
              >
                ایجاد اسپرینت
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Sprint Confirmation */}
      <ConfirmDialog
        isOpen={deleteSprintConfirmOpen}
        title="حذف اسپرینت"
        message={`آیا از حذف اسپرینت «${currentSprint?.title || ''}» اطمینان دارید؟`}
        variant="danger"
        isLoading={deleteSprintMut.isPending}
        onConfirm={async () => {
          if (!currentSprint) return;
          try {
            await deleteSprintMut.mutateAsync(currentSprint.id);
            setDeleteSprintConfirmOpen(false);
            setSelectedSprintId(null);
          } catch {
            // Toast handled by hook
          }
        }}
        onCancel={() => setDeleteSprintConfirmOpen(false)}
      />
    </div>
  );
};
