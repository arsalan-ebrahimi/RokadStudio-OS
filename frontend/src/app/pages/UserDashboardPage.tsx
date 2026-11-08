import React, { useState, useEffect } from 'react';
import {
  LogOut,
  Sun,
  Moon,
  Clock,
  Flame,
  FolderKanban,
  Sparkles,
  Rocket,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { useAuthStore } from '@/features/auth';
import { useTodayAttendance, useMidnightWatcher, AttendanceBadge, AttendanceModal } from '@/features/attendance';
import { useMyProjects, ProjectSelect } from '@/features/projects';
import {
  useTimer,
  TimerDisplay,
  RegisterDialog,
  ProjectChangeDialog,
} from '@/features/timer';
import { ScreenPet, PetSelectorModal } from '@/features/pet';
import { Card, Button, Modal } from '@/shared/ui';
import { toPersianDigits, formatDurationToHoursMins } from '@/shared/lib/formatters';
import { formatToJalali, getTehranTodayString } from '@/shared/lib/date';

const UserDashboardPage: React.FC = () => {
  const { user, logout } = useAuthStore();
  const {
    attendance,
    isLoading: attLoading,
    markPresent,
    markAbsent,
    isSubmitting: attSubmitting,
  } = useTodayAttendance();
  useMidnightWatcher();

  const { data: projects = [], isLoading: projectsLoading } = useMyProjects();

  const [isPetModalOpen, setIsPetModalOpen] = useState(false);
  const [isConfirmComeOpen, setIsConfirmComeOpen] = useState(false);

  const timer = useTimer(null);

  // Validate that the timer's selected project actually belongs to the user's assigned projects
  useEffect(() => {
    if (!projectsLoading && projects.length > 0) {
      if (timer.projectId && !projects.some((p) => p.id === timer.projectId)) {
        timer.clearProject();
      }
    }
  }, [projectsLoading, projects, timer.projectId, timer.clearProject]);

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
    setIsDark(!isDark);
  };

  const hasDeclaredToday = Boolean(attendance);
  const isAbsentToday = attendance?.status === 'ABSENT';
  const totalSeconds = attendance?.totalSeconds || 0;
  const sessionsCount = attendance?.sessionsCount || 0;
  const currentProject = projects.find((p) => p.id === timer.projectId);

  // Desktop keyboard shortcut: Space to toggle start/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        if (timer.status === 'RUNNING') {
          timer.pause();
        } else if (hasDeclaredToday && !isAbsentToday && timer.canStart && !timer.mainButtonDisabled) {
          timer.start();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [timer, hasDeclaredToday, isAbsentToday]);

  const handleProjectSelect = (projectId: number) => {
    const p = projects.find((item) => item.id === projectId);
    timer.handleSelectProject(projectId, p?.name || '');
  };

  if (attLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#F8F9FA] dark:bg-[#0B0F17]">
        <div className="w-14 h-14 rounded-2xl bg-[#612B89] p-3 shadow-hard flex items-center justify-center mb-4 animate-pulse">
          <img src="/rokad-sign.svg" alt="Rokad" className="w-full h-full object-contain filter invert" />
        </div>
        <div className="flex items-center gap-2 text-sec dark:text-white font-bold text-xs sm:text-sm">
          <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
          <span>در حال بررسی وضعیت حضور...</span>
        </div>
      </div>
    );
  }

  // Dedicated Absence Screen if user declared ABSENT today
  if (isAbsentToday) {
    return (
      <div className="min-h-screen p-4 sm:p-6 lg:p-8 max-w-xl lg:max-w-3xl mx-auto flex flex-col justify-between">
        {/* Header */}
        <header className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#612B89] p-2 shadow-hard flex items-center justify-center shrink-0">
              <img src="/rokad-sign.svg" alt="Rokad" className="w-full h-full object-contain filter invert" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-black text-sec dark:text-white leading-tight truncate">
                {user?.name}
              </h1>
              <div className="mt-1 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <AttendanceBadge attendance={attendance} />
                <span className="text-[10px] sm:text-[11px] text-ink-normal/50 dark:text-gray-400 font-bold whitespace-nowrap">
                  {formatToJalali(getTehranTodayString(), true)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={toggleTheme}
              className="w-[38px] h-[38px] flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#182030] text-gray-500 hover:text-gray-900 dark:hover:text-white shadow-hard-sm transition-all cursor-pointer"
              aria-label="تغییر تم"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={logout}
              className="h-[38px] flex items-center gap-1.5 px-2.5 sm:px-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-[#C60036] dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 shadow-hard-sm transition-all text-xs font-bold shrink-0 cursor-pointer"
              aria-label="خروج از حساب"
              title="خروج از حساب"
            >
              <LogOut className="w-4 h-4 shrink-0 text-[#C60036] dark:text-rose-400" />
              <span className="hidden sm:inline whitespace-nowrap">خروج از حساب</span>
            </button>
          </div>
        </header>

        {/* Absence Presentation Box */}
        <div className="my-auto py-8">
          <Card className="p-6 sm:p-10 text-center space-y-6 border-2 border-primary/25 shadow-hard-lg">
            {/* Friendly Graphic */}
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 mx-auto flex items-center justify-center">
              <div className="w-full h-full rounded-3xl bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-950/40 dark:to-[#182030] border-2 border-amber-300 dark:border-amber-700/60 flex items-center justify-center text-5xl sm:text-6xl shadow-hard">
                🏖️
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-black text-sec dark:text-white">
                گفتی امروز نمی‌آی :(
              </h2>
              <p className="text-xs sm:text-sm text-ink-normal/70 dark:text-gray-300 max-w-md mx-auto leading-relaxed">
                استراحت خوبی داشته باشی {user?.name} عزیز! عدم حضور شما برای امروز در سامانه ثبت شده است و نیازی به فعالیت نیست.
              </p>
            </div>

            {/* Absence Details Pill */}
            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-[#182030] border border-gray-200 dark:border-gray-700 inline-flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-xs font-bold mx-auto text-ink-normal/80 dark:text-gray-300">
              <span className="flex items-center gap-1.5 text-primary">
                <Calendar className="w-4 h-4" />
                <span>{formatToJalali(getTehranTodayString(), true)}</span>
              </span>
              {attendance.reason && (
                <>
                  <span className="hidden sm:inline text-gray-300 dark:text-gray-600">•</span>
                  <span className="text-amber-600 dark:text-amber-400">
                    علت: {attendance.reason}
                  </span>
                </>
              )}
            </div>

            {/* Change mind section */}
            <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
              <p className="text-xs text-ink-normal/60 dark:text-gray-400 font-bold">
                برنامه‌ات تغییر کرد و می‌خوای امروز کار کنی؟
              </p>
              <Button
                variant="primary"
                onClick={() => setIsConfirmComeOpen(true)}
                isLoading={attSubmitting}
                className="w-full sm:w-auto px-8 py-3.5 text-sm font-extrabold shadow-hard inline-flex items-center justify-center gap-2"
              >
                <Rocket className="w-5 h-5" />
                <span>امروز هم می‌آم!</span>
              </Button>
            </div>
          </Card>
        </div>

        {/* Change Mind Confirmation Modal */}
        <Modal
          isOpen={isConfirmComeOpen}
          onClose={() => setIsConfirmComeOpen(false)}
          title="ثبت حضور و شروع کار"
        >
          <div className="space-y-4 text-center py-2">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/20 text-primary flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-base font-extrabold text-sec dark:text-white">
                مطمئنی می‌خوای بیای؟
              </h4>
              <p className="text-xs sm:text-sm text-ink-normal/70 dark:text-gray-300 leading-relaxed">
                با تایید این درخواست، وضعیت حضور امروز شما به «حاضر» تغییر می‌کند و می‌توانید پروژه‌تان را انتخاب و تایمر را شروع کنید.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 py-2.5 text-xs font-bold"
                onClick={() => setIsConfirmComeOpen(false)}
                disabled={attSubmitting}
              >
                انصراف
              </Button>
              <Button
                variant="primary"
                className="flex-[2] py-2.5 text-xs font-bold flex items-center justify-center gap-1.5"
                isLoading={attSubmitting}
                onClick={async () => {
                  await markPresent();
                  setIsConfirmComeOpen(false);
                }}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>بله، حاضرم</span>
              </Button>
            </div>
          </div>
        </Modal>

        {/* Footer info */}
        <footer className="text-center py-2 text-[11px] text-ink-normal/40 dark:text-gray-500 font-bold">
          رکاد استودیو | سیستم مدیریت زمان و حضور
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 max-w-xl lg:max-w-5xl mx-auto space-y-6 lg:space-y-8">
      {/* Header */}
      <header className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#612B89] p-2 shadow-hard flex items-center justify-center shrink-0">
            <img src="/rokad-sign.svg" alt="Rokad" className="w-full h-full object-contain filter invert" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-black text-sec dark:text-white leading-tight truncate">
              {user?.name}
            </h1>
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
            onClick={() => setIsPetModalOpen(true)}
            className="w-[38px] h-[38px] flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#182030] text-gray-500 hover:text-sec dark:hover:text-white shadow-hard-sm transition-all cursor-pointer"
            title="انتخاب همراه تمرکز"
            aria-label="همراه تمرکز"
          >
            <Sparkles className="w-4 h-4 text-primary" />
          </button>
          <button
            onClick={toggleTheme}
            className="w-[38px] h-[38px] flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#182030] text-gray-500 hover:text-gray-900 dark:hover:text-white shadow-hard-sm transition-all cursor-pointer"
            aria-label="تغییر تم"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={logout}
            className="h-[38px] flex items-center gap-1.5 px-2.5 sm:px-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-[#C60036] dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 shadow-hard-sm transition-all text-xs font-bold shrink-0 cursor-pointer"
            aria-label="خروج از حساب"
            title="خروج از حساب"
          >
            <LogOut className="w-4 h-4 shrink-0 text-[#C60036] dark:text-rose-400" />
            <span className="hidden sm:inline whitespace-nowrap">خروج از حساب</span>
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
                selectedProjectId={timer.projectId}
                onSelect={handleProjectSelect}
                isLocked={timer.isLocked}
              />
            )}

            <TimerDisplay
              status={timer.status}
              workSeconds={timer.workSeconds}
              pomodoroRemainingSeconds={timer.pomodoroRemainingSeconds}
              pomodoroMode={timer.pomodoroMode}
              mainButtonLabel={timer.mainButtonLabel}
              mainButtonDisabled={timer.mainButtonDisabled || !hasDeclaredToday}
              mainButtonDisabledReason={
                !hasDeclaredToday ? 'ابتدا حضور امروز خود را ثبت کنید.' : timer.mainButtonDisabledReason
              }
              registerButtonDisabled={timer.registerButtonDisabled}
              registerButtonDisabledReason={timer.registerButtonDisabledReason}
              onMainClick={timer.status === 'RUNNING' ? timer.pause : timer.start}
              onRegisterClick={timer.openRegisterDialog}
              showFocusBanner={timer.showFocusBanner}
              onDismissFocusBanner={timer.dismissFocusBanner}
              showRecoveredNotice={timer.showRecoveredNotice}
              onDismissRecoveredNotice={timer.dismissRecoveredNotice}
              isOtherTabActive={timer.isOtherTabActive}
              isSubmitting={timer.isSubmitting}
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
        onConfirmPresent={markPresent}
        onConfirmAbsent={(reason) => markAbsent(reason)}
        isLoading={attSubmitting}
      />

      {/* Registration Dialog */}
      <RegisterDialog
        isOpen={timer.isRegisterDialogOpen}
        onClose={timer.closeRegisterDialog}
        projectName={currentProject?.name || 'پروژه جاری'}
        durationSeconds={timer.workSeconds}
        isLoading={timer.isSubmitting}
        onConfirmContinue={() => timer.confirmRegister('continue')}
        onConfirmFinish={() => timer.confirmRegister('finish')}
      />

      {/* Project Change Dialog */}
      <ProjectChangeDialog
        isOpen={Boolean(timer.pendingProjectChange)}
        onClose={timer.cancelProjectChange}
        currentProjectName={currentProject?.name || 'پروژه جاری'}
        newProjectName={timer.pendingProjectChange?.newProjectName || ''}
        durationSeconds={timer.workSeconds}
        isLoading={timer.isSubmitting}
        onConfirmContinue={() => timer.confirmProjectChange('continue')}
        onConfirmFinish={() => timer.confirmProjectChange('finish')}
      />

      {/* Interactive Screen Pet Companion */}
      <ScreenPet timerState={timer.state} onOpenSelector={() => setIsPetModalOpen(true)} />
      <PetSelectorModal isOpen={isPetModalOpen} onClose={() => setIsPetModalOpen(false)} />
    </div>
  );
};

export default UserDashboardPage;
