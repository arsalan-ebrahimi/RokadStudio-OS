import React from 'react';
import { cn } from '../lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({ className, hoverable = false, children, ...props }) => {
  return (
    <div
      className={cn(
        'rokad-card p-4 sm:p-5',
        !hoverable && 'hover:transform-none hover:shadow-male dark:hover:shadow-ecosystem',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
