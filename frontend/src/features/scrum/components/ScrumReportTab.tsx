import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, RotateCcw } from 'lucide-react';
import {
  Button,
  Card,
  DataTable,
  ErrorState,
  ExpandableTextCell,
  PersianDatePicker,
  Select,
  StatusDotPill,
  UnitChip,
  type DataTableColumn,
} from '@/shared/ui';
import { toPersianDigits, formatDurationToHoursMins } from '@/shared/lib/formatters';
import { useScrumReport, useScrumTasks, useSprints } from '../hooks/use-scrum';
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
    'نام تسک',
    'وضعیت تسک',
    'عضو',
    'تعداد مسئولین',
    'پوینت',
    'تعداد سشن',
    'مجموع زمان (دقیقه)',
    'زمان به ازای هر پوینت (دقیقه)',
  ];

  const lines = [headers.map(escapeCsv).join(',')];

  for (const r of rows) {
    const line = [
      escapeCsv(r.task.name),
      escapeCsv(r.task.isActive ? 'فعال' : 'غیرفعال'),
      escapeCsv(r.member?.name || 'تجمیعی'),
      escapeCsv(r.assignedMembersCount),
      escapeCsv(r.task.points),
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
  const { data: tasks = [] } = useScrumTasks(scrum.id);

  const [selectedSprintId, setSelectedSprintId] = useState<number | undefined>(undefined);
  const [selectedTaskId, setSelectedTaskId] = useState<number | undefined>(undefined);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const {
    data: report,
    isLoading,
    isError,
    error,
    refetch,
  } = useScrumReport(scrum.id, {
    sprintId: selectedSprintId,
    taskId: selectedTaskId,
    from: dateFrom || undefined,
    to: dateTo || undefined,
  });

  const rows = report?.rows || [];
  const total = report?.total || {
    totalTasks: 0,
    activeTasks: 0,
    totalPoints: 0,
    totalSeconds: 0,
    sessionCount: 0,
  };

  const hasFilters = Boolean(selectedSprintId || selectedTaskId || dateFrom || dateTo);

  const columns: DataTableColumn<ScrumReportRow>[] = useMemo(
    () => [
      {
        id: 'task',
        header: 'عنوان تسک',
        minWidth: '210px',
        isSticky: true,
        mobileFullWidth: true,
        cell: (row) => (
          <div className="space-y-1">
            <ExpandableTextCell
              text={row.task.name}
              className="font-bold text-sec dark:text-white"
            />
            {row.task.sprint && (
              <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-sec/[0.06] dark:bg-gray-800 text-sec/75 dark:text-gray-300 tabular-nums">
                {`S${toPersianDigits(row.task.sprint.number)} · ${row.task.sprint.title}`}
              </span>
            )}
          </div>
        ),
      },
      {
        id: 'member',
        header: 'عضو',
        minWidth: '150px',
        cell: (row) =>
          row.member?.name ? (
            <span className="font-bold text-sec dark:text-white">{row.member.name}</span>
          ) : (
            <span className="text-sec/55 dark:text-gray-400 font-bold">
              {row.assignedMembersCount > 0 ? 'سایر اعضا' : 'تجمیعی تسک'}
            </span>
          ),
      },
      {
        id: 'points',
        header: 'پوینت',
        minWidth: '95px',
        align: 'center',
        cell: (row) => (
          <span className="inline-flex items-center gap-1 font-black text-sec dark:text-white tabular-nums">
            <span>{toPersianDigits(row.task.points)}</span>
            <UnitChip unit="pt" />
          </span>
        ),
      },
      {
        id: 'status',
        header: 'وضعیت تسک',
        minWidth: '120px',
        align: 'center',
        cell: (row) =>
          row.task.isActive ? (
            <StatusDotPill tone="success" label="فعال" />
          ) : (
            <StatusDotPill tone="neutral" label="غیرفعال" />
          ),
      },
      {
        id: 'sessionCount',
        header: 'تعداد سشن',
        minWidth: '105px',
        align: 'center',
        cell: (row) => (
          <span className="font-bold text-sec dark:text-white tabular-nums">
            {toPersianDigits(row.sessionCount)}
          </span>
        ),
      },
      {
        id: 'totalSeconds',
        header: 'مجموع زمان',
        minWidth: '125px',
        align: 'center',
        cell: (row) => (
          <span className="font-mono font-black text-sec dark:text-primary tabular-nums">
            {formatDurationToHoursMins(row.totalSeconds)}
          </span>
        ),
      },
      {
        id: 'secondsPerPoint',
        header: 'زمان به ازای هر پوینت',
        minWidth: '155px',
        align: 'center',
        cell: (row) =>
          row.secondsPerPoint != null ? (
            <span className="font-mono font-bold text-sec/80 dark:text-gray-300 tabular-nums">
              {formatDurationToHoursMins(row.secondsPerPoint)}
            </span>
          ) : (
            <span className="text-sec/35 dark:text-gray-500">—</span>
          ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      {/* Filters bar */}
      <Card className="p-4 sm:p-5 rounded-3xl space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          {/* Task Filter */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-sec/80 dark:text-gray-300">
              فیلتر تسک
            </label>
            <Select
              value={selectedTaskId || ''}
              onChange={(e) =>
                setSelectedTaskId(e.target.value ? Number(e.target.value) : undefined)
              }
            >
              <option value="">همه تسک‌ها</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.isActive ? '' : ' (غیرفعال)'}
                </option>
              ))}
            </Select>
          </div>

          {/* Sprint Date Preset Filter */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-sec/80 dark:text-gray-300">
              بازه اسپرینت
            </label>
            <Select
              value={selectedSprintId || ''}
              onChange={(e) =>
                setSelectedSprintId(e.target.value ? Number(e.target.value) : undefined)
              }
            >
              <option value="">همه بازه‌ها</option>
              {sprints.map((s) => (
                <option key={s.id} value={s.id}>
                  اسپرینت {toPersianDigits(s.number)} ({s.title})
                </option>
              ))}
            </Select>
          </div>

          {/* Date From */}
          <PersianDatePicker
            label="از تاریخ"
            value={dateFrom}
            onChange={(d) => setDateFrom(d)}
            allowStep={false}
          />

          {/* Date To */}
          <PersianDatePicker
            label="تا تاریخ"
            value={dateTo}
            onChange={(d) => setDateTo(d)}
            allowStep={false}
          />

          {/* Export CSV button */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => exportScrumReportCsv(rows, scrum.name)}
              disabled={rows.length === 0 || isError}
              className="w-full text-xs font-bold gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#009966]" />
              <span>خروجی اکسل (CSV)</span>
            </Button>
          </div>
        </div>

        {hasFilters && (
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => {
                setSelectedSprintId(undefined);
                setSelectedTaskId(undefined);
                setDateFrom('');
                setDateTo('');
              }}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-sec/70 dark:text-gray-300 hover:text-sec dark:hover:text-white cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>پاک کردن همه فیلترها</span>
            </button>
          </div>
        )}
      </Card>

      {isError ? (
        <ErrorState
          title="خطا در دریافت گزارش اسکرام"
          message={error instanceof Error ? error.message : 'دریافت گزارش عملکرد انجام نشد.'}
          onRetry={() => refetch()}
        />
      ) : (
        <>
          {/* Overview Aggregates */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4 rounded-3xl text-center space-y-1">
              <span className="block text-[11px] text-sec/60 dark:text-gray-400 font-bold">
                تعداد تسک‌ها
              </span>
              <span className="text-xl sm:text-2xl font-black text-sec dark:text-white tabular-nums block">
                {toPersianDigits(total.totalTasks)}
              </span>
              <span className="block text-[10px] font-bold text-[#007A52] dark:text-emerald-400 tabular-nums">
                {toPersianDigits(total.activeTasks)} فعال
              </span>
            </Card>

            <Card className="p-4 rounded-3xl text-center space-y-1">
              <span className="block text-[11px] text-sec/60 dark:text-gray-400 font-bold">
                مجموع پوینت تسک‌ها
              </span>
              <span className="text-xl sm:text-2xl font-black text-sec dark:text-white tabular-nums block">
                {toPersianDigits(total.totalPoints)}
              </span>
            </Card>

            <Card className="p-4 rounded-3xl text-center space-y-1">
              <span className="block text-[11px] text-sec/60 dark:text-gray-400 font-bold">
                مجموع زمان ثبت‌شده
              </span>
              <span className="text-lg sm:text-xl xl:text-2xl leading-snug font-black text-sec dark:text-white font-mono tabular-nums block">
                {formatDurationToHoursMins(total.totalSeconds)}
              </span>
            </Card>

            <Card className="p-4 rounded-3xl text-center space-y-1">
              <span className="block text-[11px] text-sec/60 dark:text-gray-400 font-bold">
                تعداد سشن‌های کاری
              </span>
              <span className="text-xl sm:text-2xl font-black text-sec dark:text-primary tabular-nums block">
                {toPersianDigits(total.sessionCount)}
              </span>
            </Card>
          </div>

          {/* Modern DataTable */}
          <DataTable<ScrumReportRow>
            columns={columns}
            data={rows}
            getRowKey={(row, idx) => `${row.task.id}_${row.member?.id ?? 'none'}_${idx}`}
            isLoading={isLoading}
            emptyTitle="هیچ داده‌ای مطابق فیلترهای انتخابی یافت نشد"
            emptyDescription="بازه تاریخ یا فیلتر تسک و اسپرینت را تغییر دهید تا داده‌های مرتبط نمایش داده شوند."
            footnote="* بر اساس سشن‌های کاری تأییدشده / در انتظار"
          />
        </>
      )}
    </div>
  );
};
