import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Role, User } from '@/shared/types/models';
import { useAuthStore } from '../hooks/use-auth-store';
import { Skeleton } from '@/shared/ui';

interface RequireRoleProps {
  roles: Role[];
  allowWhen?: (user: User) => boolean;
  redirectTo?: string | ((user: User) => string);
  children: React.ReactNode;
}

export function getDefaultHomeForUser(user: User): string {
  if (user.role === 'USER') return '/';
  if (user.role === 'SCRUM_ADMIN') return '/scrum-admin';
  return '/panel/attendance';
}

export const RequireRole: React.FC<RequireRoleProps> = ({
  roles,
  allowWhen,
  redirectTo,
  children,
}) => {
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
    const isAdminArea = location.pathname.startsWith('/panel') || location.pathname.startsWith('/scrum-admin');
    const target = isAdminArea ? '/rokad-admin' : '/login';
    return <Navigate to={target} state={{ from: location }} replace />;
  }

  if (!roles.includes(user.role) || (allowWhen && !allowWhen(user))) {
    const target =
      typeof redirectTo === 'function'
        ? redirectTo(user)
        : redirectTo || getDefaultHomeForUser(user);
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
};

