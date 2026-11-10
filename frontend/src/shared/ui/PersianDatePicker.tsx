import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronRight, ChevronLeft } from 'lucide-react';
import { jalaaliMonthLength } from 'jalaali-js';
import { Select } from './Select';
import {
  isoToJalali,
  jalaliToIso,
  formatToJalali,
  addDaysToIso,
  getTehranTodayString,
  PERSIAN_MONTHS,
} from '@/shared/lib/date';
import { toPersianDigits } from '@/shared/lib/formatters';
import { cn } from '@/shared/lib/utils';

interface PersianDatePickerProps {
  value: string; // ISO 'YYYY-MM-DD'
  onChange: (isoDate: string) => void;
  label?: string;
  allowStep?: boolean;
  size?: 'sm' | 'md';
  containerClassName?: string;
}

export const PersianDatePicker: React.FC<PersianDatePickerProps> = ({
  value,
  onChange,
  label,
  allowStep = true,
  size = 'md',
  containerClassName,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { jy, jm, jd } = isoToJalali(value);
  const daysInMonth = jalaaliMonthLength(jy, jm);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const handlePrevDay = () => onChange(addDaysToIso(value, -1));
  const handleNextDay = () => onChange(addDaysToIso(value, 1));
  const handleToday = () => {
    onChange(getTehranTodayString());
    setIsOpen(false);
  };

  const changeMonth = (newJm: number) => {
    const newMaxDays = jalaaliMonthLength(jy, newJm);
    const newJd = Math.min(jd, newMaxDays);
    onChange(jalaliToIso(jy, newJm, newJd));
  };

  const changeDay = (newJd: number) => {
    onChange(jalaliToIso(jy, jm, newJd));
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={cn('relative inline-flex flex-col', label ? 'gap-1.5' : '', containerClassName)}>
      {label && <label className="text-xs font-bold text-sec/85 dark:text-gray-300">{label}</label>}

      <div
        className={cn(
          'flex items-center gap-0.5 bg-white dark:bg-[#151C28] px-1 rounded-xl border-[1.5px] border-sec/25 dark:border-gray-700 shadow-[2px_2px_0_rgba(32,42,90,0.2)] dark:shadow-[2px_2px_0_rgba(89,187,175,0.25)] shrink-0 select-none',
          size === 'sm' ? 'h-10' : 'h-11',
          isOpen && 'border-primary shadow-male dark:shadow-ecosystem'
        )}
      >
        {allowStep && (
          <button
            type="button"
            onClick={handleNextDay}
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-sec/[0.06] dark:hover:bg-gray-800 text-sec/70 dark:text-gray-300 shrink-0 transition-colors cursor-pointer"
            title="روز بعد"
            aria-label="روز بعد"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          className="flex-1 h-8 flex items-center justify-center gap-2 px-2.5 text-xs font-bold text-sec dark:text-white rounded-lg hover:bg-sec/[0.05] dark:hover:bg-gray-800 transition-colors whitespace-nowrap cursor-pointer"
        >
          <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="tabular-nums">{formatToJalali(value, false)}</span>
        </button>

        {allowStep && (
          <button
            type="button"
            onClick={handlePrevDay}
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-sec/[0.06] dark:hover:bg-gray-800 text-sec/70 dark:text-gray-300 shrink-0 transition-colors cursor-pointer"
            title="روز قبل"
            aria-label="روز قبل"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full start-0 mt-1.5 z-50 w-64 max-w-[calc(100vw-2rem)] p-3 bg-white dark:bg-[#182030] rounded-2xl border-[1.5px] border-sec dark:border-primary/50 shadow-male dark:shadow-ecosystem space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-sec/10 dark:border-gray-800">
            <span className="text-xs font-black text-sec dark:text-white tabular-nums">
              {toPersianDigits(jy)}
            </span>
            <div className="w-32">
              <Select
                selectSize="sm"
                value={jm}
                onChange={(e) => changeMonth(Number(e.target.value))}
                aria-label="انتخاب ماه"
              >
                {PERSIAN_MONTHS.map((m, idx) => (
                  <option key={m} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
              const isSelected = d === jd;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => changeDay(d)}
                  className={cn(
                    'h-8 w-8 text-xs font-bold rounded-lg flex items-center justify-center transition-all select-none touch-manipulation cursor-pointer tabular-nums',
                    isSelected
                      ? 'bg-primary text-sec font-black shadow-hard-sm'
                      : 'hover:bg-primary/[0.12] dark:hover:bg-gray-800 text-sec dark:text-gray-300'
                  )}
                >
                  {toPersianDigits(d)}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleToday}
            className="w-full py-2 text-center text-xs font-bold rounded-xl bg-sec/[0.06] dark:bg-gray-800 hover:bg-primary/[0.15] text-sec dark:text-white transition-colors cursor-pointer"
          >
            برو به امروز
          </button>
        </div>
      )}
    </div>
  );
};
