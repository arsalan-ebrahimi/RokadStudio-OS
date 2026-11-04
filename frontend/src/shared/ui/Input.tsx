import React from 'react';
import { cn } from '../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || props.name;

    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-bold text-ink-normal/80 dark:text-gray-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn(
            'w-full px-3.5 py-2.5 rounded-xl border bg-[#FAFAFA] dark:bg-[#1C2536] text-ink-normal dark:text-white text-base sm:text-sm font-medium transition-all focus:outline-none',
            error
              ? 'border-[#C60036] focus:border-[#C60036] focus:ring-1 focus:ring-[#C60036]'
              : 'border-gray-200 dark:border-gray-700 focus:border-primary focus:bg-white dark:focus:bg-[#1C2536]',
            className
          )}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-[#C60036] font-medium mt-1">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

