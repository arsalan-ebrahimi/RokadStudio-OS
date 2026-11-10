import React from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  Users,
  Zap,
  Target,
  ListChecks,
  Calendar,
  Clock,
  ArrowLeft,
  CheckSquare,
  BarChart3,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  ProgressBar,
  Skeleton,
  StatusDotPill,
} from '@/shared/ui';
import { cn } from '@/shared/lib/utils';
import { toPersianDigits } from '@/shared/lib/formatters';
import { formatToJalali, getTehranTodayString } from '@/shared/lib/date';
import { useAuthStore } from '@/features/auth';
import { useScrumAdminDashboard } from '../hooks/use-scrum';
import { SCRUM_COLOR_MAP } from '../types/scrum-types';

export const ScrumAdminDashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const { data, isLoading, isError, error, refetch } = useScrumAdminDashboard();

  const todayJalali = formatToJalali(getTehranTodayString(), true);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-36" />
          </div>
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-3xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-60 w-full rounded-3xl" />
            ))}
          </div>
          <Skeleton className="lg:col-span-4 h-60 w-full rounded-3xl" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <ErrorState
        title="خطا در دریافت داشبورد مدیر اسکرام"
        message={error instanceof Error ? error.message : 'در بارگذاری اطلاعات مشکلی پیش آمد.'}
        onRetry={() => refetch()}
      />
    );
  }

  const { totals, scrums, todayEvents } = data;

  return (
    <div className="space-y-6">
      {/* Greeting Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sec/10 dark:border-gray-800">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-black text-sec dark:text-white">
            سلام، {user?.name} عزیز
          </h1>
          <p className="text-xs font-bold text-sec/65 dark:text-gray-400">
            {todayJalali} · خلاصه وضعیت اسکرام‌ها و اسپرینت‌های فعال شما
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <Link to="/scrum-admin/attendance">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs font-extrabold">
              <CheckSquare className="w-4 h-4 text-primary" />
              <span>حضور و غیاب</span>
            </Button>
          </Link>
          <Link to="/scrum-admin/reports">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs font-extrabold">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span>گزارش عملکرد</span>
            </Button>
          </Link>
          <Link to="/scrum-admin/scrums">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs font-extrabold">
              <Layers className="w-4 h-4 text-primary" />
              <span>همه اسکرام‌های من</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 rounded-3xl space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sec/65 dark:text-gray-400">اسکرام‌ها</span>
            <div className="w-9 h-9 rounded-xl bg-ecosystem-light dark:bg-ecosystem-darker/60 border border-primary/30 text-sec dark:text-primary flex items-center justify-center">
              <Layers className="w-4 h-4 text-primary" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-sec dark:text-white tabular-nums">
            {toPersianDigits(totals.scrums)}
          </p>
        </Card>

        <Card className="p-5 rounded-3xl space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sec/65 dark:text-gray-400">اعضا</span>
            <div className="w-9 h-9 rounded-xl bg-club-light dark:bg-club-darker/60 border border-club-normal/30 text-club-normal dark:text-purple-300 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-sec dark:text-white tabular-nums">
            {toPersianDigits(totals.members)}
          </p>
        </Card>

        <Card className="p-5 rounded-3xl space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sec/65 dark:text-gray-400">اسپرینت‌های فعال</span>
            <div className="w-9 h-9 rounded-xl bg-college-light dark:bg-college-darker/60 border border-college-normal/40 text-[#9C5700] dark:text-amber-300 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-sec dark:text-white tabular-nums">
            {toPersianDigits(totals.activeSprints)}
          </p>
        </Card>

        <Card className="p-5 rounded-3xl space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sec/65 dark:text-gray-400">تسک‌های فعال / کل</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-[#007A52] dark:text-emerald-300 flex items-center justify-center">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <p className="text-2xl sm:text-3xl font-black text-sec dark:text-white tabular-nums">
              {toPersianDigits(totals.activeTasks)} / {toPersianDigits(totals.totalTasks)}
            </p>
            <span className="text-[11px] font-bold text-sec/55 dark:text-gray-400 tabular-nums">
              ({toPersianDigits(totals.totalTaskPoints)} پوینت)
            </span>
          </div>
        </Card>
      </div>

      {/* Empty State when no scrums assigned */}
      {scrums.length === 0 ? (
        <Card className="p-8 sm:p-12 rounded-3xl text-center space-y-3 max-w-xl mx-auto">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-ecosystem-light dark:bg-primary/15 border border-primary/35 text-primary flex items-center justify-center shadow-hard-sm">
            <Layers className="w-7 h-7" />
          </div>
          <h2 className="text-base sm:text-lg font-black text-sec dark:text-white">
            اسکرامی برای نمایش وجود ندارد
          </h2>
          <p className="text-xs sm:text-sm font-bold text-sec/70 dark:text-gray-300 leading-relaxed">
            هنوز اسکرامی به شما اختصاص داده نشده است. با مدیر کل در تماس باشید.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* My Scrums Cards */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-sec dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <span>اسکرام‌های من ({toPersianDigits(scrums.length)})</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scrums.map((s) => {
                const colorMeta = SCRUM_COLOR_MAP[s.color] || SCRUM_COLOR_MAP.ECOSYSTEM;
                const sp = s.activeSprint;

                return (
                  <Card
                    key={s.id}
                    className="relative overflow-hidden rounded-3xl p-5 flex flex-col justify-between space-y-4"
                  >
                    <div className={cn('absolute top-0 inset-x-0 h-2', colorMeta.solidBg)} />

                    <div className="space-y-3.5 pt-1.5">
                      {/* Title */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={cn('w-3 h-3 rounded-full shrink-0', colorMeta.solidBg)} />
                          <h3 className="text-base font-black text-sec dark:text-white truncate">
                            {s.name}
                          </h3>
                        </div>
                        <Link to={`/scrum-admin/scrums/${s.id}`} className="shrink-0">
                          <Button size="sm" variant="outline" className="text-xs font-black gap-1">
                            <span>باز کردن</span>
                            <ArrowLeft className="w-3.5 h-3.5 text-primary" />
                          </Button>
                        </Link>
                      </div>

                      {/* Active Sprint + Progress + Jalali End Date */}
                      <div className="p-3.5 rounded-2xl bg-[#F8FAFC] dark:bg-[#182030] border border-sec/15 dark:border-gray-700 space-y-2.5">
                        {sp ? (
                          <>
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-black text-sec dark:text-white truncate">
                                <span className="font-mono text-sec dark:text-primary me-1">
                                  S{toPersianDigits(sp.number)}
                                </span>
                                · {sp.title}
                              </span>
                              <span className="text-[11px] font-black text-sec dark:text-primary shrink-0 tabular-nums">
                                {toPersianDigits(sp.progressPercent)}٪
                              </span>
                            </div>
                            <ProgressBar
                              value={sp.progressPercent}
                              max={100}
                              barClassName={colorMeta.barText}
                              size="sm"
                              aria-label={`پیشرفت اسپرینت ${sp.title}`}
                            />
                            <div className="flex items-center justify-between text-[11px] font-bold text-sec/60 dark:text-gray-400 tabular-nums">
                              <span>
                                پایان: {sp.endDate ? formatToJalali(sp.endDate) : 'تعیین نشده'}
                              </span>
                              <span>{toPersianDigits(s.totalTaskPoints)} پوینت کل</span>
                            </div>
                          </>
                        ) : (
                          <p className="text-xs font-bold text-sec/55 dark:text-gray-400 text-center py-1">
                            بدون اسپرینت فعال
                          </p>
                        )}
                      </div>

                      {/* KPI Health Pills */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[11px] font-bold text-sec/65 dark:text-gray-400">
                          سلامت KPI:
                        </span>
                        {s.kpi.total === 0 ? (
                          <span className="text-[11px] font-bold text-sec/45 dark:text-gray-500">
                            تعریف نشده
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <StatusDotPill tone="success" label={`${toPersianDigits(s.kpi.onTarget)} هدف`} />
                            <StatusDotPill tone="warning" label={`${toPersianDigits(s.kpi.inRange)} در مسیر`} />
                            <StatusDotPill tone="danger" label={`${toPersianDigits(s.kpi.belowMin)} هشدار`} />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Counts */}
                    <div className="pt-3 border-t border-sec/10 dark:border-gray-800 flex items-center justify-between text-xs font-bold text-sec/70 dark:text-gray-300 tabular-nums">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-primary" />
                        <span>{toPersianDigits(s.memberCount)} عضو</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <ListChecks className="w-3.5 h-3.5 text-club-normal dark:text-purple-300" />
                        <span>{toPersianDigits(s.activeTaskCount)} / {toPersianDigits(s.taskCount)} تسک</span>
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Today Ceremony Timeline (with dedicated Time column) */}
          <div className="lg:col-span-4 space-y-4">
            <h2 className="text-base font-black text-sec dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <span>امروز ({toPersianDigits(todayEvents.length)} رویداد)</span>
            </h2>

            <Card className="p-4 sm:p-5 rounded-3xl space-y-3">
              {todayEvents.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <Calendar className="w-8 h-8 text-sec/30 dark:text-gray-600 mx-auto" />
                  <p className="text-xs font-bold text-sec/60 dark:text-gray-400">
                    امروز جلسه‌ای در اسکرام‌های شما برنامه‌ریزی نشده است.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {todayEvents.map((ev, idx) => {
                    const colorMeta = SCRUM_COLOR_MAP[ev.color] || SCRUM_COLOR_MAP.ECOSYSTEM;
                    return (
                      <Link
                        key={`${ev.scrumId}-${idx}-${ev.name}`}
                        to={`/scrum-admin/scrums/${ev.scrumId}#events`}
                        className="p-3 rounded-2xl border border-sec/15 dark:border-gray-700 bg-[#F8FAFC] dark:bg-[#182030] hover:border-primary hover:bg-white dark:hover:bg-[#1E2738] transition-all flex items-stretch gap-3 group"
                      >
                        {/* Dedicated Time Rail */}
                        <div className="w-20 shrink-0 rounded-xl bg-[#ECF7F5] dark:bg-[#182730] border border-primary/25 px-2 py-1.5 flex flex-col items-center justify-center text-center">
                          <div className="flex items-center gap-1 font-mono text-xs font-black text-sec dark:text-white tabular-nums">
                            <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span>{ev.startTime ? toPersianDigits(ev.startTime) : '—'}</span>
                          </div>
                          {ev.durationMinutes != null && (
                            <span className="text-[10px] font-bold text-sec/60 dark:text-gray-400 tabular-nums mt-0.5">
                              {toPersianDigits(ev.durationMinutes)} دقیقه
                            </span>
                          )}
                        </div>

                        {/* Event Info */}
                        <div className="min-w-0 flex-1 flex flex-col justify-center gap-1.5">
                          <h4 className="text-xs sm:text-sm font-black text-sec dark:text-white group-hover:text-primary transition-colors truncate">
                            {ev.name}
                          </h4>
                          <div>
                            <Badge dot variant={colorMeta.badgeVariant} className="text-[10px] py-0.5 px-2">
                              <span className="truncate max-w-[140px]">{ev.scrumName}</span>
                            </Badge>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
