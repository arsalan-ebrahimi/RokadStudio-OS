import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../lib/utils';

export interface SelectOption {
  value: string | number;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  error?: string;
  selectSize?: 'sm' | 'md';
  placeholder?: string;
  options?: SelectOption[];
  containerClassName?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      containerClassName,
      label,
      error,
      id,
      children,
      options,
      value,
      defaultValue,
      onChange,
      disabled,
      placeholder,
      selectSize = 'md',
      name,
      ...props
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [openUpward, setOpenUpward] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const generatedId = React.useId();
    const selectId = id || name || generatedId;

    useEffect(() => {
      if (!isOpen || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 220 && rect.top > 200) {
        setOpenUpward(true);
      } else {
        setOpenUpward(false);
      }
    }, [isOpen]);

    // Parse options from either `options` prop or `children` (<option>)
    const parsedOptions: SelectOption[] = React.useMemo(() => {
      if (options && options.length > 0) {
        return options;
      }

      const list: SelectOption[] = [];
      React.Children.forEach(children, (child) => {
        if (!React.isValidElement(child)) return;
        const childProps = child.props as { value?: string | number; children?: React.ReactNode; disabled?: boolean };
        const val = childProps.value !== undefined ? childProps.value : String(childProps.children ?? '');
        list.push({
          value: val,
          label: childProps.children ?? String(val),
          disabled: childProps.disabled,
        });
      });

      return list;
    }, [options, children]);

    const currentVal = value !== undefined ? String(value) : defaultValue !== undefined ? String(defaultValue) : '';
    const selectedOption = parsedOptions.find((opt) => String(opt.value) === currentVal);
    const displayLabel = selectedOption ? selectedOption.label : placeholder || (parsedOptions[0]?.label ?? '');

    // Close on outside click and Escape
    useEffect(() => {
      if (!isOpen) return;

      const handleClickOutside = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setIsOpen(false);
        }
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }, [isOpen]);

    const handleSelect = (optionValue: string | number) => {
      if (disabled) return;
      setIsOpen(false);

      if (onChange) {
        const syntheticEvent = {
          target: { value: String(optionValue), name: name || selectId },
          currentTarget: { value: String(optionValue), name: name || selectId },
        } as unknown as React.ChangeEvent<HTMLSelectElement>;
        onChange(syntheticEvent);
      }
    };

    return (
      <div className={cn('w-full relative', label ? 'space-y-1.5' : '', containerClassName)} ref={containerRef}>
        {label && (
          <label htmlFor={selectId} className="block text-xs font-bold text-sec/85 dark:text-gray-300">
            {label}
          </label>
        )}

        {/* Hidden native select for form integration and ref */}
        <select
          ref={ref}
          id={selectId}
          name={name}
          value={value}
          defaultValue={defaultValue}
          onChange={onChange}
          disabled={disabled}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          {...props}
        >
          {parsedOptions.map((opt) => (
            <option key={String(opt.value)} value={opt.value} disabled={opt.disabled}>
              {typeof opt.label === 'string' ? opt.label : String(opt.value)}
            </option>
          ))}
        </select>

        {/* Custom styled trigger button */}
        <div className="relative">
          <button
            type="button"
            disabled={disabled}
            onClick={() => !disabled && setIsOpen((prev) => !prev)}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-label={typeof label === 'string' ? label : props['aria-label']}
            className={cn(
              'w-full flex items-center justify-between rounded-xl border-[1.5px] font-bold transition-all text-start cursor-pointer select-none',
              'bg-[#FAFAFA] dark:bg-[#1C2536] text-sec dark:text-white',
              'border-sec/25 dark:border-gray-700',
              'hover:border-sec/55 dark:hover:border-gray-600',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sec dark:focus-visible:ring-primary focus-visible:ring-offset-1',
              'shadow-[2px_2px_0_rgba(32,42,90,0.2)] dark:shadow-[2px_2px_0_rgba(89,187,175,0.25)] disabled:opacity-50 disabled:cursor-not-allowed',
              isOpen && 'border-primary bg-white dark:bg-[#151C28] shadow-male dark:shadow-ecosystem',
              selectSize === 'sm' ? 'min-h-[40px] py-1.5 px-3 text-xs' : 'min-h-[44px] py-2.5 px-3.5 text-xs sm:text-sm',
              error && 'border-[#E0195B] focus:border-[#E0195B]',
              className
            )}
          >
            <span className="truncate pe-2">{displayLabel}</span>
            <ChevronDown
              className={cn(
                'text-sec/55 dark:text-gray-400 shrink-0 transition-transform duration-200',
                selectSize === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4',
                isOpen && 'rotate-180 text-sec dark:text-primary'
              )}
            />
          </button>

          {/* Styled Options Dropdown Menu */}
          {isOpen && (
            <div
              role="listbox"
              className={cn(
                'absolute start-0 z-50 w-full min-w-[168px]',
                openUpward ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
                'bg-white dark:bg-[#151C28]',
                'border-[1.5px] border-sec dark:border-primary/50',
                'rounded-2xl p-1.5 shadow-male dark:shadow-ecosystem',
                'max-h-60 overflow-y-auto space-y-1',
                'animate-in fade-in-0 zoom-in-95 duration-100'
              )}
            >
              {parsedOptions.map((opt) => {
                const isSelected = String(opt.value) === currentVal;
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    onClick={() => !opt.disabled && handleSelect(opt.value)}
                    className={cn(
                      'w-full text-start px-3 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-between select-none touch-manipulation cursor-pointer',
                      opt.disabled && 'opacity-40 cursor-not-allowed',
                      !opt.disabled &&
                        !isSelected &&
                        'text-sec dark:text-gray-200 hover:bg-primary/[0.12] dark:hover:bg-primary/[0.16] hover:text-sec dark:hover:text-white',
                      isSelected && 'bg-primary text-sec font-black shadow-hard-sm'
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <Check className="w-4 h-4 shrink-0 ms-2 text-sec" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {error && <p className="text-xs text-[#C60036] dark:text-rose-400 font-bold mt-1">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;
