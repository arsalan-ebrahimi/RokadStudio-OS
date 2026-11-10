import { cn } from '../lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
  'aria-label'?: string;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  disabled = false,
  'aria-label': ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-1 p-1 rounded-2xl bg-white dark:bg-[#151C28] border-[1.5px] border-sec/25 dark:border-gray-700 shadow-[2px_2px_0_rgba(32,42,90,0.18)]',
        className
      )}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            disabled={disabled}
            aria-selected={isActive}
            onClick={() => !disabled && onChange(opt.value)}
            className={cn(
              'rounded-xl font-black transition-all whitespace-nowrap select-none touch-manipulation',
              disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
              size === 'sm' ? 'min-h-[34px] px-2.5 py-1 text-[11px]' : 'min-h-[38px] px-3.5 py-1.5 text-xs',
              isActive
                ? 'bg-primary text-sec shadow-[1.5px_1.5px_0_#202A5A] border border-sec/30'
                : 'text-sec/70 dark:text-gray-300 hover:bg-sec/[0.05] dark:hover:bg-gray-800 border border-transparent'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
