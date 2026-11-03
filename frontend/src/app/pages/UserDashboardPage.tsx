import React, { useState, useEffect } from 'react';
import { LogOut, Sun, Moon } from 'lucide-react';
import { useAuthStore } from '@/features/auth';
import { useTodayAttendance, useMidnightWatcher, AttendanceBadge, AttendanceModal } from '@/features/attendance';
import { useMyProjects, ProjectSelect } from '@/features/projects';
import { useTimer, TimerDisplay, BreakOverlay } from '@/features/timer';
import { Card } from '@/shared/ui';
import { toPersianDigits, formatDurationToHoursMins } from '@/shared/lib/formatters';

const UserDashboardPage: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { attendance, isLoading: attLoading, markPresent, isSubmitting } = useTodayAttendance();
  useMidnightWatcher();

  const { data: projects = [], isLoading: projectsLoading } = useMyProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const { state, remaining, start, pause, reset, isLocked } = useTimer(selectedProjectId);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
    setIsDark(!isDark);
  };

  const hasDeclaredToday = Boolean(attendance);
  const totalSeconds = attendance?.totalSeconds || 0;
  const sessionsCount = attendance?.sessionsCount || 0;

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-lg mx-auto space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-base font-black text-sec dark:text-white">{user?.name}</h1>
            <div className="mt-1">
              <AttendanceBadge attendance={attendance} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-white"
            aria-label="تغییر تم"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            onClick={logout}
            className="p-2 rounded-xl text-gray-500 hover:text-[#C60036]"
            aria-label="خروج"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Focus Card */}
      <Card className="p-6 space-y-6">
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

      {/* Daily Summary */}
      <Card className="p-4 flex items-center justify-between text-xs sm:text-sm font-bold">
        <span className="text-ink-normal/70 dark:text-gray-400">عملکرد امروز</span>
        <div className="flex items-center gap-3 text-sec dark:text-white">
          <span>{toPersianDigits(sessionsCount)} دور</span>
          <span>•</span>
          <span>{formatDurationToHoursMins(totalSeconds)}</span>
        </div>
      </Card>

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

