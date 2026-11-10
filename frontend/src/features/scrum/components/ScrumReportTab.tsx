import React, { useMemo, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import {
  Badge,
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
    'نوع',
    'نام عضو',
    'عنوان',
    'پروژه مرتبط',
    'اسپرینت',
    'وضعیت',
    'پوینت',
    'تعداد سشن',
    'مجموع زمان (دقیقه)',
    'زمان به ازای هر پوینت (دقیقه)',
  ];

  const lines = [headers.map(escapeCsv).join(',')];

  for (const r of rows) {
    const isProjectRow = r.kind === 'PROJECT';
    const typeLabel = isProjectRow ? 'پروژه' : 'آیتم اسپرینت';
    const title = isProjectRow ? r.project?.name || '-' : r.item?.name || '-';
    const linkedProject = r.project?.name || '-';
    const sprintLabel = r.item?.sprint ? `اسپرینت ${r.item.sprint.number}` : '-';
    const statusLabel = r.item
      ? r.item.status === 'DONE'
        ? 'انجام‌شده'
        : r.item.status === 'DOING'
          ? 'در حال انجام'
          : 'در انتظار'
      : '-';

    const line = [
      escapeCsv(typeLabel),
      escapeCsv(r.member?.name || 'بدون مسئول'),
      escapeCsv(title),
      escapeCsv(linkedProject),
      escapeCsv(sprintLabel),
      escapeCsv(statusLabel),
      escapeCsv(r.item ? r.item.points : '-'),
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

  const {
    data: report,
    isLoading,
    isError,
    error,
    refetch,
  } = useScrumReport(scrum.id, {
    sprintId: selectedSprintId,
    from: dateFrom || undefined,
    to: dateTo || undefined,
  });

  const rows = report?.rows || [];
  const total = report?.total || { totalPoints: 0, donePoints: 0, totalSeconds: 0, sessionCount: 0 };

  const columns: DataTableColumn<ScrumReportRow>[] = useMemo(
    () => [
      {
        id: 'member',
        header: 'عضو',
        minWidth: '150px',
        isSticky: true,
        cell: (row) =>
          row.member?.name ? (
            <span className="font-bold text-sec dark:text-white">{row.member.name}</span>
          ) : (
            <span className="text-sec/45 dark:text-gray-400 font-bold">بدون مسئول</span>
          ),
      },
      {
        id: 'kind',
        header: 'نوع',
        minWidth: '130px',
        cell: (row) => {
          const isProjectRow = row.kind === 'PROJECT';
          return (
            <Badge dot variant={isProjectRow ? 'college' : 'ecosystem'}>
              {isProjectRow ? 'پروژه' : 'آیتم اسپرینت'}
            </Badge>
          );
        },
      },
      {
        id: 'title',
        header: 'عنوان تسک / پروژه',
        minWidth: '220px',
        mobileFullWidth: true,
        cell: (row) => {
          const isProjectRow = row.kind === 'PROJECT';
          const title = isProjectRow ? row.project?.name || '—' : row.item?.name || '—';
          return (
            <div className="space-y-0.5 min-w-0">
              <ExpandableTextCell
                text={title}
                className="font-bold text-sec dark:text-white"
              />
              {!isProjectRow && row.project && (
                <span className="block text-[11px] font-semibold text-sec/55 dark:text-gray-400">
                  پروژه: {row.project.name}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'sprint',
        header: 'اسپرینت',
        minWidth: '170px',
        cell: (row) =>
          row.item?.sprint ? (
            <span className="text-sec/75 dark:text-gray-300 font-bold">
              <span className="font-mono font-black text-sec dark:text-primary me-1">
                S{toPersianDigits(row.item.sprint.number)}
              </span>
              · {row.item.sprint.title}
            </span>
          ) : (
            <span className="text-sec/35 dark:text-gray-500">—</span>
          ),
      },
      {
        id: 'points',
        header: 'پوینت',
        minWidth: '95px',
        align: 'center',
        cell: (row) =>
          row.item ? (
            <span className="inline-flex items-center gap-1 font-black text-sec dark:text-white tabular-nums">
              <span>{toPersianDigits(row.item.points)}</span>
              <UnitChip unit="pt" />
            </span>
          ) : (
            <span className="text-sec/35 dark:text-gray-500">—</span>
          ),
      },
      {
        id: 'status',
        header: 'وضعیت',
        minWidth: '130px',
        align: 'center',
        cell: (row) => {
          if (!row.item) return <span className="text-sec/35 dark:text-gray-500">—</span>;
          if (row.item.status === 'DONE') {
            return <StatusDotPill tone="success" label="انجام‌شده" />;
          }
          if (row.item.status === 'DOING') {
            return <StatusDotPill tone="warning" label="در حال انجام" />;
          }
          return <StatusDotPill tone="neutral" label="در انتظار" />;
        },
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
      <Card className="p-4 sm:p-5 rounded-3xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          {/* Sprint Filter */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-sec/80 dark:text-gray-300">
              انتخاب اسپرینت
            </label>
            <Select
              value={selectedSprintId || ''}
              onChange={(e) =>
                setSelectedSprintId(e.target.value ? Number(e.target.value) : undefined)
              }
            >
              <option value="">همه اسپرینت‌ها و پروژه‌ها</option>
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
          <div>
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
                کل پوینت‌ها
              </span>
              <span className="text-xl sm:text-2xl font-black text-sec dark:text-white tabular-nums block">
                {toPersianDigits(total.totalPoints)}
              </span>
            </Card>

            <Card className="p-4 rounded-3xl text-center space-y-1">
              <span className="block text-[11px] text-sec/60 dark:text-gray-400 font-bold">
                پوینت‌های انجام‌شده
              </span>
              <span className="text-xl sm:text-2xl font-black text-[#007A52] dark:text-emerald-400 tabular-nums block">
                {toPersianDigits(total.donePoints)}
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
            getRowKey={(row, idx) =>
              `${row.kind}_${row.item?.id ?? row.project?.id ?? idx}_${row.member?.id ?? 'none'}_${idx}`
            }
            isLoading={isLoading}
            emptyTitle="هیچ داده‌ای مطابق فیلترهای انتخابی یافت نشد"
            emptyDescription="بازه تاریخ یا اسپرینت انتخابی را تغییر دهید تا داده‌های مرتبط نمایش داده شوند."
            footnote="* بر اساس سشن‌های کاری تأییدشده / در انتظار"
          />
        </>
      )}
    </div>
  );
};
