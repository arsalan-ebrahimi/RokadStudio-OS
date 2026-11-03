import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '@/shared/ui';
import { OtpInput } from './OtpInput';
import { useAuthStore } from '../hooks/use-auth-store';
import { ApiError } from '@/shared/types/api';

interface LoginFormProps {
  title: string;
  isAdmin?: boolean;
}

export const LoginForm: React.FC<LoginFormProps> = ({ title, isAdmin = false }) => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleComplete = async (code: string) => {
    setError(null);
    setLoading(true);
    try {
      const user = await login(code);
      if (isAdmin && user.role === 'USER') {
        setError('دسترسی مدیریت ندارید');
        return;
      }
      if (!isAdmin && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')) {
        navigate('/panel/attendance');
        return;
      }
      navigate(isAdmin ? '/panel/attendance' : '/');
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError('تعداد تلاش بیش از حد مجاز. ۱۵ دقیقه بعد تلاش کنید.');
      } else {
        setError('کد نامعتبر است یا حساب غیرفعال شده است');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-lg font-black text-sec dark:text-white">{title}</h1>
        </div>

        <OtpInput onComplete={handleComplete} isLoading={loading} hasError={Boolean(error)} />

        {error && (
          <p className="text-xs text-[#C60036] font-bold text-center leading-relaxed">
            {error}
          </p>
        )}

        <div className="pt-2">
          <Button variant="primary" className="w-full" isLoading={loading}>
            ورود
          </Button>
        </div>
      </Card>
    </div>
  );
};
