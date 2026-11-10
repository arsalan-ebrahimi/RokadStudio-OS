import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar as CalendarIcon,
  Clock,
  FolderKanban,
  Info,
  ListChecks,
  RotateCcw,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  PersianDatePicker,
  SegmentedControl,
  Select,
  Skeleton,
} from '@/shared/ui';
import { useAuthStore } from '@/features/auth';
import { SessionBadge } from '@/features/timer/components/SessionBadge';
import { useSprints } from '@/features/scrum/hooks/use-scrum';
import { SCRUM_COLOR_MAP } from '@/features/scrum/types/scrum-types';
import { fetchAllProjects, fetchMyProjects } from '@/features/projects/api/projects-api';
import {
  addJalaliMonths,
  formatToJalali,
  getJalaliMonthCalendarInfo,
  getJalaliMonthRange,
  getJalaliWeekRange,
  getTehranTodayString,
  isoToJalali,
} from '@/shared/lib/date';
import { formatDurationToHoursMins, toPersianDigits } from '@/shared/lib/formatters';
import { cn } from '@/shared/lib/utils';
import type { ApprovalStatus } from '@/shared/types/models';
import {
  useMemberCalendar,
  useMemberDay,
  useMemberProfile,
  useMemberWork,
  useUpdateScrumPerformance,
  useUpdateStudioPerformance,
} from '../hooks/use-members';
import type { MemberIdParam } from '../types';
import { ActivityCalendar } from './ActivityCalendar';
import { AttendanceTotalsPills } from './AttendanceTotalsPills';
import { MemberDayPanel } from './MemberDayPanel';
import { PerformanceEditorCard } from './PerformanceEditorCard';

export interface MemberDetailDrawerProps {
  userId: MemberIdParam | null;
  scrumId?: number;
  initialTab?: 'attendance' | 'work';
  onClose: () => void;
}

type DrawerTab = 'attendance' | 'work';
type WorkDatePreset = 'WEEK' | 'MONTH' | null;
type ApprovalFilter = 'ALL' | ApprovalStatus;

const DRAWER_TABS: { value: DrawerTab; label: string }[] = [
  { value: 'attendance', label: 'حضور و تقویم' },
  { value: 'work', label: 'کارکرد' },
];

export const MemberDetailDrawer: React.FC<MemberDetailDrawerProps> = ({
  userId,
  scrumId,
  initialTab = 'attendance',
  onClose,
}) => {
  const currentUser = useAuthStore((s) => s.user);
  const isOpen = userId !== null;
  const todayIso = getTehranTodayString();
  const initialJalali = useMemo(() => isoToJalali(todayIso), [todayIso]);

  const [activeTab, setActiveTab] = useState<DrawerTab>(initialTab);
  const [calendarMonth, setCalendarMonth] = useState<{ jy: number; jm: number }>({
    jy: initialJalali.jy,
    jm: initialJalali.jm,
  });
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);

  // Work tab filters
  const [workFrom, setWorkFrom] = useState('');
  const [workTo, setWorkTo] = useState('');
  const [workDatePreset, setWorkDatePreset] = useState<WorkDatePreset>(null);
  const [filterScrumId, setFilterScrumId] = useState<number | undefined>(scrumId);
  const [filterSprintId, setFilterSprintId] = useState<number | undefined>(undefined);
  const [filterProjectId, setFilterProjectId] = useState<number | undefined>(undefined);
  const [filterApproval, setFilterApproval] = useState<ApprovalFilter>('ALL');
  const [workPage, setWorkPage] = useState(1);

  // Reset local drawer state when opened for a different target/context
  useEffect(() => {
    if (!isOpen) return;
    const jNow = isoToJalali(todayIso);
    setActiveTab(initialTab);
    setCalendarMonth({ jy: jNow.jy, jm: jNow.jm });
    setSelectedDate(todayIso);
    setWorkFrom('');
    setWorkTo('');
    setWorkDatePreset(null);
    setFilterScrumId(scrumId);
    setFilterSprintId(undefined);
    setFilterProjectId(undefined);
    setFilterApproval('ALL');
    setWorkPage(1);
  }, [isOpen, userId, scrumId, initialTab, todayIso]);

  // Body scroll lock & Escape handler (yields to inner Modals/ConfirmDialogs at z-50)
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const openDialogsCount = document.querySelectorAll('[role="dialog"]').length;
        if (openDialogsCount <= 1) {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const {
    data: profile,
    isLoading: isProfileLoading,
    isError: isProfileError,
    error: profileError,
    refetch: refetchProfile,
  } = useMemberProfile(userId, { scrumId, enabled: isOpen });

  const isSelf =
    userId === 'me' ||
    (profile !== undefined && currentUser !== null && profile.id === currentUser.id);
  const hasStudioPerformanceField = Boolean(profile && 'studioPerformance' in profile);
  const canViewProjects = !scrumId && (hasStudioPerformanceField || isSelf);
  const editableScrumMemberships = useMemo(
    () => (profile && !isSelf ? profile.memberships.filter((m) => 'performance' in m) : []),
    [profile, isSelf]
  );

  // Studio projects dropdown options (strictly only loaded if server confirms permission)
  const { data: projectOptions = [] } = useQuery({
    queryKey: [
      'member-drawer-projects',
      hasStudioPerformanceField ? 'all' : 'mine',
      profile?.id ?? null,
    ],
    queryFn: async () => {
      if (hasStudioPerformanceField) {
        const res = await fetchAllProjects({ limit: 100 });
        return res.data.map((p) => ({ id: p.id, name: p.name }));
      }
      const mine = await fetchMyProjects({ includeInactive: true });
      return mine.map((p) => ({ id: p.id, name: p.name }));
    },
    enabled: isOpen && activeTab === 'work' && canViewProjects && Boolean(profile),
    staleTime: 60_000,
  });

  const effectiveScrumId = scrumId ?? filterScrumId;
  const { data: sprintOptions = [] } = useSprints(effectiveScrumId ?? 0);

  const studioPerfMut = useUpdateStudioPerformance();
  const scrumPerfMut = useUpdateScrumPerformance();

  const calendarInfo = useMemo(
    () => getJalaliMonthCalendarInfo(calendarMonth.jy, calendarMonth.jm),
    [calendarMonth.jy, calendarMonth.jm]
  );

  const {
    data: calendarData,
    isLoading: isCalendarLoading,
    isError: isCalendarError,
    error: calendarError,
    refetch: refetchCalendar,
  } = useMemberCalendar(
    userId,
    {
      from: calendarInfo.gridFromIso,
      to: calendarInfo.gridToIso,
      scrumId,
    },
    { enabled: isOpen && activeTab === 'attendance' }
  );

  const {
    data: dayData,
    isLoading: isDayLoading,
    isError: isDayError,
    error: dayError,
    refetch: refetchDay,
  } = useMemberDay(
    userId,
    {
      date: selectedDate,
      scrumId,
    },
    { enabled: isOpen && activeTab === 'attendance' && Boolean(selectedDate) }
  );

  const {
    data: workData,
    isLoading: isWorkLoading,
    isError: isWorkError,
    error: workError,
    refetch: refetchWork,
  } = useMemberWork(
    userId,
    {
      from: workFrom || undefined,
      to: workTo || undefined,
      scrumId: effectiveScrumId,
      sprintId: filterSprintId,
      projectId: filterProjectId,
      approval: filterApproval === 'ALL' ? undefined : filterApproval,
      page: workPage,
      limit: 20,
    },
    { enabled: isOpen && activeTab === 'work' }
  );

  const hasWorkFilters = Boolean(
    workFrom ||
      workTo ||
      (!scrumId && filterScrumId) ||
      filterSprintId ||
      filterProjectId ||
      filterApproval !== 'ALL'
  );

  const applyWorkPreset = (preset: 'WEEK' | 'MONTH') => {
    const range =
      preset === 'WEEK' ? getJalaliWeekRange(todayIso) : getJalaliMonthRange(todayIso);
    setWorkFrom(range.from);
    setWorkTo(range.to);
    setWorkDatePreset(preset);
    setWorkPage(1);
  };

  const clearWorkFilters = () => {
    setWorkFrom('');
    setWorkTo('');
    setWorkDatePreset(null);
    setFilterScrumId(scrumId);
    setFilterSprintId(undefined);
    setFilterProjectId(undefined);
    setFilterApproval('ALL');
    setWorkPage(1);
  };

  const handleJumpToday = () => {
    const jNow = isoToJalali(todayIso);
    setCalendarMonth({ jy: jNow.jy, jm: jNow.jm });
    setSelectedDate(todayIso);
  };

  if (!isOpen) return null;

  const lockedScrumMeta =
    scrumId && profile
      ? profile.memberships.find((m) => m.scrum.id === scrumId)?.scrum
      : undefined;

  const drawerContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={profile ? `جزئیات ${profile.name}` : 'جزئیات عضو'}
      className="fixed inset-0 z-[45] overflow-hidden"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Side Drawer Panel (Start edge in RTL) */}
      <div className="fixed inset-y-0 start-0 w-full sm:max-w-[640px] bg-white dark:bg-[#121824] border-e-[1.5px] border-sec dark:border-primary/40 shadow-hard-lg flex flex-col">
        {/* Sticky Drawer Header */}
        <div className="shrink-0 p-4 sm:px-6 sm:py-4 border-b border-sec/15 dark:border-gray-800 bg-white dark:bg-[#121824] flex items-start justify-between gap-3">
          {isProfileLoading ? (
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Skeleton className="w-12 h-12 rounded-2xl shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-40 rounded-lg" />
                <Skeleton className="h-4 w-56 rounded-lg" />
              </div>
            </div>
          ) : profile ? (
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="w-12 h-12 rounded-2xl bg-primary text-sec border-[1.5px] border-sec/30 shadow-hard-sm flex items-center justify-center font-black text-lg shrink-0">
                {profile.name.trim().slice(0, 1) || 'ک'}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-sec dark:text-white truncate">
                    {profile.name}
                  </h2>
                  {isSelf && <Badge variant="ecosystem">پروفایل شما</Badge>}
                </div>

                <AttendanceTotalsPills totals={profile.attendanceTotals} compact />

                {profile.memberships.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    {profile.memberships.map((m) => {
                      const cMeta = SCRUM_COLOR_MAP[m.scrum.color] || SCRUM_COLOR_MAP.ECOSYSTEM;
                      return (
                        <Badge
                          key={m.scrum.id}
                          variant={cMeta.badgeVariant}
                          className="text-[10px] py-0.5 px-2"
                        >
                          {m.scrum.name}
                          {m.label ? ` · ${m.label}` : ''}
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1">
              <h2 className="text-base font-black text-sec dark:text-white">جزئیات عضو</h2>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 -me-1 flex items-center justify-center rounded-xl text-sec/65 dark:text-gray-400 hover:text-sec dark:hover:text-white hover:bg-sec/[0.06] dark:hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            aria-label="بستن"
            title="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Drawer Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {isProfileError ? (
            <ErrorState
              title="خطا در دریافت اطلاعات عضو"
              message={
                profileError instanceof Error
                  ? profileError.message
                  : 'امکان بارگذاری پروفایل عضو وجود ندارد.'
              }
              onRetry={() => refetchProfile()}
            />
          ) : (
            <>
              {/* Two-Level Performance Section (driven strictly by fields present in profile, never for self) */}
              {profile &&
                !isSelf &&
                (hasStudioPerformanceField || editableScrumMemberships.length > 0) && (
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-black text-sec/75 dark:text-gray-300">
                      ارزیابی وضعیت عملکرد
                    </h3>

                    <div className="space-y-2.5">
                      {hasStudioPerformanceField && (
                        <PerformanceEditorCard
                          title="عملکرد در استودیو"
                          subtitle="ارزیابی کلان و استودیویی (فقط مدیران)"
                          badgeSlot={<Badge variant="male">سطح استودیو</Badge>}
                          level={profile.studioPerformance?.level ?? null}
                          note={profile.studioPerformance?.note ?? null}
                          updatedAt={profile.studioPerformance?.updatedAt ?? null}
                          canEdit
                          isSaving={studioPerfMut.isPending}
                          onSave={(payload) =>
                            studioPerfMut.mutateAsync({
                              userId: profile.id,
                              ...payload,
                            })
                          }
                        />
                      )}

                      {editableScrumMemberships.map((m) => {
                        const cMeta =
                          SCRUM_COLOR_MAP[m.scrum.color] || SCRUM_COLOR_MAP.ECOSYSTEM;
                        return (
                          <PerformanceEditorCard
                            key={m.scrum.id}
                            title={`عملکرد در اسکرام ${m.scrum.name}`}
                            subtitle={m.label || undefined}
                            badgeSlot={<Badge variant={cMeta.badgeVariant}>{m.scrum.name}</Badge>}
                            level={m.performance ?? null}
                            note={m.performanceNote ?? null}
                            updatedAt={m.performanceUpdatedAt ?? null}
                            canEdit
                            isSaving={scrumPerfMut.isPending}
                            onSave={(payload) =>
                              scrumPerfMut.mutateAsync({
                                scrumId: m.scrum.id,
                                userId: profile.id,
                                ...payload,
                              })
                            }
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* Tabs */}
              <div className="flex items-center justify-between gap-3 flex-wrap pt-1 border-t border-sec/10 dark:border-gray-800">
                <SegmentedControl<DrawerTab>
                  options={DRAWER_TABS}
                  value={activeTab}
                  onChange={setActiveTab}
                  size="sm"
                />

                {lockedScrumMeta && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-ink-normal/65 dark:text-gray-300">
                    <span>فیلتر اسکرام:</span>
                    <Badge
                      variant={
                        (SCRUM_COLOR_MAP[lockedScrumMeta.color] || SCRUM_COLOR_MAP.ECOSYSTEM)
                          .badgeVariant
                      }
                    >
                      {lockedScrumMeta.name}
                    </Badge>
                  </span>
                )}
              </div>

              {/* TAB 1: Attendance & Calendar */}
              {activeTab === 'attendance' && (
                <div className="space-y-4">
                  <ActivityCalendar
                    calendarInfo={calendarInfo}
                    days={calendarData?.days}
                    totals={calendarData?.totals}
                    todayIso={todayIso}
                    selectedDate={selectedDate}
                    onSelect={(iso) => setSelectedDate(iso)}
                    onPrevMonth={() =>
                      setCalendarMonth((prev) => addJalaliMonths(prev.jy, prev.jm, -1))
                    }
                    onNextMonth={() =>
                      setCalendarMonth((prev) => addJalaliMonths(prev.jy, prev.jm, 1))
                    }
                    onToday={handleJumpToday}
                    activePreset={selectedDate === todayIso ? 'TODAY' : null}
                    isLoading={isCalendarLoading}
                    isError={isCalendarError}
                    error={calendarError}
                    onRetry={() => refetchCalendar()}
                  />

                  <MemberDayPanel
                    date={selectedDate}
                    dayData={dayData}
                    isLoading={isDayLoading}
                    isError={isDayError}
                    error={dayError}
                    onRetry={() => refetchDay()}
                    canViewProjects={canViewProjects}
                  />
                </div>
              )}

              {/* TAB 2: Work Breakdown & Sessions */}
              {activeTab === 'work' && (
                <div className="space-y-4">
                  {/* Scope notice when SCRUM_ADMIN inspects a member without studio permissions */}
                  {!isSelf && !scrumId && profile && !hasStudioPerformanceField && (
                    <div className="p-3 rounded-2xl bg-male-light/60 dark:bg-male-darker/35 border border-male-normal/30 text-xs font-bold text-male-normal dark:text-blue-200 flex items-center gap-2">
                      <Info className="w-4 h-4 shrink-0" />
                      <span>نمایش کارکرد فقط در اسکرام‌های تحت مدیریت شماست.</span>
                    </div>
                  )}

                  {/* Filters Bar (no overflow-hidden so PersianDatePicker popover never clips) */}
                  <div className="p-3.5 rounded-2xl border-[1.5px] border-sec/15 dark:border-gray-700 bg-gray-50/75 dark:bg-[#151C28] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => applyWorkPreset('WEEK')}
                          className={cn(
                            'min-h-[34px] px-2.5 rounded-xl border text-[11px] font-black transition-all cursor-pointer',
                            workDatePreset === 'WEEK'
                              ? 'bg-primary text-sec border-sec shadow-hard-sm'
                              : 'bg-white dark:bg-[#182030] border-sec/20 dark:border-gray-700 text-sec dark:text-gray-200 hover:border-primary'
                          )}
                        >
                          این هفته
                        </button>
                        <button
                          type="button"
                          onClick={() => applyWorkPreset('MONTH')}
                          className={cn(
                            'min-h-[34px] px-2.5 rounded-xl border text-[11px] font-black transition-all cursor-pointer',
                            workDatePreset === 'MONTH'
                              ? 'bg-primary text-sec border-sec shadow-hard-sm'
                              : 'bg-white dark:bg-[#182030] border-sec/20 dark:border-gray-700 text-sec dark:text-gray-200 hover:border-primary'
                          )}
                        >
                          این ماه
                        </button>
                      </div>

                      {hasWorkFilters && (
                        <button
                          type="button"
                          onClick={clearWorkFilters}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-sec/70 dark:text-gray-300 hover:text-sec dark:hover:text-white cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>پاک کردن فیلترها</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <PersianDatePicker
                        label="از تاریخ"
                        size="sm"
                        allowStep={false}
                        value={workFrom}
                        onChange={(nextFrom) => {
                          setWorkFrom(nextFrom);
                          if (workTo && nextFrom > workTo) setWorkTo(nextFrom);
                          setWorkDatePreset(null);
                          setWorkPage(1);
                        }}
                      />

                      <PersianDatePicker
                        label="تا تاریخ"
                        size="sm"
                        allowStep={false}
                        value={workTo}
                        onChange={(nextTo) => {
                          setWorkTo(nextTo);
                          if (workFrom && nextTo < workFrom) setWorkFrom(nextTo);
                          setWorkDatePreset(null);
                          setWorkPage(1);
                        }}
                      />

                      {!scrumId && profile && profile.memberships.length > 0 && (
                        <Select
                          label="اسکرام"
                          selectSize="sm"
                          value={filterScrumId || ''}
                          onChange={(e) => {
                            const val = e.target.value ? Number(e.target.value) : undefined;
                            setFilterScrumId(val);
                            setFilterSprintId(undefined);
                            if (val) setFilterProjectId(undefined);
                            setWorkPage(1);
                          }}
                        >
                          <option value="">همه اسکرام‌ها</option>
                          {profile.memberships.map((m) => (
                            <option key={m.scrum.id} value={m.scrum.id}>
                              {m.scrum.name}
                            </option>
                          ))}
                        </Select>
                      )}

                      {effectiveScrumId && sprintOptions.length > 0 && (
                        <Select
                          label="اسپرینت"
                          selectSize="sm"
                          value={filterSprintId || ''}
                          onChange={(e) => {
                            const val = e.target.value ? Number(e.target.value) : undefined;
                            setFilterSprintId(val);
                            if (val) setFilterProjectId(undefined);
                            setWorkPage(1);
                          }}
                        >
                          <option value="">همه اسپرینت‌ها</option>
                          {sprintOptions.map((sp) => (
                            <option key={sp.id} value={sp.id}>
                              S{toPersianDigits(sp.number)} · {sp.title}
                            </option>
                          ))}
                        </Select>
                      )}

                      {canViewProjects && !filterSprintId && projectOptions.length > 0 && (
                        <Select
                          label="پروژه استودیو"
                          selectSize="sm"
                          value={filterProjectId || ''}
                          onChange={(e) => {
                            const val = e.target.value ? Number(e.target.value) : undefined;
                            setFilterProjectId(val);
                            if (val) setFilterSprintId(undefined);
                            setWorkPage(1);
                          }}
                        >
                          <option value="">همه پروژه‌ها</option>
                          {projectOptions.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </Select>
                      )}

                      <Select
                        label="وضعیت تأیید"
                        selectSize="sm"
                        value={filterApproval}
                        onChange={(e) => {
                          setFilterApproval(e.target.value as ApprovalFilter);
                          setWorkPage(1);
                        }}
                      >
                        <option value="ALL">همه وضعیت‌ها</option>
                        <option value="APPROVED">تأییدشده</option>
                        <option value="PENDING">در انتظار تأیید</option>
                        <option value="REJECTED">ردشده</option>
                      </Select>
                    </div>
                  </div>

                  {isWorkLoading ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[1, 2, 3, 4].map((i) => (
                          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
                        ))}
                      </div>
                      <Skeleton className="h-28 w-full rounded-2xl" />
                      <Skeleton className="h-32 w-full rounded-2xl" />
                    </div>
                  ) : isWorkError ? (
                    <ErrorState
                      title="خطا در دریافت گزارش کارکرد"
                      message={
                        workError instanceof Error
                          ? workError.message
                          : 'دریافت آمار کارکرد عضو انجام نشد.'
                      }
                      onRetry={() => refetchWork()}
                    />
                  ) : workData ? (
                    <div className="space-y-4">
                      {/* Totals Strip */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 tabular-nums">
                        <div className="p-3 rounded-2xl border-[1.5px] border-sec/20 dark:border-primary/30 bg-ecosystem-light/65 dark:bg-ecosystem-darker/35 text-center space-y-0.5">
                          <span className="block text-[10px] font-bold text-sec/70 dark:text-gray-300">
                            مجموع کارکرد
                          </span>
                          <span className="block text-sm font-black text-sec dark:text-white">
                            {formatDurationToHoursMins(workData.totals.totalSeconds)}
                          </span>
                          <span className="block text-[10px] font-bold text-sec/60 dark:text-gray-400">
                            {toPersianDigits(workData.totals.sessionCount)} سشن
                          </span>
                        </div>

                        <div className="p-3 rounded-2xl border border-[#007A52]/25 bg-emerald-50/70 dark:bg-emerald-950/25 text-center space-y-0.5">
                          <span className="block text-[10px] font-bold text-[#007A52] dark:text-emerald-300">
                            تأییدشده
                          </span>
                          <span className="block text-sm font-black text-[#007A52] dark:text-emerald-200">
                            {formatDurationToHoursMins(workData.totals.approvedSeconds)}
                          </span>
                          <span className="block text-[10px] font-bold text-[#007A52]/75 dark:text-emerald-300/75">
                            {toPersianDigits(workData.totals.approvedCount)} سشن
                          </span>
                        </div>

                        <div className="p-3 rounded-2xl border border-college-normal/35 bg-college-light/60 dark:bg-amber-950/25 text-center space-y-0.5">
                          <span className="block text-[10px] font-bold text-[#704A0D] dark:text-amber-300">
                            در انتظار تأیید
                          </span>
                          <span className="block text-sm font-black text-[#704A0D] dark:text-amber-200">
                            {formatDurationToHoursMins(workData.totals.pendingSeconds)}
                          </span>
                          <span className="block text-[10px] font-bold text-[#704A0D]/75 dark:text-amber-300/75">
                            {toPersianDigits(workData.totals.pendingCount)} سشن
                          </span>
                        </div>

                        <div className="p-3 rounded-2xl border border-rose-300/50 dark:border-rose-800/50 bg-rose-50/70 dark:bg-rose-950/25 text-center space-y-0.5">
                          <span className="block text-[10px] font-bold text-[#C60036] dark:text-rose-300">
                            ردشده
                          </span>
                          <span className="block text-sm font-black text-[#C60036] dark:text-rose-200">
                            {formatDurationToHoursMins(workData.totals.rejectedSeconds)}
                          </span>
                          <span className="block text-[10px] font-bold text-[#C60036]/75 dark:text-rose-300/75">
                            {toPersianDigits(workData.totals.rejectedCount)} سشن
                          </span>
                        </div>
                      </div>

                      {/* Scrum Tasks Breakdown */}
                      {workData.tasks.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-black text-sec/80 dark:text-gray-200 flex items-center gap-1.5">
                            <ListChecks className="w-4 h-4 text-primary shrink-0" />
                            <span>تفکیک تسک‌های اسکرام ({toPersianDigits(workData.tasks.length)})</span>
                          </h4>
                          <div className="space-y-1.5">
                            {workData.tasks.map((t) => {
                              const cMeta =
                                SCRUM_COLOR_MAP[t.scrum.color] || SCRUM_COLOR_MAP.ECOSYSTEM;
                              return (
                                <div
                                  key={t.task.id}
                                  className="p-2.5 rounded-2xl border border-sec/15 dark:border-gray-700 bg-gray-50/70 dark:bg-[#182030] flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0 space-y-1">
                                    <p className="text-xs font-black text-sec dark:text-white truncate">
                                      {t.task.name}
                                    </p>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <Badge variant={cMeta.badgeVariant} className="text-[10px] py-0 px-2">
                                        {t.scrum.name}
                                      </Badge>
                                      {t.sprint && (
                                        <Badge variant="neutral" className="text-[10px] py-0 px-2 tabular-nums">
                                          S{toPersianDigits(t.sprint.number)}
                                        </Badge>
                                      )}
                                      <span className="text-[10px] font-bold text-ink-normal/60 dark:text-gray-400 tabular-nums">
                                        {toPersianDigits(t.points)} پوینت
                                      </span>
                                    </div>
                                  </div>

                                  <div className="text-end shrink-0 tabular-nums">
                                    <span className="block text-xs font-black text-sec dark:text-primary">
                                      {formatDurationToHoursMins(t.totalSeconds)}
                                    </span>
                                    <span className="block text-[10px] font-bold text-ink-normal/55 dark:text-gray-400">
                                      {toPersianDigits(t.sessionCount)} سشن
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Studio Projects Breakdown */}
                      {canViewProjects && workData.projects.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-black text-sec/80 dark:text-gray-200 flex items-center gap-1.5">
                            <FolderKanban className="w-4 h-4 text-primary shrink-0" />
                            <span>
                              پروژه‌های استودیو ({toPersianDigits(workData.projects.length)})
                            </span>
                          </h4>
                          <div className="space-y-1.5">
                            {workData.projects.map((p) => (
                              <div
                                key={p.project.id}
                                className="p-2.5 rounded-2xl border border-sec/15 dark:border-gray-700 bg-gray-50/70 dark:bg-[#182030] flex items-center justify-between gap-2"
                              >
                                <span className="text-xs font-black text-sec dark:text-white truncate">
                                  {p.project.name}
                                </span>
                                <div className="text-end shrink-0 tabular-nums">
                                  <span className="block text-xs font-black text-sec dark:text-primary">
                                    {formatDurationToHoursMins(p.totalSeconds)}
                                  </span>
                                  <span className="block text-[10px] font-bold text-ink-normal/55 dark:text-gray-400">
                                    {toPersianDigits(p.sessionCount)} سشن
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Paginated Sessions */}
                      <div className="space-y-2.5">
                        <h4 className="text-xs font-black text-sec/80 dark:text-gray-200 flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-primary shrink-0" />
                          <span>
                            فهرست سشن‌ها ({toPersianDigits(workData.sessions.meta.total)})
                          </span>
                        </h4>

                        {workData.sessions.items.length === 0 ? (
                          <EmptyState
                            className="p-6"
                            title="سشنی با این فیلترها یافت نشد"
                            description="فیلترهای تاریخ، اسکرام یا وضعیت را تغییر دهید."
                          />
                        ) : (
                          <>
                            <div className="space-y-1.5">
                              {workData.sessions.items.map((s) => {
                                const isTask = s.target.kind === 'TASK';
                                const cMeta =
                                  s.target.kind === 'TASK'
                                    ? SCRUM_COLOR_MAP[s.target.scrum.color] ||
                                      SCRUM_COLOR_MAP.ECOSYSTEM
                                    : null;
                                return (
                                  <div
                                    key={s.id}
                                    className="p-2.5 rounded-2xl border border-sec/15 dark:border-gray-700 bg-white dark:bg-[#182030] flex items-center justify-between gap-2"
                                  >
                                    <div className="min-w-0 space-y-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        {isTask ? (
                                          <ListChecks className="w-3.5 h-3.5 text-primary shrink-0" />
                                        ) : (
                                          <FolderKanban className="w-3.5 h-3.5 text-primary shrink-0" />
                                        )}
                                        <span className="text-xs font-black text-sec dark:text-white truncate">
                                          {s.target.name}
                                        </span>
                                        {s.target.kind === 'TASK' && cMeta && (
                                          <Badge variant={cMeta.badgeVariant} className="text-[10px] py-0 px-2">
                                            {s.target.scrum.name}
                                          </Badge>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-2 flex-wrap text-[10px] font-bold text-ink-normal/60 dark:text-gray-400 tabular-nums">
                                        <SessionBadge approval={s.approval} className="text-[10px] py-0 px-2" />
                                        <span className="inline-flex items-center gap-1">
                                          <CalendarIcon className="w-3 h-3" />
                                          {formatToJalali(s.workDate)}
                                        </span>
                                      </div>
                                    </div>

                                    <span className="text-xs font-black text-sec dark:text-primary shrink-0 tabular-nums">
                                      {formatDurationToHoursMins(s.durationSeconds)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>

                            {workData.sessions.meta.totalPages > 1 && (
                              <div className="flex items-center justify-between gap-2 pt-2">
                                <span className="text-xs font-bold text-ink-normal/65 dark:text-gray-400 tabular-nums">
                                  صفحه {toPersianDigits(workData.sessions.meta.page)} از{' '}
                                  {toPersianDigits(workData.sessions.meta.totalPages)}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={workPage <= 1}
                                    onClick={() => setWorkPage((p) => Math.max(1, p - 1))}
                                    className="gap-1"
                                  >
                                    <ChevronRight className="w-4 h-4" />
                                    <span>قبلی</span>
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={workPage >= workData.sessions.meta.totalPages}
                                    onClick={() => setWorkPage((p) => p + 1)}
                                    className="gap-1"
                                  >
                                    <span>بعدی</span>
                                    <ChevronLeft className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(drawerContent, document.body)
    : drawerContent;
};
