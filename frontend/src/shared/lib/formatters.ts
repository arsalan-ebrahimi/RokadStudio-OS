const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => PERSIAN_DIGITS[parseInt(d, 10)] ?? d);
}

export function toEnglishDigits(value: string): string {
  return value.replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)));
}

export function formatSecondsToTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const m = String(mins).padStart(2, '0');
  const s = String(secs).padStart(2, '0');
  return `${m}:${s}`;
}

export function formatSecondsToHms(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const h = String(hours).padStart(2, '0');
  const m = String(mins).padStart(2, '0');
  const s = String(secs).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function formatDurationToHumanPersian(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${toPersianDigits(hours)} ساعت`);
  if (minutes > 0) parts.push(`${toPersianDigits(minutes)} دقیقه`);
  if (seconds > 0 || parts.length === 0) parts.push(`${toPersianDigits(seconds)} ثانیه`);
  return parts.join(' و ');
}

export function formatDurationToHoursMins(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    if (minutes > 0) {
      return `${toPersianDigits(hours)} ساعت و ${toPersianDigits(minutes)} دقیقه`;
    }
    return `${toPersianDigits(hours)} ساعت`;
  }
  if (minutes > 0) {
    return `${toPersianDigits(minutes)} دقیقه`;
  }
  if (totalSeconds > 0) {
    return `${toPersianDigits(totalSeconds)} ثانیه`;
  }
  return '۰ دقیقه';
}

