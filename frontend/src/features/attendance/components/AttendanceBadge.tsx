import React from 'react';
import { Badge } from '@/shared/ui';
import type { Attendance } from '@/shared/types/models';

interface AttendanceBadgeProps {
  attendance: Attendance | null | undefined;
  className?: string;
}

export const AttendanceBadge: React.FC<AttendanceBadgeProps> = ({ attendance, className }) => {
  if (!attendance) {
    return <Badge variant="neutral" className={className}>ثبت نشده</Badge>;
  }

  if (attendance.status === 'ABSENT' || attendance.approval === 'REJECTED') {
    return <Badge variant="female" className={className}>عدم حضور</Badge>;
  }

  if (attendance.status === 'PRESENT' && attendance.approval === 'PENDING') {
    return <Badge variant="college" className={className}>حاضر (در انتظار تایید)</Badge>;
  }

  if (attendance.status === 'PRESENT' && attendance.approval === 'APPROVED') {
    return <Badge variant="ecosystem" className={className}>حاضر (تایید شده)</Badge>;
  }

  return <Badge variant="ecosystem" className={className}>حاضر</Badge>;
};

