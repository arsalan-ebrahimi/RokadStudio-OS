import React from 'react';
import { cn } from '../lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, ...props }, ref) => {
    const selectId = id || props.name;

    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-bold text-ink-normal/80 dark:text-gray-300">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'w-full px-3.5 py-2.5 rounded-xl border bg-[#FAFAFA] dark:bg-[#1C2536] text-ink-normal dark:text-white text-xs sm:text-sm font-medium transition-all focus:outline-none',
            error
              ? 'border-[#C60036] focus:border-[#C60036]'
              : 'border-gray-200 dark:border-gray-700 focus:border-primary focus:bg-white dark:focus:bg-[#1C2536]',
            className
          )}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-xs text-[#C60036] font-medium mt-1">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
