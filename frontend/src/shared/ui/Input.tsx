import React from 'react';
import { cn } from '../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, containerClassName, label, error, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || props.name || generatedId;

    return (
      <div className={cn('w-full', label ? 'space-y-1.5' : '', containerClassName)}>
        {label && (
          <label htmlFor={inputId} className="block text-xs font-bold text-sec/85 dark:text-gray-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn(
            'w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border-[1.5px] bg-[#FAFAFA] dark:bg-[#1C2536] text-sec dark:text-white text-base sm:text-sm font-medium placeholder:text-ink-normal/40 dark:placeholder:text-gray-500 transition-all focus:outline-none',
            error
              ? 'border-[#E0195B] focus:border-[#E0195B] focus:ring-2 focus:ring-[#E0195B]/25'
              : 'border-sec/25 dark:border-gray-700 hover:border-sec/45 dark:hover:border-gray-600 focus:border-primary focus:bg-white dark:focus:bg-[#151C28] focus:shadow-hard-sm',
            className
          )}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-[#C60036] dark:text-rose-400 font-bold mt-1">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
