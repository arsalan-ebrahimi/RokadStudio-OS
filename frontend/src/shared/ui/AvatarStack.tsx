import React from 'react';
import { Shield } from 'lucide-react';
import { cn } from '../lib/utils';
import { toPersianDigits } from '../lib/formatters';

export interface AvatarStackUser {
  id: number;
  name: string;
}

export interface AvatarStackProps {
  users: AvatarStackUser[];
  max?: number;
  size?: 'sm' | 'md';
  avatarClassName?: string;
  badgeIcon?: 'admin' | null;
  emptyLabel?: string;
  className?: string;
}

export const AvatarStack: React.FC<AvatarStackProps> = ({
  users,
  max = 4,
  size = 'sm',
  avatarClassName = 'bg-[#612B89] text-white',
  badgeIcon = null,
  emptyLabel,
  className,
}) => {
  if (!users || users.length === 0) {
    return emptyLabel ? (
      <span className="text-[11px] font-bold text-ink-normal/45 dark:text-gray-500">
        {emptyLabel}
      </span>
    ) : null;
  }

  const visible = users.slice(0, max);
  const remaining = users.length - visible.length;
  const sizeClass = size === 'md' ? 'w-8 h-8 text-xs' : 'w-7 h-7 text-[11px]';

  return (
    <div className={cn('flex items-center -space-x-2 space-x-reverse', className)}>
      {visible.map((u) => (
        <div
          key={u.id}
          title={u.name}
          className={cn(
            'relative rounded-full ring-2 ring-white dark:ring-[#121824] flex items-center justify-center font-black shadow-sm shrink-0 select-none',
            sizeClass,
            avatarClassName
          )}
        >
          <span>{u.name.trim().slice(0, 1) || 'ک'}</span>
          {badgeIcon === 'admin' && (
            <span
              className="absolute -bottom-0.5 -end-0.5 w-3.5 h-3.5 rounded-full bg-amber-400 text-[#121824] flex items-center justify-center ring-1 ring-white dark:ring-[#121824] z-10"
              aria-hidden="true"
            >
              <Shield className="w-2.5 h-2.5 stroke-[2.2]" />
            </span>
          )}
        </div>
      ))}
      {remaining > 0 && (
        <div
          dir="ltr"
          className={cn(
            'relative z-10 rounded-full ring-2 ring-white dark:ring-[#121824] bg-gray-200 dark:bg-gray-700 text-ink-normal/90 dark:text-gray-100 flex items-center justify-center font-bold shrink-0 select-none text-[10px]',
            sizeClass
          )}
          title={`${toPersianDigits(remaining)} نفر دیگر`}
        >
          +{toPersianDigits(remaining)}
        </div>
      )}
    </div>
  );
};
