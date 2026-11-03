import { toJalaali } from 'jalaali-js';
import { toPersianDigits } from './formatters';

const PERSIAN_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

export function getTehranTodayString(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  const y = parts.find((p) => p.type === 'year')?.value ?? '2026';
  return `${y}-${m}-${d}`;
}

export function formatToJalali(isoDateStr: string): string {
  if (!isoDateStr) return '';
  const [gyStr, gmStr, gdStr] = isoDateStr.slice(0, 10).split('-');
  const gy = parseInt(gyStr, 10);
  const gm = parseInt(gmStr, 10);
  const gd = parseInt(gdStr, 10);
  if (isNaN(gy) || isNaN(gm) || isNaN(gd)) return isoDateStr;

  const { jy, jm, jd } = toJalaali(gy, gm, gd);
  const monthName = PERSIAN_MONTHS[jm - 1] ?? '';
  return `${toPersianDigits(jd)} ${monthName} ${toPersianDigits(jy)}`;
}

export function getWeekStartAndEnd(dateStr: string): { start: string; end: string } {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0 is Sunday, 6 is Saturday
  // Saturday is day 6 in JS Date, in Iran week starts on Saturday
  const diffToSaturday = (day + 1) % 7;
  const start = new Date(d);
  start.setDate(d.getDate() - diffToSaturday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}
