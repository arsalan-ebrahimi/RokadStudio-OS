import React, { useLayoutEffect, useRef, useState } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '../lib/utils';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'موردی یافت نشد',
  description,
  action,
  icon,
  className,
}) => {
  return (
    <div className={cn('flex flex-col items-center justify-center p-8 sm:p-10 text-center space-y-3', className)}>
      <div className="w-14 h-14 rounded-2xl bg-primary/[0.12] dark:bg-primary/15 border-[1.5px] border-sec/20 dark:border-primary/35 shadow-hard-sm flex items-center justify-center text-sec dark:text-primary">
        {icon || <Inbox className="w-6 h-6" />}
      </div>
      <div className="space-y-1 max-w-sm">
        <p className="text-sm sm:text-base font-black text-sec dark:text-white">{title}</p>
        {description && (
          <p className="text-xs text-ink-normal/65 dark:text-gray-400 leading-relaxed">{description}</p>
        )}
      </div>
      {action && <div className="pt-2 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
};

// Keep a tiny utility for text helpers shared across tables
export const AutoGrowTextarea: React.FC<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
> = ({ className, value, onChange, ...props }) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(44, el.scrollHeight)}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => {
        const el = e.currentTarget;
        el.style.height = 'auto';
        el.style.height = `${Math.max(44, el.scrollHeight)}px`;
        onChange?.(e);
      }}
      className={cn(
        'w-full min-h-[44px] px-2.5 py-2 rounded-xl border border-transparent bg-transparent text-xs font-medium text-sec dark:text-white placeholder:text-ink-normal/40 dark:placeholder:text-gray-500 resize-none overflow-hidden leading-relaxed transition-all',
        'hover:bg-sec/[0.03] dark:hover:bg-white/[0.04] hover:border-sec/20 dark:hover:border-white/15',
        'focus:bg-white dark:focus:bg-[#151C28] focus:border-primary focus:shadow-hard-sm focus:outline-none',
        className
      )}
      {...props}
    />
  );
};

export interface ExpandableTextCellProps {
  text?: string | null;
  fallback?: string;
  className?: string;
}

export const ExpandableTextCell: React.FC<ExpandableTextCellProps> = ({
  text,
  fallback = '—',
  className,
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!text || !text.trim()) {
    return <span className="text-ink-normal/40 dark:text-gray-500">{fallback}</span>;
  }

  const isPotentiallyLong = text.trim().length > 48 || text.includes('\n');

  if (!isPotentiallyLong) {
    return <span className={cn('leading-relaxed', className)}>{text}</span>;
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== 'undefined' && window.getSelection()?.toString()) return;
        setExpanded((prev) => !prev);
      }}
      title={expanded ? 'کلیک برای جمع کردن متن' : 'کلیک برای مشاهده متن کامل'}
      aria-expanded={expanded}
      className={cn(
        'text-start w-full group/expand focus:outline-none focus-visible:underline cursor-pointer',
        className
      )}
    >
      <span className={cn('block leading-relaxed break-words', !expanded && 'line-clamp-2')}>
        {text}
      </span>
      <span className="inline-block mt-0.5 text-[10px] font-bold text-primary/90 group-hover/expand:text-sec dark:group-hover/expand:text-primary transition-colors">
        {expanded ? 'بستن' : 'مشاهده کامل'}
      </span>
    </button>
  );
};
