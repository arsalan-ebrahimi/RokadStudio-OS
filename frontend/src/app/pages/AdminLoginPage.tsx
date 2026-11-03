import React from 'react';
import { LoginForm } from '@/features/auth';

const AdminLoginPage: React.FC = () => {
  return <LoginForm title="ورود مدیران استودیو" isAdmin />;
};

export default AdminLoginPage;
