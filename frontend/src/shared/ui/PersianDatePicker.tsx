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
}

export const PersianDatePicker: React.FC<PersianDatePickerProps> = ({
  value,
  onChange,
  label,
  allowStep = true,
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
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
    <div ref={containerRef} className="relative inline-flex flex-col gap-1">
      {label && <label className="text-xs font-bold text-ink-normal/70 dark:text-gray-300">{label}</label>}

      <div className="flex items-center gap-1 bg-white dark:bg-[#151C28] p-1 rounded-xl border border-gray-200 dark:border-gray-700 shadow-hard-sm">
        {allowStep && (
          <button
            type="button"
            onClick={handleNextDay}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
            title="روز بعد"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-2.5 py-1 text-xs font-bold text-sec dark:text-white"
        >
          <Calendar className="w-3.5 h-3.5 text-primary" />
          <span>{formatToJalali(value, false)}</span>
        </button>

        {allowStep && (
          <button
            type="button"
            onClick={handlePrevDay}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
            title="روز قبل"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full start-0 mt-1.5 z-50 w-64 max-w-[calc(100vw-2rem)] p-3 bg-white dark:bg-[#182030] rounded-2xl border-2 border-gray-200 dark:border-gray-700 shadow-hard space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
            <span className="text-xs font-black text-sec dark:text-white">
              {toPersianDigits(jy)}
            </span>
            <div className="w-28">
              <Select
                selectSize="sm"
                value={jm}
                onChange={(e) => changeMonth(Number(e.target.value))}
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
                    'h-7 w-7 text-xs font-bold rounded-lg flex items-center justify-center transition-all select-none touch-manipulation',
                    isSelected
                      ? 'bg-primary text-white shadow-hard-sm'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-ink-normal dark:text-gray-300'
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
            className="w-full py-1.5 text-center text-xs font-bold rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-sec dark:text-white transition-colors"
          >
            برو به امروز
          </button>
        </div>
      )}
    </div>
  );
};

