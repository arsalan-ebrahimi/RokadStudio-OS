import React, { useMemo } from 'react';
import {
  AutoGrowTextarea,
  EditableTable,
  ErrorState,
  ExpandableTextCell,
  ProgressBar,
  Skeleton,
  StatusDotPill,
  UnitChip,
  INLINE_INPUT_CLASS,
  type EditableTableColumn,
} from '@/shared/ui';
import { cn } from '@/shared/lib/utils';
import { toPersianDigits } from '@/shared/lib/formatters';
import { useKpis, useBatchUpdateKpis } from '../hooks/use-scrum';
import type { KpiStatus, Scrum, ScrumKpi } from '../types/scrum-types';

interface KpiTabProps {
  scrum: Scrum;
  canEdit: boolean;
}

const KPI_STATUS_OPTIONS: { value: '' | KpiStatus; label: string }[] = [
  { value: '', label: 'نامشخص' },
  { value: 'BELOW_MIN', label: 'کمتر از انتظار' },
  { value: 'IN_RANGE', label: 'در محدوده' },
  { value: 'ON_TARGET', label: 'رسیده به هدف' },
];

export const KpiTab: React.FC<KpiTabProps> = ({ scrum, canEdit }) => {
  const { data: kpis = [], isLoading, isError, error, refetch } = useKpis(scrum.id);
  const updateMut = useBatchUpdateKpis(scrum.id);

  // Check if minExpected is present in the payload (only true for editor/SA)
  const hasMinExpected = useMemo(() => {
    return kpis.some((k) => 'minExpected' in k && k.minExpected !== undefined);
  }, [kpis]);

  const createEmptyRow = (): ScrumKpi => ({
    indicator: '',
    formula: '',
    strategicGoal: '',
    unit: '',
    firstMonthTarget: '',
    target: '',
    finalTarget: '',
    actualValue: null,
    progressPercent: null,
    status: null,
    minExpected: null,
  });

  const isRowEmpty = (r: ScrumKpi): boolean => {
    const fields = [
      r.indicator,
      r.formula,
      r.strategicGoal,
      r.unit,
      r.firstMonthTarget,
      r.target,
      r.finalTarget,
      r.actualValue,
      r.progressPercent,
      r.status,
      r.minExpected,
    ];
    return fields.every(
      (f) => f === undefined || f === null || f === '' || (typeof f === 'string' && f.trim() === '')
    );
  };

  const columns: EditableTableColumn<ScrumKpi>[] = useMemo(() => {
    const cols: EditableTableColumn<ScrumKpi>[] = [
      {
        id: 'indicator',
        header: 'شاخص',
        minWidth: '185px',
        isSticky: true,
        renderView: (row) => (
          <ExpandableTextCell
            text={row.indicator}
            className="font-bold text-sec dark:text-white"
          />
        ),
        renderEdit: (row, _index, onChange) => (
          <AutoGrowTextarea
            value={row.indicator || ''}
            onChange={(e) => onChange({ indicator: e.target.value })}
            placeholder="عنوان شاخص..."
            className="font-bold"
          />
        ),
      },
      {
        id: 'formula',
        header: 'فرمول محاسبه',
        minWidth: '200px',
        mobileFullWidth: true,
        renderView: (row) => (
          <ExpandableTextCell
            text={row.formula}
            className="text-sec/75 dark:text-gray-300 text-xs"
          />
        ),
        renderEdit: (row, _index, onChange) => (
          <AutoGrowTextarea
            value={row.formula || ''}
            onChange={(e) => onChange({ formula: e.target.value })}
            placeholder="مثال: A / B * 100"
          />
        ),
      },
      {
        id: 'strategicGoal',
        header: 'هدف استراتژیک',
        minWidth: '185px',
        mobileFullWidth: true,
        renderView: (row) => (
          <ExpandableTextCell
            text={row.strategicGoal}
            className="text-sec/75 dark:text-gray-300 text-xs"
          />
        ),
        renderEdit: (row, _index, onChange) => (
          <AutoGrowTextarea
            value={row.strategicGoal || ''}
            onChange={(e) => onChange({ strategicGoal: e.target.value })}
            placeholder="هدف کلان..."
          />
        ),
      },
      {
        id: 'firstMonthTarget',
        header: 'تارگت ماه اول',
        minWidth: '145px',
        renderView: (row) => (
          <ExpandableTextCell
            text={
              row.firstMonthTarget != null && row.firstMonthTarget !== ''
                ? toPersianDigits(row.firstMonthTarget)
                : null
            }
            className="text-sec/80 dark:text-gray-200 font-bold"
          />
        ),
        renderEdit: (row, _index, onChange) => (
          <AutoGrowTextarea
            value={row.firstMonthTarget ?? ''}
            onChange={(e) => onChange({ firstMonthTarget: e.target.value })}
            placeholder="مثال: ۷۰ درصد"
          />
        ),
      },
      {
        id: 'target',
        header: 'تارگت',
        minWidth: '145px',
        renderView: (row) => (
          <ExpandableTextCell
            text={row.target != null && row.target !== '' ? toPersianDigits(row.target) : null}
            className="font-black text-sec dark:text-white"
          />
        ),
        renderEdit: (row, _index, onChange) => (
          <AutoGrowTextarea
            value={row.target ?? ''}
            onChange={(e) => onChange({ target: e.target.value })}
            placeholder="مثال: ۸۵ درصد"
            className="font-bold"
          />
        ),
      },
      {
        id: 'finalTarget',
        header: 'تارگت نهایی',
        minWidth: '145px',
        renderView: (row) => (
          <ExpandableTextCell
            text={
              row.finalTarget != null && row.finalTarget !== ''
                ? toPersianDigits(row.finalTarget)
                : null
            }
            className="font-black text-sec dark:text-primary"
          />
        ),
        renderEdit: (row, _index, onChange) => (
          <AutoGrowTextarea
            value={row.finalTarget ?? ''}
            onChange={(e) => onChange({ finalTarget: e.target.value })}
            placeholder="مثال: ۱۰۰ درصد"
            className="font-bold"
          />
        ),
      },
      {
        id: 'actualValue',
        header: 'پیشرفت واقعی',
        minWidth: '115px',
        align: 'center',
        renderView: (row) =>
          row.actualValue != null ? (
            <span className="inline-flex items-center justify-center gap-1.5 font-black text-sec dark:text-white tabular-nums">
              <span>{toPersianDigits(row.actualValue)}</span>
              <UnitChip unit={row.unit} />
            </span>
          ) : (
            <span className="text-sec/35 dark:text-gray-500">—</span>
          ),
        renderEdit: (row, _index, onChange) => (
          <input
            type="number"
            step="any"
            value={row.actualValue ?? ''}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') {
                onChange({ actualValue: null });
                return;
              }
              const parsed = Number(raw);
              if (Number.isFinite(parsed)) {
                onChange({ actualValue: parsed });
              }
            }}
            placeholder="عدد"
            className={cn(INLINE_INPUT_CLASS, 'text-center tabular-nums font-bold')}
          />
        ),
      },
      {
        id: 'progressPercent',
        header: 'پیشرفت٪',
        minWidth: '140px',
        align: 'center',
        renderView: (row) =>
          row.progressPercent != null ? (
            <ProgressBar
              size="xs"
              value={row.progressPercent}
              max={100}
              showLabel
              status={
                row.status === 'BELOW_MIN'
                  ? 'danger'
                  : row.status === 'ON_TARGET'
                    ? 'success'
                    : 'warning'
              }
              aria-label={`درصد پیشرفت ${row.indicator || 'شاخص'}`}
            />
          ) : (
            <span className="text-sec/35 dark:text-gray-500">—</span>
          ),
        renderEdit: (row, _index, onChange) => (
          <div className="flex items-center justify-center gap-1">
            <input
              type="number"
              min={0}
              max={100}
              step="any"
              value={row.progressPercent ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                  onChange({ progressPercent: null });
                  return;
                }
                const parsed = Number(raw);
                if (Number.isFinite(parsed)) {
                  onChange({ progressPercent: parsed });
                }
              }}
              placeholder="۰ تا ۱۰۰"
              aria-label={`درصد پیشرفت ${row.indicator || 'شاخص'}`}
              className={cn(INLINE_INPUT_CLASS, 'text-center tabular-nums font-bold')}
            />
            <span className="text-xs font-bold text-sec/60 dark:text-gray-400 shrink-0">٪</span>
          </div>
        ),
      },
      {
        id: 'status',
        header: 'وضعیت',
        minWidth: '150px',
        align: 'center',
        renderView: (row) => {
          if (!row.status) return <span className="text-sec/35 dark:text-gray-500">—</span>;
          if (row.status === 'BELOW_MIN') {
            return <StatusDotPill tone="danger" label="کمتر از انتظار" />;
          }
          if (row.status === 'ON_TARGET') {
            return <StatusDotPill tone="success" label="رسیده به هدف" />;
          }
          return <StatusDotPill tone="warning" label="در محدوده" />;
        },
        renderEdit: (row, _index, onChange) => (
          <select
            value={row.status ?? ''}
            onChange={(e) => {
              const val = e.target.value as '' | KpiStatus;
              onChange({ status: val === '' ? null : val });
            }}
            aria-label={`وضعیت ${row.indicator || 'شاخص'}`}
            className={cn(INLINE_INPUT_CLASS, 'cursor-pointer font-bold')}
          >
            {KPI_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || 'EMPTY'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ),
      },
    ];

    // Conditionally append حداقل انتظار (minExpected) ONLY if present in payload or canEdit
    if (hasMinExpected || canEdit) {
      cols.push({
        id: 'minExpected',
        header: 'حداقل انتظار (محرمانه)',
        minWidth: '145px',
        align: 'center',
        renderView: (row) =>
          row.minExpected != null ? (
            <span className="inline-flex items-center justify-center gap-1.5 text-[#9C5700] dark:text-amber-300 font-bold tabular-nums">
              <span>{toPersianDigits(row.minExpected)}</span>
              <UnitChip unit={row.unit} />
            </span>
          ) : (
            <span className="text-sec/35 dark:text-gray-500">—</span>
          ),
        renderEdit: (row, _index, onChange, isLastCell, onTabLastCell) => (
          <input
            type="number"
            step="any"
            value={row.minExpected ?? ''}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') {
                onChange({ minExpected: null });
                return;
              }
              const parsed = Number(raw);
              if (Number.isFinite(parsed)) {
                onChange({ minExpected: parsed });
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Tab' && !e.shiftKey && isLastCell && onTabLastCell) {
                e.preventDefault();
                onTabLastCell();
              }
            }}
            placeholder="حداقل انتظار"
            className={cn(
              INLINE_INPUT_CLASS,
              'text-center tabular-nums text-[#9C5700] dark:text-amber-300 focus:border-college-normal'
            )}
          />
        ),
      });
    }

    return cols;
  }, [hasMinExpected, canEdit]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-sec/10 dark:border-gray-800">
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-52" />
            <Skeleton className="h-3.5 w-80 max-w-full" />
          </div>
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
        <div className="rounded-3xl border-[1.5px] border-sec dark:border-primary/40 bg-white dark:bg-[#121824] shadow-male dark:shadow-ecosystem overflow-hidden">
          <div className="h-12 bg-[#ECF7F5] dark:bg-[#182730] border-b border-sec/15 dark:border-white/10 px-4 flex items-center gap-6">
            <Skeleton className="h-3.5 w-8" />
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3.5 w-24 hidden sm:block" />
            <Skeleton className="h-3.5 w-20 hidden md:block" />
          </div>
          <div className="divide-y divide-sec/10 dark:divide-white/10">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="min-h-[56px] px-4 py-3 flex items-center justify-between gap-4">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-2 w-28 rounded-full hidden sm:block" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="خطا در دریافت جدول شاخص‌های کلیدی"
        message={error instanceof Error ? error.message : 'بارگذاری شاخص‌ها ناموفق بود.'}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <EditableTable<ScrumKpi>
      columns={columns}
      data={kpis}
      canEdit={canEdit}
      onSave={async (draft) => {
        await updateMut.mutateAsync(draft);
      }}
      createEmptyRow={createEmptyRow}
      isRowEmpty={isRowEmpty}
      title="شاخص‌های کلیدی عملکرد (KPI)"
      subtitle="جدول شاخص‌ها، تارگت‌ها و وضعیت پیشرفت اهداف استراتژیک اسکرام"
      emptyMessage="هنوز هیچ شاخص کلیدی (KPI) برای این اسکرام تعریف نشده است"
    />
  );
};
