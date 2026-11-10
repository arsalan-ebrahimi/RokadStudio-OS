import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  Trash2,
  Layers,
  ListChecks,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth';
import { useTodayAttendance, useMidnightWatcher, AttendanceBadge, AttendanceModal } from '@/features/attendance';
import { WorkTargetSelect } from '@/features/projects';
import { TodayScrumEventsCard, useWorkTargetsMine } from '@/features/scrum';
import {
  useTimer,
  TimerDisplay,
  RegisterDialog,
  ProjectChangeDialog,
  fetchMySessionsToday,
  deleteWorkSession,
  SessionBadge,
  DeleteSessionDialog,
} from '@/features/timer';
import { ScreenPet, PetSelectorModal } from '@/features/pet';
import { Card, Button, Modal, toast } from '@/shared/ui';
import { toPersianDigits, formatDurationToHoursMins } from '@/shared/lib/formatters';
import { formatToJalali, getTehranTodayString } from '@/shared/lib/date';
import { useTheme } from '@/shared/lib/theme';

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

  const {
    data: workTargets,
    isLoading: targetsLoading,
    isError: targetsError,
  } = useWorkTargetsMine();

  const [isPetModalOpen, setIsPetModalOpen] = useState(false);
  const [isConfirmComeOpen, setIsConfirmComeOpen] = useState(false);
  const [hasInitiallyChecked, setHasInitiallyChecked] = useState(false);
  const [deletingSession, setDeletingSession] = useState<{ id: number; info: string } | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!attLoading) {
      setHasInitiallyChecked(true);
    }
  }, [attLoading]);

  const timer = useTimer(null);
  const {
    target: timerTarget,
    status: timerStatus,
    workSeconds: timerWorkSeconds,
    clearTarget,
  } = timer;

  // Validate that an idle timer's selected PROJECT or TASK still exists and is assigned/active
  useEffect(() => {
    if (targetsLoading || targetsError || !workTargets || !timerTarget) return;
    if (timerStatus !== 'IDLE' && timerWorkSeconds > 0) return;

    if (timerTarget.kind === 'PROJECT') {
      const stillValid = (workTargets.studioProjects || []).some(
        (p) => p.id === timerTarget.id
      );
      if (!stillValid) {
        clearTarget();
      }
    } else if (timerTarget.kind === 'TASK') {
      const stillValid = (workTargets.scrums || []).some((s) =>
        (s.tasks || []).some((t) => t.id === timerTarget.id)
      );
      if (!stillValid) {
        clearTarget();
      }
    }
  }, [
    targetsLoading,
    targetsError,
    workTargets,
    timerTarget,
    timerStatus,
    timerWorkSeconds,
    clearTarget,
  ]);

  const { isDark, toggleTheme } = useTheme();

  const hasDeclaredToday = Boolean(attendance);
  const isAbsentToday = attendance?.status === 'ABSENT';

  const { data: mySessionsRes } = useQuery({
    queryKey: ['my-sessions-today'],
    queryFn: () => fetchMySessionsToday(),
    enabled: hasDeclaredToday && !isAbsentToday,
  });
  const mySessions = mySessionsRes?.sessions || [];

  // Compute stats directly from today's sessions list (ignoring rejected sessions)
  const validSessions = mySessions.filter((s) => s.approval !== 'REJECTED');
  const registeredSeconds = validSessions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);

  const totalSeconds = mySessionsRes !== undefined
    ? (mySessionsRes.totalSeconds ?? registeredSeconds)
    : (attendance?.totalSeconds || 0);

  // Default is 0; exactly 1 round for each 25 minutes (1500 seconds)
  const sessionsCount = Math.floor(totalSeconds / 1500);

  const deleteSessionMut = useMutation({
    mutationFn: (id: number) => deleteWorkSession(id),
    onMutate: async (deletedId: number) => {
      setDeletingSession(null);
      // Optimistically remove session from local cache immediately
      queryClient.setQueryData(['my-sessions-today'], (old: any) => {
        if (!old?.sessions) return old;
        const remaining = old.sessions.filter((s: any) => s.id !== deletedId);
        const validRemaining = remaining.filter((s: any) => s.approval !== 'REJECTED');
        return {
          ...old,
          totalSeconds: validRemaining.reduce((acc: number, s: any) => acc + (s.durationSeconds || 0), 0),
          sessions: remaining,
        };
      });
    },
    onSuccess: () => {
      toast.success('سشن کاری با موفقیت حذف شد');
      queryClient.invalidateQueries({ queryKey: ['my-sessions-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'today'] });
      queryClient.invalidateQueries({ queryKey: ['admin-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['work-targets', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['work-target-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['scrum-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['scrum'] });
      queryClient.invalidateQueries({ queryKey: ['scrum-admin', 'dashboard'] });
    },
    onError: (err: Error) => {
      queryClient.invalidateQueries({ queryKey: ['my-sessions-today'] });
      toast.error(err.message || 'خطا در حذف سشن کاری');
    },
  });

  // Desktop keyboard shortcut: Space to toggle start/pause (avoid intercepting buttons/inputs/modals)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable ||
            Boolean(target.closest('button, a, [role="dialog"]')))
        ) {
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

  if (attLoading && !hasInitiallyChecked) {
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
      <div className="min-h-screen p-4 sm:p-6 lg:p-8 max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto flex flex-col justify-between">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-2.5 pb-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#612B89] p-2 shadow-hard flex items-center justify-center shrink-0">
              <img src="/rokad-sign.svg" alt="Rokad" className="w-full h-full object-contain filter invert" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-black text-sec dark:text-white leading-tight truncate">
                {user?.name}
              </h1>
              <div className="mt-1 hidden sm:flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <AttendanceBadge attendance={attendance} />
                <span className="text-[11px] text-ink-normal/50 dark:text-gray-400 font-bold whitespace-nowrap tabular-nums">
                  {formatToJalali(getTehranTodayString(), true)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              className="w-11 h-11 flex items-center justify-center rounded-2xl border-[1.5px] border-sec/25 dark:border-gray-700 bg-white dark:bg-[#182030] text-sec/70 dark:text-gray-300 hover:text-sec dark:hover:text-white shadow-hard-sm transition-all cursor-pointer"
              aria-label="تغییر تم"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={logout}
              className="h-11 flex items-center gap-1.5 px-3 rounded-2xl border-[1.5px] border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-[#C60036] dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 shadow-hard-sm transition-all text-xs font-bold shrink-0 cursor-pointer"
              aria-label="خروج از حساب"
              title="خروج از حساب"
            >
              <LogOut className="w-4 h-4 shrink-0 text-[#C60036] dark:text-rose-400" />
              <span className="hidden md:inline whitespace-nowrap">خروج از حساب</span>
            </button>
          </div>

          <div className="flex sm:hidden items-center justify-between gap-2 basis-full pt-0.5">
            <AttendanceBadge attendance={attendance} />
            <span className="text-[11px] text-ink-normal/55 dark:text-gray-400 font-bold whitespace-nowrap tabular-nums">
              {formatToJalali(getTehranTodayString(), false)}
            </span>
          </div>
        </header>

        {/* Absence Presentation Box */}
        <div className="my-auto py-8">
          <Card className="p-6 sm:p-10 rounded-3xl text-center space-y-6 border-[1.5px] border-sec/30 dark:border-primary/40 shadow-hard-lg">
            {/* Friendly Graphic */}
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 mx-auto flex items-center justify-center">
              <div className="w-full h-full rounded-3xl bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-950/40 dark:to-[#182030] border-[1.5px] border-sec/30 dark:border-amber-700/60 flex items-center justify-center text-5xl sm:text-6xl shadow-hard">
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
            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-[#182030] border border-sec/15 dark:border-gray-700 inline-flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-xs font-bold mx-auto text-ink-normal/80 dark:text-gray-300">
              <span className="flex items-center gap-1.5 text-sec dark:text-primary">
                <Calendar className="w-4 h-4 text-primary" />
                <span>{formatToJalali(getTehranTodayString(), true)}</span>
              </span>
              {attendance.reason && (
                <>
                  <span className="hidden sm:inline text-gray-300 dark:text-gray-600">•</span>
                  <span className="text-[#9C5700] dark:text-amber-300">
                    علت: {attendance.reason}
                  </span>
                </>
              )}
            </div>

            {/* Change mind section */}
            <div className="pt-4 border-t border-sec/10 dark:border-gray-800 space-y-3">
              <p className="text-xs text-ink-normal/60 dark:text-gray-400 font-bold">
                برنامه‌ات تغییر کرد و می‌خوای امروز کار کنی؟
              </p>
              <Button
                variant="primary"
                size="lg"
                onClick={() => setIsConfirmComeOpen(true)}
                isLoading={attSubmitting}
                className="w-full sm:w-auto px-8 text-sm font-black shadow-hard inline-flex items-center justify-center gap-2"
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
            <div className="w-14 h-14 mx-auto rounded-2xl bg-ecosystem-light dark:bg-primary/20 text-sec dark:text-primary flex items-center justify-center border border-primary/35">
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
            <div className="flex items-center gap-2.5 pt-2">
              <Button
                variant="outline"
                className="flex-1 text-xs font-bold"
                onClick={() => setIsConfirmComeOpen(false)}
                disabled={attSubmitting}
              >
                انصراف
              </Button>
              <Button
                variant="primary"
                className="flex-[2] text-xs font-black flex items-center justify-center gap-1.5"
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
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto space-y-6 lg:space-y-8">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-2.5 pb-4 border-b border-sec/15 dark:border-gray-800">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          <div className="w-11 h-11 rounded-2xl bg-[#612B89] p-2 shadow-hard flex items-center justify-center shrink-0 border-[1.5px] border-sec">
            <img src="/rokad-sign.svg" alt="Rokad" className="w-full h-full object-contain filter invert" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-black text-sec dark:text-white leading-tight truncate">
              {user?.name}
            </h1>
            <div className="mt-1 hidden sm:flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <AttendanceBadge attendance={attendance} />
              <span className="text-[11px] text-ink-normal/55 dark:text-gray-400 font-bold whitespace-nowrap tabular-nums">
                {formatToJalali(getTehranTodayString(), true)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Link
            to="/my-projects"
            className="min-w-[44px] h-11 flex items-center justify-center gap-1.5 px-2.5 md:px-3.5 rounded-2xl border-[1.5px] border-sec/25 dark:border-gray-700 bg-white dark:bg-[#182030] text-sec dark:text-white hover:border-primary shadow-hard-sm transition-all text-xs font-bold shrink-0 cursor-pointer"
            title="پروژه‌های من"
            aria-label="پروژه‌های من"
          >
            <FolderKanban className="w-4 h-4 text-primary shrink-0" />
            <span className="hidden md:inline whitespace-nowrap">پروژه‌های من</span>
          </Link>
          <Link
            to="/my-scrums"
            className="min-w-[44px] h-11 flex items-center justify-center gap-1.5 px-2.5 md:px-3.5 rounded-2xl border-[1.5px] border-sec/25 dark:border-gray-700 bg-white dark:bg-[#182030] text-sec dark:text-white hover:border-primary shadow-hard-sm transition-all text-xs font-bold shrink-0 cursor-pointer"
            title="اسکرام‌های من"
            aria-label="اسکرام‌های من"
          >
            <Layers className="w-4 h-4 text-primary shrink-0" />
            <span className="hidden md:inline whitespace-nowrap">اسکرام‌های من</span>
          </Link>
          <button
            type="button"
            onClick={() => setIsPetModalOpen(true)}
            className="w-11 h-11 flex items-center justify-center rounded-2xl border-[1.5px] border-sec/25 dark:border-gray-700 bg-white dark:bg-[#182030] text-sec/70 hover:text-sec dark:hover:text-white shadow-hard-sm transition-all cursor-pointer"
            title="انتخاب همراه تمرکز"
            aria-label="همراه تمرکز"
          >
            <Sparkles className="w-4 h-4 text-primary" />
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className="w-11 h-11 flex items-center justify-center rounded-2xl border-[1.5px] border-sec/25 dark:border-gray-700 bg-white dark:bg-[#182030] text-sec/70 dark:text-gray-300 hover:text-sec dark:hover:text-white shadow-hard-sm transition-all cursor-pointer"
            aria-label="تغییر تم"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={logout}
            className="min-w-[44px] h-11 flex items-center justify-center gap-1.5 px-2.5 md:px-3.5 rounded-2xl border-[1.5px] border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-[#C60036] dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 shadow-hard-sm transition-all text-xs font-bold shrink-0 cursor-pointer"
            aria-label="خروج از حساب"
            title="خروج از حساب"
          >
            <LogOut className="w-4 h-4 shrink-0 text-[#C60036] dark:text-rose-400" />
            <span className="hidden md:inline whitespace-nowrap">خروج از حساب</span>
          </button>
        </div>

        <div className="flex sm:hidden items-center justify-between gap-2 basis-full pt-0.5">
          <AttendanceBadge attendance={attendance} />
          <span className="text-[11px] text-ink-normal/55 dark:text-gray-400 font-bold whitespace-nowrap tabular-nums">
            {formatToJalali(getTehranTodayString(), false)}
          </span>
        </div>
      </header>

      {/* Main Content: Responsive layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Focus Timer Area */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-5">
          <Card
            tabIndex={0}
            aria-label="پنل تایمر تمرکز"
            className="p-6 sm:p-8 rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-sec dark:focus-visible:ring-primary"
          >
            <TimerDisplay
              headerSlot={
                <WorkTargetSelect
                  variant="chip"
                  selectedTarget={timer.target}
                  onSelect={timer.handleSelectTarget}
                  isLocked={timer.isLocked}
                />
              }
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
              onDismissOtherTabLock={timer.dismissOtherTabLock}
              isSubmitting={timer.isSubmitting}
            />
          </Card>

          {/* Desktop Keyboard Tip */}
          <div className="hidden lg:flex items-center justify-center gap-2 text-xs font-bold text-ink-normal/55 dark:text-gray-400">
            <span>کلید میانبر:</span>
            <kbd className="px-2 py-0.5 rounded-lg bg-white dark:bg-gray-800 border-[1.5px] border-sec/25 dark:border-gray-700 font-mono text-[11px] text-sec dark:text-white shadow-sm">
              Space
            </kbd>
            <span>برای شروع یا توقف</span>
          </div>
        </div>

        {/* Sidebar Cards Area on Desktop */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4">
          {/* Today's Scrum Ceremonies */}
          <TodayScrumEventsCard />

          {/* Daily Performance Card */}
          <Card className="p-5 rounded-3xl space-y-4">
            <h2 className="text-xs font-black text-sec/70 dark:text-gray-300">عملکرد امروز</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-[#F8FAFC] dark:bg-[#182030] border-[1.5px] border-sec/15 dark:border-gray-700 space-y-1">
                <div className="flex items-center gap-1.5 text-[#9C5700] dark:text-amber-300">
                  <Flame className="w-4 h-4 text-third shrink-0" />
                  <span className="text-[11px] font-bold text-sec/65 dark:text-gray-400">دورهای تکمیل</span>
                </div>
                <p className="text-xl font-black text-sec dark:text-white tabular-nums">
                  {toPersianDigits(sessionsCount)} <span className="text-xs font-bold">دور</span>
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#ECF7F5] dark:bg-[#182730] border-[1.5px] border-primary/35 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-[11px] font-bold text-sec/70 dark:text-gray-300">مجموع زمان</span>
                </div>
                <p className="text-xl font-black text-sec dark:text-primary tabular-nums">
                  {formatDurationToHoursMins(totalSeconds)}
                </p>
              </div>
            </div>

            {/* Today's Logged Sessions */}
            {mySessions.length > 0 && (
              <div className="pt-3 border-t border-sec/10 dark:border-gray-800 space-y-2.5">
                <span className="block text-[11px] font-bold text-sec/65 dark:text-gray-400">
                  سشن‌های ثبت‌شده امروز ({toPersianDigits(mySessions.length)})
                </span>
                <div className="space-y-2 max-h-56 overflow-y-auto pe-1">
                  {mySessions.map((s) => {
                    const isTask = s.targetType === 'TASK' && Boolean(s.task);
                    const pName =
                      isTask && s.task
                        ? s.task.scrum
                          ? `[${s.task.scrum.name}] ${s.task.name}`
                          : s.task.name
                        : s.project?.name || s.projectName || 'پروژه';
                    const sInfo = `${pName} (${formatDurationToHoursMins(s.durationSeconds)})`;
                    return (
                      <div
                        key={s.id}
                        className="group p-3 rounded-2xl bg-[#F8FAFC] dark:bg-[#182030] border border-sec/15 dark:border-gray-700 flex items-center justify-between gap-2 text-xs transition-colors hover:border-sec/35"
                      >
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex items-center gap-1.5 font-black text-sec dark:text-white truncate">
                            {isTask ? (
                              <ListChecks className="w-3.5 h-3.5 text-primary shrink-0" />
                            ) : (
                              <FolderKanban className="w-3.5 h-3.5 text-primary shrink-0" />
                            )}
                            <span className="truncate">{pName}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <SessionBadge approval={s.approval} className="text-[10px] py-0.5 px-2" />
                            <span className="text-[11px] font-black text-sec dark:text-primary tabular-nums">
                              {formatDurationToHoursMins(s.durationSeconds)}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="w-11 h-11 flex items-center justify-center rounded-xl border border-transparent text-sec/45 dark:text-gray-400 hover:text-[#C60036] dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:border-rose-200 dark:hover:border-rose-900/50 transition-all shrink-0 cursor-pointer"
                          onClick={() => setDeletingSession({ id: s.id, info: sInfo })}
                          title="حذف سشن"
                          aria-label="حذف سشن"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>

          {/* Active Info Card */}
          <Card className="p-5 rounded-3xl space-y-3.5">
            <h2 className="text-xs font-black text-sec/70 dark:text-gray-300">جزئیات نشست</h2>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-sec/10 dark:border-gray-800">
                <span className="text-sec/65 dark:text-gray-400 font-bold shrink-0">هدف کاری جاری</span>
                <span className="font-extrabold text-sec dark:text-white flex items-center gap-1.5 truncate max-w-[200px]" title={timer.target?.label || ''}>
                  {timer.target?.kind === 'TASK' ? (
                    <ListChecks className="w-3.5 h-3.5 text-primary shrink-0" />
                  ) : (
                    <FolderKanban className="w-3.5 h-3.5 text-primary shrink-0" />
                  )}
                  <span className="truncate">{timer.target?.label || 'انتخاب نشده'}</span>
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-sec/10 dark:border-gray-800">
                <span className="text-sec/65 dark:text-gray-400 font-bold">وضعیت حضور</span>
                <AttendanceBadge attendance={attendance} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sec/65 dark:text-gray-400 font-bold">تاریخ سیستم</span>
                <span className="font-bold text-sec dark:text-white tabular-nums">{formatToJalali(getTehranTodayString(), true)}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Mandatory Modals */}
      <AttendanceModal
        isOpen={hasInitiallyChecked && !hasDeclaredToday}
        userName={user?.name || ''}
        onConfirmPresent={markPresent}
        onConfirmAbsent={(reason) => markAbsent(reason)}
        isLoading={attSubmitting}
      />

      {/* Registration Dialog */}
      <RegisterDialog
        isOpen={timer.isRegisterDialogOpen}
        onClose={timer.closeRegisterDialog}
        projectName={timer.target?.label || 'هدف کاری جاری'}
        durationSeconds={timer.workSeconds}
        isLoading={timer.isSubmitting}
        onConfirmContinue={() => timer.confirmRegister('continue')}
        onConfirmFinish={() => timer.confirmRegister('finish')}
      />

      {/* Project Change Dialog */}
      <ProjectChangeDialog
        isOpen={Boolean(timer.pendingTargetChange || timer.pendingProjectChange)}
        onClose={timer.cancelTargetChange}
        currentProjectName={timer.target?.label || 'هدف کاری جاری'}
        newProjectName={timer.pendingTargetChange?.label || timer.pendingProjectChange?.newProjectName || ''}
        durationSeconds={timer.workSeconds}
        isLoading={timer.isSubmitting}
        onConfirmContinue={() => timer.confirmTargetChange('continue')}
        onConfirmFinish={() => timer.confirmTargetChange('finish')}
      />

      {/* Interactive Screen Pet Companion */}
      <ScreenPet timerState={timer.state} onOpenSelector={() => setIsPetModalOpen(true)} />
      <PetSelectorModal isOpen={isPetModalOpen} onClose={() => setIsPetModalOpen(false)} />

      {/* Delete Session Dialog */}
      <DeleteSessionDialog
        isOpen={Boolean(deletingSession)}
        targetInfo={deletingSession?.info || ''}
        isLoading={deleteSessionMut.isPending}
        onConfirm={() => deletingSession && deleteSessionMut.mutate(deletingSession.id)}
        onCancel={() => setDeletingSession(null)}
      />
    </div>
  );
};

export default UserDashboardPage;
