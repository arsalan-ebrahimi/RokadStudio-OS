import React from 'react';
import { cn } from '../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'ecosystem' | 'male' | 'female' | 'college' | 'club' | 'neutral';
}

export const Badge: React.FC<BadgeProps> = ({ className, variant = 'ecosystem', children, ...props }) => {
  const variants = {
    ecosystem: 'bg-ecosystem-light dark:bg-ecosystem-darker/60 text-ecosystem-darker dark:text-ecosystem-light border-primary/30',
    male: 'bg-male-light dark:bg-male-darker/60 text-male-normal dark:text-male-light border-male-normal/30',
    female: 'bg-female-light dark:bg-female-darker/60 text-female-normal dark:text-female-light border-female-normal/30',
    college: 'bg-college-light dark:bg-college-darker/60 text-college-darker dark:text-college-light border-college-normal/30',
    club: 'bg-club-light dark:bg-club-darker/60 text-club-normal dark:text-club-light border-club-normal/30',
    neutral: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-xs border',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};

