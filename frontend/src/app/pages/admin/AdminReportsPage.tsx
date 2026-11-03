import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { Card, Button, Skeleton, EmptyState } from '@/shared/ui';
import { fetchWorkSessionsSummary } from '@/features/reports/api/reports-api';
import { exportReportsToCsv } from '@/features/reports/lib/export-csv';
import { toPersianDigits, formatDurationToHoursMins } from '@/shared/lib/formatters';
import { getTehranTodayString } from '@/shared/lib/date';

export const AdminReportsPage: React.FC = () => {
  const [dateFrom, setDateFrom] = useState(getTehranTodayString());
  const [dateTo, setDateTo] = useState(getTehranTodayString());
  const [groupBy, setGroupBy] = useState<'user' | 'project' | 'user_project'>('user_project');

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['reports-summary', dateFrom, dateTo, groupBy],
    queryFn: () => fetchWorkSessionsSummary({ dateFrom, dateTo, groupBy }),
  });

  const totalSeconds = rows.reduce((acc, r) => acc + r.totalSeconds, 0);
  const totalRounds = rows.reduce((acc, r) => acc + r.sessionsCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-lg font-black text-sec dark:text-white">گزارش عملکرد</h1>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151C28] text-xs font-bold"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151C28] text-xs font-bold"
          />
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as 'user' | 'project' | 'user_project')}
            className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151C28] text-xs font-bold"
          >
            <option value="user_project">کاربر و پروژه</option>
            <option value="user">تفکیک کاربر</option>
            <option value="project">تفکیک پروژه</option>
          </select>
          <Button size="sm" variant="outline" onClick={() => exportReportsToCsv(rows)}>
            <Download className="w-3.5 h-3.5 me-1" />
            خروجی
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 text-center">
          <span className="text-xs text-ink-normal/60 dark:text-gray-400 font-bold">مجموع دورها</span>
          <p className="text-2xl font-black text-sec dark:text-white mt-1">{toPersianDigits(totalRounds)}</p>
        </Card>
        <Card className="p-4 text-center">
          <span className="text-xs text-ink-normal/60 dark:text-gray-400 font-bold">مجموع زمان</span>
          <p className="text-2xl font-black text-primary mt-1">{formatDurationToHoursMins(totalSeconds)}</p>
        </Card>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="هیچ داده‌ای در این بازه زمانی ثبت نشده است" />
      ) : (
        <div className="space-y-2">
          {rows.map((row, idx) => (
            <Card key={idx} className="p-3.5 flex items-center justify-between text-xs sm:text-sm font-bold">
              <div className="space-y-0.5">
                <p className="text-sec dark:text-white">{row.user?.name || row.project?.name || '-'}</p>
                {row.user && row.project && (
                  <p className="text-xs text-ink-normal/50 dark:text-gray-400">{row.project.name}</p>
                )}
              </div>
              <div className="flex items-center gap-4 text-sec dark:text-white">
                <span>{toPersianDigits(row.sessionsCount)} دور</span>
                <span>•</span>
                <span>{formatDurationToHoursMins(row.totalSeconds)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminReportsPage;

