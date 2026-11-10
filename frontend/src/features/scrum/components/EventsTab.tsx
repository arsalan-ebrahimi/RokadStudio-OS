import React, { useMemo } from 'react';
import { Clock, Sparkles } from 'lucide-react';
import {
  AutoGrowTextarea,
  Badge,
  Button,
  EditableTable,
  ErrorState,
  ExpandableTextCell,
  PersianDatePicker,
  Skeleton,
  UnitChip,
  INLINE_INPUT_CLASS,
  type EditableTableColumn,
} from '@/shared/ui';
import { cn } from '@/shared/lib/utils';
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
  const { data: events = [], isLoading, isError, error, refetch } = useEvents(scrum.id);
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
    const fields = [r.name, r.startTime, r.inputs, r.outputs];
    return fields.every(
      (f) => f === undefined || f === null || f === '' || (typeof f === 'string' && f.trim() === '')
    );
  };

  const columns: EditableTableColumn<ScrumEvent>[] = useMemo(() => [
    {
      id: 'name',
      header: 'رویداد',
      minWidth: '165px',
      isSticky: true,
      renderView: (row) => (
        <ExpandableTextCell
          text={row.name}
          className="font-bold text-sec dark:text-white"
        />
      ),
      renderEdit: (row, _index, onChange) => (
        <AutoGrowTextarea
          value={row.name || ''}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="عنوان رویداد..."
          className="font-bold"
        />
      ),
    },
    {
      id: 'schedule',
      header: 'زمان برگزاری',
      minWidth: '210px',
      mobileFullWidth: true,
      renderView: (row) => {
        const isWeekly = row.scheduleType === 'WEEKLY';
        const scheduleLabel = isWeekly
          ? `هفتگی (${PERSIAN_WEEKDAYS.find((w) => w.value === row.dayOfWeek)?.label || 'نامشخص'})`
          : `یکباره (${row.date ? toPersianDigits(row.date) : 'تعیین نشده'})`;

        return (
          <div className="flex items-center gap-2 flex-wrap">
            <Badge dot variant={isWeekly ? 'ecosystem' : 'college'}>
              {scheduleLabel}
            </Badge>
            {row.startTime && (
              <span className="inline-flex items-center gap-1 text-xs font-mono font-black text-sec dark:text-white tabular-nums">
                <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>{toPersianDigits(row.startTime)}</span>
              </span>
            )}
          </div>
        );
      },
      renderEdit: (row, _index, onChange) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <select
            value={row.scheduleType}
            onChange={(e) =>
              onChange({
                scheduleType: e.target.value as EventScheduleType,
                dayOfWeek: e.target.value === 'WEEKLY' ? row.dayOfWeek ?? 0 : null,
                date: e.target.value === 'ONCE' ? row.date : null,
              })
            }
            aria-label="نوع تکرار رویداد"
            className={cn(
              INLINE_INPUT_CLASS,
              'w-auto bg-white/80 dark:bg-[#182030] border-sec/20 dark:border-gray-700 font-bold cursor-pointer'
            )}
          >
            <option value="WEEKLY">هفتگی</option>
            <option value="ONCE">یکبار</option>
          </select>

          {row.scheduleType === 'WEEKLY' ? (
            <select
              value={row.dayOfWeek ?? 0}
              onChange={(e) => onChange({ dayOfWeek: Number(e.target.value) })}
              aria-label="روز هفته"
              className={cn(
                INLINE_INPUT_CLASS,
                'w-auto bg-white/80 dark:bg-[#182030] border-sec/20 dark:border-gray-700 font-bold cursor-pointer'
              )}
            >
              {PERSIAN_WEEKDAYS.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>
          ) : (
            <PersianDatePicker
              size="md"
              value={row.date || ''}
              onChange={(d) => onChange({ date: d })}
              allowStep={false}
            />
          )}

          <input
            type="text"
            value={row.startTime || ''}
            onChange={(e) => onChange({ startTime: e.target.value })}
            placeholder="09:30"
            dir="ltr"
            aria-label="ساعت شروع"
            className={cn(
              INLINE_INPUT_CLASS,
              'w-20 text-center font-mono font-bold tabular-nums bg-white/80 dark:bg-[#182030] border-sec/20 dark:border-gray-700'
            )}
          />
        </div>
      ),
    },
    {
      id: 'durationMinutes',
      header: 'مدت',
      minWidth: '95px',
      align: 'center',
      renderView: (row) =>
        row.durationMinutes != null ? (
          <span className="inline-flex items-center justify-center gap-1.5 text-sec dark:text-white font-bold tabular-nums">
            <span>{toPersianDigits(row.durationMinutes)}</span>
            <UnitChip unit="دقیقه" />
          </span>
        ) : (
          <span className="text-sec/35 dark:text-gray-500">—</span>
        ),
      renderEdit: (row, _index, onChange) => (
        <div className="flex items-center justify-center gap-1.5">
          <input
            type="number"
            min="1"
            max="1440"
            value={row.durationMinutes ?? ''}
            onChange={(e) =>
              onChange({ durationMinutes: e.target.value ? Number(e.target.value) : null })
            }
            placeholder="۳۰"
            className={cn(INLINE_INPUT_CLASS, 'w-20 text-center tabular-nums font-bold')}
          />
          <UnitChip unit="دقیقه" />
        </div>
      ),
    },
    {
      id: 'inputs',
      header: 'ورودی جلسه',
      minWidth: '175px',
      mobileFullWidth: true,
      renderView: (row) => (
        <ExpandableTextCell
          text={row.inputs}
          className="text-sec/75 dark:text-gray-300 text-xs"
        />
      ),
      renderEdit: (row, _index, onChange) => (
        <AutoGrowTextarea
          value={row.inputs || ''}
          onChange={(e) => onChange({ inputs: e.target.value })}
          placeholder="ورودی‌های جلسه..."
        />
      ),
    },
    {
      id: 'outputs',
      header: 'خروجی جلسه',
      minWidth: '175px',
      mobileFullWidth: true,
      renderView: (row) => (
        <ExpandableTextCell
          text={row.outputs}
          className="text-sec/75 dark:text-gray-300 text-xs"
        />
      ),
      renderEdit: (row, _index, onChange, isLastCell, onTabLastCell) => (
        <AutoGrowTextarea
          value={row.outputs || ''}
          onChange={(e) => onChange({ outputs: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Tab' && !e.shiftKey && isLastCell && onTabLastCell) {
              e.preventDefault();
              onTabLastCell();
            }
          }}
          placeholder="خروجی‌های مورد انتظار..."
        />
      ),
    },
  ], []);

  const handleApplyStandardTemplate = async () => {
    try {
      const merged = [...events, ...STANDARD_CEREMONIES_TEMPLATE];
      await updateMut.mutateAsync(merged);
    } catch {
      // Handled by hook toast
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-sec/10 dark:border-gray-800">
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-52" />
            <Skeleton className="h-3.5 w-80 max-w-full" />
          </div>
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
        <div className="rounded-3xl border-[1.5px] border-sec dark:border-primary/40 bg-white dark:bg-[#121824] shadow-male dark:shadow-ecosystem overflow-hidden">
          <div className="h-12 bg-[#ECF7F5] dark:bg-[#182730] border-b border-sec/15 dark:border-white/10 px-4 flex items-center gap-6">
            <Skeleton className="h-3.5 w-8" />
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3.5 w-32 hidden sm:block" />
            <Skeleton className="h-3.5 w-24 hidden md:block" />
          </div>
          <div className="divide-y divide-sec/10 dark:divide-white/10">
            {[1, 2, 3].map((i) => (
              <div key={i} className="min-h-[56px] px-4 py-3 flex items-center justify-between gap-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-6 w-32 rounded-full" />
                <Skeleton className="h-4 w-16 hidden sm:block" />
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
        title="خطا در دریافت ریتم جلسات"
        message={error instanceof Error ? error.message : 'بارگذاری برنامه جلسات ناموفق بود.'}
        onRetry={() => refetch()}
      />
    );
  }

  const templateButton = (
    <Button
      variant="outline"
      size="sm"
      type="button"
      onClick={handleApplyStandardTemplate}
      isLoading={updateMut.isPending}
      className="text-xs font-bold gap-1.5 border-sec/30 dark:border-primary/45 text-sec dark:text-primary"
    >
      <Sparkles className="w-3.5 h-3.5 text-primary" />
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
