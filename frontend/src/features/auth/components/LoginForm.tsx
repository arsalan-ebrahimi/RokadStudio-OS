import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '@/shared/ui';
import { useAuthStore } from '../hooks/use-auth-store';
import { toEnglishDigits } from '@/shared/lib/formatters';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = toEnglishDigits(code).trim();
    if (cleanCode.length < 6) {
      setError('کد پرسنلی باید حداقل ۶ کاراکتر باشد');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const user = await login(cleanCode);
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
        setError(err instanceof Error ? err.message : 'کد نامعتبر است یا حساب غیرفعال شده است');
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-ink-normal/80 dark:text-gray-300">
              {isAdmin ? 'کد مدیریت' : 'کد پرسنلی'}
            </label>
            <input
              type="text"
              dir="ltr"
              autoFocus
              disabled={loading}
              value={code}
              onChange={(e) => setCode(toEnglishDigits(e.target.value).trim())}
              placeholder={isAdmin ? 'super_admin_2026' : 'ROK1101'}
              className="w-full px-4 py-3 text-center text-base sm:text-lg font-black font-mono tracking-widest rounded-xl border-2 border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A2234] text-sec dark:text-white shadow-hard-sm focus:outline-none focus:border-primary transition-all"
            />
          </div>

          {error && (
            <p className="text-xs text-[#C60036] font-bold text-center leading-relaxed">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" className="w-full mt-2" isLoading={loading} disabled={code.trim().length < 6}>
            ورود
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default LoginForm;
