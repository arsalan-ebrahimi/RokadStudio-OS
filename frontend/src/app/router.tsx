import { createBrowserRouter, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import AdminLoginPage from './pages/AdminLoginPage';
import UserDashboardPage from './pages/UserDashboardPage';
import { AdminLayout } from './layout/AdminLayout';
import { ScrumAdminLayout } from './layout/ScrumAdminLayout';
import AdminAttendancePage from './pages/admin/AdminAttendancePage';
import AdminReportsPage from './pages/admin/AdminReportsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminProjectsPage from './pages/admin/AdminProjectsPage';
import { RequireRole } from '@/features/auth';
import {
  ScrumListPage,
  ScrumDetailPage,
  ScrumAdminDashboardPage,
} from '@/features/scrum';

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
      <RequireRole roles={['USER', 'SCRUM_ADMIN', 'ADMIN', 'SUPER_ADMIN']}>
        <UserDashboardPage />
      </RequireRole>
    ),
  },
  {
    path: '/app',
    element: (
      <RequireRole roles={['USER', 'SCRUM_ADMIN', 'ADMIN', 'SUPER_ADMIN']}>
        <UserDashboardPage />
      </RequireRole>
    ),
  },
  {
    path: '/my-scrums',
    element: (
      <RequireRole roles={['USER', 'ADMIN', 'SUPER_ADMIN', 'SCRUM_ADMIN']}>
        <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0B0F17] p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          <ScrumListPage />
        </div>
      </RequireRole>
    ),
  },
  {
    path: '/my-scrums/:id',
    element: (
      <RequireRole roles={['USER', 'ADMIN', 'SUPER_ADMIN', 'SCRUM_ADMIN']}>
        <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0B0F17] p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          <ScrumDetailPage />
        </div>
      </RequireRole>
    ),
  },
  {
    path: '/scrum-admin',
    element: (
      <RequireRole roles={['SCRUM_ADMIN', 'SUPER_ADMIN']}>
        <ScrumAdminLayout />
      </RequireRole>
    ),
    children: [
      {
        index: true,
        element: <ScrumAdminDashboardPage />,
      },
      {
        path: 'scrums',
        element: <ScrumListPage />,
      },
      {
        path: 'scrums/:id',
        element: <ScrumDetailPage />,
      },
    ],
  },
  {
    path: '/panel',
    element: (
      <RequireRole roles={['ADMIN', 'SUPER_ADMIN']}>
        <AdminLayout />
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
          <RequireRole roles={['ADMIN', 'SUPER_ADMIN']}>
            <AdminAttendancePage />
          </RequireRole>
        ),
      },
      {
        path: 'reports',
        element: (
          <RequireRole roles={['ADMIN', 'SUPER_ADMIN']}>
            <AdminReportsPage />
          </RequireRole>
        ),
      },
      {
        path: 'users',
        element: (
          <RequireRole roles={['SUPER_ADMIN']}>
            <AdminUsersPage />
          </RequireRole>
        ),
      },
      {
        path: 'projects',
        element: (
          <RequireRole roles={['ADMIN', 'SUPER_ADMIN']}>
            <AdminProjectsPage />
          </RequireRole>
        ),
      },
      {
        path: 'scrums',
        element: (
          <RequireRole roles={['SUPER_ADMIN']}>
            <ScrumListPage />
          </RequireRole>
        ),
      },
      {
        path: 'scrums/:id',
        element: (
          <RequireRole roles={['SUPER_ADMIN']}>
            <ScrumDetailPage />
          </RequireRole>
        ),
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
