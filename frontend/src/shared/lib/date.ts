import { toJalaali, toGregorian, jalaaliMonthLength } from 'jalaali-js';
import { toPersianDigits } from './formatters';

export const PERSIAN_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

export const PERSIAN_WEEKDAYS = [
  'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'
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

export function isoToJalali(isoDateStr: string) {
  if (!isoDateStr) return { jy: 1405, jm: 8, jd: 12, monthName: 'آبان', weekdayName: 'امروز' };
  const [gyStr, gmStr, gdStr] = isoDateStr.slice(0, 10).split('-');
  const gy = parseInt(gyStr, 10);
  const gm = parseInt(gmStr, 10);
  const gd = parseInt(gdStr, 10);
  if (isNaN(gy) || isNaN(gm) || isNaN(gd)) {
    return { jy: 1405, jm: 8, jd: 12, monthName: 'آبان', weekdayName: 'امروز' };
  }

  const { jy, jm, jd } = toJalaali(gy, gm, gd);
  const dateObj = new Date(Date.UTC(gy, gm - 1, gd, 12, 0, 0));
  const weekdayName = PERSIAN_WEEKDAYS[dateObj.getUTCDay()] ?? '';
  const monthName = PERSIAN_MONTHS[jm - 1] ?? '';

  return { jy, jm, jd, monthName, weekdayName };
}

export function jalaliToIso(jy: number, jm: number, jd: number): string {
  const { gy, gm, gd } = toGregorian(jy, jm, jd);
  const mm = String(gm).padStart(2, '0');
  const dd = String(gd).padStart(2, '0');
  return `${gy}-${mm}-${dd}`;
}

export function formatToJalali(isoDateStr: string, withWeekday = false): string {
  if (!isoDateStr) return '';
  const { jy, jd, monthName, weekdayName } = isoToJalali(isoDateStr);
  const dateText = `${toPersianDigits(jd)} ${monthName} ${toPersianDigits(jy)}`;
  return withWeekday ? `${weekdayName}، ${dateText}` : dateText;
}

export function addDaysToIso(isoDateStr: string, days: number): string {
  const [gyStr, gmStr, gdStr] = isoDateStr.slice(0, 10).split('-');
  const d = new Date(Date.UTC(parseInt(gyStr, 10), parseInt(gmStr, 10) - 1, parseInt(gdStr, 10)));
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getJalaliWeekRange(isoDateStr: string): { from: string; to: string } {
  const [gyStr, gmStr, gdStr] = isoDateStr.slice(0, 10).split('-');
  const d = new Date(Date.UTC(parseInt(gyStr, 10), parseInt(gmStr, 10) - 1, parseInt(gdStr, 10), 12, 0, 0));
  const dayOfWeek = d.getUTCDay(); // 0 is Sunday, 6 is Saturday
  // In Iran, week starts on Saturday (diffToSaturday is 0 if Saturday)
  const diffToSaturday = (dayOfWeek + 1) % 7;
  const startIso = addDaysToIso(isoDateStr, -diffToSaturday);
  const endIso = addDaysToIso(startIso, 6);
  return { from: startIso, to: endIso };
}

export function getJalaliMonthRange(isoDateStr: string): { from: string; to: string } {
  const { jy, jm } = isoToJalali(isoDateStr);
  const daysInMonth = jalaaliMonthLength(jy, jm);
  const from = jalaliToIso(jy, jm, 1);
  const to = jalaliToIso(jy, jm, daysInMonth);
  return { from, to };
}

/**
 * Returns 0 for Saturday, 1 for Sunday, ..., 6 for Friday.
 */
export function getWeekdaySat0(isoDateStr: string): number {
  const [gyStr, gmStr, gdStr] = isoDateStr.slice(0, 10).split('-');
  const d = new Date(
    Date.UTC(parseInt(gyStr, 10), parseInt(gmStr, 10) - 1, parseInt(gdStr, 10), 12, 0, 0)
  );
  return (d.getUTCDay() + 1) % 7;
}

export function addJalaliMonths(jy: number, jm: number, delta: number): { jy: number; jm: number } {
  const totalMonths = jy * 12 + (jm - 1) + delta;
  const nextJy = Math.floor(totalMonths / 12);
  const nextJm = ((totalMonths % 12) + 12) % 12 + 1;
  return { jy: nextJy, jm: nextJm };
}

export interface JalaliCalendarCell {
  iso: string;
  jy: number;
  jm: number;
  jd: number;
  inMonth: boolean;
  dayOfWeekSat0: number;
}

export interface JalaliMonthCalendarInfo {
  jy: number;
  jm: number;
  monthName: string;
  daysInMonth: number;
  startIso: string;
  endIso: string;
  gridFromIso: string;
  gridToIso: string;
  cells: JalaliCalendarCell[];
}

export function getJalaliMonthCalendarInfo(jy: number, jm: number): JalaliMonthCalendarInfo {
  const daysInMonth = jalaaliMonthLength(jy, jm);
  const startIso = jalaliToIso(jy, jm, 1);
  const endIso = jalaliToIso(jy, jm, daysInMonth);
  const firstWeekdaySat0 = getWeekdaySat0(startIso);
  const lastWeekdaySat0 = getWeekdaySat0(endIso);
  const leadingDays = firstWeekdaySat0;
  const trailingDays = 6 - lastWeekdaySat0;

  const gridFromIso = addDaysToIso(startIso, -leadingDays);
  const gridToIso = addDaysToIso(endIso, trailingDays);
  const totalCells = leadingDays + daysInMonth + trailingDays;

  const cells: JalaliCalendarCell[] = [];
  for (let i = 0; i < totalCells; i += 1) {
    const iso = addDaysToIso(gridFromIso, i);
    const jInfo = isoToJalali(iso);
    cells.push({
      iso,
      jy: jInfo.jy,
      jm: jInfo.jm,
      jd: jInfo.jd,
      inMonth: jInfo.jy === jy && jInfo.jm === jm,
      dayOfWeekSat0: i % 7,
    });
  }

  return {
    jy,
    jm,
    monthName: PERSIAN_MONTHS[jm - 1] ?? '',
    daysInMonth,
    startIso,
    endIso,
    gridFromIso,
    gridToIso,
    cells,
  };
}

export function formatTehranTime(isoDateTime?: string | null): string {
  if (!isoDateTime) return '';
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('fa-IR', {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
  });
}
