import React from 'react';
import { Skeleton } from '@/shared/ui';

export const AttendanceSkeleton: React.FC = () => {
  return (
    <div className="flex items-center gap-2">
      <Skeleton className="w-20 h-6 rounded-full" />
    </div>
  );
};

