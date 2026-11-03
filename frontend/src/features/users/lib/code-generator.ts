import type { User } from '@/shared/types/models';

export function suggestNextUserCode(users: User[], prefix = 'IT'): string {
  const cleanPrefix = prefix.toUpperCase().trim().slice(0, 2);
  const regex = new RegExp(`^${cleanPrefix}(\\d+)$`, 'i');

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

  return `${cleanPrefix}${maxNum + 1}`;
}

