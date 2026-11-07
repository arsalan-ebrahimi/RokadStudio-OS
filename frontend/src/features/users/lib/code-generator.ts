import type { User } from '@/shared/types/models';

/**
 * Suggests the next sequential 6-digit user code based on a 2-digit department prefix.
 * e.g. prefix '10' -> '101101', '101102', ...
 */
export function suggestNextUserCode(users: User[], prefix = '10'): string {
  const numericPrefix = prefix.replace(/\D/g, '').slice(0, 2) || '10';
  const regex = new RegExp(`^${numericPrefix}(\\d{4})$`);

  let maxNum = 1100;
  for (const u of users) {
    if (!u.code) continue;
    const match = regex.exec(u.code);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  const nextSuffix = String(maxNum + 1).padStart(4, '0');
  return `${numericPrefix}${nextSuffix}`.slice(0, 6);
}
