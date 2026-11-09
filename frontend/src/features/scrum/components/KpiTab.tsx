import React, { useMemo } from 'react';
import { EditableTable, type EditableTableColumn } from '@/shared/ui/EditableTable';
import { toPersianDigits } from '@/shared/lib/formatters';
import { useKpis, useBatchUpdateKpis } from '../hooks/use-scrum';
import type { ScrumKpi, Scrum } from '../types/scrum-types';

interface KpiTabProps {
  scrum: Scrum;
  canEdit: boolean;
}

export const KpiTab: React.FC<KpiTabProps> = ({ scrum, canEdit }) => {
  const { data: kpis = [], isLoading } = useKpis(scrum.id);
  const updateMut = useBatchUpdateKpis(scrum.id);

  // Check if minExpected is present in the payload (only true for owner/SA)
  const hasMinExpected = useMemo(() => {
    return kpis.some((k) => 'minExpected' in k && k.minExpected !== undefined);
  }, [kpis]);

  const createEmptyRow = (): ScrumKpi => ({
    indicator: '',
    formula: '',
    strategicGoal: '',
    unit: '',
    target: null,
    firstMonthTarget: null,
    actualValue: null,
    minExpected: null,
  });

  const isRowEmpty = (r: ScrumKpi): boolean => {
    const fields = [
      r.indicator,
      r.formula,
      r.strategicGoal,
      r.unit,
      r.target,
      r.firstMonthTarget,
      r.actualValue,
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
        width: '180px',
        isSticky: true,
        renderView: (row) => (
          <span className="font-bold text-sec dark:text-white">
            {row.indicator || '—'}
          </span>
        ),
        renderEdit: (row, _index, onChange) => (
          <input
            type="text"
            value={row.indicator || ''}
            onChange={(e) => onChange({ indicator: e.target.value })}
            placeholder="عنوان شاخص..."
            className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#182030] text-sec dark:text-white"
          />
        ),
      },
      {
        id: 'formula',
        header: 'فرمول محاسبه',
        width: '180px',
        renderView: (row) => (
          <span className="text-ink-normal/70 dark:text-gray-300 text-[11px]">
            {row.formula || '—'}
          </span>
        ),
        renderEdit: (row, _index, onChange) => (
          <input
            type="text"
            value={row.formula || ''}
            onChange={(e) => onChange({ formula: e.target.value })}
            placeholder="مثال: A / B * 100"
            className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#182030] text-sec dark:text-white"
          />
        ),
      },
      {
        id: 'target',
        header: 'تارگت',
        width: '100px',
        renderView: (row) => (
          <span className="font-black text-sec dark:text-white">
            {row.target != null ? `${toPersianDigits(row.target)} ${row.unit || ''}` : '—'}
          </span>
        ),
        renderEdit: (row, _index, onChange) => (
          <input
            type="number"
            step="any"
            value={row.target ?? ''}
            onChange={(e) => onChange({ target: e.target.value ? Number(e.target.value) : null })}
            placeholder="عدد"
            className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#182030] text-sec dark:text-white"
          />
        ),
      },
      {
        id: 'strategicGoal',
        header: 'هدف استراتژیک',
        width: '160px',
        renderView: (row) => (
          <span className="text-ink-normal/70 dark:text-gray-300 text-[11px]">
            {row.strategicGoal || '—'}
          </span>
        ),
        renderEdit: (row, _index, onChange) => (
          <input
            type="text"
            value={row.strategicGoal || ''}
            onChange={(e) => onChange({ strategicGoal: e.target.value })}
            placeholder="هدف کلان..."
            className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#182030] text-sec dark:text-white"
          />
        ),
      },
      {
        id: 'firstMonthTarget',
        header: 'تارگت ماه اول',
        width: '110px',
        renderView: (row) => (
          <span className="text-ink-normal/80 dark:text-gray-300">
            {row.firstMonthTarget != null ? toPersianDigits(row.firstMonthTarget) : '—'}
          </span>
        ),
        renderEdit: (row, _index, onChange) => (
          <input
            type="number"
            step="any"
            value={row.firstMonthTarget ?? ''}
            onChange={(e) =>
              onChange({ firstMonthTarget: e.target.value ? Number(e.target.value) : null })
            }
            placeholder="عدد"
            className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#182030] text-sec dark:text-white"
          />
        ),
      },
      {
        id: 'actualValue',
        header: 'پیشرفت واقعی',
        width: '110px',
        renderView: (row) => (
          <span className="font-bold text-sec dark:text-white">
            {row.actualValue != null ? toPersianDigits(row.actualValue) : '—'}
          </span>
        ),
        renderEdit: (row, _index, onChange) => (
          <input
            type="number"
            step="any"
            value={row.actualValue ?? ''}
            onChange={(e) =>
              onChange({ actualValue: e.target.value ? Number(e.target.value) : null })
            }
            placeholder="عدد"
            className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#182030] text-sec dark:text-white"
          />
        ),
      },
      {
        id: 'progressPercent',
        header: 'پیشرفت٪',
        width: '90px',
        renderView: (row) => (
          <span className="font-black text-primary">
            {row.progressPercent != null
              ? `${toPersianDigits(row.progressPercent.toFixed(1))}٪`
              : '—'}
          </span>
        ),
        renderEdit: (row) => (
          <span className="text-[11px] font-bold text-ink-normal/50 dark:text-gray-400">
            {row.progressPercent != null
              ? `${toPersianDigits(row.progressPercent.toFixed(1))}٪`
              : 'محاسبه خودکار'}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'وضعیت',
        width: '110px',
        renderView: (row) => {
          if (!row.status) return <span className="text-gray-400">—</span>;
          if (row.status === 'BELOW_MIN') {
            return (
              <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300">
                کمتر از انتظار
              </span>
            );
          }
          if (row.status === 'ON_TARGET') {
            return (
              <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300">
                رسیده به هدف
              </span>
            );
          }
          return (
            <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300">
              در محدوده
            </span>
          );
        },
        renderEdit: () => (
          <span className="text-[11px] font-bold text-ink-normal/50 dark:text-gray-400">
            محاسبه خودکار
          </span>
        ),
      },
    ];

    // Conditionally append حداقل انتظار (minExpected) ONLY if present in payload or canEdit
    if (hasMinExpected || canEdit) {
      cols.push({
        id: 'minExpected',
        header: 'حداقل انتظار (محرمانه)',
        width: '130px',
        renderView: (row) => (
          <span className="text-amber-600 dark:text-amber-400 font-bold">
            {row.minExpected != null ? toPersianDigits(row.minExpected) : '—'}
          </span>
        ),
        renderEdit: (row, _index, onChange, isLastCell, onTabLastCell) => (
          <input
            type="number"
            step="any"
            value={row.minExpected ?? ''}
            onChange={(e) =>
              onChange({ minExpected: e.target.value ? Number(e.target.value) : null })
            }
            onKeyDown={(e) => {
              if (e.key === 'Tab' && !e.shiftKey && isLastCell && onTabLastCell) {
                e.preventDefault();
                onTabLastCell();
              }
            }}
            placeholder="حداقل انتظار"
            className="w-full px-2 py-1 text-xs rounded border border-amber-300 dark:border-amber-700 bg-white dark:bg-[#182030] text-amber-700 dark:text-amber-300"
          />
        ),
      });
    }

    return cols;
  }, [hasMinExpected, canEdit]);

  if (isLoading) {
    return (
      <div className="py-12 text-center text-xs font-bold text-ink-normal/50 dark:text-gray-400 animate-pulse">
        در حال بارگذاری شاخص‌های کلیدی...
      </div>
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
