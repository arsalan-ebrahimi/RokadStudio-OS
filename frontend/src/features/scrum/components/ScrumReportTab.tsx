import React, { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { Card, Button, PersianDatePicker, Select } from '@/shared/ui';
import { toPersianDigits, formatDurationToHoursMins } from '@/shared/lib/formatters';
import { useScrumReport, useSprints } from '../hooks/use-scrum';
import type { Scrum, ScrumReportRow } from '../types/scrum-types';

interface ScrumReportTabProps {
  scrum: Scrum;
  canEdit: boolean;
}

function escapeCsv(field: string | number | null | undefined): string {
  let str = field != null ? String(field) : '-';
  if (/^[=+\-@]/.test(str)) str = `'${str}`;
  return `"${str.replace(/"/g, '""')}"`;
}

function exportScrumReportCsv(rows: ScrumReportRow[], scrumName: string): void {
  const headers = [
    'نام عضو',
    'عنوان تسک/پروژه',
    'اسپرینت',
    'وضعیت',
    'پوینت',
    'تعداد سشن',
    'مجموع زمان (دقیقه)',
    'زمان به ازای هر پوینت (دقیقه)',
  ];

  const lines = [headers.map(escapeCsv).join(',')];

  for (const r of rows) {
    const line = [
      escapeCsv(r.member?.name || 'بدون مسئول'),
      escapeCsv(r.item.name),
      escapeCsv(`اسپرینت ${r.item.sprint.number}`),
      escapeCsv(r.item.status === 'DONE' ? 'انجام‌شده' : r.item.status === 'DOING' ? 'در حال انجام' : 'در انتظار'),
      escapeCsv(r.item.points),
      escapeCsv(r.sessionCount),
      escapeCsv(Math.round(r.totalSeconds / 60)),
      escapeCsv(r.secondsPerPoint != null ? Math.round(r.secondsPerPoint / 60) : '-'),
    ].join(',');
    lines.push(line);
  }

  const bom = '\uFEFF';
  const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scrum-report-${scrumName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export const ScrumReportTab: React.FC<ScrumReportTabProps> = ({ scrum }) => {
  const { data: sprints = [] } = useSprints(scrum.id);

  const [selectedSprintId, setSelectedSprintId] = useState<number | undefined>(undefined);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: report, isLoading } = useScrumReport(scrum.id, {
    sprintId: selectedSprintId,
    from: dateFrom || undefined,
    to: dateTo || undefined,
  });

  const rows = report?.rows || [];
  const total = report?.total || { totalPoints: 0, donePoints: 0, totalSeconds: 0, sessionCount: 0 };

  return (
    <div className="space-y-6">
      {/* Filters bar */}
      <Card className="p-4 border-2 border-primary/20 shadow-hard-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          {/* Sprint Filter */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-ink-normal/80 dark:text-gray-300">
              انتخاب اسپرینت
            </label>
            <Select
              value={selectedSprintId || ''}
              onChange={(e) =>
                setSelectedSprintId(e.target.value ? Number(e.target.value) : undefined)
              }
            >
              <option value="">همه اسپرینت‌ها</option>
              {sprints.map((s) => (
                <option key={s.id} value={s.id}>
                  اسپرینت {toPersianDigits(s.number)} ({s.title})
                </option>
              ))}
            </Select>
          </div>

          {/* Date From */}
          <div className="space-y-1">
            <span className="block text-xs font-bold text-ink-normal/80 dark:text-gray-300">
              از تاریخ
            </span>
            <PersianDatePicker
              value={dateFrom}
              onChange={(d) => setDateFrom(d)}
              allowStep={false}
            />
          </div>

          {/* Date To */}
          <div className="space-y-1">
            <span className="block text-xs font-bold text-ink-normal/80 dark:text-gray-300">
              تا تاریخ
            </span>
            <PersianDatePicker
              value={dateTo}
              onChange={(d) => setDateTo(d)}
              allowStep={false}
            />
          </div>

          {/* Export CSV button */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportScrumReportCsv(rows, scrum.name)}
              disabled={rows.length === 0}
              className="w-full h-10 text-xs font-bold gap-1.5 shadow-hard-sm border-primary/30"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>خروجی اکسل (CSV)</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Overview Aggregates */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 border border-primary/20 shadow-hard-sm text-center">
          <span className="block text-[11px] text-ink-normal/60 dark:text-gray-400 font-bold mb-1">
            کل پوینت‌ها
          </span>
          <span className="text-xl font-black text-sec dark:text-white">
            {toPersianDigits(total.totalPoints)}
          </span>
        </Card>

        <Card className="p-4 border border-primary/20 shadow-hard-sm text-center">
          <span className="block text-[11px] text-ink-normal/60 dark:text-gray-400 font-bold mb-1">
            پوینت‌های انجام‌شده
          </span>
          <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
            {toPersianDigits(total.donePoints)}
          </span>
        </Card>

        <Card className="p-4 border border-primary/20 shadow-hard-sm text-center">
          <span className="block text-[11px] text-ink-normal/60 dark:text-gray-400 font-bold mb-1">
            مجموع زمان ثبت‌شده
          </span>
          <span className="text-xl font-black text-sec dark:text-white font-mono">
            {formatDurationToHoursMins(total.totalSeconds)}
          </span>
        </Card>

        <Card className="p-4 border border-primary/20 shadow-hard-sm text-center">
          <span className="block text-[11px] text-ink-normal/60 dark:text-gray-400 font-bold mb-1">
            تعداد سشن‌های کاری
          </span>
          <span className="text-xl font-black text-primary">
            {toPersianDigits(total.sessionCount)}
          </span>
        </Card>
      </div>

      {/* Report Table */}
      <Card className="overflow-hidden border-2 border-primary/20 shadow-hard p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100 dark:bg-[#182030] border-b-2 border-primary/20 text-ink-normal/80 dark:text-gray-200 font-black">
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-3">عضو</th>
                <th className="py-3 px-3">تسک / پروژه</th>
                <th className="py-3 px-3">اسپرینت</th>
                <th className="py-3 px-3 text-center">پوینت</th>
                <th className="py-3 px-3 text-center">وضعیت</th>
                <th className="py-3 px-3 text-center">تعداد سشن</th>
                <th className="py-3 px-3 text-center">مجموع زمان</th>
                <th className="py-3 px-3 text-center">زمان به ازای هر پوینت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400 animate-pulse font-bold">
                    در حال بارگذاری داده‌های گزارش...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400 font-bold">
                    هیچ داده‌ای مطابق فیلترهای انتخابی یافت نشد
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
                    <td className="py-2.5 px-3 text-center text-[11px] text-gray-400 font-bold">
                      {toPersianDigits(idx + 1)}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-sec dark:text-white">
                      {row.member?.name || <span className="text-gray-400">بدون مسئول</span>}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-sec dark:text-white">
                      {row.item.name}
                    </td>
                    <td className="py-2.5 px-3 text-ink-normal/70 dark:text-gray-400 font-bold">
                      S{toPersianDigits(row.item.sprint.number)} · {row.item.sprint.title}
                    </td>
                    <td className="py-2.5 px-3 text-center font-black">
                      {toPersianDigits(row.item.points)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-ink-normal/80 dark:text-gray-300">
                        {row.item.status === 'DONE' ? 'انجام‌شده' : row.item.status === 'DOING' ? 'در حال انجام' : 'در انتظار'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold">
                      {toPersianDigits(row.sessionCount)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-primary">
                      {formatDurationToHoursMins(row.totalSeconds)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-[11px]">
                      {row.secondsPerPoint != null ? formatDurationToHoursMins(row.secondsPerPoint) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footnote */}
        <div className="p-3 bg-gray-50 dark:bg-[#151C28] border-t border-gray-100 dark:border-gray-800 text-[11px] text-ink-normal/50 dark:text-gray-400 font-bold text-center">
          * بر اساس حضورهای تأییدشده/در انتظار
        </div>
      </Card>
    </div>
  );
};
