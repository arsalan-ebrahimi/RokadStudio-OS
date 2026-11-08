import React from 'react';
import { Badge } from '@/shared/ui';
import type { ApprovalStatus } from '@/shared/types/models';

interface SessionBadgeProps {
  approval?: ApprovalStatus;
  className?: string;
}

export const SessionBadge: React.FC<SessionBadgeProps> = ({ approval = 'PENDING', className }) => {
  if (approval === 'APPROVED') {
    return <Badge variant="ecosystem" className={className}>تایید شده</Badge>;
  }
  if (approval === 'REJECTED') {
    return <Badge variant="female" className={className}>رد شده</Badge>;
  }
  return <Badge variant="college" className={className}>در انتظار تایید</Badge>;
};

