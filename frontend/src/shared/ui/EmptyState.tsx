import React from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '../lib/utils';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'موردی یافت نشد',
  description,
  action,
  className,
}) => {
  return (
    <div className={cn('flex flex-col items-center justify-center p-8 text-center space-y-3', className)}>
      <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
        <Inbox className="w-6 h-6" />
      </div>
      <p className="text-sm font-bold text-ink-normal/80 dark:text-gray-300">{title}</p>
      {description && <p className="text-xs text-ink-normal/50 dark:text-gray-500 max-w-xs">{description}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
};

