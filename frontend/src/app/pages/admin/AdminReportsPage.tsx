import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Download,
  Check,
  X,
  Trash2,
  Clock,
  FolderKanban,
  ArrowLeft,
  ListChecks,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  PersianDatePicker,
  SegmentedControl,
  Select,
  Skeleton,
  UnitChip,
  toast,
  type DataTableColumn,
} from '@/shared/ui';
import { fetchWorkSessionsSummary } from '@/features/reports/api/reports-api';
import { searchActiveUsers } from '@/features/users/api/users-api';
import { exportReportsToCsv } from '@/features/reports/lib/export-csv';
import {
  fetchAdminWorkSessions,
  fetchWorkSessionTargets,
  decideWorkSession,
  deleteWorkSession,
} from '@/features/timer/api/timer-api';
import { SCRUM_COLOR_MAP } from '@/features/scrum';
import { SessionBadge } from '@/features/timer/components/SessionBadge';
import { SessionDecisionDialog } from '@/features/timer/components/SessionDecisionDialog';
import { DeleteSessionDialog } from '@/features/timer/components/DeleteSessionDialog';
import { toPersianDigits, formatDurationToHoursMins, calculateCompletedRounds } from '@/shared/lib/formatters';
import { getTehranTodayString, getJalaliWeekRange, getJalaliMonthRange, formatToJalali } from '@/shared/lib/date';
import { cn } from '@/shared/lib/utils';
import type { WorkSession, WorkSessionSummaryRow } from '@/shared/types/models';

export const AdminReportsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const today = getTehranTodayString();
  const [activeTab, setActiveTab] = useState<'sessions' | 'summary'>('sessions');
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [targetType, setTargetType] = useState<'ALL' | 'PROJECT' | 'TASK'>('ALL');
  const [projectId, setProjectId] = useState<number | undefined>(undefined);
  const [taskId, setTaskId] = useState<number | undefined>(undefined);
  const [userId, setUserId] = useState<number | undefined>(undefined);
  const [groupBy, setGroupBy] = useState<'user' | 'project' | 'user_project'>('user_project');
  const [sessionStatusFilter, setSessionStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

  const [activeDecision, setActiveDecision] = useState<{ id: number; decision: 'APPROVED' | 'REJECTED'; info: string } | null>(null);
  const [deletingSession, setDeletingSession] = useState<{ id: number; info: string } | null>(null);

  // Unified projects + Scrum tasks targets list for filter
  const { data: targetsData } = useQuery({
    queryKey: ['work-session-targets'],
    queryFn: fetchWorkSessionTargets,
    staleTime: 30_000,
  });
  const targetProjects = targetsData?.projects || [];
  const targetTasks = targetsData?.tasks || [];

  // Users list for filter
  const { data: activeUsers = [] } = useQuery({
    queryKey: ['admin-users-active-list'],
    queryFn: () => searchActiveUsers(),
    staleTime: 30_000,
  });

  const effectiveTargetType = targetType === 'ALL' ? undefined : targetType;

  // Summary aggregation query (always loaded for instant KPI overview and fast tab switching)
  const { data: rows = [], isLoading: isSummaryLoading } = useQuery({
    queryKey: ['reports-summary', dateFrom, dateTo, groupBy, targetType, projectId, taskId, userId],
    queryFn: () =>
      fetchWorkSessionsSummary({
        dateFrom,
        dateTo,
        groupBy,
        targetType: effectiveTargetType,
        projectId,
        taskId,
        userId,
      }),
    staleTime: 30_000,
  });

  // Individual work sessions query
  const { data: sessionsRes, isLoading: isSessionsLoading } = useQuery({
    queryKey: ['admin-work-sessions', dateFrom, dateTo, targetType, projectId, taskId, userId, sessionStatusFilter],
    queryFn: () =>
      fetchAdminWorkSessions({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        targetType: effectiveTargetType,
        projectId: projectId || undefined,
        taskId: taskId || undefined,
        userId: userId || undefined,
        approval: sessionStatusFilter === 'ALL' ? undefined : sessionStatusFilter,
        limit: 100,
      }),
    staleTime: 30_000,
  });

  const sessions = sessionsRes?.data?.sessions || [];
  const sessionsTotalSeconds = sessionsRes?.data?.totalSeconds || 0;

  const decideMut = useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: 'APPROVED' | 'REJECTED' }) =>
      decideWorkSession(id, decision),
    onMutate: async ({ id, decision }) => {
      setActiveDecision(null);
      queryClient.setQueriesData({ queryKey: ['admin-work-sessions'] }, (old: any) => {
        if (!old?.data?.sessions) return old;
        return {
          ...old,
          data: {
            ...old.data,
            sessions: old.data.sessions.map((s: WorkSession) =>
              s.id === id ? { ...s, approval: decision } : s
            ),
          },
        };
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-work-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['reports-summary'] });
      queryClient.invalidateQueries({ queryKey: ['admin-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['work-target-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['scrum-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-scrum-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['scrum'] });
      queryClient.invalidateQueries({ queryKey: ['scrum-admin', 'dashboard'] });
      toast.success('وضعیت سشن با موفقیت تغییر کرد');
    },
    onError: (err: Error) => {
      queryClient.invalidateQueries({ queryKey: ['admin-work-sessions'] });
      toast.error(err.message || 'خطا در ثبت وضعیت سشن');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteWorkSession(id),
    onMutate: async (deletedId: number) => {
      setDeletingSession(null);
      // Immediately evict session from all admin-work-sessions caches
      queryClient.setQueriesData({ queryKey: ['admin-work-sessions'] }, (old: any) => {
        if (!old?.data?.sessions) return old;
        const remaining = old.data.sessions.filter((s: WorkSession) => s.id !== deletedId);
        const validRemaining = remaining.filter((s: WorkSession) => s.approval !== 'REJECTED');
        return {
          ...old,
          data: {
            ...old.data,
            totalSeconds: validRemaining.reduce((acc: number, s: WorkSession) => acc + s.durationSeconds, 0),
            sessions: remaining,
          },
        };
      });
    },
    onSuccess: () => {
      toast.success('سشن کاری با موفقیت حذف شد');
      queryClient.invalidateQueries({ queryKey: ['admin-work-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['reports-summary'] });
      queryClient.invalidateQueries({ queryKey: ['admin-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['work-target-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['scrum-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-scrum-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['scrum'] });
      queryClient.invalidateQueries({ queryKey: ['scrum-admin', 'dashboard'] });
    },
    onError: (err: Error) => {
      queryClient.invalidateQueries({ queryKey: ['admin-work-sessions'] });
      toast.error(err.message || 'خطا در حذف سشن کاری');
    },
  });

  const totalSeconds = rows.reduce((acc, r) => acc + r.totalSeconds, 0);
  const totalRounds = calculateCompletedRounds(totalSeconds || sessionsTotalSeconds);
  const activePersonnelCount = new Set(sessions.map((s: WorkSession) => s.user?.id).filter(Boolean)).size;

  const approvedSessionsCount = sessions.filter((s: WorkSession) => s.approval === 'APPROVED').length;
  const pendingSessionsCount = sessions.filter((s: WorkSession) => s.approval === 'PENDING').length;
  const rejectedSessionsCount = sessions.filter((s: WorkSession) => s.approval === 'REJECTED').length;

  const applyToday = () => {
    setDateFrom(today);
    setDateTo(today);
  };

  const applyThisWeek = () => {
    const { from, to } = getJalaliWeekRange(today);
    setDateFrom(from);
    setDateTo(to);
  };

  const applyThisMonth = () => {
    const { from, to } = getJalaliMonthRange(today);
    setDateFrom(from);
    setDateTo(to);
  };

  const weekRange = getJalaliWeekRange(today);
  const monthRange = getJalaliMonthRange(today);
  const isTodaySelected = dateFrom === today && dateTo === today;
  const isWeekSelected = !isTodaySelected && dateFrom === weekRange.from && dateTo === weekRange.to;
  const isMonthSelected = !isTodaySelected && !isWeekSelected && dateFrom === monthRange.from && dateTo === monthRange.to;

  const formatSummaryTargetName = (row: WorkSessionSummaryRow): string => {
    if (row.task) {
      return row.task.scrum ? `[${row.task.scrum.name}] ${row.task.name}` : row.task.name;
    }
    return row.project?.name || '';
  };

  const formatSummaryRowLabel = (row: WorkSessionSummaryRow): string => {
    const targetName = formatSummaryTargetName(row);
    if (row.user && targetName) return `${row.user.name} (${targetName})`;
    return row.user?.name || targetName || '—';
  };

  const summaryColumns: DataTableColumn<WorkSessionSummaryRow>[] = useMemo(
    () => [
      {
        id: 'label',
        header: 'نام',
        minWidth: '210px',
        isSticky: true,
        cell: (row) => {
          const label = formatSummaryRowLabel(row);
          return (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sec dark:text-white">{label}</span>
              {row.task && (
                <Badge variant="college" className="text-[10px]">
                  تسک اسکرام
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        id: 'rounds',
        header: 'تعداد دور',
        minWidth: '125px',
        align: 'center',
        cell: (row) => (
          <span className="inline-flex items-center justify-center gap-1.5 font-bold tabular-nums text-sec dark:text-white">
            <span>{toPersianDigits(calculateCompletedRounds(row.totalSeconds))}</span>
            <UnitChip unit="دور" />
          </span>
        ),
      },
      {
        id: 'totalSeconds',
        header: 'مجموع زمان',
        minWidth: '140px',
        align: 'center',
        cell: (row) => (
          <span className="font-black font-mono tabular-nums text-sec dark:text-primary text-xs sm:text-sm">
            {formatDurationToHoursMins(row.totalSeconds)}
          </span>
        ),
      },
    ],
    []
  );

  const inspectSummaryRow = (row: WorkSessionSummaryRow) => {
    if (row.task?.id) {
      setTargetType('TASK');
      setTaskId(row.task.id);
      setProjectId(undefined);
    } else if (row.project?.id) {
      setTargetType('PROJECT');
      setProjectId(row.project.id);
      setTaskId(undefined);
    }
    if (row.user?.id) setUserId(row.user.id);
    setActiveTab('sessions');
  };

  const selectedTargetValue = projectId
    ? `P:${projectId}`
    : taskId
      ? `T:${taskId}`
      : '';

  const handleTargetSelectionChange = (val: string) => {
    if (!val) {
      setProjectId(undefined);
      setTaskId(undefined);
      return;
    }
    if (val.startsWith('P:')) {
      setProjectId(Number(val.slice(2)));
      setTaskId(undefined);
    } else if (val.startsWith('T:')) {
      setTaskId(Number(val.slice(2)));
      setProjectId(undefined);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and View Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-lg font-black text-sec dark:text-white">گزارش و مدیریت سشن‌ها</h1>
          <SegmentedControl<'sessions' | 'summary'>
            aria-label="نمای گزارش"
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { value: 'sessions', label: `سشن‌های کاری (${toPersianDigits(sessions.length)})` },
              { value: 'summary', label: `گزارش تجمیعی (${toPersianDigits(rows.length)})` },
            ]}
          />
        </div>

        {activeTab === 'summary' && (
          <Button size="sm" variant="outline" onClick={() => exportReportsToCsv(rows)}>
            <Download className="w-3.5 h-3.5 me-1.5" />
            خروجی CSV
          </Button>
        )}
      </div>

      {/* Top Overview KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 sm:p-5 rounded-3xl text-center space-y-1">
          <span className="text-xs text-sec/65 dark:text-gray-400 font-bold">مجموع دورها</span>
          <p className="text-xl sm:text-2xl font-black text-sec dark:text-white tabular-nums">
            {toPersianDigits(totalRounds || sessions.length)}{' '}
            <span className="text-xs font-bold text-sec/55 dark:text-gray-400">دور</span>
          </p>
        </Card>
        <Card className="p-4 sm:p-5 rounded-3xl text-center space-y-1">
          <span className="text-xs text-sec/65 dark:text-gray-400 font-bold">مجموع زمان کار</span>
          <p className="text-lg sm:text-xl xl:text-2xl leading-snug font-black text-sec dark:text-primary tabular-nums">
            {formatDurationToHoursMins(totalSeconds || sessionsTotalSeconds)}
          </p>
        </Card>
        <Card className="p-4 sm:p-5 rounded-3xl text-center space-y-1">
          <span className="text-xs text-sec/65 dark:text-gray-400 font-bold">در انتظار تایید</span>
          <p
            className={cn(
              'text-xl sm:text-2xl font-black tabular-nums',
              pendingSessionsCount > 0 ? 'text-[#9C5700] dark:text-amber-400' : 'text-sec dark:text-white'
            )}
          >
            {toPersianDigits(pendingSessionsCount)}{' '}
            <span className="text-xs font-bold text-sec/55 dark:text-gray-400">سشن</span>
          </p>
        </Card>
        <Card className="p-4 sm:p-5 rounded-3xl text-center space-y-1">
          <span className="text-xs text-sec/65 dark:text-gray-400 font-bold">پرسنل فعال</span>
          <p className="text-xl sm:text-2xl font-black text-sec dark:text-white tabular-nums">
            {toPersianDigits(activePersonnelCount || (rows.length > 0 ? rows.length : 0))}{' '}
            <span className="text-xs font-bold text-sec/55 dark:text-gray-400">نفر</span>
          </p>
        </Card>
      </div>

      {/* Global Filter Bar */}
      <Card className="p-4 rounded-3xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Presets and Date Pickers */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 flex-wrap">
            {/* Preset Buttons */}
            <div className="h-11 flex items-center gap-1 bg-gray-50 dark:bg-[#182030] p-1 rounded-2xl border-[1.5px] border-sec/20 dark:border-gray-700 overflow-x-auto no-scrollbar w-full sm:w-auto shrink-0">
              <button
                type="button"
                onClick={applyToday}
                className={cn(
                  'h-full flex items-center justify-center flex-1 sm:flex-initial px-3 text-xs font-black rounded-xl transition-all whitespace-nowrap cursor-pointer',
                  isTodaySelected
                    ? 'bg-primary text-sec border border-sec/25 shadow-hard-sm'
                    : 'text-sec/70 dark:text-gray-300 hover:bg-sec/[0.05] dark:hover:bg-gray-800'
                )}
              >
                امروز
              </button>
              <button
                type="button"
                onClick={applyThisWeek}
                className={cn(
                  'h-full flex items-center justify-center flex-1 sm:flex-initial px-3 text-xs font-black rounded-xl transition-all whitespace-nowrap cursor-pointer',
                  isWeekSelected
                    ? 'bg-primary text-sec border border-sec/25 shadow-hard-sm'
                    : 'text-sec/70 dark:text-gray-300 hover:bg-sec/[0.05] dark:hover:bg-gray-800'
                )}
              >
                این هفته
              </button>
              <button
                type="button"
                onClick={applyThisMonth}
                className={cn(
                  'h-full flex items-center justify-center flex-1 sm:flex-initial px-3 text-xs font-black rounded-xl transition-all whitespace-nowrap cursor-pointer',
                  isMonthSelected
                    ? 'bg-primary text-sec border border-sec/25 shadow-hard-sm'
                    : 'text-sec/70 dark:text-gray-300 hover:bg-sec/[0.05] dark:hover:bg-gray-800'
                )}
              >
                این ماه
              </button>
            </div>

            <div className="h-6 w-px bg-sec/15 dark:bg-gray-700 hidden sm:block self-center" />

            {/* Date Pickers */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <PersianDatePicker
                value={dateFrom}
                onChange={setDateFrom}
                allowStep={false}
                containerClassName="flex-1 sm:flex-initial"
              />
              <span className="text-xs text-sec/55 dark:text-gray-400 font-bold shrink-0">تا</span>
              <PersianDatePicker
                value={dateTo}
                onChange={setDateTo}
                allowStep={false}
                containerClassName="flex-1 sm:flex-initial"
              />
            </div>
          </div>

          <div className="h-6 w-px bg-sec/15 dark:bg-gray-700 hidden lg:block self-center" />

          {/* Target Type, Project/Task & User Filters */}
          <div className="flex items-center gap-2.5 flex-col sm:flex-row flex-wrap w-full lg:w-auto">
            {/* Personnel Filter */}
            <div className="w-full sm:w-40">
              <Select
                aria-label="فیلتر پرسنل"
                value={userId ?? ''}
                onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : undefined)}
              >
                <option value="">همه پرسنل</option>
                {activeUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Target Type Filter */}
            <div className="w-full sm:w-40">
              <Select
                aria-label="فیلتر نوع"
                value={targetType}
                onChange={(e) => {
                  const nextType = e.target.value as 'ALL' | 'PROJECT' | 'TASK';
                  setTargetType(nextType);
                  setProjectId(undefined);
                  setTaskId(undefined);
                }}
              >
                <option value="ALL">همه انواع</option>
                <option value="PROJECT">پروژه‌های استودیو</option>
                <option value="TASK">تسک‌های اسکرام</option>
              </Select>
            </div>

            {/* Project / Task Filter */}
            <div className="w-full sm:w-52">
              <Select
                aria-label="فیلتر پروژه یا تسک"
                value={selectedTargetValue}
                onChange={(e) => handleTargetSelectionChange(e.target.value)}
              >
                <option value="">
                  {targetType === 'PROJECT'
                    ? 'همه پروژه‌ها'
                    : targetType === 'TASK'
                      ? 'همه تسک‌ها'
                      : 'همه پروژه‌ها و تسک‌ها'}
                </option>
                {targetType !== 'TASK' && targetProjects.length > 0 && (
                  targetType === 'ALL' ? (
                    <optgroup label="پروژه‌های استودیو">
                      {targetProjects.map((p) => (
                        <option key={`P:${p.id}`} value={`P:${p.id}`}>
                          {p.name}
                          {p.isActive ? '' : ' (تمام‌شده)'}
                        </option>
                      ))}
                    </optgroup>
                  ) : (
                    targetProjects.map((p) => (
                      <option key={`P:${p.id}`} value={`P:${p.id}`}>
                        {p.name}
                        {p.isActive ? '' : ' (تمام‌شده)'}
                      </option>
                    ))
                  )
                )}
                {targetType !== 'PROJECT' && targetTasks.length > 0 && (
                  targetType === 'ALL' ? (
                    <optgroup label="تسک‌های اسکرام">
                      {targetTasks.map((t) => (
                        <option key={`T:${t.id}`} value={`T:${t.id}`}>
                          [{t.scrumName}] {t.name}
                          {t.isActive ? '' : ' (غیرفعال)'}
                        </option>
                      ))}
                    </optgroup>
                  ) : (
                    targetTasks.map((t) => (
                      <option key={`T:${t.id}`} value={`T:${t.id}`}>
                        [{t.scrumName}] {t.name}
                        {t.isActive ? '' : ' (غیرفعال)'}
                      </option>
                    ))
                  )
                )}
              </Select>
            </div>

            {activeTab === 'summary' && (
              <div className="w-full sm:w-44">
                <Select
                  aria-label="نحوه تفکیک"
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as 'user' | 'project' | 'user_project')}
                >
                  <option value="user_project">کاربر و پروژه/تسک</option>
                  <option value="user">تفکیک کاربر</option>
                  <option value="project">تفکیک پروژه/تسک</option>
                </Select>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Tab 1: Individual Work Sessions Management (Approve, Reject, Delete) */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          {/* Status Breakdown Bar & Quick Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#151C28] p-3 sm:p-4 rounded-3xl border-[1.5px] border-sec/25 dark:border-primary/30 shadow-male dark:shadow-ecosystem">
            {/* Quick Status Pill Filters */}
            <div className="min-h-[44px] flex flex-wrap items-center gap-1 bg-gray-50 dark:bg-[#182030] p-1 rounded-2xl border border-sec/15 dark:border-gray-700 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setSessionStatusFilter('ALL')}
                className={cn(
                  'min-h-[36px] flex items-center justify-center px-3 py-1 text-xs font-black rounded-xl transition-all whitespace-nowrap cursor-pointer',
                  sessionStatusFilter === 'ALL'
                    ? 'bg-primary text-sec shadow-hard-sm border border-sec/25'
                    : 'text-sec/70 dark:text-gray-300 hover:bg-sec/[0.05] dark:hover:bg-gray-800'
                )}
              >
                همه ({toPersianDigits(sessions.length)})
              </button>
              <button
                type="button"
                onClick={() => setSessionStatusFilter('PENDING')}
                className={cn(
                  'min-h-[36px] flex items-center justify-center gap-1.5 px-3 py-1 text-xs font-black rounded-xl transition-all whitespace-nowrap cursor-pointer',
                  sessionStatusFilter === 'PENDING'
                    ? 'bg-college-normal text-sec shadow-hard-sm border border-sec/25'
                    : 'text-[#9C5700] dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                )}
              >
                {pendingSessionsCount > 0 && (
                  <span
                    className={cn(
                      'w-1.5 h-1.5 rounded-full animate-ping',
                      sessionStatusFilter === 'PENDING' ? 'bg-sec' : 'bg-amber-500'
                    )}
                  />
                )}
                در انتظار تایید ({toPersianDigits(pendingSessionsCount)})
              </button>
              <button
                type="button"
                onClick={() => setSessionStatusFilter('APPROVED')}
                className={cn(
                  'min-h-[36px] flex items-center justify-center px-3 py-1 text-xs font-black rounded-xl transition-all whitespace-nowrap cursor-pointer',
                  sessionStatusFilter === 'APPROVED'
                    ? 'bg-[#007A52] text-white shadow-hard-sm'
                    : 'text-[#007A52] dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                )}
              >
                تایید شده ({toPersianDigits(approvedSessionsCount)})
              </button>
              <button
                type="button"
                onClick={() => setSessionStatusFilter('REJECTED')}
                className={cn(
                  'min-h-[36px] flex items-center justify-center px-3 py-1 text-xs font-black rounded-xl transition-all whitespace-nowrap cursor-pointer',
                  sessionStatusFilter === 'REJECTED'
                    ? 'bg-[#C60036] text-white shadow-hard-sm'
                    : 'text-[#C60036] dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                )}
              >
                رد شده ({toPersianDigits(rejectedSessionsCount)})
              </button>
            </div>

            {/* Total Duration Label */}
            <div className="flex items-center gap-2 text-xs font-bold text-sec/70 dark:text-gray-300 self-end sm:self-center">
              <span>مجموع ساعات سشن‌های نمایش داده‌شده:</span>
              <span className="text-sec dark:text-primary font-black text-sm sm:text-base tabular-nums tracking-wide">
                {formatDurationToHoursMins(sessionsTotalSeconds)}
              </span>
            </div>
          </div>

          {/* Progress Visualizer */}
          {!isSessionsLoading && sessions.length > 0 && (
            <div className="w-full h-2 rounded-full bg-sec/10 dark:bg-gray-800 overflow-hidden flex">
              {approvedSessionsCount > 0 && (
                <div
                  style={{ width: `${(approvedSessionsCount / sessions.length) * 100}%` }}
                  className="h-full bg-[#009966] transition-all duration-500"
                  title={`تایید شده: ${approvedSessionsCount}`}
                />
              )}
              {pendingSessionsCount > 0 && (
                <div
                  style={{ width: `${(pendingSessionsCount / sessions.length) * 100}%` }}
                  className="h-full bg-[#F8A41D] transition-all duration-500"
                  title={`در انتظار: ${pendingSessionsCount}`}
                />
              )}
              {rejectedSessionsCount > 0 && (
                <div
                  style={{ width: `${(rejectedSessionsCount / sessions.length) * 100}%` }}
                  className="h-full bg-[#E0195B] transition-all duration-500"
                  title={`رد شده: ${rejectedSessionsCount}`}
                />
              )}
            </div>
          )}

          {/* Sessions List */}
          {isSessionsLoading ? (
            <div className="space-y-3">
              {Array(4)
                .fill(0)
                .map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-3xl" />
                ))}
            </div>
          ) : sessions.length === 0 ? (
            <EmptyState title="هیچ سشن کاری با مشخصات انتخابی یافت نشد" />
          ) : (
            <div className="space-y-3">
              {sessions.map((s: WorkSession) => {
                const userName = s.user?.name || 'کاربر';
                const isTask = s.targetType === 'TASK' && Boolean(s.task);
                const scrumMeta =
                  isTask && s.task?.scrum
                    ? SCRUM_COLOR_MAP[s.task.scrum.color] || SCRUM_COLOR_MAP.ECOSYSTEM
                    : null;
                const targetName =
                  isTask && s.task
                    ? s.task.scrum
                      ? `[${s.task.scrum.name}] ${s.task.name}`
                      : s.task.name
                    : s.project?.name || s.projectName || 'پروژه';
                const sessionDate = s.workDate || s.attendanceDate || s.createdAt;
                const sessionInfo = `${userName} - ${targetName} (${formatDurationToHoursMins(s.durationSeconds)})`;

                return (
                  <Card
                    key={s.id}
                    className="p-4 sm:p-5 rounded-3xl flex flex-col md:grid md:grid-cols-12 md:items-center gap-3.5 md:gap-4 transition-all"
                  >
                    {/* Right: User Avatar + Name + Project/Task Tag + Date & Status */}
                    <div className="md:col-span-6 flex items-center gap-3.5 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-[#ECF7F5] dark:bg-gray-800 text-sec dark:text-white flex items-center justify-center font-black text-sm shrink-0 border-[1.5px] border-sec/25 dark:border-gray-700 shadow-hard-sm">
                        {userName.slice(0, 1)}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm sm:text-base font-black text-sec dark:text-white truncate" title={userName}>
                            {userName}
                          </p>
                          {isTask && s.task ? (
                            <span className="inline-flex items-center gap-1.5 max-w-full flex-wrap">
                              {s.task.scrum && scrumMeta && (
                                <Badge variant={scrumMeta.badgeVariant} className="text-[10px]">
                                  {s.task.scrum.name}
                                </Badge>
                              )}
                              <span className="text-[11px] font-bold text-sec dark:text-gray-200 bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 rounded-full border border-sec/20 dark:border-gray-700 flex items-center gap-1.5 max-w-full">
                                <ListChecks className="w-3.5 h-3.5 text-primary shrink-0" />
                                <span className="truncate">{s.task.name}</span>
                              </span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-sec dark:text-ecosystem-light bg-ecosystem-light dark:bg-primary/15 px-2.5 py-0.5 rounded-full border border-primary/35 flex items-center gap-1.5 max-w-full">
                              <FolderKanban className="w-3.5 h-3.5 text-primary shrink-0" />
                              <span className="truncate">{targetName}</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap text-xs text-sec/65 dark:text-gray-400 font-medium">
                          <SessionBadge approval={s.approval} />
                          <span className="text-[10px] text-sec/30 dark:text-gray-600 font-bold">•</span>
                          <span>{formatToJalali(sessionDate)}</span>
                          {s.startedAt && (
                            <span className="text-[11px] tabular-nums font-bold opacity-85">
                              ({new Date(s.startedAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Left: Duration Chip + Actions (Approve / Reject / Delete) */}
                    <div className="flex items-center justify-between md:justify-end gap-3 sm:gap-4 pt-3 md:pt-0 border-t border-sec/10 dark:border-gray-800 md:border-0 md:col-span-6 flex-wrap">
                      {/* Duration Chip */}
                      <div className="inline-flex items-center gap-2 bg-ecosystem-light/85 dark:bg-ecosystem-darker/50 px-3.5 py-2 rounded-2xl border-[1.5px] border-primary/40 text-xs font-bold text-sec dark:text-gray-200 shrink-0">
                        <Clock className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-xs font-bold text-sec/70 dark:text-gray-400">مدت:</span>
                        <span className="text-sec dark:text-primary font-black text-xs sm:text-sm tracking-wide tabular-nums">
                          {formatDurationToHoursMins(s.durationSeconds)}
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {s.approval !== 'APPROVED' && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => setActiveDecision({ id: s.id, decision: 'APPROVED', info: sessionInfo })}
                            className="text-xs font-black"
                          >
                            <Check className="w-3.5 h-3.5 me-1" />
                            {s.approval === 'REJECTED' ? 'تغییر به تایید' : 'تایید'}
                          </Button>
                        )}
                        {s.approval !== 'REJECTED' && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => setActiveDecision({ id: s.id, decision: 'REJECTED', info: sessionInfo })}
                            className="text-xs font-bold"
                          >
                            <X className="w-3.5 h-3.5 me-1" />
                            {s.approval === 'APPROVED' ? 'تغییر به رد' : 'رد'}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[#C60036] dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-300 dark:border-rose-900/60 font-bold"
                          onClick={() => setDeletingSession({ id: s.id, info: sessionInfo })}
                          aria-label="حذف سشن"
                          title="حذف سشن کاری"
                        >
                          <Trash2 className="w-3.5 h-3.5 me-1" />
                          <span>حذف</span>
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Summary Report & Charts */}
      {activeTab === 'summary' && (
        <div className="space-y-6">
          {/* Distribution Bar */}
          {!isSummaryLoading && rows.length > 0 && totalSeconds > 0 && (
            <Card className="p-4 sm:p-5 rounded-3xl space-y-3">
              <div className="flex items-center justify-between text-xs font-bold flex-wrap gap-2">
                <span className="text-sec dark:text-white">توزیع زمان کار بر اساس تفکیک انتخابی</span>
                <span className="text-sec/65 dark:text-gray-400 font-black tabular-nums">
                  {formatDurationToHoursMins(totalSeconds)} کل
                </span>
              </div>

              <div className="w-full h-3 rounded-full bg-sec/10 dark:bg-gray-800 overflow-hidden flex gap-0.5">
                {rows.slice(0, 5).map((row, idx) => {
                  const pct = (row.totalSeconds / totalSeconds) * 100;
                  const colors = ['bg-primary', 'bg-girl', 'bg-third', 'bg-[#612B89]', 'bg-[#202A5A]'];
                  return (
                    <div
                      key={idx}
                      style={{ width: `${pct}%` }}
                      className={cn('h-full transition-all duration-500', colors[idx % colors.length])}
                      title={`${formatSummaryRowLabel(row)}: ${pct.toFixed(0)}%`}
                    />
                  );
                })}
              </div>

              <div className="flex items-center gap-4 flex-wrap text-[11px] font-bold">
                {rows.slice(0, 4).map((row, idx) => {
                  const label = formatSummaryRowLabel(row);
                  const dotColors = ['bg-primary', 'bg-girl', 'bg-third', 'bg-[#612B89]'];
                  const pct = Math.round((row.totalSeconds / totalSeconds) * 100);
                  return (
                    <div key={idx} className="flex items-center gap-1.5 text-sec/75 dark:text-gray-300">
                      <span className={cn('w-2 h-2 rounded-full', dotColors[idx % dotColors.length])} />
                      <span className="truncate max-w-[160px]">{label}</span>
                      <span className="text-sec/55 dark:text-gray-400 font-bold tabular-nums">({toPersianDigits(pct)}٪)</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <DataTable<WorkSessionSummaryRow>
            columns={summaryColumns}
            data={rows}
            getRowKey={(row, idx) =>
              `summary_${row.user?.id ?? 'u'}_${row.project?.id ?? (row.task?.id ? `t${row.task.id}` : 'p')}_${idx}`
            }
            showIndex={false}
            isLoading={isSummaryLoading}
            emptyTitle="داده‌ای در این بازه زمانی ثبت نشده است"
            tableClassName="executive-table"
            renderRowActions={(row) => (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => inspectSummaryRow(row)}
                className="text-xs font-bold gap-1.5"
                title="بررسی، تایید، رد یا حذف سشن‌ها"
              >
                <span>بررسی سشن‌ها</span>
                <ArrowLeft className="w-3.5 h-3.5 text-primary" />
              </Button>
            )}
            mobileActions={(row) => [
              {
                label: 'بررسی سشن‌ها',
                icon: <ArrowLeft className="w-3.5 h-3.5 text-primary" />,
                onClick: () => inspectSummaryRow(row),
              },
            ]}
          />
        </div>
      )}

      {/* Decision and Delete Confirmation Dialogs */}
      <SessionDecisionDialog
        isOpen={Boolean(activeDecision)}
        decision={activeDecision?.decision || null}
        targetInfo={activeDecision?.info || ''}
        isLoading={decideMut.isPending}
        onConfirm={() => activeDecision && decideMut.mutate(activeDecision)}
        onCancel={() => setActiveDecision(null)}
      />

      <DeleteSessionDialog
        isOpen={Boolean(deletingSession)}
        targetInfo={deletingSession?.info || ''}
        isLoading={deleteMut.isPending}
        onConfirm={() => deletingSession && deleteMut.mutate(deletingSession.id)}
        onCancel={() => setDeletingSession(null)}
      />
    </div>
  );
};

export default AdminReportsPage;
