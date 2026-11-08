import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import AdminLoginPage from './pages/AdminLoginPage';
import UserDashboardPage from './pages/UserDashboardPage';
import { Skeleton } from '@/shared/ui';
import { RequireRole } from '@/features/auth';

const AdminLayout = lazy(() => import('./layout/AdminLayout').then(m => ({ default: m.AdminLayout })));
const AdminAttendancePage = lazy(() => import('./pages/admin/AdminAttendancePage'));
const AdminReportsPage = lazy(() => import('./pages/admin/AdminReportsPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminProjectsPage = lazy(() => import('./pages/admin/AdminProjectsPage'));

const PageFallback = () => (
  <div className="p-4 sm:p-6 space-y-4 max-w-5xl mx-auto">
    <Skeleton className="h-10 w-48 rounded-xl" />
    <Skeleton className="h-32 w-full rounded-2xl" />
    <Skeleton className="h-64 w-full rounded-2xl" />
  </div>
);

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/rokad-admin',
    element: <AdminLoginPage />,
  },
  {
    path: '/',
    element: (
      <RequireRole roles={['USER']}>
        <UserDashboardPage />
      </RequireRole>
    ),
  },
  {
    path: '/panel',
    element: (
      <RequireRole roles={['ADMIN', 'SUPER_ADMIN']}>
        <Suspense fallback={<PageFallback />}>
          <AdminLayout />
        </Suspense>
      </RequireRole>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/panel/attendance" replace />,
      },
      {
        path: 'attendance',
        element: (
          <Suspense fallback={<PageFallback />}>
            <AdminAttendancePage />
          </Suspense>
        ),
      },
      {
        path: 'reports',
        element: (
          <Suspense fallback={<PageFallback />}>
            <AdminReportsPage />
          </Suspense>
        ),
      },
      {
        path: 'users',
        element: (
          <RequireRole roles={['SUPER_ADMIN']}>
            <Suspense fallback={<PageFallback />}>
              <AdminUsersPage />
            </Suspense>
          </RequireRole>
        ),
      },
      {
        path: 'projects',
        element: (
          <Suspense fallback={<PageFallback />}>
            <AdminProjectsPage />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

