import { createBrowserRouter, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import AdminLoginPage from './pages/AdminLoginPage';
import UserDashboardPage from './pages/UserDashboardPage';
import { AdminLayout } from './layout/AdminLayout';
import AdminAttendancePage from './pages/admin/AdminAttendancePage';
import AdminReportsPage from './pages/admin/AdminReportsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminProjectsPage from './pages/admin/AdminProjectsPage';
import { RequireRole } from '@/features/auth';

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
        element: <AdminAttendancePage />,
      },
      {
        path: 'reports',
        element: <AdminReportsPage />,
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
        element: <AdminProjectsPage />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
