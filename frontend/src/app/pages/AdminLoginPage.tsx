import React from 'react';
import { Navigate } from 'react-router-dom';
import { LoginForm, useAuthStore } from '@/features/auth';

const AdminLoginPage: React.FC = () => {
  const { user, token } = useAuthStore();

  if (token && user) {
    if (user.role === 'SCRUM_ADMIN') {
      return <Navigate to="/scrum-admin" replace />;
    }
    return <Navigate to={user.role === 'USER' ? '/' : '/panel/attendance'} replace />;
  }

  return <LoginForm title="ورود مدیران استودیو" isAdmin />;
};

export default AdminLoginPage;
