import React, { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/shared/ui';
import { EditableTable, type EditableTableColumn } from '@/shared/ui/EditableTable';
import { PersianDatePicker } from '@/shared/ui/PersianDatePicker';
import { toPersianDigits } from '@/shared/lib/formatters';
import { useEvents, useBatchUpdateEvents } from '../hooks/use-scrum';
import type { ScrumEvent, Scrum, EventScheduleType } from '../types/scrum-types';

interface EventsTabProps {
  scrum: Scrum;
  canEdit: boolean;
}

const PERSIAN_WEEKDAYS = [
  { value: 0, label: 'شنبه' },
  { value: 1, label: 'یکشنبه' },
  { value: 2, label: 'دوشنبه' },
  { value: 3, label: 'سه‌شنبه' },
  { value: 4, label: 'چهارشنبه' },
  { value: 5, label: 'پنج‌شنبه' },
  { value: 6, label: 'جمعه' },
];

const STANDARD_CEREMONIES_TEMPLATE: ScrumEvent[] = [
  {
    name: 'دیلی اسکرام (Daily Scrum)',
    scheduleType: 'WEEKLY',
    dayOfWeek: 0,
    startTime: '09:30',
    durationMinutes: 15,
    inputs: 'کارهای دیروز، برنامه‌های امروز، موانع و چالش‌ها',
    outputs: 'همگامی و هماهنگی روزانه اعضای تیم',
  },
  {
    name: 'برنامه‌ریزی اسپرینت (Sprint Planning)',
    scheduleType: 'WEEKLY',
    dayOfWeek: 0,
    startTime: '10:00',
    durationMinutes: 60,
    inputs: 'بک‌لاگ محصول، ظرفیت تیم، اهداف کلان',
    outputs: 'هدف اسپرینت (Sprint Goal) و تسک‌های متعهد شده',
  },
  {
    name: 'پالایش بک‌لاگ (Backlog Refinement)',
    scheduleType: 'WEEKLY',
    dayOfWeek: 2,
    startTime: '14:00',
    durationMinutes: 45,
    inputs: 'ایده‌ها، نیازمندی‌ها و درخواست‌های جدید',
    outputs: 'تسک‌های شفاف، دارای جزئیات و تخمین پوینت',
  },
  {
    name: 'بررسی اسپرینت (Sprint Review / Demo)',
    scheduleType: 'WEEKLY',
    dayOfWeek: 4,
    startTime: '15:00',
    durationMinutes: 45,
    inputs: 'خروجی‌های انجام‌شده و قابلیت‌های آماده ارائه',
    outputs: 'بازخورد ذینفعان و بروزرسانی بک‌لاگ',
  },
  {
    name: 'بازنگری اسپرینت (Sprint Retrospective)',
    scheduleType: 'WEEKLY',
    dayOfWeek: 4,
    startTime: '16:00',
    durationMinutes: 45,
    inputs: 'تجربیات تیم، فرآیندها و چالش‌های اسپرینت گذشته',
    outputs: 'برنامه بهبود عملیاتی برای اسپرینت آینده',
  },
];

export const EventsTab: React.FC<EventsTabProps> = ({ scrum, canEdit }) => {
  const { data: events = [], isLoading } = useEvents(scrum.id);
  const updateMut = useBatchUpdateEvents(scrum.id);

  const createEmptyRow = (): ScrumEvent => ({
    name: '',
    scheduleType: 'WEEKLY',
    dayOfWeek: 0,
    date: null,
    startTime: '09:00',
    durationMinutes: 30,
    inputs: '',
    outputs: '',
  });

  const isRowEmpty = (r: ScrumEvent): boolean => {
    const fields = [
      r.name,
      r.startTime,
      r.inputs,
      r.outputs,
    ];
    return fields.every(
      (f) => f === undefined || f === null || f === '' || (typeof f === 'string' && f.trim() === '')
    );
  };

  const columns: EditableTableColumn<ScrumEvent>[] = useMemo(() => [
    {
      id: 'name',
      header: 'رویداد',
      width: '180px',
      isSticky: true,
      renderView: (row) => (
        <span className="font-bold text-sec dark:text-white">
          {row.name || '—'}
        </span>
      ),
      renderEdit: (row, _index, onChange) => (
        <input
          type="text"
          value={row.name || ''}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="عنوان رویداد..."
          className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#182030] text-sec dark:text-white"
        />
      ),
    },
    {
      id: 'schedule',
      header: 'زمان برگزاری',
      width: '260px',
      renderView: (row) => {
        const timeStr = row.startTime ? `، ساعت ${toPersianDigits(row.startTime)}` : '';
        if (row.scheduleType === 'WEEKLY') {
          const wd = PERSIAN_WEEKDAYS.find((w) => w.value === row.dayOfWeek)?.label || 'نامشخص';
          return (
            <span className="text-ink-normal/80 dark:text-gray-300 font-bold">
              هفتگی ({wd}){timeStr}
            </span>
          );
        }
        return (
          <span className="text-ink-normal/80 dark:text-gray-300 font-bold">
            یکباره ({row.date ? toPersianDigits(row.date) : 'تعیین نشده'}){timeStr}
          </span>
        );
      },
      renderEdit: (row, _index, onChange) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Toggle Type */}
          <select
            value={row.scheduleType}
            onChange={(e) =>
              onChange({
                scheduleType: e.target.value as EventScheduleType,
                dayOfWeek: e.target.value === 'WEEKLY' ? (row.dayOfWeek ?? 0) : null,
                date: e.target.value === 'ONCE' ? row.date : null,
              })
            }
            className="text-[11px] font-bold px-1.5 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#182030]"
          >
            <option value="WEEKLY">هفتگی</option>
            <option value="ONCE">یکبار</option>
          </select>

          {/* Weekday or Date picker */}
          {row.scheduleType === 'WEEKLY' ? (
            <select
              value={row.dayOfWeek ?? 0}
              onChange={(e) => onChange({ dayOfWeek: Number(e.target.value) })}
              className="text-[11px] font-bold px-1.5 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#182030]"
            >
              {PERSIAN_WEEKDAYS.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>
          ) : (
            <div className="w-28">
              <PersianDatePicker
                value={row.date || ''}
                onChange={(d) => onChange({ date: d })}
                allowStep={false}
              />
            </div>
          )}

          {/* Time input */}
          <input
            type="text"
            value={row.startTime || ''}
            onChange={(e) => onChange({ startTime: e.target.value })}
            placeholder="09:30"
            className="w-16 px-1.5 py-1 text-xs text-center font-mono rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#182030]"
          />
        </div>
      ),
    },
    {
      id: 'durationMinutes',
      header: 'مدت',
      width: '100px',
      renderView: (row) => (
        <span className="text-sec dark:text-white font-bold">
          {row.durationMinutes != null ? `${toPersianDigits(row.durationMinutes)} دقیقه` : '—'}
        </span>
      ),
      renderEdit: (row, _index, onChange) => (
        <div className="flex items-center gap-1">
          <input
            type="number"
            min="1"
            max="1440"
            value={row.durationMinutes ?? ''}
            onChange={(e) =>
              onChange({ durationMinutes: e.target.value ? Number(e.target.value) : null })
            }
            placeholder="دقیقه"
            className="w-16 px-2 py-1 text-xs text-center rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#182030]"
          />
          <span className="text-[10px] text-gray-500">دقیقه</span>
        </div>
      ),
    },
    {
      id: 'inputs',
      header: 'ورودی جلسه',
      width: '200px',
      renderView: (row) => (
        <span className="text-ink-normal/70 dark:text-gray-300 text-[11px] line-clamp-2">
          {row.inputs || '—'}
        </span>
      ),
      renderEdit: (row, _index, onChange) => (
        <input
          type="text"
          value={row.inputs || ''}
          onChange={(e) => onChange({ inputs: e.target.value })}
          placeholder="ورودی‌های جلسه..."
          className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#182030] text-sec dark:text-white"
        />
      ),
    },
    {
      id: 'outputs',
      header: 'خروجی جلسه',
      width: '200px',
      renderView: (row) => (
        <span className="text-ink-normal/70 dark:text-gray-300 text-[11px] line-clamp-2">
          {row.outputs || '—'}
        </span>
      ),
      renderEdit: (row, _index, onChange, isLastCell, onTabLastCell) => (
        <input
          type="text"
          value={row.outputs || ''}
          onChange={(e) => onChange({ outputs: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Tab' && !e.shiftKey && isLastCell && onTabLastCell) {
              e.preventDefault();
              onTabLastCell();
            }
          }}
          placeholder="خروجی‌های مورد انتظار..."
          className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#182030] text-sec dark:text-white"
        />
      ),
    },
  ], []);

  const handleApplyStandardTemplate = async () => {
    // Appends standard rows without overwriting existing rows
    const merged = [...events, ...STANDARD_CEREMONIES_TEMPLATE];
    await updateMut.mutateAsync(merged);
  };

  if (isLoading) {
    return (
      <div className="py-12 text-center text-xs font-bold text-ink-normal/50 dark:text-gray-400 animate-pulse">
        در حال بارگذاری ریتم جلسات...
      </div>
    );
  }

  const templateButton = (
    <Button
      variant="outline"
      size="sm"
      type="button"
      onClick={handleApplyStandardTemplate}
      isLoading={updateMut.isPending}
      className="text-xs font-bold gap-1.5 shadow-hard-sm border-primary/40 text-primary"
    >
      <Sparkles className="w-3.5 h-3.5" />
      <span>پر کردن با قالب استاندارد اسکرام</span>
    </Button>
  );

  return (
    <EditableTable<ScrumEvent>
      columns={columns}
      data={events}
      canEdit={canEdit}
      onSave={async (draft) => {
        await updateMut.mutateAsync(draft);
      }}
      createEmptyRow={createEmptyRow}
      isRowEmpty={isRowEmpty}
      title="ریتم و تقویم رویدادهای اسکرام"
      subtitle="تنظیم جلسات دوره‌ای تیم (دیلی، پلنینگ، رترو، دموی اسپرینت) به همراه ورودی و خروجی‌ها"
      emptyMessage="هنوز هیچ جلسه‌ای برای این اسکرام تنظیم نشده است"
      extraHeaderActions={templateButton}
    />
  );
};
