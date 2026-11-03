import React from 'react';
import { Badge } from '@/shared/ui';
import type { Attendance } from '@/shared/types/models';

interface AttendanceBadgeProps {
  attendance: Attendance | null | undefined;
}

export const AttendanceBadge: React.FC<AttendanceBadgeProps> = ({ attendance }) => {
  if (!attendance) {
    return <Badge variant="neutral">ثبت نشده</Badge>;
  }

  if (attendance.approval === 'REJECTED') {
    return <Badge variant="female">غایب</Badge>;
  }

  if (attendance.approval === 'PENDING') {
    return <Badge variant="college">در انتظار تایید</Badge>;
  }

  return <Badge variant="ecosystem">حاضر</Badge>;
};
