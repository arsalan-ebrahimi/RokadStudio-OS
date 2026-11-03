import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { CheckSquare, BarChart3, Users, FolderKanban, LogOut, Sun, Moon, Menu, X } from 'lucide-react';
import { useAuthStore } from '@/features/auth';
import { cn } from '@/shared/lib/utils';
import { getTehranTodayString, formatToJalali } from '@/shared/lib/date';

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
    setIsDark(!isDark);
  };

  const navItems = [
    { to: '/panel/attendance', label: 'حضور و غیاب', icon: CheckSquare },
    { to: '/panel/reports', label: 'گزارش عملکرد', icon: BarChart3 },
    ...(isSuperAdmin ? [{ to: '/panel/users', label: 'کاربران', icon: Users }] : []),
    { to: '/panel/projects', label: 'پروژه‌ها', icon: FolderKanban },
  ];

  return (
    <div className="min-h-screen flex bg-[#F8F9FA] dark:bg-[#0B0F17]">
      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 start-0 z-50 w-64 bg-white dark:bg-[#121824] border-e border-[#EAEAEA] dark:border-gray-800 p-4 flex flex-col justify-between transition-transform duration-200 md:translate-x-0',
        mobileOpen ? 'translate-x-0' : 'max-md:translate-x-full'
      )}>
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
            <div>
              <h2 className="text-base font-black text-sec dark:text-white">پنل مدیریت رکاد</h2>
              <p className="text-xs text-ink-normal/60 dark:text-gray-400 mt-0.5">{user?.name}</p>
            </div>
            <button onClick={() => setMobileOpen(false)} className="md:hidden p-1 text-gray-500">
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) => cn(
                    'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all',
                    isActive
                      ? 'bg-ecosystem-light dark:bg-ecosystem-darker/60 text-ecosystem-darker dark:text-ecosystem-light border border-primary/40 shadow-[2px_2px_0_#59BBAF]'
                      : 'text-ink-normal/70 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  )}
                >
                  <Icon className="w-4 h-4 text-primary" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <button onClick={toggleTheme} className="p-2 rounded-xl text-gray-500 hover:text-sec dark:hover:text-white">
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button onClick={() => { logout(); navigate('/rokad-admin'); }} className="p-2 rounded-xl text-gray-500 hover:text-[#C60036]">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 md:ms-64 flex flex-col min-h-screen">
        <header className="h-16 px-4 sm:px-6 bg-white/90 dark:bg-[#121824]/90 backdrop-blur-md border-b border-[#EAEAEA] dark:border-gray-800 flex items-center justify-between sticky top-0 z-40">
          <button onClick={() => setMobileOpen(true)} className="md:hidden p-2 text-gray-600 dark:text-gray-200">
            <Menu className="w-6 h-6" />
          </button>
          <span className="text-xs sm:text-sm font-bold text-sec dark:text-gray-300">
            امروز: {formatToJalali(getTehranTodayString())}
          </span>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
