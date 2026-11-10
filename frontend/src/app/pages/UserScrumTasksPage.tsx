import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Hourglass,
  Layers,
  ListChecks,
  Search,
  Sparkles,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  PersianDatePicker,
  SegmentedControl,
  Select,
  Skeleton,
} from '@/shared/ui';
import { useAuthStore } from '@/features/auth';
import {
  useMyScrumTasks,
  type MyScrumTaskItem,
  type ScrumColor,
} from '@/features/scrum';
import { WorkTargetSessionsModal, type WorkTargetDatePreset } from '@/features/timer';
import { formatDurationToHoursMins, toPersianDigits } from '@/shared/lib/formatters';
import {
  formatToJalali,
  getJalaliMonthRange,
  getJalaliWeekRange,
  getTehranTodayString,
} from '@/shared/lib/date';
import { cn } from '@/shared/lib/utils';

type TaskStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

const DATE_PRESET_OPTIONS: { value: WorkTargetDatePreset; label: string }[] = [
  { value: 'ALL', label: 'همه تاریخ‌ها' },
  { value: 'TODAY', label: 'امروز' },
  { value: 'WEEK', label: 'این هفته' },
  { value: 'MONTH', label: 'این ماه' },
  { value: 'SINGLE', label: 'یک روز خاص' },
  { value: 'RANGE', label: 'بازه زمانی' },
];

const SCRUM_COLOR_BADGE_VARIANT: Record<
  ScrumColor,
  'ecosystem' | 'male' | 'female' | 'college' | 'club'
> = {
  ECOSYSTEM: 'ecosystem',
  MALE: 'male',
  FEMALE: 'female',
  COLLEGE: 'college',
  CLUB: 'club',
};

export const UserScrumTasksPage: React.FC = () => {
  const { user } = useAuthStore();
  const todayIso = useMemo(() => getTehranTodayString(), []);
  const weekRange = useMemo(() => getJalaliWeekRange(todayIso), [todayIso]);

  const [selectedScrumId, setSelectedScrumId] = useState<string>('');
  const [datePreset, setDatePreset] = useState<WorkTargetDatePreset>('ALL');
  const [singleDate, setSingleDate] = useState<string>(todayIso);
  const [rangeFrom, setRangeFrom] = useState<string>(weekRange.from);
  const [rangeTo, setRangeTo] = useState<string>(todayIso);
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('ALL');
  const [onlyWithTracked, setOnlyWithTracked] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewingTask, setViewingTask] = useState<MyScrumTaskItem | null>(null);

  const serverDateQuery = useMemo(() => {
    let date: string | undefined;
    let dateFrom: string | undefined;
    let dateTo: string | undefined;

    if (datePreset === 'TODAY') {
      date = todayIso;
    } else if (datePreset === 'WEEK') {
      const range = getJalaliWeekRange(todayIso);
      dateFrom = range.from;
      dateTo = range.to;
    } else if (datePreset === 'MONTH') {
      const range = getJalaliMonthRange(todayIso);
      dateFrom = range.from;
      dateTo = range.to;
    } else if (datePreset === 'SINGLE') {
      date = singleDate;
    } else if (datePreset === 'RANGE') {
      if (rangeFrom <= rangeTo) {
        dateFrom = rangeFrom;
        dateTo = rangeTo;
      } else {
        dateFrom = rangeTo;
        dateTo = rangeFrom;
      }
    }

    return {
      scrumId: selectedScrumId ? Number(selectedScrumId) : undefined,
      date,
      dateFrom,
      dateTo,
    };
  }, [selectedScrumId, datePreset, todayIso, singleDate, rangeFrom, rangeTo]);

  const activeRangeLabel = useMemo(() => {
    if (datePreset === 'ALL') return 'تمامی تاریخ‌ها';
    if (serverDateQuery.date) {
      return formatToJalali(serverDateQuery.date, true);
    }
    if (serverDateQuery.dateFrom && serverDateQuery.dateTo) {
      return `${formatToJalali(serverDateQuery.dateFrom)} تا ${formatToJalali(serverDateQuery.dateTo)}`;
    }
    return '';
  }, [datePreset, serverDateQuery]);

  const { data, isLoading, isFetching, isError, error, refetch } =
    useMyScrumTasks(serverDateQuery);

  const scrumOptions = data?.scrums || [];
  const allTasks = useMemo(() => data?.tasks || [], [data?.tasks]);

  const activeCount = useMemo(
    () => allTasks.filter((t) => t.isActive).length,
    [allTasks]
  );
  const inactiveCount = useMemo(
    () => allTasks.filter((t) => !t.isActive).length,
    [allTasks]
  );

  const filteredTasks = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return allTasks.filter((t) => {
      if (statusFilter === 'ACTIVE' && !t.isActive) return false;
      if (statusFilter === 'INACTIVE' && t.isActive) return false;
      if (onlyWithTracked && t.sessionCounts.total === 0) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        Boolean(t.description && t.description.toLowerCase().includes(q)) ||
        t.scrum.name.toLowerCase().includes(q) ||
        Boolean(t.sprint && t.sprint.title.toLowerCase().includes(q))
      );
    });
  }, [allTasks, statusFilter, onlyWithTracked, searchTerm]);

  const summaryStats = useMemo(() => {
    return filteredTasks.reduce(
      (acc, t) => {
        acc.totalTasks += 1;
        if (t.isActive) acc.activeTasks += 1;
        if (t.sessionCounts.total > 0) acc.workedTasksCount += 1;
        acc.totalPoints += Number(t.points || 0);
        acc.approvedSeconds += t.trackedSeconds.approved;
        acc.pendingSeconds += t.trackedSeconds.pending;
        acc.rejectedSeconds += t.trackedSeconds.rejected;
        acc.totalSeconds += t.trackedSeconds.total;
        acc.sessionCount += t.sessionCounts.total;
        return acc;
      },
      {
        totalTasks: 0,
        activeTasks: 0,
        workedTasksCount: 0,
        totalPoints: 0,
        approvedSeconds: 0,
        pendingSeconds: 0,
        rejectedSeconds: 0,
        totalSeconds: 0,
        sessionCount: 0,
      }
    );
  }, [filteredTasks]);

  const hasActiveFilters =
    Boolean(selectedScrumId) ||
    datePreset !== 'ALL' ||
    statusFilter !== 'ALL' ||
    onlyWithTracked ||
    searchTerm.trim() !== '';

  const resetAllFilters = () => {
    setSelectedScrumId('');
    setDatePreset('ALL');
    setSingleDate(todayIso);
    setRangeFrom(weekRange.from);
    setRangeTo(todayIso);
    setStatusFilter('ALL');
    setOnlyWithTracked(false);
    setSearchTerm('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sec/15 dark:border-gray-800">
        <div className="space-y-1.5">
          <Link
            to="/app"
            className="inline-flex items-center gap-1.5 min-h-[36px] px-2.5 -ms-2.5 rounded-xl text-xs font-bold text-ink-normal/75 dark:text-gray-300 hover:text-sec dark:hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>بازگشت به پیشخوان تایمر</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-ecosystem-light dark:bg-ecosystem-darker/60 border-[1.5px] border-sec/30 dark:border-primary/40 text-sec dark:text-primary flex items-center justify-center shadow-hard-sm shrink-0">
              <ListChecks className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-sec dark:text-white">
                تسک‌های اسکرام من
              </h1>
              {isFetching && !isLoading && (
                <span className="text-[11px] font-bold text-primary animate-pulse">
                  در حال بروزرسانی...
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-ink-normal/65 dark:text-gray-400 leading-relaxed">
            فهرست تسک‌های اسکرامی که به شما اختصاص داده شده‌اند؛ با فیلتر دقیق تاریخ و اسکرام، میزان کارکرد خود را بررسی کرده و با کلیک روی هر تسک، جزئیات سشن‌ها را ببینید.
          </p>
        </div>
      </div>

      {/* Filters Card */}
      <Card className="p-4 sm:p-5 rounded-3xl border-[1.5px] border-sec/20 dark:border-gray-700 space-y-4">
        {/* Row 1: Exact Date / Time Range Presets */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-xs font-black text-sec/75 dark:text-gray-300 me-1.5">
                <Calendar className="w-4 h-4 text-primary shrink-0" />
                بازه زمانی کارکرد:
              </span>
              {DATE_PRESET_OPTIONS.map((opt) => {
                const active = datePreset === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDatePreset(opt.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer',
                      active
                        ? 'bg-primary text-sec border-sec shadow-[1.5px_1.5px_0_#202A5A]'
                        : 'bg-[#F8FAFC] dark:bg-gray-800 text-sec/75 dark:text-gray-300 border-sec/15 dark:border-gray-700 hover:bg-primary/15'
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {activeRangeLabel && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#F8FAFC] dark:bg-[#182030] border border-sec/15 dark:border-gray-700 text-[11px] font-bold text-sec/75 dark:text-gray-300 tabular-nums">
                <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>{activeRangeLabel}</span>
              </span>
            )}
          </div>

          {datePreset === 'SINGLE' && (
            <div className="pt-1 flex flex-wrap items-end gap-3">
              <PersianDatePicker
                label="انتخاب تاریخ"
                size="sm"
                value={singleDate}
                onChange={setSingleDate}
              />
            </div>
          )}

          {datePreset === 'RANGE' && (
            <div className="pt-1 flex flex-wrap items-end gap-3">
              <PersianDatePicker
                label="از تاریخ"
                size="sm"
                value={rangeFrom}
                onChange={setRangeFrom}
              />
              <PersianDatePicker
                label="تا تاریخ"
                size="sm"
                value={rangeTo}
                onChange={setRangeTo}
              />
            </div>
          )}
        </div>

        {/* Row 2: Scrum filter + Search + Status + Worked-only toggle */}
        <div className="pt-3 border-t border-sec/10 dark:border-gray-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1">
            {/* Scrum Dropdown */}
            <div className="w-full sm:w-56 shrink-0">
              <Select
                selectSize="sm"
                value={selectedScrumId}
                onChange={(e) => setSelectedScrumId(e.target.value)}
                aria-label="فیلتر بر اساس اسکرام"
              >
                <option value="">همه اسکرام‌ها ({toPersianDigits(scrumOptions.length)})</option>
                {scrumOptions.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.name}
                    {!sc.isActive ? ' (بایگانی)' : ''}
                  </option>
                ))}
              </Select>
            </div>

            {/* Search Input */}
            <div className="relative flex items-center w-full sm:max-w-xs">
              <Search className="w-4 h-4 text-sec/45 dark:text-gray-400 absolute start-3 pointer-events-none" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="جستجوی عنوان تسک یا اسپرینت..."
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
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setOnlyWithTracked((prev) => !prev)}
              aria-pressed={onlyWithTracked}
              className={cn(
                'min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer inline-flex items-center gap-1.5',
                onlyWithTracked
                  ? 'bg-sec text-white dark:bg-primary dark:text-sec border-sec dark:border-primary shadow-hard-sm'
                  : 'bg-[#F8FAFC] dark:bg-gray-800 text-sec/75 dark:text-gray-300 border-sec/15 dark:border-gray-700 hover:border-primary'
              )}
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>فقط تسک‌های دارای کارکرد</span>
            </button>

            <SegmentedControl<TaskStatusFilter>
              size="sm"
              value={statusFilter}
              onChange={setStatusFilter}
              aria-label="فیلتر وضعیت تسک‌های من"
              className="overflow-x-auto no-scrollbar max-w-full shrink-0"
              options={[
                { value: 'ALL', label: `همه (${toPersianDigits(allTasks.length)})` },
                { value: 'ACTIVE', label: `فعال (${toPersianDigits(activeCount)})` },
                { value: 'INACTIVE', label: `غیرفعال (${toPersianDigits(inactiveCount)})` },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      {!isLoading && !isError && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <Card className="p-4 rounded-3xl border-[1.5px] border-sec/15 dark:border-gray-700 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-sec/65 dark:text-gray-400">
              <span>تعداد تسک‌ها</span>
              <ListChecks className="w-4 h-4 text-primary" />
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="text-xl sm:text-2xl font-black text-sec dark:text-white tabular-nums">
                {toPersianDigits(summaryStats.totalTasks)}
              </p>
              <span className="text-[11px] font-bold text-sec/60 dark:text-gray-400 tabular-nums">
                ({toPersianDigits(summaryStats.activeTasks)} فعال · {toPersianDigits(summaryStats.totalPoints)} پوینت)
              </span>
            </div>
          </Card>

          <Card className="p-4 rounded-3xl border-[1.5px] border-ecosystem-normal/45 bg-ecosystem-light/45 dark:bg-ecosystem-darker/30 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-sec/75 dark:text-ecosystem-light/85">
              <span>زمان تایید شده</span>
              <CheckCircle2 className="w-4 h-4 text-[#007A52] dark:text-emerald-300" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-sec dark:text-ecosystem-light tabular-nums">
              {formatDurationToHoursMins(summaryStats.approvedSeconds)}
            </p>
          </Card>

          <Card className="p-4 rounded-3xl border-[1.5px] border-college-normal/45 bg-college-light/45 dark:bg-college-darker/30 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-[#704A0D] dark:text-amber-200/85">
              <span>زمان در انتظار تایید</span>
              <Hourglass className="w-4 h-4 text-[#9C5700] dark:text-amber-300" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-[#704A0D] dark:text-amber-200 tabular-nums">
              {formatDurationToHoursMins(summaryStats.pendingSeconds)}
            </p>
          </Card>

          <Card className="p-4 rounded-3xl border-[1.5px] border-sec/20 dark:border-gray-700 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-sec/65 dark:text-gray-400">
              <span>کل کارکرد ثبت‌شده</span>
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="text-xl sm:text-2xl font-black text-sec dark:text-white tabular-nums">
                {formatDurationToHoursMins(summaryStats.totalSeconds)}
              </p>
              <span className="text-[11px] font-bold text-sec/60 dark:text-gray-400 tabular-nums">
                ({toPersianDigits(summaryStats.sessionCount)} سشن)
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* Task List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array(3)
            .fill(0)
            .map((_, i) => (
              <Skeleton key={i} className="h-56 w-full rounded-3xl" />
            ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="خطا در دریافت تسک‌های اسکرام من"
          message={
            error instanceof Error ? error.message : 'دریافت فهرست تسک‌ها با خطا مواجه شد.'
          }
          onRetry={() => refetch()}
        />
      ) : filteredTasks.length === 0 ? (
        <EmptyState
          title="تسکی یافت نشد"
          description={
            hasActiveFilters
              ? 'فیلتر اسکرام، بازه زمانی یا عبارت جستجو را تغییر دهید تا تسک‌های دیگر نمایش داده شوند.'
              : 'در حال حاضر هیچ تسک اسکرامی به شما اختصاص داده نشده است.'
          }
          action={
            hasActiveFilters ? (
              <Button type="button" variant="outline" size="sm" onClick={resetAllFilters}>
                پاک کردن فیلترها
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTasks.map((task) => {
            const scrumVariant =
              SCRUM_COLOR_BADGE_VARIANT[task.scrum.color] || 'ecosystem';
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
                className="p-5 rounded-3xl border-[1.5px] border-sec/20 dark:border-primary/25 flex flex-col justify-between space-y-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="space-y-3">
                  {/* Scrum + Sprint + Status badges */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <Badge variant={scrumVariant} dot className="max-w-full">
                        <span className="truncate flex items-center gap-1">
                          <Layers className="w-3 h-3 shrink-0" />
                          <span>{task.scrum.name}</span>
                        </span>
                      </Badge>
                      {task.sprint && (
                        <Badge variant="neutral" className="tabular-nums">
                          {`S${toPersianDigits(task.sprint.number)} · ${task.sprint.title}`}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="college" className="tabular-nums">
                        {toPersianDigits(task.points)} پوینت
                      </Badge>
                      <Badge variant={task.isActive ? 'ecosystem' : 'neutral'}>
                        {task.isActive ? 'فعال' : 'غیرفعال'}
                      </Badge>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div className="space-y-1.5">
                    <h3 className="text-sm sm:text-base font-black text-sec dark:text-white leading-snug break-words">
                      {task.name}
                    </h3>
                    <p className="text-xs text-ink-normal/65 dark:text-gray-400 line-clamp-2 min-h-[32px] leading-relaxed">
                      {task.description || 'بدون توضیحات'}
                    </p>
                  </div>

                  {/* Time Breakdown in Selected Filter Window */}
                  <div className="p-3 rounded-2xl bg-[#F8FAFC] dark:bg-[#182030] border border-sec/15 dark:border-gray-700 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 font-bold text-sec/70 dark:text-gray-300">
                        <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>کارکرد در این بازه</span>
                      </span>
                      <span className="font-black text-sec dark:text-white tabular-nums">
                        {formatDurationToHoursMins(task.trackedSeconds.total)}
                        <span className="text-[11px] font-bold text-sec/55 dark:text-gray-400 ms-1">
                          ({toPersianDigits(task.sessionCounts.total)} سشن)
                        </span>
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 pt-1 text-[11px] font-bold tabular-nums">
                      <div className="px-2 py-1 rounded-xl bg-ecosystem-light/60 dark:bg-ecosystem-darker/35 text-sec dark:text-ecosystem-light text-center">
                        <span className="block text-[10px] opacity-75">تایید</span>
                        <span className="font-black">
                          {formatDurationToHoursMins(task.trackedSeconds.approved)}
                        </span>
                      </div>
                      <div className="px-2 py-1 rounded-xl bg-college-light/60 dark:bg-college-darker/35 text-[#704A0D] dark:text-amber-200 text-center">
                        <span className="block text-[10px] opacity-75">انتظار</span>
                        <span className="font-black">
                          {formatDurationToHoursMins(task.trackedSeconds.pending)}
                        </span>
                      </div>
                      <div
                        className={cn(
                          'px-2 py-1 rounded-xl text-center',
                          task.trackedSeconds.rejected > 0
                            ? 'bg-rose-100/80 dark:bg-rose-950/50 text-[#C60036] dark:text-rose-200'
                            : 'bg-gray-100 dark:bg-gray-800 text-sec/55 dark:text-gray-400'
                        )}
                      >
                        <span className="flex items-center justify-center gap-0.5 text-[10px] opacity-80">
                          {task.trackedSeconds.rejected > 0 && <XCircle className="w-2.5 h-2.5" />}
                          <span>رد</span>
                        </span>
                        <span className="font-black">
                          {formatDurationToHoursMins(task.trackedSeconds.rejected)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div
                  className="pt-3 border-t border-sec/10 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#F8FAFC] dark:bg-[#182030] border border-sec/15 dark:border-gray-700 text-xs font-bold text-sec dark:text-gray-200 tabular-nums">
                    <Users className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>{toPersianDigits(task.members.length)} همکار</span>
                  </span>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setViewingTask(task)}
                    className="gap-1.5 border-primary/50 text-sec dark:text-primary hover:bg-primary/15 text-xs font-black"
                  >
                    <Eye className="w-3.5 h-3.5 shrink-0" />
                    <span>جزئیات سشن‌ها</span>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Session Drill-down Modal synced with current date filter */}
      <WorkTargetSessionsModal
        isOpen={Boolean(viewingTask)}
        onClose={() => setViewingTask(null)}
        targetKind="TASK"
        targetId={viewingTask?.id ?? null}
        initialTitle={viewingTask?.name}
        initialDescription={viewingTask?.description}
        scrumName={viewingTask?.scrum.name}
        scrumColor={viewingTask?.scrum.color}
        points={viewingTask?.points}
        initialDatePreset={datePreset}
        initialSingleDate={singleDate}
        initialRangeFrom={rangeFrom}
        initialRangeTo={rangeTo}
        initialUserId={
          user && (user.role === 'SCRUM_ADMIN' || user.role === 'SUPER_ADMIN')
            ? user.id
            : undefined
        }
      />
    </div>
  );
};

export default UserScrumTasksPage;

