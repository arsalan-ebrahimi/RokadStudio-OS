import React from 'react';
import { cn } from '../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'ecosystem' | 'male' | 'female' | 'college' | 'club' | 'neutral';
  dot?: boolean;
  dotClassName?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'ecosystem',
  dot = false,
  dotClassName,
  children,
  ...props
}) => {
  const variants = {
    ecosystem:
      'bg-ecosystem-light dark:bg-ecosystem-darker/70 text-sec dark:text-ecosystem-light border-ecosystem-dark/35',
    male: 'bg-male-light dark:bg-male-darker/60 text-male-normal dark:text-male-light border-male-normal/30',
    female: 'bg-female-light dark:bg-female-darker/60 text-[#A81344] dark:text-rose-200 border-female-normal/35',
    college:
      'bg-college-light dark:bg-college-darker/60 text-[#704A0D] dark:text-amber-200 border-college-normal/45',
    club: 'bg-club-light dark:bg-club-darker/60 text-club-normal dark:text-purple-200 border-club-normal/35',
    neutral: 'bg-gray-100 dark:bg-gray-800 text-sec/80 dark:text-gray-200 border-gray-300 dark:border-gray-700',
  };

  const defaultDotColors = {
    ecosystem: 'bg-primary',
    male: 'bg-male-normal dark:bg-blue-400',
    female: 'bg-female-normal',
    college: 'bg-college-normal',
    club: 'bg-club-normal dark:bg-purple-400',
    neutral: 'bg-gray-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-xs border whitespace-nowrap shrink-0 leading-none select-none',
        variants[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn('w-2 h-2 rounded-full shrink-0', defaultDotColors[variant], dotClassName)}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
};
