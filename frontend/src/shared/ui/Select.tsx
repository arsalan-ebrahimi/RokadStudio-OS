import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  selectSize?: 'sm' | 'md';
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, selectSize = 'md', ...props }, ref) => {
    const selectId = id || props.name;

    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-bold text-ink-normal/80 dark:text-gray-300">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              'w-full appearance-none rounded-xl border font-bold transition-all focus:outline-none cursor-pointer',
              'bg-[#FAFAFA] dark:bg-[#1C2536] text-sec dark:text-white',
              'border-gray-200 dark:border-gray-700',
              'focus:border-primary focus:bg-white dark:focus:bg-[#1C2536]',
              'shadow-hard-sm disabled:opacity-50 disabled:cursor-not-allowed',
              selectSize === 'sm' ? 'py-1.5 ps-3 pe-8 text-xs' : 'py-2.5 ps-3.5 pe-9 text-xs sm:text-sm',
              error && 'border-[#C60036] focus:border-[#C60036]',
              className
            )}
            {...props}
          >
            {children}
          </select>
          <div className="absolute end-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-ink-normal/50 dark:text-gray-400">
            <ChevronDown className={cn(selectSize === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
          </div>
        </div>
        {error && <p className="text-xs text-[#C60036] font-bold mt-1">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;
