import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Check, X, Trash2, Clock, FolderKanban, ArrowLeft } from 'lucide-react';
import { Card, Button, Skeleton, EmptyState, PersianDatePicker, Select, toast } from '@/shared/ui';
import { fetchWorkSessionsSummary } from '@/features/reports/api/reports-api';
import { fetchAllProjects } from '@/features/projects/api/projects-api';
import { searchActiveUsers } from '@/features/users/api/users-api';
import { exportReportsToCsv } from '@/features/reports/lib/export-csv';
import {
  fetchAdminWorkSessions,
  decideWorkSession,
  deleteWorkSession,
} from '@/features/timer/api/timer-api';
import { SessionBadge } from '@/features/timer/components/SessionBadge';
import { SessionDecisionDialog } from '@/features/timer/components/SessionDecisionDialog';
import { DeleteSessionDialog } from '@/features/timer/components/DeleteSessionDialog';
import { toPersianDigits, formatDurationToHoursMins } from '@/shared/lib/formatters';
import { getTehranTodayString, getJalaliWeekRange, getJalaliMonthRange, formatToJalali } from '@/shared/lib/date';
import { cn } from '@/shared/lib/utils';
import type { WorkSession } from '@/shared/types/models';

export const AdminReportsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const today = getTehranTodayString();
  const [activeTab, setActiveTab] = useState<'sessions' | 'summary'>('sessions');
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [projectId, setProjectId] = useState<number | undefined>(undefined);
  const [userId, setUserId] = useState<number | undefined>(undefined);
  const [groupBy, setGroupBy] = useState<'user' | 'project' | 'user_project'>('user_project');
  const [sessionStatusFilter, setSessionStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

  const [activeDecision, setActiveDecision] = useState<{ id: number; decision: 'APPROVED' | 'REJECTED'; info: string } | null>(null);
  const [deletingSession, setDeletingSession] = useState<{ id: number; info: string } | null>(null);

  // Projects list for filter
  const { data: projectsRes } = useQuery({
    queryKey: ['admin-projects-list'],
    queryFn: () => fetchAllProjects({ limit: 100, isActive: true }),
    staleTime: 30_000,
  });
  const projects = projectsRes?.data || [];

  // Users list for filter
  const { data: activeUsers = [] } = useQuery({
    queryKey: ['admin-users-active-list'],
    queryFn: () => searchActiveUsers(),
    staleTime: 30_000,
  });

  // Summary aggregation query (always loaded for instant KPI overview and fast tab switching)
  const { data: rows = [], isLoading: isSummaryLoading } = useQuery({
    queryKey: ['reports-summary', dateFrom, dateTo, groupBy, projectId],
    queryFn: () => fetchWorkSessionsSummary({ dateFrom, dateTo, groupBy, projectId }),
    staleTime: 30_000,
  });

  // Individual work sessions query
  const { data: sessionsRes, isLoading: isSessionsLoading } = useQuery({
    queryKey: ['admin-work-sessions', dateFrom, dateTo, projectId, userId, sessionStatusFilter],
    queryFn: () =>
      fetchAdminWorkSessions({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        projectId: projectId || undefined,
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
    },
    onError: (err: Error) => {
      queryClient.invalidateQueries({ queryKey: ['admin-work-sessions'] });
      toast.error(err.message || 'خطا در حذف سشن کاری');
    },
  });

  const totalSeconds = rows.reduce((acc, r) => acc + r.totalSeconds, 0);
  const totalRounds = rows.reduce((acc, r) => acc + r.sessionsCount, 0);
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

  return (
    <div className="space-y-6">
      {/* Header and View Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-lg font-black text-sec dark:text-white">گزارش و مدیریت سشن‌ها</h1>
          <div className="flex items-center bg-gray-100 dark:bg-[#182030] p-1 rounded-xl border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('sessions')}
              className={cn(
                'px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition-all flex items-center gap-1.5',
                activeTab === 'sessions'
                  ? 'bg-white dark:bg-[#121824] text-sec dark:text-white shadow-hard-sm border border-gray-200 dark:border-gray-700'
                  : 'text-ink-normal/60 dark:text-gray-400 hover:text-sec dark:hover:text-white'
              )}
            >
              <span>سشن‌های کاری ({toPersianDigits(sessions.length)})</span>
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={cn(
                'px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition-all',
                activeTab === 'summary'
                  ? 'bg-white dark:bg-[#121824] text-sec dark:text-white shadow-hard-sm border border-gray-200 dark:border-gray-700'
                  : 'text-ink-normal/60 dark:text-gray-400 hover:text-sec dark:hover:text-white'
              )}
            >
              گزارش تجمیعی ({toPersianDigits(rows.length)})
            </button>
          </div>
        </div>

        {activeTab === 'summary' && (
          <Button size="sm" variant="outline" onClick={() => exportReportsToCsv(rows)}>
            <Download className="w-3.5 h-3.5 me-1" />
            خروجی CSV
          </Button>
        )}
      </div>

      {/* Top Overview KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 text-center space-y-1">
          <span className="text-xs text-ink-normal/60 dark:text-gray-400 font-bold">مجموع دورها</span>
          <p className="text-xl sm:text-2xl font-black text-sec dark:text-white tabular-nums">
            {toPersianDigits(totalRounds || sessions.length)}{' '}
            <span className="text-xs font-bold text-ink-normal/50">دور</span>
          </p>
        </Card>
        <Card className="p-4 text-center space-y-1">
          <span className="text-xs text-ink-normal/60 dark:text-gray-400 font-bold">مجموع زمان کار</span>
          <p className="text-xl sm:text-2xl font-black text-primary tabular-nums">
            {formatDurationToHoursMins(totalSeconds || sessionsTotalSeconds)}
          </p>
        </Card>
        <Card className="p-4 text-center space-y-1">
          <span className="text-xs text-ink-normal/60 dark:text-gray-400 font-bold">در انتظار تایید</span>
          <p
            className={cn(
              'text-xl sm:text-2xl font-black tabular-nums',
              pendingSessionsCount > 0 ? 'text-amber-500' : 'text-sec dark:text-white'
            )}
          >
            {toPersianDigits(pendingSessionsCount)}{' '}
            <span className="text-xs font-bold text-ink-normal/50">سشن</span>
          </p>
        </Card>
        <Card className="p-4 text-center space-y-1">
          <span className="text-xs text-ink-normal/60 dark:text-gray-400 font-bold">پرسنل فعال</span>
          <p className="text-xl sm:text-2xl font-black text-sec dark:text-white tabular-nums">
            {toPersianDigits(activePersonnelCount || (rows.length > 0 ? rows.length : 0))}{' '}
            <span className="text-xs font-bold text-ink-normal/50">نفر</span>
          </p>
        </Card>
      </div>

      {/* Global Filter Bar */}
      <Card className="p-3.5 sm:p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Presets and Date Pickers */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 flex-wrap">
            {/* Preset Buttons */}
            <div className="h-[38px] flex items-center gap-1 bg-gray-50 dark:bg-[#182030] p-1 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto no-scrollbar w-full sm:w-auto shrink-0">
              <button
                onClick={applyToday}
                className={`h-full flex items-center justify-center flex-1 sm:flex-initial px-3 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                  dateFrom === today && dateTo === today
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-ink-normal/70 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                امروز
              </button>
              <button
                onClick={applyThisWeek}
                className="h-full flex items-center justify-center flex-1 sm:flex-initial px-3 text-xs font-bold rounded-lg text-ink-normal/70 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all whitespace-nowrap"
              >
                این هفته
              </button>
              <button
                onClick={applyThisMonth}
                className="h-full flex items-center justify-center flex-1 sm:flex-initial px-3 text-xs font-bold rounded-lg text-ink-normal/70 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all whitespace-nowrap"
              >
                این ماه
              </button>
            </div>

            <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block self-center" />

            {/* Date Pickers */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <PersianDatePicker
                value={dateFrom}
                onChange={setDateFrom}
                allowStep={false}
                containerClassName="flex-1 sm:flex-initial"
              />
              <span className="text-xs text-ink-normal/50 dark:text-gray-400 font-bold shrink-0">تا</span>
              <PersianDatePicker
                value={dateTo}
                onChange={setDateTo}
                allowStep={false}
                containerClassName="flex-1 sm:flex-initial"
              />
            </div>
          </div>

          <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 hidden lg:block self-center" />

          {/* Project & User Filters */}
          <div className="flex items-center gap-2.5 flex-col sm:flex-row w-full lg:w-auto">
            {/* Personnel Filter */}
            <div className="w-full sm:w-40">
              <Select
                selectSize="sm"
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

            {/* Project Filter */}
            <div className="w-full sm:w-40">
              <Select
                selectSize="sm"
                value={projectId ?? ''}
                onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : undefined)}
              >
                <option value="">همه پروژه‌ها</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>

            {activeTab === 'summary' && (
              <div className="w-full sm:w-40">
                <Select
                  selectSize="sm"
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as 'user' | 'project' | 'user_project')}
                >
                  <option value="user_project">کاربر و پروژه</option>
                  <option value="user">تفکیک کاربر</option>
                  <option value="project">تفکیک پروژه</option>
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#151C28] p-3 sm:p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
            {/* Quick Status Pill Filters */}
            <div className="h-[38px] flex items-center gap-1 bg-gray-50 dark:bg-[#182030] p-1 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto no-scrollbar max-w-full shrink-0">
              <button
                onClick={() => setSessionStatusFilter('ALL')}
                className={cn(
                  'h-full flex items-center px-3 text-xs font-bold rounded-lg transition-all whitespace-nowrap',
                  sessionStatusFilter === 'ALL'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-ink-normal/70 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                )}
              >
                همه ({toPersianDigits(sessions.length)})
              </button>
              <button
                onClick={() => setSessionStatusFilter('PENDING')}
                className={cn(
                  'h-full flex items-center gap-1.5 px-3 text-xs font-bold rounded-lg transition-all whitespace-nowrap',
                  sessionStatusFilter === 'PENDING'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                )}
              >
                {pendingSessionsCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />}
                در انتظار تایید ({toPersianDigits(pendingSessionsCount)})
              </button>
              <button
                onClick={() => setSessionStatusFilter('APPROVED')}
                className={cn(
                  'h-full flex items-center px-3 text-xs font-bold rounded-lg transition-all whitespace-nowrap',
                  sessionStatusFilter === 'APPROVED'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                )}
              >
                تایید شده ({toPersianDigits(approvedSessionsCount)})
              </button>
              <button
                onClick={() => setSessionStatusFilter('REJECTED')}
                className={cn(
                  'h-full flex items-center px-3 text-xs font-bold rounded-lg transition-all whitespace-nowrap',
                  sessionStatusFilter === 'REJECTED'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                )}
              >
                رد شده ({toPersianDigits(rejectedSessionsCount)})
              </button>
            </div>

            {/* Total Duration Label */}
            <div className="flex items-center gap-2 text-xs font-bold text-ink-normal/70 dark:text-gray-300 self-end sm:self-center">
              <span>مجموع ساعات سشن‌های نمایش داده‌شده:</span>
              <span className="text-primary font-black text-sm sm:text-base tabular-nums font-sans tracking-wide">
                {formatDurationToHoursMins(sessionsTotalSeconds)}
              </span>
            </div>
          </div>

          {/* Progress Visualizer */}
          {!isSessionsLoading && sessions.length > 0 && (
            <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden flex">
              {approvedSessionsCount > 0 && (
                <div
                  style={{ width: `${(approvedSessionsCount / sessions.length) * 100}%` }}
                  className="h-full bg-emerald-500 transition-all duration-500"
                  title={`تایید شده: ${approvedSessionsCount}`}
                />
              )}
              {pendingSessionsCount > 0 && (
                <div
                  style={{ width: `${(pendingSessionsCount / sessions.length) * 100}%` }}
                  className="h-full bg-amber-400 transition-all duration-500"
                  title={`در انتظار: ${pendingSessionsCount}`}
                />
              )}
              {rejectedSessionsCount > 0 && (
                <div
                  style={{ width: `${(rejectedSessionsCount / sessions.length) * 100}%` }}
                  className="h-full bg-rose-500 transition-all duration-500"
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
                  <Skeleton key={i} className="h-20 w-full rounded-2xl" />
                ))}
            </div>
          ) : sessions.length === 0 ? (
            <EmptyState title="هیچ سشن کاری با مشخصات انتخابی یافت نشد" />
          ) : (
            <div className="space-y-3">
              {sessions.map((s: WorkSession) => {
                const userName = s.user?.name || 'کاربر';
                const projectName = s.project?.name || s.projectName || 'پروژه';
                const sessionDate = s.workDate || s.attendanceDate || s.createdAt;
                const sessionInfo = `${userName} - ${projectName} (${formatDurationToHoursMins(s.durationSeconds)})`;

                return (
                  <Card
                    key={s.id}
                    className="p-4 sm:p-5 flex flex-col md:grid md:grid-cols-12 md:items-center gap-3.5 md:gap-4 transition-all hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md"
                  >
                    {/* Right: User Avatar + Name + Project Tag + Date & Status */}
                    <div className="md:col-span-6 flex items-center gap-3.5 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-gray-100 dark:bg-gray-800 text-sec dark:text-white flex items-center justify-center font-black text-sm shrink-0 border border-gray-200 dark:border-gray-700 shadow-sm">
                        {userName.slice(0, 1)}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm sm:text-base font-black text-sec dark:text-white truncate" title={userName}>
                            {userName}
                          </p>
                          <span className="text-[11px] font-bold text-primary bg-primary/10 dark:bg-primary/15 px-2.5 py-0.5 rounded-lg border border-primary/20 flex items-center gap-1.5">
                            <FolderKanban className="w-3.5 h-3.5 shrink-0" />
                            {projectName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap text-xs text-ink-normal/60 dark:text-gray-400 font-medium">
                          <SessionBadge approval={s.approval} />
                          <span className="text-[10px] text-ink-normal/30 dark:text-gray-600 font-bold">•</span>
                          <span>{formatToJalali(sessionDate)}</span>
                          {s.startedAt && (
                            <span className="font-sans text-[11px] tabular-nums font-bold opacity-80">
                              ({new Date(s.startedAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Left: Duration Chip + Actions (Approve / Reject / Delete) */}
                    <div className="flex items-center justify-between md:justify-end gap-3 sm:gap-4 pt-3 md:pt-0 border-t border-gray-100 dark:border-gray-800 md:border-0 md:col-span-6 flex-wrap">
                      {/* Duration Chip */}
                      <div className="inline-flex items-center gap-2 bg-ecosystem-light/80 dark:bg-ecosystem-darker/40 px-3.5 py-2 rounded-xl border border-primary/30 text-xs font-bold text-ink-normal/90 dark:text-gray-200 shadow-sm shrink-0">
                        <Clock className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-xs font-bold text-ink-normal/60 dark:text-gray-400">مدت:</span>
                        <span className="text-primary font-black text-xs sm:text-sm tracking-wide tabular-nums font-sans">
                          {formatDurationToHoursMins(s.durationSeconds)}
                        </span>
                      </div>

                      {/* Action Buttons: Spacious and distinct */}
                      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                        {s.approval !== 'APPROVED' && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => setActiveDecision({ id: s.id, decision: 'APPROVED', info: sessionInfo })}
                            className="h-9 px-3.5 text-xs font-bold shadow-sm"
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
                            className="h-9 px-3.5 text-xs font-bold shadow-sm"
                          >
                            <X className="w-3.5 h-3.5 me-1" />
                            {s.approval === 'APPROVED' ? 'تغییر به رد' : 'رد'}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 px-3 text-[#C60036] hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 shadow-sm font-bold"
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
            <Card className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold flex-wrap gap-2">
                <span className="text-sec dark:text-white">توزیع زمان کار بر اساس تفکیک انتخابی</span>
                <span className="text-ink-normal/60 dark:text-gray-400 font-sans font-black tabular-nums">
                  {formatDurationToHoursMins(totalSeconds)} کل
                </span>
              </div>

              <div className="w-full h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden flex gap-0.5">
                {rows.slice(0, 5).map((row, idx) => {
                  const pct = (row.totalSeconds / totalSeconds) * 100;
                  const colors = ['bg-primary', 'bg-girl', 'bg-third', 'bg-[#612B89]', 'bg-[#202A5A]'];
                  return (
                    <div
                      key={idx}
                      style={{ width: `${pct}%` }}
                      className={cn('h-full transition-all duration-500', colors[idx % colors.length])}
                      title={`${row.user?.name || row.project?.name || ''}: ${pct.toFixed(0)}%`}
                    />
                  );
                })}
              </div>

              <div className="flex items-center gap-4 flex-wrap text-[11px] font-bold">
                {rows.slice(0, 4).map((row, idx) => {
                  const label =
                    row.user && row.project
                      ? `${row.user.name} - ${row.project.name}`
                      : row.user?.name || row.project?.name || '—';
                  const dotColors = ['bg-primary', 'bg-girl', 'bg-third', 'bg-[#612B89]'];
                  const pct = Math.round((row.totalSeconds / totalSeconds) * 100);
                  return (
                    <div key={idx} className="flex items-center gap-1.5 text-ink-normal/70 dark:text-gray-300">
                      <span className={cn('w-2 h-2 rounded-full', dotColors[idx % dotColors.length])} />
                      <span className="truncate max-w-[140px]">{label}</span>
                      <span className="text-ink-normal/50 dark:text-gray-400 font-sans font-bold tabular-nums">({toPersianDigits(pct)}٪)</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {isSummaryLoading ? (
            <div className="space-y-3">
              {Array(3)
                .fill(0)
                .map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState title="داده‌ای در این بازه زمانی ثبت نشده است" />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs executive-table min-w-[440px]">
                  <thead className="bg-gray-50 dark:bg-[#182030] text-ink-normal/60 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="p-3.5 sm:p-4 font-bold md:w-5/12">نام</th>
                      <th className="p-3.5 sm:p-4 font-bold md:w-2/12">تعداد دور</th>
                      <th className="p-3.5 sm:p-4 font-bold md:w-3/12">مجموع زمان</th>
                      <th className="p-3.5 sm:p-4 font-bold md:w-2/12 text-left">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {rows.map((row, idx) => {
                      const label =
                        row.user && row.project
                          ? `${row.user.name} (${row.project.name})`
                          : row.user?.name || row.project?.name || '—';
                      return (
                        <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-[#151C28]/50 transition-colors">
                          <td className="p-3.5 sm:p-4 font-bold text-sec dark:text-white">{label}</td>
                          <td className="p-3.5 sm:p-4 font-bold tabular-nums font-sans text-sec dark:text-white">
                            {toPersianDigits(row.sessionsCount)} دور
                          </td>
                          <td className="p-3.5 sm:p-4 font-black font-sans tabular-nums text-primary text-xs sm:text-sm">
                            {formatDurationToHoursMins(row.totalSeconds)}
                          </td>
                          <td className="p-3.5 sm:p-4 text-left">
                            <button
                              type="button"
                              onClick={() => {
                                if (row.project?.id) setProjectId(row.project.id);
                                if (row.user?.id) setUserId(row.user.id);
                                setActiveTab('sessions');
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#182030] hover:bg-primary/10 hover:text-primary hover:border-primary/40 text-xs font-bold transition-all cursor-pointer"
                              title="بررسی، تایید، رد یا حذف سشن‌ها"
                            >
                              <span>بررسی سشن‌ها</span>
                              <ArrowLeft className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
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
