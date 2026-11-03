import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Role } from '@/shared/types/models';
import { useAuthStore } from '../hooks/use-auth-store';
import { Skeleton } from '@/shared/ui';

interface RequireRoleProps {
  roles: Role[];
  children: React.ReactNode;
}

export const RequireRole: React.FC<RequireRoleProps> = ({ roles, children }) => {
  const { user, token, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Skeleton className="w-64 h-16" />
      </div>
    );
  }

  if (!token || !user) {
    const target = location.pathname.startsWith('/panel') ? '/rokad-admin' : '/login';
    return <Navigate to={target} state={{ from: location }} replace />;
  }

  if (!roles.includes(user.role)) {
    return <Navigate to={user.role === 'USER' ? '/' : '/panel/attendance'} replace />;
  }

  return <>{children}</>;
};
