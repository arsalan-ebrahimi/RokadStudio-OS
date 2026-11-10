import React from 'react';
import { Navigate } from 'react-router-dom';
import { LoginForm, useAuthStore } from '@/features/auth';

const LoginPage: React.FC = () => {
  const { user, token } = useAuthStore();

  if (token && user) {
    const target =
      user.role === 'USER'
        ? '/'
        : user.role === 'SCRUM_ADMIN'
        ? '/scrum-admin'
        : '/panel/attendance';
    return <Navigate to={target} replace />;
  }

  return <LoginForm title="کد پرسنلی خود را وارد کنید" />;
};

export default LoginPage;
