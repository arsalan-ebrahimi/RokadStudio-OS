import type { User } from '@/shared/types/models';

/**
 * Suggests the next sequential 6-character user code based on a 2-character department prefix.
 * e.g. prefix 'IT' -> 'IT1101', 'IT1102', ...
 */
export function suggestNextUserCode(users: User[], prefix = 'IT'): string {
  const cleanPrefix = (prefix.trim() || 'IT').toUpperCase().slice(0, 2);
  const regex = new RegExp(`^${cleanPrefix}(\\d{4})$`, 'i');

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
  return `${cleanPrefix}${nextSuffix}`.slice(0, 6);
}
