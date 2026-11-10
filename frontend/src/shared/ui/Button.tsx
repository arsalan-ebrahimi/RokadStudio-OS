import React from 'react';
import { cn } from '../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, disabled, children, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed select-none touch-manipulation active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sec dark:focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#151C28]';

    const sizes = {
      sm: 'min-h-[40px] px-3.5 text-xs rounded-xl',
      md: 'min-h-[44px] px-4 py-2.5 text-sm rounded-2xl',
      lg: 'min-h-[52px] px-6 py-3 text-base rounded-2xl',
    };

    const variants = {
      primary: 'rokad-btn-primary',
      secondary: 'rokad-btn-sec',
      outline: 'rokad-btn-outline',
      danger:
        'bg-[#C60036] text-white border-[1.5px] border-[#202A5A] dark:border-[#9A002A] shadow-[2.75px_2.75px_0_#202A5A] dark:shadow-[2.75px_2.75px_0_#4E0920] hover:bg-[#B30031] hover:-translate-x-px hover:-translate-y-px hover:shadow-[3.75px_3.75px_0_#202A5A] active:translate-x-[1.5px] active:translate-y-[1.5px] active:shadow-[1px_1px_0_#202A5A]',
      ghost:
        'bg-transparent border-[1.5px] border-transparent text-sec dark:text-gray-200 hover:bg-sec/[0.06] dark:hover:bg-white/[0.08] hover:border-sec/15 dark:hover:border-white/15',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(base, sizes[size], variants[variant], className)}
        {...props}
      >
        {isLoading && (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin me-2 shrink-0" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
