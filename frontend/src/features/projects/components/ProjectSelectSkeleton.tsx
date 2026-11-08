import React from 'react';
import { Skeleton } from '@/shared/ui';

export const ProjectSelectSkeleton: React.FC = () => {
  return (
    <div className="space-y-1.5" aria-hidden="true">
      <Skeleton className="w-16 h-4" />
      <Skeleton className="w-full h-10 rounded-xl" />
    </div>
  );
};

