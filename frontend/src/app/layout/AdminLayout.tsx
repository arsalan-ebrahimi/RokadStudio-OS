import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { CheckSquare, BarChart3, Users, FolderKanban, LogOut, Sun, Moon, Menu, X, Layers } from 'lucide-react';
import { useAuthStore } from '@/features/auth';
import { cn } from '@/shared/lib/utils';
import { getTehranTodayString, formatToJalali } from '@/shared/lib/date';
import { useTheme } from '@/shared/lib/theme';

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isDark, toggleTheme } = useTheme();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isScrumAdmin = user?.role === 'SCRUM_ADMIN';

  const navItems = isScrumAdmin
    ? [{ to: '/panel/scrums', label: 'اسکرام‌ها', icon: Layers }]
    : [
        { to: '/panel/attendance', label: 'حضور و غیاب', icon: CheckSquare },
        { to: '/panel/reports', label: 'گزارش عملکرد', icon: BarChart3 },
        ...(isSuperAdmin ? [{ to: '/panel/users', label: 'کاربران', icon: Users }] : []),
        { to: '/panel/projects', label: 'پروژه‌ها', icon: FolderKanban },
        ...(isSuperAdmin ? [{ to: '/panel/scrums', label: 'اسکرام‌ها', icon: Layers }] : []),
      ];

  const currentNav = navItems.find((item) => location.pathname.startsWith(item.to));

  return (
    <div className="min-h-screen flex bg-[#F8F9FA] dark:bg-[#0B0F17] overflow-x-hidden">
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 start-0 z-50 w-64 bg-white dark:bg-[#121824] border-e border-[#EAEAEA] dark:border-gray-800 p-4 flex flex-col justify-between transition-all duration-200 md:translate-x-0 md:opacity-100 md:pointer-events-auto',
        mobileOpen
          ? 'translate-x-0 opacity-100 pointer-events-auto shadow-2xl'
          : 'max-md:translate-x-full max-md:opacity-0 max-md:pointer-events-none'
      )}>
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#612B89] p-2 shadow-hard flex items-center justify-center shrink-0">
                <img src="/rokad-sign.svg" alt="Rokad" className="w-full h-full object-contain filter invert" />
              </div>
              <div>
                <h2 className="text-sm font-black text-sec dark:text-white leading-tight">رکاد استودیو</h2>
                <p className="text-[11px] text-ink-normal/60 dark:text-gray-400 mt-0.5">{user?.name}</p>
              </div>
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
      </aside>

      {/* Main Content */}
      <div className="flex-1 md:ms-64 flex flex-col min-h-screen min-w-0 overflow-x-hidden">
        <header className="h-16 px-4 sm:px-6 lg:px-8 bg-white/90 dark:bg-[#121824]/90 backdrop-blur-md border-b border-[#EAEAEA] dark:border-gray-800 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden w-[38px] h-[38px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#182030] text-gray-600 dark:text-gray-200 shadow-hard-sm shrink-0 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              aria-label="منو"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden md:flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold text-ink-normal/50 dark:text-gray-400 whitespace-nowrap">سامانه مدیریت</span>
              <span className="text-xs text-ink-normal/30 dark:text-gray-600">/</span>
              <span className="text-xs font-medium text-ink-normal/70 dark:text-gray-300 whitespace-nowrap">رکاد استودیو</span>
              {currentNav && (
                <>
                  <span className="text-xs text-ink-normal/30 dark:text-gray-600">/</span>
                  <span className="text-xs font-black text-sec dark:text-white whitespace-nowrap">{currentNav.label}</span>
                </>
              )}
            </div>
            <div className="md:hidden flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-[#612B89] p-1.5 shadow-hard-sm flex items-center justify-center shrink-0">
                <img src="/rokad-sign.svg" alt="Rokad" className="w-full h-full object-contain filter invert" />
              </div>
              <span className="text-xs sm:text-sm font-black text-sec dark:text-white truncate">
                {currentNav?.label || 'رکاد استودیو'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <span className="hidden min-[480px]:flex text-[11px] sm:text-xs font-bold text-sec dark:text-gray-300 bg-gray-100 dark:bg-[#182030] px-2.5 sm:px-3 h-[38px] items-center rounded-xl border border-gray-200 dark:border-gray-700 whitespace-nowrap shrink-0">
              <span className="hidden sm:inline">امروز: </span>
              <span>{formatToJalali(getTehranTodayString(), false)}</span>
            </span>
            <button
              onClick={toggleTheme}
              className="w-[38px] h-[38px] flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#182030] text-gray-500 hover:text-sec dark:hover:text-white shadow-hard-sm transition-all shrink-0"
              aria-label="تغییر تم"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => {
                logout();
                navigate('/rokad-admin');
              }}
              className="h-[38px] flex items-center gap-1.5 px-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-[#C60036] dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 shadow-hard-sm transition-all text-xs font-bold shrink-0"
              title="خروج از حساب"
              aria-label="خروج از حساب"
            >
              <LogOut className="w-4 h-4 shrink-0 text-[#C60036] dark:text-rose-400" />
              <span className="hidden sm:inline whitespace-nowrap">خروج از حساب</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
