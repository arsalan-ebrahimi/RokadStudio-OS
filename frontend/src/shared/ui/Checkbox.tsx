import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../lib/utils';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  wrapperClassName?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, wrapperClassName, label, description, checked, disabled, id, onChange, ...props }, ref) => {
    const generatedId = React.useId();
    const checkboxId = id || generatedId;

    const control = (
      <div className="relative inline-flex items-center justify-center shrink-0">
        <input
          ref={ref}
          type="checkbox"
          id={checkboxId}
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          className="peer sr-only"
          {...props}
        />
        <div
          className={cn(
            'w-5 h-5 rounded-lg border-2 transition-all flex items-center justify-center select-none',
            'border-gray-300 bg-white dark:border-gray-600 dark:bg-[#1C2536]',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 dark:peer-focus-visible:ring-offset-[#151C28]',
            'peer-checked:bg-primary peer-checked:border-primary peer-checked:text-white',
            'peer-checked:shadow-[2px_2px_0_#202A5A] dark:peer-checked:shadow-[2px_2px_0_#59BBAF]',
            'peer-hover:border-primary/80',
            disabled ? 'opacity-50 cursor-not-allowed peer-hover:border-gray-300 dark:peer-hover:border-gray-600' : 'cursor-pointer',
            className
          )}
        />
        <Check
          className={cn(
            'w-3.5 h-3.5 stroke-[3] text-white absolute pointer-events-none transition-transform duration-150',
            'scale-0 opacity-0 peer-checked:scale-100 peer-checked:opacity-100'
          )}
        />
      </div>
    );

    if (!label && !description) {
      return control;
    }

    return (
      <label
        htmlFor={checkboxId}
        className={cn(
          'inline-flex items-start gap-2.5 select-none',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          wrapperClassName
        )}
      >
        {control}
        <div className="space-y-0.5 text-right">
          {label && (
            <span className="block text-xs sm:text-sm font-bold text-sec dark:text-white">
              {label}
            </span>
          )}
          {description && (
            <span className="block text-xs text-ink-normal/60 dark:text-gray-400">
              {description}
            </span>
          )}
        </div>
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';

