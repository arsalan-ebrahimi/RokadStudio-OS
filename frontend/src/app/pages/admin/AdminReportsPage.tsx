import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { Card, Button, Skeleton, EmptyState, PersianDatePicker, Select } from '@/shared/ui';
import { fetchWorkSessionsSummary } from '@/features/reports/api/reports-api';
import { fetchAllProjects } from '@/features/projects/api/projects-api';
import { exportReportsToCsv } from '@/features/reports/lib/export-csv';
import { toPersianDigits, formatDurationToHoursMins } from '@/shared/lib/formatters';
import { getTehranTodayString, getJalaliWeekRange, getJalaliMonthRange } from '@/shared/lib/date';
import { cn } from '@/shared/lib/utils';

export const AdminReportsPage: React.FC = () => {
  const today = getTehranTodayString();
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [projectId, setProjectId] = useState<number | undefined>(undefined);
  const [groupBy, setGroupBy] = useState<'user' | 'project' | 'user_project'>('user_project');

  const { data: projectsRes } = useQuery({
    queryKey: ['admin-projects-list'],
    queryFn: () => fetchAllProjects({ limit: 100, isActive: true }),
  });
  const projects = projectsRes?.data || [];

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['reports-summary', dateFrom, dateTo, groupBy, projectId],
    queryFn: () => fetchWorkSessionsSummary({ dateFrom, dateTo, groupBy, projectId }),
  });

  const totalSeconds = rows.reduce((acc, r) => acc + r.totalSeconds, 0);
  const totalRounds = rows.reduce((acc, r) => acc + r.sessionsCount, 0);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-lg font-black text-sec dark:text-white">گزارش عملکرد</h1>

        <Button size="sm" variant="outline" onClick={() => exportReportsToCsv(rows)}>
          <Download className="w-3.5 h-3.5 me-1" />
          خروجی
        </Button>
      </div>

      <Card className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
          {/* Preset Buttons */}
          <div className="flex items-center justify-between sm:justify-start gap-1 bg-gray-50 dark:bg-[#182030] p-1 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
            <button
              onClick={applyToday}
              className={`flex-1 sm:flex-initial px-3 py-1 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                dateFrom === today && dateTo === today
                  ? 'bg-primary text-white shadow-hard-sm'
                  : 'text-ink-normal/70 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              امروز
            </button>
            <button
              onClick={applyThisWeek}
              className="flex-1 sm:flex-initial px-3 py-1 text-xs font-bold rounded-lg text-ink-normal/70 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all whitespace-nowrap"
            >
              این هفته
            </button>
            <button
              onClick={applyThisMonth}
              className="flex-1 sm:flex-initial px-3 py-1 text-xs font-bold rounded-lg text-ink-normal/70 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all whitespace-nowrap"
            >
              این ماه
            </button>
          </div>

          <div className="h-6 w-px bg-gray-200 dark:border-gray-700 hidden sm:block" />

          {/* Date Pickers */}
          <div className="flex items-center justify-between sm:justify-start gap-1.5 flex-wrap">
            <div className="flex-1 sm:flex-initial">
              <PersianDatePicker value={dateFrom} onChange={setDateFrom} allowStep={false} />
            </div>
            <span className="text-xs text-ink-normal/50 dark:text-gray-400 font-bold shrink-0">تا</span>
            <div className="flex-1 sm:flex-initial">
              <PersianDatePicker value={dateTo} onChange={setDateTo} allowStep={false} />
            </div>
          </div>

          <div className="h-6 w-px bg-gray-200 dark:border-gray-700 hidden lg:block" />

          <div className="w-full sm:w-44">
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
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <span className="text-xs text-ink-normal/60 dark:text-gray-400 font-bold">مجموع دورها</span>
          <p className="text-2xl font-black text-sec dark:text-white mt-1">{toPersianDigits(totalRounds)}</p>
        </Card>
        <Card className="p-4 text-center">
          <span className="text-xs text-ink-normal/60 dark:text-gray-400 font-bold">مجموع ساعات</span>
          <p className="text-2xl font-black text-primary mt-1">{formatDurationToHoursMins(totalSeconds)}</p>
        </Card>
        <Card className="p-4 text-center">
          <span className="text-xs text-ink-normal/60 dark:text-gray-400 font-bold">تعداد موارد</span>
          <p className="text-2xl font-black text-sec dark:text-white mt-1">{toPersianDigits(rows.length)}</p>
        </Card>
        <Card className="p-4 text-center">
          <span className="text-xs text-ink-normal/60 dark:text-gray-400 font-bold">میانگین هر دور</span>
          <p className="text-2xl font-black text-third mt-1">
            {formatDurationToHoursMins(totalRounds > 0 ? Math.round(totalSeconds / totalRounds) : 0)}
          </p>
        </Card>
      </div>

      {!isLoading && rows.length > 0 && totalSeconds > 0 && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-sec dark:text-white">سهم تمرکز در این بازه</span>
            <span className="text-ink-normal/50 dark:text-gray-400 font-mono">
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
              const label = row.user && row.project ? `${row.user.name} - ${row.project.name}` : (row.user?.name || row.project?.name || '—');
              const dotColors = ['bg-primary', 'bg-girl', 'bg-third', 'bg-[#612B89]'];
              const pct = Math.round((row.totalSeconds / totalSeconds) * 100);
              return (
                <div key={idx} className="flex items-center gap-1.5 text-ink-normal/70 dark:text-gray-300">
                  <span className={cn('w-2 h-2 rounded-full', dotColors[idx % dotColors.length])} />
                  <span className="truncate max-w-[140px]">{label}</span>
                  <span className="text-ink-normal/40 font-mono">({toPersianDigits(pct)}٪)</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState title="داده‌ای در این بازه زمانی ثبت نشده است" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs executive-table min-w-[340px]">
              <thead className="bg-gray-50 dark:bg-[#182030] text-ink-normal/60 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="p-3.5 sm:p-4 font-bold md:w-1/2">نام</th>
                  <th className="p-3.5 sm:p-4 font-bold md:w-1/4">تعداد دور</th>
                  <th className="p-3.5 sm:p-4 font-bold md:w-1/4">مجموع زمان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {rows.map((row, idx) => {
                  const label = row.user && row.project
                    ? `${row.user.name} (${row.project.name})`
                    : (row.user?.name || row.project?.name || '—');
                  return (
                    <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-[#151C28]/50 transition-colors">
                      <td className="p-3.5 sm:p-4 font-bold text-sec dark:text-white">{label}</td>
                      <td className="p-3.5 sm:p-4 font-bold tabular-nums text-sec dark:text-white">{toPersianDigits(row.sessionsCount)} دور</td>
                      <td className="p-3.5 sm:p-4 font-bold text-primary">{formatDurationToHoursMins(row.totalSeconds)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default AdminReportsPage;
