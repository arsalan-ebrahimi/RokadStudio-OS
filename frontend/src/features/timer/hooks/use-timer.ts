import { useState, useEffect, useRef, useCallback } from 'react';
import {
  TimerEngineState,
  createInitialTimerState,
  getDerivedTimerState,
  startTimer,
  pauseTimer,
  tickTimer,
  registerContinue,
  registerFinish,
  changeProject,
  restoreTimerState,
  PomodoroMode,
} from '../lib/timer-engine';
import {
  HEARTBEAT_MS,
  TAB_LOCK_TIMEOUT_MS,
  TICK_INTERVAL_MS,
} from '../config/timer-constants';
import { submitWorkSession, type MySessionsResponse } from '../api/timer-api';
import { playCompletionChime } from '../lib/sound';
import { formatSecondsToTime } from '@/shared/lib/formatters';
import { toast } from '@/shared/ui';
import { queryClient } from '@/shared/lib/query-client';
import { useAuthStore } from '@/features/auth';

export type TimerState = 'IDLE' | 'RUNNING' | 'PAUSED' | 'BREAK';

function getStorageKey(userId: number | string): string {
  return `rokad_timer_state_${userId}`;
}

function getLockKey(userId: number | string): string {
  return `rokad_tab_lock_${userId}`;
}

function safeUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getSessionTabId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    let id = sessionStorage.getItem('rokad_timer_tab_id');
    if (!id) {
      id = safeUUID();
      sessionStorage.setItem('rokad_timer_tab_id', id);
    }
    return id;
  } catch {
    return safeUUID();
  }
}

export function useTimer(selectedProjectId?: number | null) {
  const { user } = useAuthStore();
  const userId = user?.id || 'guest';
  const tabIdRef = useRef<string>(getSessionTabId());

  const [initialData] = useState(() => {
    try {
      const raw = localStorage.getItem(getStorageKey(userId));
      if (raw) {
        const parsed = JSON.parse(raw);
        return restoreTimerState(parsed, selectedProjectId);
      }
    } catch {
      // Fallback
    }
    return {
      state: createInitialTimerState(selectedProjectId),
      wasRecovered: false,
    };
  });

  const [engineState, setEngineState] = useState<TimerEngineState>(initialData.state);
  const [now, setNow] = useState<number>(() => Date.now());
  const [isOtherTabActive, setIsOtherTabActive] = useState(false);
  const [showRecoveredNotice, setShowRecoveredNotice] = useState(initialData.wasRecovered);
  const [showFocusBanner, setShowFocusBanner] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeClientRequestId, setActiveClientRequestId] = useState<string | null>(null);

  // Dialog states
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);
  const [pendingProjectChange, setPendingProjectChange] = useState<{
    newProjectId: number;
    newProjectName: string;
  } | null>(null);

  const engineStateRef = useRef(engineState);
  useEffect(() => {
    engineStateRef.current = engineState;
  }, [engineState]);

  // Persist state to localStorage safely
  const persistState = useCallback(
    (stateToPersist: TimerEngineState) => {
      try {
        localStorage.setItem(getStorageKey(userId), JSON.stringify(stateToPersist));
      } catch {
        // Ignore storage errors
      }
    },
    [userId]
  );

  // Auto-dismiss recovered notice after 8 seconds
  useEffect(() => {
    if (showRecoveredNotice) {
      const timer = setTimeout(() => {
        setShowRecoveredNotice(false);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [showRecoveredNotice]);

  // Tab lock check and refresh
  const refreshTabLock = useCallback(() => {
    try {
      const lockKey = getLockKey(userId);
      const rawLock = localStorage.getItem(lockKey);
      const currentTime = Date.now();

      if (rawLock) {
        const lock = JSON.parse(rawLock);
        if (lock.tabId !== tabIdRef.current && currentTime - lock.timestamp < TAB_LOCK_TIMEOUT_MS) {
          setIsOtherTabActive(true);
          return;
        }
      }
      setIsOtherTabActive(false);

      // If running in this tab, claim/refresh the lock
      if (engineStateRef.current.status === 'RUNNING') {
        localStorage.setItem(
          lockKey,
          JSON.stringify({ tabId: tabIdRef.current, timestamp: currentTime })
        );
      }
    } catch {
      // Ignore storage errors
    }
  }, [userId]);

  // Dismiss other tab lock and claim control in this tab
  const dismissOtherTabLock = useCallback(() => {
    try {
      const lockKey = getLockKey(userId);
      const currentTime = Date.now();
      localStorage.setItem(
        lockKey,
        JSON.stringify({ tabId: tabIdRef.current, timestamp: currentTime })
      );
      setIsOtherTabActive(false);
    } catch {
      // Ignore storage errors
    }
  }, [userId]);

  // Unsaved time guard (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const derivedState = getDerivedTimerState(engineStateRef.current);
      if (derivedState.workSeconds > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Storage event listener for multi-tab synchronization
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === getLockKey(userId)) {
        refreshTabLock();
      } else if (e.key === getStorageKey(userId) && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          const { state } = restoreTimerState(parsed, engineStateRef.current.projectId);
          setEngineState(state);
        } catch {
          // Ignore
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [userId, refreshTabLock]);

  // High-frequency UI tick (250ms) and heartbeat timer
  useEffect(() => {
    const interval = setInterval(() => {
      const currentNow = Date.now();
      setNow(currentNow);

      const current = engineStateRef.current;
      const tickRes = tickTimer(current, currentNow);

      if (tickRes.event === 'FOCUS_ENDED') {
        playCompletionChime();
        setShowFocusBanner(true);

        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('زمان استراحت فرا رسید', {
              body: '۲۵ دقیقه کار کردید. زمان استراحت ۵ دقیقه‌ای است.',
            });
          } catch {
            // Ignore notification errors
          }
        }
      }

      let updated = tickRes.nextState;

      // Heartbeat check every HEARTBEAT_MS while running
      if (updated.status === 'RUNNING') {
        const lastHb = updated.lastHeartbeat || 0;
        if (currentNow - lastHb >= HEARTBEAT_MS) {
          updated = { ...updated, lastHeartbeat: currentNow };
          persistState(updated);
          refreshTabLock();
        }
      }

      setEngineState(updated);

      // Title reflection
      const derivedTitle = getDerivedTimerState(updated, currentNow);
      if (derivedTitle.isBreakActive) {
        document.title = `(استراحت ${formatSecondsToTime(derivedTitle.pomodoroRemainingSeconds)}) رکاد استودیو`;
      } else if (updated.status === 'RUNNING' || updated.status === 'PAUSED') {
        document.title = `(${formatSecondsToTime(derivedTitle.pomodoroRemainingSeconds)}) رکاد استودیو`;
      } else {
        document.title = 'رکاد استودیو';
      }
    }, TICK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [persistState, refreshTabLock]);

  // Handle selected project changes from outside
  useEffect(() => {
    if (selectedProjectId && !engineStateRef.current.projectId && engineStateRef.current.status === 'IDLE') {
      setEngineState((prev) => {
        const next = { ...prev, projectId: selectedProjectId };
        persistState(next);
        return next;
      });
    }
  }, [selectedProjectId, persistState]);

  // Start / Resume action
  const start = useCallback(() => {
    if (!engineStateRef.current.projectId) {
      toast.error('برای شروع، ابتدا یک پروژه انتخاب کنید.');
      return;
    }

    if (isOtherTabActive) {
      toast.error('تایمر در تب دیگری فعال است.');
      return;
    }

    // Request browser notification permission lazily on first START
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    setEngineState((prev) => {
      const next = startTimer(prev);
      persistState(next);
      return next;
    });
    refreshTabLock();
  }, [isOtherTabActive, persistState, refreshTabLock]);

  // Pause action
  const pause = useCallback(() => {
    setEngineState((prev) => {
      const next = pauseTimer(prev);
      persistState(next);
      return next;
    });
  }, [persistState]);

  // Clear project selection
  const clearProject = useCallback(() => {
    setEngineState((prev) => {
      const next = { ...prev, projectId: null };
      persistState(next);
      return next;
    });
  }, [persistState]);

  // Project selection trigger
  const handleSelectProject = useCallback(
    (newProjectId: number, projectName: string) => {
      const current = engineStateRef.current;
      const derivedState = getDerivedTimerState(current);
      if (derivedState.projectSelectLocked) return;

      // If timer hasn't recorded time or had no previous project, switch immediately without dialog!
      if (derivedState.workSeconds < 1 || !current.projectId) {
        setEngineState((prev) => {
          const next = { ...prev, projectId: newProjectId };
          persistState(next);
          return next;
        });
      } else {
        // Show project change confirmation dialog
        setPendingProjectChange({
          newProjectId,
          newProjectName: projectName,
        });
      }
    },
    [persistState]
  );

  // Confirm project change
  const confirmProjectChange = useCallback(
    async (mode: 'continue' | 'finish' = 'continue') => {
      if (!pendingProjectChange) return;
      const current = engineStateRef.current;
      const currentDerived = getDerivedTimerState(current);

      if (!current.projectId) {
        setPendingProjectChange(null);
        return;
      }

      const clientReqId = activeClientRequestId || safeUUID();
      setActiveClientRequestId(clientReqId);
      setIsSubmitting(true);

      try {
        const startedAt = current.work.segmentStartedAt || new Date().toISOString();
        const newSession = await submitWorkSession({
          projectId: current.projectId,
          durationSeconds: currentDerived.workSeconds,
          startedAt,
          clientRequestId: clientReqId,
        });

        // Optimistically insert new session into cache so DOM updates immediately
        if (newSession && typeof newSession === 'object') {
          queryClient.setQueriesData<MySessionsResponse>({ queryKey: ['my-sessions-today'] }, (old) => {
            if (!old) {
              return {
                totalSeconds: newSession.durationSeconds || 0,
                sessions: [newSession],
              };
            }
            const existing = old.sessions || [];
            const filtered = existing.filter((s) => s.id !== newSession.id);
            const updated = [newSession, ...filtered];
            const total = updated
              .filter((s) => s.approval !== 'REJECTED')
              .reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
            return {
              totalSeconds: total,
              sessions: updated,
            };
          });
        }

        // Local timer state changes only on success
        setEngineState((prev) => {
          const next = changeProject(prev, pendingProjectChange.newProjectId, mode);
          persistState(next);
          return next;
        });

        setActiveClientRequestId(null);
        setPendingProjectChange(null);
        queryClient.invalidateQueries({ queryKey: ['attendance', 'today'] });
        queryClient.invalidateQueries({ queryKey: ['my-sessions-today'] });
        toast.success('زمان پروژه ثبت و پروژه تغییر یافت');
      } catch (err: unknown) {
        let errorMsg = 'ثبت انجام نشد. زمان شما حفظ شده است؛ دوباره تلاش کنید.';
        if (err instanceof Error && err.message) {
          if (err.message.includes('not an assigned member')) {
            errorMsg = 'شما عضو این پروژه نیستید.';
          } else if (err.message.includes('attendance')) {
            errorMsg = 'حضور شما برای امروز ثبت نشده است.';
          } else if (err.message.includes('inactive')) {
            errorMsg = 'این پروژه غیرفعال است.';
          } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
            errorMsg = 'عدم اتصال به سرور. لطفا اتصال اینترنت یا سرور را بررسی کنید.';
          } else {
            errorMsg = err.message;
          }
        }
        toast.error(errorMsg);
      } finally {
        setIsSubmitting(false);
      }
    },
    [pendingProjectChange, activeClientRequestId, persistState]
  );

  // Cancel project change
  const cancelProjectChange = useCallback(() => {
    setPendingProjectChange(null);
  }, []);

  // Open register dialog
  const openRegisterDialog = useCallback(() => {
    const derivedState = getDerivedTimerState(engineStateRef.current);
    if (derivedState.canRegister) {
      setIsRegisterDialogOpen(true);
    }
  }, []);

  // Close register dialog
  const closeRegisterDialog = useCallback(() => {
    setIsRegisterDialogOpen(false);
  }, []);

  // Confirm registration
  const confirmRegister = useCallback(
    async (mode: 'continue' | 'finish') => {
      const current = engineStateRef.current;
      const currentDerived = getDerivedTimerState(current);

      if (!current.projectId || currentDerived.workSeconds < 1) {
        setIsRegisterDialogOpen(false);
        return;
      }

      const clientReqId = activeClientRequestId || safeUUID();
      setActiveClientRequestId(clientReqId);
      setIsSubmitting(true);

      try {
        const startedAt = current.work.segmentStartedAt || new Date().toISOString();
        const newSession = await submitWorkSession({
          projectId: current.projectId,
          durationSeconds: currentDerived.workSeconds,
          startedAt,
          clientRequestId: clientReqId,
        });

        // Optimistically insert new session into cache so DOM updates immediately
        if (newSession && typeof newSession === 'object') {
          queryClient.setQueriesData<MySessionsResponse>({ queryKey: ['my-sessions-today'] }, (old) => {
            if (!old) {
              return {
                totalSeconds: newSession.durationSeconds || 0,
                sessions: [newSession],
              };
            }
            const existing = old.sessions || [];
            const filtered = existing.filter((s) => s.id !== newSession.id);
            const updated = [newSession, ...filtered];
            const total = updated
              .filter((s) => s.approval !== 'REJECTED')
              .reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
            return {
              totalSeconds: total,
              sessions: updated,
            };
          });
        }

        // Local state changes ONLY after a successful response
        setEngineState((prev) => {
          const next = mode === 'continue' ? registerContinue(prev) : registerFinish(prev);
          persistState(next);
          return next;
        });

        setActiveClientRequestId(null);
        setIsRegisterDialogOpen(false);
        setShowFocusBanner(false);
        queryClient.invalidateQueries({ queryKey: ['attendance', 'today'] });
        queryClient.invalidateQueries({ queryKey: ['my-sessions-today'] });
        queryClient.invalidateQueries({ queryKey: ['admin-attendance'] });
        toast.success('زمان کار با موفقیت ثبت شد');
      } catch (err: unknown) {
        let errorMsg = 'ثبت انجام نشد. زمان شما حفظ شده است؛ دوباره تلاش کنید.';
        if (err instanceof Error && err.message) {
          if (err.message.includes('not an assigned member')) {
            errorMsg = 'شما عضو این پروژه نیستید.';
          } else if (err.message.includes('attendance')) {
            errorMsg = 'حضور شما برای امروز ثبت نشده است.';
          } else if (err.message.includes('inactive')) {
            errorMsg = 'این پروژه غیرفعال است.';
          } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
            errorMsg = 'عدم اتصال به سرور. لطفا اتصال اینترنت یا سرور را بررسی کنید.';
          } else {
            errorMsg = err.message;
          }
        }
        toast.error(errorMsg);
      } finally {
        setIsSubmitting(false);
      }
    },
    [activeClientRequestId, persistState]
  );

  const derived = getDerivedTimerState(engineState, now);

  // Compute TimerState compatible with ScreenPet
  const mappedState: TimerState =
    derived.isBreakActive
      ? 'BREAK'
      : engineState.status === 'RUNNING'
      ? 'RUNNING'
      : engineState.status === 'PAUSED'
      ? 'PAUSED'
      : 'IDLE';

  return {
    state: mappedState,
    status: engineState.status,
    projectId: engineState.projectId,
    workMs: derived.workMs,
    workSeconds: derived.workSeconds,
    pomodoroRemainingMs: derived.pomodoroRemainingMs,
    pomodoroRemainingSeconds: derived.pomodoroRemainingSeconds,
    pomodoroMode: derived.pomodoroMode as PomodoroMode,
    isBreakActive: derived.isBreakActive,
    canStart: derived.canStart && Boolean(engineState.projectId) && !isOtherTabActive && !isSubmitting,
    canRegister: derived.canRegister && !isOtherTabActive && !isSubmitting,
    mainButtonLabel: derived.mainButtonLabel,
    mainButtonDisabled: derived.mainButtonDisabled || !engineState.projectId || isOtherTabActive || isSubmitting,
    mainButtonDisabledReason: !engineState.projectId
      ? 'برای شروع، ابتدا یک پروژه انتخاب کنید.'
      : isOtherTabActive
      ? 'تایمر در تب دیگری فعال است.'
      : derived.mainButtonDisabledReason,
    registerButtonDisabled: derived.registerButtonDisabled || isOtherTabActive || isSubmitting,
    registerButtonDisabledReason: isOtherTabActive ? 'تایمر در تب دیگری فعال است.' : derived.registerButtonDisabledReason,
    isLocked: derived.projectSelectLocked || isSubmitting,
    savedProjectId: engineState.projectId,
    isOtherTabActive,
    dismissOtherTabLock,
    isSubmitting,
    showRecoveredNotice,
    dismissRecoveredNotice: () => setShowRecoveredNotice(false),
    showFocusBanner,
    dismissFocusBanner: () => setShowFocusBanner(false),
    start,
    pause,
    clearProject,
    handleSelectProject,
    openRegisterDialog,
    closeRegisterDialog,
    isRegisterDialogOpen,
    confirmRegister,
    pendingProjectChange,
    confirmProjectChange,
    cancelProjectChange,
  };
}
