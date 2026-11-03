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
    const selectId = id || name;

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
      <div className={cn('space-y-1.5 w-full relative', containerClassName)} ref={containerRef}>
        {label && (
          <label htmlFor={selectId} className="block text-xs font-bold text-ink-normal/80 dark:text-gray-300">
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
            className={cn(
              'w-full flex items-center justify-between rounded-xl border font-bold transition-all text-right cursor-pointer select-none',
              'bg-[#FAFAFA] dark:bg-[#1C2536] text-sec dark:text-white',
              'border-gray-200 dark:border-gray-700',
              'hover:border-gray-300 dark:hover:border-gray-600',
              'focus:outline-none focus:border-primary',
              'shadow-hard-sm disabled:opacity-50 disabled:cursor-not-allowed',
              isOpen && 'border-primary shadow-hard dark:border-primary',
              selectSize === 'sm' ? 'py-1.5 px-3 text-xs min-h-[34px]' : 'py-2.5 px-3.5 text-xs sm:text-sm min-h-[42px]',
              error && 'border-[#C60036] focus:border-[#C60036]',
              className
            )}
          >
            <span className="truncate pe-2">{displayLabel}</span>
            <ChevronDown
              className={cn(
                'text-ink-normal/50 dark:text-gray-400 shrink-0 transition-transform duration-200',
                selectSize === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4',
                isOpen && 'rotate-180 text-primary'
              )}
            />
          </button>

          {/* Styled Options Dropdown Menu */}
          {isOpen && (
            <div
              role="listbox"
              className={cn(
                'absolute start-0 z-50 w-full min-w-[160px]',
                openUpward ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
                'bg-white dark:bg-[#151C28]',
                'border-2 border-[#121824] dark:border-gray-700',
                'rounded-xl p-1.5 shadow-hard',
                'max-h-56 overflow-y-auto space-y-1',
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
                      'w-full text-right px-3 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-between',
                      opt.disabled && 'opacity-40 cursor-not-allowed',
                      !opt.disabled && !isSelected && 'text-sec dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/80 hover:text-primary dark:hover:text-primary',
                      isSelected && 'bg-primary text-white shadow-hard-sm'
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <Check className="w-4 h-4 shrink-0 ms-2 text-white" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {error && <p className="text-xs text-[#C60036] font-bold mt-1">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;
