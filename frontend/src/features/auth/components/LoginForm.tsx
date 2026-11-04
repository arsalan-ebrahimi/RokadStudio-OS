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
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleComplete = async (submittedCode: string) => {
    const finalCode = (submittedCode || code).trim().toUpperCase();
    if (finalCode.length < 6) return;

    setError(null);
    setLoading(true);
    try {
      const user = await login(finalCode);
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
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-[#F8F9FA] via-[#F4F6F9] to-[#EAEFF5] dark:from-[#0B0F17] dark:via-[#0F141F] dark:to-[#121824]">
      <Card className="w-full max-w-sm sm:max-w-md p-6 sm:p-8 space-y-6 shadow-hard-lg dark:shadow-dark-hard">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#612B89] p-2.5 shadow-hard flex items-center justify-center">
            <img src="/rokad-sign.svg" alt="Rokad" className="w-full h-full object-contain filter invert" />
          </div>
          <h1 className="text-lg sm:text-xl font-black text-sec dark:text-white">{title}</h1>
        </div>

        <div className="space-y-4">
          <OtpInput
            onComplete={(val) => {
              setCode(val);
              handleComplete(val);
            }}
            isLoading={loading}
            hasError={Boolean(error)}
          />

          {error && (
            <p className="text-xs text-[#C60036] font-bold text-center leading-relaxed">
              {error}
            </p>
          )}

          <Button
            variant="primary"
            className="w-full"
            isLoading={loading}
            disabled={code.length < 6}
            onClick={() => handleComplete(code)}
          >
            ورود
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default LoginForm;
