import React, { useState, useEffect } from 'react';
import { LogOut, Sun, Moon, Clock, Flame, FolderKanban } from 'lucide-react';
import { useAuthStore } from '@/features/auth';
import { useTodayAttendance, useMidnightWatcher, AttendanceBadge, AttendanceModal } from '@/features/attendance';
import { useMyProjects, ProjectSelect } from '@/features/projects';
import { useTimer, useTimerStore, TimerDisplay, BreakOverlay } from '@/features/timer';
import { Card } from '@/shared/ui';
import { toPersianDigits, formatDurationToHoursMins } from '@/shared/lib/formatters';
import { formatToJalali, getTehranTodayString } from '@/shared/lib/date';

const UserDashboardPage: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { attendance, isLoading: attLoading, markPresent, isSubmitting } = useTodayAttendance();
  useMidnightWatcher();

  const { data: projects = [], isLoading: projectsLoading } = useMyProjects();

  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(() => {
    const saved = localStorage.getItem('rokad_selected_project');
    return saved ? Number(saved) : null;
  });

  const { state, remaining, start, pause, reset, isLocked, savedProjectId } = useTimer(selectedProjectId);

  useEffect(() => {
    if (savedProjectId && !selectedProjectId) {
      setSelectedProjectId(savedProjectId);
    } else if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    } else if (selectedProjectId && projects.length > 0 && !projects.some((p) => p.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId, savedProjectId]);

  useEffect(() => {
    if (selectedProjectId) {
      localStorage.setItem('rokad_selected_project', String(selectedProjectId));
      useTimerStore.getState().setProjectId(selectedProjectId);
    }
  }, [selectedProjectId]);

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
    setIsDark(!isDark);
  };

  const hasDeclaredToday = Boolean(attendance);
  const totalSeconds = attendance?.totalSeconds || 0;
  const sessionsCount = attendance?.sessionsCount || 0;
  const currentProject = projects.find((p) => p.id === selectedProjectId);

  // Desktop keyboard shortcut: Space to toggle start/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        if (state === 'RUNNING') {
          pause();
        } else if (hasDeclaredToday && Boolean(selectedProjectId) && state !== 'BREAK' && state !== 'DONE') {
          start();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, hasDeclaredToday, selectedProjectId, start, pause]);

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 max-w-xl lg:max-w-5xl mx-auto space-y-6 lg:space-y-8">
      {/* Header */}
      <header className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#612B89] p-2 shadow-hard flex items-center justify-center shrink-0">
            <img src="/rokad-sign.svg" alt="Rokad" className="w-full h-full object-contain filter invert" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-black text-sec dark:text-white leading-tight truncate">{user?.name}</h1>
            <div className="mt-1 flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <AttendanceBadge attendance={attendance} />
              <span className="text-[10px] sm:text-[11px] text-ink-normal/50 dark:text-gray-400 font-bold whitespace-nowrap">
                <span className="hidden sm:inline">{formatToJalali(getTehranTodayString(), true)}</span>
                <span className="sm:hidden">{formatToJalali(getTehranTodayString(), false)}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={toggleTheme}
            className="p-2 sm:p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#182030] text-gray-500 hover:text-gray-900 dark:hover:text-white shadow-hard-sm transition-all"
            aria-label="تغییر تم"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={logout}
            className="p-2 sm:p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#182030] text-gray-500 hover:text-[#C60036] shadow-hard-sm transition-all"
            aria-label="خروج"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content: Responsive layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Focus Timer Area */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          <Card className="p-5 sm:p-7 space-y-6">
            {!projectsLoading && (
              <ProjectSelect
                projects={projects}
                selectedProjectId={selectedProjectId}
                onSelect={setSelectedProjectId}
                isLocked={isLocked}
              />
            )}

            <TimerDisplay
              remaining={remaining}
              state={state}
              onStart={start}
              onPause={pause}
              onReset={reset}
              canStart={hasDeclaredToday && Boolean(selectedProjectId)}
            />
          </Card>

          {/* Desktop Keyboard Tip */}
          <div className="hidden lg:flex items-center justify-center gap-2 text-xs font-bold text-ink-normal/50 dark:text-gray-400">
            <span>کلید میانبر:</span>
            <kbd className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 font-mono text-[11px] text-sec dark:text-white shadow-sm">
              Space
            </kbd>
            <span>برای شروع یا توقف</span>
          </div>
        </div>

        {/* Sidebar Cards Area on Desktop */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4">
          {/* Daily Performance Card */}
          <Card className="p-5 space-y-4">
            <h2 className="text-xs font-bold text-ink-normal/60 dark:text-gray-400">عملکرد امروز</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-[#182030] border border-gray-200 dark:border-gray-700 space-y-1">
                <div className="flex items-center gap-1.5 text-third">
                  <Flame className="w-4 h-4" />
                  <span className="text-[11px] font-bold text-ink-normal/60 dark:text-gray-400">دورهای تکمیل</span>
                </div>
                <p className="text-xl font-black text-sec dark:text-white tabular-nums">
                  {toPersianDigits(sessionsCount)} <span className="text-xs font-bold">دور</span>
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-[#182030] border border-gray-200 dark:border-gray-700 space-y-1">
                <div className="flex items-center gap-1.5 text-primary">
                  <Clock className="w-4 h-4" />
                  <span className="text-[11px] font-bold text-ink-normal/60 dark:text-gray-400">مجموع زمان</span>
                </div>
                <p className="text-xl font-black text-primary tabular-nums">
                  {formatDurationToHoursMins(totalSeconds)}
                </p>
              </div>
            </div>
          </Card>

          {/* Active Info Card */}
          <Card className="p-5 space-y-3.5">
            <h2 className="text-xs font-bold text-ink-normal/60 dark:text-gray-400">جزئیات نشست</h2>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-ink-normal/60 dark:text-gray-400 font-bold">پروژه جاری</span>
                <span className="font-extrabold text-sec dark:text-white flex items-center gap-1">
                  <FolderKanban className="w-3.5 h-3.5 text-primary" />
                  {currentProject?.name || 'انتخاب نشده'}
                </span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-ink-normal/60 dark:text-gray-400 font-bold">وضعیت حضور</span>
                <AttendanceBadge attendance={attendance} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-normal/60 dark:text-gray-400 font-bold">تاریخ سیستم</span>
                <span className="font-bold text-sec dark:text-white">{formatToJalali(getTehranTodayString(), true)}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Mandatory Modals */}
      <AttendanceModal
        isOpen={!attLoading && !hasDeclaredToday}
        userName={user?.name || ''}
        onConfirm={markPresent}
        isLoading={isSubmitting}
      />

      {state === 'BREAK' && <BreakOverlay remaining={remaining} />}
    </div>
  );
};

export default UserDashboardPage;

