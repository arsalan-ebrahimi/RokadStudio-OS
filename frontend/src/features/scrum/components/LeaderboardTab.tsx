import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Trophy, Medal, Info, Clock, ArrowUp, Eye } from 'lucide-react';
import {
  Badge,
  Card,
  Select,
  Skeleton,
  EmptyState,
  ErrorState,
  ProgressBar,
  SegmentedControl,
} from '@/shared/ui';
import { useAuthStore } from '@/features/auth';
import {
  AttendanceTotalsPills,
  MemberDetailDrawer,
  PerformanceBadge,
} from '@/features/members';
import { cn } from '@/shared/lib/utils';
import { toPersianDigits, formatDurationToHoursMins } from '@/shared/lib/formatters';
import { formatToJalali } from '@/shared/lib/date';
import { useScrumLeaderboard, useSprints } from '../hooks/use-scrum';
import { SCRUM_COLOR_MAP, type LeaderboardPeriod, type Scrum } from '../types/scrum-types';

interface LeaderboardTabProps {
  scrum: Scrum;
}

const PERIOD_OPTIONS: { value: LeaderboardPeriod; label: string }[] = [
  { value: 'SPRINT', label: 'این اسپرینت' },
  { value: 'MONTH', label: 'این ماه' },
  { value: 'ALL', label: 'همه' },
];

export const LeaderboardTab: React.FC<LeaderboardTabProps> = ({ scrum }) => {
  const currentUser = useAuthStore((s) => s.user);
  const colorMeta = SCRUM_COLOR_MAP[scrum.color] || SCRUM_COLOR_MAP.ECOSYSTEM;
  const [period, setPeriod] = useState<LeaderboardPeriod>('SPRINT');
  const [selectedSprintId, setSelectedSprintId] = useState<number | undefined>(undefined);
  const [isOwnRowVisible, setIsOwnRowVisible] = useState(true);
  const [drawerUserId, setDrawerUserId] = useState<number | null>(null);

  const adminIdSet = useMemo(
    () => new Set((scrum.admins || []).map((a) => a.id)),
    [scrum.admins]
  );

  const canInspectMembers =
    currentUser?.role === 'SUPER_ADMIN' ||
    currentUser?.role === 'ADMIN' ||
    (currentUser?.role === 'SCRUM_ADMIN' &&
      Boolean(scrum.permissions?.canEditContent ?? scrum.canEdit));

  const ownRowRef = useRef<HTMLDivElement>(null);

  const { data: sprints = [] } = useSprints(scrum.id);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useScrumLeaderboard(scrum.id, {
    period,
    sprintId: period === 'SPRINT' ? selectedSprintId : undefined,
  });

  const rows = useMemo(() => data?.rows || [], [data]);
  const me = data?.me;

  const hasApprovedTime = useMemo(
    () => rows.some((r) => r.approvedSeconds > 0),
    [rows]
  );

  const leaderSeconds = useMemo(
    () => Math.max(...rows.map((r) => r.approvedSeconds), 0),
    [rows]
  );

  const podiumRows = useMemo(
    () => rows.filter((r) => r.approvedSeconds > 0).slice(0, 3),
    [rows]
  );

  // Observe whether caller's own row is currently within viewport to control sticky bar
  useEffect(() => {
    const el = ownRowRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsOwnRowVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsOwnRowVisible(entry.isIntersecting);
      },
      { threshold: 0.15 }
    );
    observer.observe(el);

    return () => observer.disconnect();
  }, [rows, hasApprovedTime, period, selectedSprintId]);

  return (
    <div className="space-y-6 pb-8">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-sec/15 dark:border-gray-800">
        <div className="space-y-1">
          <h3 className="text-base sm:text-lg font-black text-sec dark:text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-college-normal" />
            <span>رتبه‌بندی اعضای اسکرام</span>
          </h3>
          <p className="text-xs font-bold text-ink-normal/65 dark:text-gray-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-sec dark:text-primary shrink-0" />
            <span>رتبه‌بندی فقط بر اساس مجموع ساعات کاری تأییدشده محاسبه می‌شود.</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <SegmentedControl<LeaderboardPeriod>
            options={PERIOD_OPTIONS}
            value={period}
            onChange={(val) => {
              setPeriod(val);
              if (val !== 'SPRINT') {
                setSelectedSprintId(undefined);
              }
            }}
          />

          {period === 'SPRINT' && sprints.length > 0 && (
            <Select
              value={selectedSprintId || ''}
              onChange={(e) =>
                setSelectedSprintId(e.target.value ? Number(e.target.value) : undefined)
              }
              containerClassName="w-48"
            >
              <option value="">اسپرینت فعال / اخیر</option>
              {sprints.map((s) => (
                <option key={s.id} value={s.id}>
                  S{toPersianDigits(s.number)} · {s.title}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>

      {/* Period Info Sub-bar */}
      {data && (data.sprint || data.range) && (
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-sec dark:text-gray-200">
          {data.sprint && (
            <span className="px-3 py-1.5 rounded-xl bg-ecosystem-light dark:bg-ecosystem-darker/50 text-sec dark:text-ecosystem-light border border-ecosystem-dark/30">
              اسپرینت {toPersianDigits(data.sprint.number)}: {data.sprint.title}
            </span>
          )}
          {data.range && (
            <span className="px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-[#182030] border border-sec/15 dark:border-gray-700 tabular-nums">
              بازه: {formatToJalali(data.range.from)} تا {formatToJalali(data.range.to)}
            </span>
          )}
        </div>
      )}

      {/* Main Content States */}
      {isLoading ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-3xl" />
            ))}
          </div>
          <div className="space-y-2.5">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      ) : isError ? (
        <ErrorState
          title="خطا در دریافت جدول رتبه‌بندی"
          message={error instanceof Error ? error.message : 'در بارگذاری اطلاعات مشکلی پیش آمد.'}
          onRetry={() => refetch()}
        />
      ) : !hasApprovedTime ? (
        <div className="space-y-4">
          <EmptyState
            title="هنوز زمان تأییدشده‌ای ثبت نشده است"
            description="در این بازه زمانی هنوز هیچ سشن کاری تأییدشده‌ای برای اعضای این اسکرام ثبت نشده است."
          />
          {me && me.pendingSeconds > 0 && (
            <div className="flex items-center justify-center">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-college-light dark:bg-amber-950/40 border border-college-normal/45 dark:border-amber-800 text-xs font-bold text-[#704A0D] dark:text-amber-300 tabular-nums">
                <Clock className="w-4 h-4" />
                <span>{formatDurationToHoursMins(me.pendingSeconds)} در انتظار تأیید</span>
              </span>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Top-3 Podium */}
          {podiumRows.length > 0 && (
            <div
              className={cn(
                'grid gap-4 items-end pt-2',
                podiumRows.length === 1
                  ? 'grid-cols-1 max-w-sm mx-auto'
                  : podiumRows.length === 2
                  ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto'
                  : 'grid-cols-1 sm:grid-cols-3'
              )}
            >
              {podiumRows.map((entry, idx) => {
                const isFirstVisual = idx === 0;
                // Center raised layout on desktop when 3 podium cards exist: 2nd (order-1), 1st (order-2), 3rd (order-3)
                const desktopOrderClass =
                  podiumRows.length === 3
                    ? idx === 0
                      ? 'sm:order-2 sm:-translate-y-2'
                      : idx === 1
                      ? 'sm:order-1'
                      : 'sm:order-3'
                    : idx === 0
                    ? 'sm:order-1 sm:-translate-y-1'
                    : 'sm:order-2';

                return (
                  <Card
                    key={entry.user.id}
                    className={cn(
                      'relative overflow-hidden rounded-3xl p-5 sm:p-6 text-center space-y-3 border-[1.5px] transition-all',
                      desktopOrderClass,
                      isFirstVisual
                        ? 'border-sec dark:border-college-normal bg-gradient-to-b from-college-light/85 to-white dark:from-college-darker/35 dark:to-[#121824] shadow-hard'
                        : 'border-sec/25 dark:border-primary/30 shadow-hard-sm',
                      entry.isMe && 'ring-2 ring-primary'
                    )}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      {entry.rank === 1 ? (
                        <Trophy className="w-5 h-5 text-college-normal" />
                      ) : (
                        <Medal
                          className={cn(
                            'w-5 h-5',
                            entry.rank === 2 ? 'text-slate-400' : 'text-amber-700'
                          )}
                        />
                      )}
                      <span className="text-xs font-black text-sec dark:text-white tabular-nums">
                        رتبه {toPersianDigits(entry.rank)}
                      </span>
                    </div>

                    <div
                      className={cn(
                        'mx-auto rounded-2xl font-black flex items-center justify-center border-[1.5px] border-sec/25 shadow-hard-sm',
                        isFirstVisual ? 'w-14 h-14 text-lg' : 'w-12 h-12 text-base',
                        entry.rank === 1
                          ? 'bg-college-normal text-sec'
                          : cn(colorMeta.solidBg, colorMeta.solidText)
                      )}
                    >
                      {entry.user.name.trim().slice(0, 1) || 'ک'}
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="text-sm font-black text-sec dark:text-white flex items-center justify-center gap-1.5 flex-wrap">
                        {canInspectMembers || entry.user.id === currentUser?.id ? (
                          <button
                            type="button"
                            onClick={() => setDrawerUserId(entry.user.id)}
                            className="inline-flex items-center gap-1 hover:text-primary dark:hover:text-primary transition-colors cursor-pointer truncate"
                            title="مشاهده جزئیات عضو"
                          >
                            <span className="truncate">{entry.user.name}</span>
                            <Eye className="w-3.5 h-3.5 text-sec/50 dark:text-gray-400 shrink-0" />
                          </button>
                        ) : (
                          <span className="truncate">{entry.user.name}</span>
                        )}
                        {entry.isMe && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary text-sec border border-sec/25 shrink-0">
                            شما
                          </span>
                        )}
                        {(entry.isAdmin || adminIdSet.has(entry.user.id)) && (
                          <Badge variant="club" className="text-[10px] py-0 px-2 shrink-0">
                            ادمین
                          </Badge>
                        )}
                      </h4>
                      <p className="text-sm font-black text-sec dark:text-primary tabular-nums">
                        {formatDurationToHoursMins(entry.approvedSeconds)}
                      </p>
                      <p className="text-[11px] font-bold text-ink-normal/60 dark:text-gray-400 tabular-nums">
                        {toPersianDigits(entry.sessionCount)} سشن تأییدشده
                      </p>
                      {(entry.performance || entry.attendanceTotals) && (
                        <div className="pt-1.5 flex flex-col items-center gap-1.5">
                          {entry.performance && entry.user.id !== currentUser?.id && (
                            <PerformanceBadge level={entry.performance} />
                          )}
                          {entry.attendanceTotals && (
                            <AttendanceTotalsPills totals={entry.attendanceTotals} compact />
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Full Ranked List */}
          <Card className="p-4 sm:p-5 rounded-3xl border-[1.5px] border-sec/20 dark:border-primary/25 shadow-hard-sm space-y-3">
            {rows.map((row) => {
              const isHighlighted = row.isMe;
              const isRowAdmin = Boolean(row.isAdmin) || adminIdSet.has(row.user.id);
              const canInspectRow = canInspectMembers || row.user.id === currentUser?.id;
              return (
                <div
                  key={row.user.id}
                  ref={isHighlighted ? ownRowRef : undefined}
                  className={cn(
                    'p-3.5 sm:p-4 rounded-2xl border-[1.5px] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3',
                    isHighlighted
                      ? 'border-sec dark:border-primary bg-ecosystem-light/70 dark:bg-ecosystem-darker/35 shadow-hard-sm'
                      : 'border-sec/15 dark:border-gray-800 bg-gray-50/70 dark:bg-[#151C28]'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Rank Number (supports tie ranks e.g. 1, 1, 3) */}
                    <div
                      className={cn(
                        'w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 tabular-nums border',
                        row.rank === 1
                          ? 'bg-college-normal text-sec border-sec/30'
                          : row.rank === 2
                          ? 'bg-slate-200 dark:bg-slate-700 text-sec dark:text-white border-sec/15'
                          : row.rank === 3
                          ? 'bg-amber-100 dark:bg-amber-900/50 text-[#704A0D] dark:text-amber-200 border-college-normal/40'
                          : 'bg-gray-100 dark:bg-gray-800 text-sec/75 dark:text-gray-300 border-sec/10'
                      )}
                    >
                      {toPersianDigits(row.rank)}
                    </div>

                    {/* Initial Avatar */}
                    <div
                      className={cn(
                        'w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs border border-sec/20 shrink-0',
                        colorMeta.solidBg,
                        colorMeta.solidText
                      )}
                    >
                      {row.user.name.trim().slice(0, 1) || 'ک'}
                    </div>

                    {/* Name + Progress relative to leader */}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {canInspectRow ? (
                          <button
                            type="button"
                            onClick={() => setDrawerUserId(row.user.id)}
                            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black text-sec dark:text-white hover:text-primary dark:hover:text-primary transition-colors cursor-pointer group"
                            title="مشاهده جزئیات عضو"
                          >
                            <span className="truncate">{row.user.name}</span>
                            <Eye className="w-3.5 h-3.5 text-sec/50 dark:text-gray-400 group-hover:text-primary shrink-0" />
                          </button>
                        ) : (
                          <span className="text-xs sm:text-sm font-black text-sec dark:text-white truncate">
                            {row.user.name}
                          </span>
                        )}
                        {isHighlighted && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-primary text-sec border border-sec/25">
                            شما
                          </span>
                        )}
                        {isRowAdmin && (
                          <Badge variant="club" className="text-[10px] py-0 px-2">
                            ادمین
                          </Badge>
                        )}
                        {'performance' in row && row.user.id !== currentUser?.id && row.performance && (
                          <PerformanceBadge level={row.performance} />
                        )}
                        {row.attendanceTotals && (
                          <AttendanceTotalsPills totals={row.attendanceTotals} compact />
                        )}
                        {isHighlighted && me && me.pendingSeconds > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-college-light dark:bg-amber-950/60 text-[#704A0D] dark:text-amber-200 border border-college-normal/45 tabular-nums">
                            <Clock className="w-3 h-3" />
                            <span>
                              {formatDurationToHoursMins(me.pendingSeconds)} در انتظار تأیید
                            </span>
                          </span>
                        )}
                      </div>

                      <ProgressBar
                        value={row.approvedSeconds}
                        max={leaderSeconds || 1}
                        barClassName={isHighlighted ? 'text-primary' : colorMeta.barText}
                        size="xs"
                        aria-label={`پیشرفت ${row.user.name}`}
                      />
                    </div>
                  </div>

                  {/* Right Stats: Approved Time + Session Count */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 shrink-0 ps-12 sm:ps-0 tabular-nums">
                    <span className="text-xs sm:text-sm font-black text-sec dark:text-white">
                      {formatDurationToHoursMins(row.approvedSeconds)}
                    </span>
                    <span className="text-[11px] font-bold text-ink-normal/60 dark:text-gray-400">
                      {toPersianDigits(row.sessionCount)} سشن
                    </span>
                  </div>
                </div>
              );
            })}
          </Card>

          {/* Sticky Bottom Own-Rank Bar when own row is scrolled outside viewport */}
          {me && me.rank !== null && !isOwnRowVisible && (
            <div className="sticky bottom-3 z-20 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="p-3 sm:px-4 rounded-2xl border-[1.5px] border-sec dark:border-primary bg-white/95 dark:bg-[#121824]/95 backdrop-blur-md shadow-hard flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="px-3 py-1 rounded-xl bg-primary text-sec border border-sec/25 text-xs font-black shrink-0 tabular-nums">
                    رتبه شما: {toPersianDigits(me.rank)}
                  </span>
                  <span className="text-xs font-black text-sec dark:text-white truncate tabular-nums">
                    {formatDurationToHoursMins(me.approvedSeconds)}
                  </span>
                  {me.pendingSeconds > 0 && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-[#704A0D] dark:text-amber-300 tabular-nums">
                      ({formatDurationToHoursMins(me.pendingSeconds)} در انتظار تأیید)
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    ownRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }
                  className="inline-flex items-center gap-1.5 min-h-[38px] px-3 rounded-xl text-xs font-black text-sec dark:text-primary hover:bg-primary/15 transition-colors shrink-0 cursor-pointer"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                  <span>مشاهده جایگاه</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <MemberDetailDrawer
        userId={drawerUserId}
        scrumId={scrum.id}
        onClose={() => setDrawerUserId(null)}
      />
    </div>
  );
};
