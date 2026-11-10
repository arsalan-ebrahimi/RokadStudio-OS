import { useState, useEffect, useRef, useCallback } from 'react';
import {
  TimerEngineState,
  TimerTarget,
  createInitialTimerState,
  getDerivedTimerState,
  startTimer,
  pauseTimer,
  tickTimer,
  registerContinue,
  registerFinish,
  changeTarget,
  discardTarget,
  restoreTimerState,
  PomodoroMode,
} from '../lib/timer-engine';
import { mapWorkSessionError } from '../lib/work-session-error';
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

function getRecentStorageKey(userId: number | string): string {
  return `rokad_recent_targets_${userId}`;
}

function saveRecentTarget(userId: number | string, target: TimerTarget) {
  try {
    const key = getRecentStorageKey(userId);
    const raw = localStorage.getItem(key);
    const parsed: unknown[] = raw ? JSON.parse(raw) : [];
    const normalized: TimerTarget[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;
      const rawKind = obj.kind;
      const kind = rawKind === 'STUDIO' ? 'PROJECT' : rawKind;
      if ((kind === 'PROJECT' || kind === 'TASK') && typeof obj.id === 'number') {
        normalized.push({
          kind,
          id: obj.id,
          label: String(obj.label || ''),
          points: typeof obj.points === 'number' ? obj.points : undefined,
          scrumColor: typeof obj.scrumColor === 'string' ? obj.scrumColor : undefined,
        });
      }
    }
    const filtered = normalized.filter((t) => !(t.kind === target.kind && t.id === target.id));
    const next = [target, ...filtered].slice(0, 3);
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Ignore
  }
}

function removeRecentTarget(userId: number | string, target: TimerTarget) {
  try {
    const key = getRecentStorageKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;

    const filtered = parsed.filter((item) => {
      if (!item || typeof item !== 'object') return false;
      const obj = item as Record<string, unknown>;
      const kind = obj.kind === 'STUDIO' ? 'PROJECT' : obj.kind;
      return !(kind === target.kind && Number(obj.id) === target.id);
    });

    if (filtered.length === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(filtered));
    }
  } catch {
    // Ignore
  }
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

export function useTimer(initialTargetOrProjectId?: TimerTarget | number | null) {
  const { user } = useAuthStore();
  const userId = user?.id || 'guest';
  const tabIdRef = useRef<string>(getSessionTabId());

  const normalizedInitial: TimerTarget | null =
    typeof initialTargetOrProjectId === 'number'
      ? { kind: 'PROJECT', id: initialTargetOrProjectId, label: '' }
      : initialTargetOrProjectId || null;

  const [initialData] = useState(() => {
    try {
      const raw = localStorage.getItem(getStorageKey(userId));
      if (raw) {
        const parsed = JSON.parse(raw);
        return restoreTimerState(parsed, normalizedInitial);
      }
    } catch {
      // Fallback
    }
    return {
      state: createInitialTimerState(normalizedInitial),
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
  const [pendingTargetChange, setPendingTargetChange] = useState<TimerTarget | null>(null);
  const [submissionError, setSubmissionError] = useState<{
    message: string;
    canDiscardTarget: boolean;
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
          const { state } = restoreTimerState(parsed, engineStateRef.current.target);
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

  // Handle selected target/project changes from outside
  useEffect(() => {
    if (normalizedInitial && !engineStateRef.current.target && engineStateRef.current.status === 'IDLE') {
      setEngineState((prev) => {
        const next = {
          ...prev,
          target: normalizedInitial,
          projectId: normalizedInitial.kind === 'PROJECT' ? normalizedInitial.id : null,
        };
        persistState(next);
        return next;
      });
    }
  }, [normalizedInitial, persistState]);

  // Start / Resume action
  const start = useCallback(() => {
    if (!engineStateRef.current.target) {
      toast.error('برای شروع، ابتدا یک پروژه یا هدف کاری انتخاب کنید.');
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

  // Clear target / project selection
  const clearTarget = useCallback(() => {
    setEngineState((prev) => {
      const derivedState = getDerivedTimerState(prev);
      const next =
        derivedState.workSeconds < 1
          ? discardTarget(prev, null)
          : { ...prev, target: null, projectId: null };
      persistState(next);
      return next;
    });
    setSubmissionError(null);
  }, [persistState]);

  const clearProject = clearTarget;

  // Target selection trigger
  const handleSelectTarget = useCallback(
    (newTarget: TimerTarget) => {
      const current = engineStateRef.current;
      const derivedState = getDerivedTimerState(current);
      if (derivedState.projectSelectLocked) return;

      setSubmissionError(null);

      // If timer hasn't recorded time or had no previous target, switch immediately without dialog!
      if (derivedState.workSeconds < 1 || !current.target) {
        setEngineState((prev) => {
          const next = {
            ...prev,
            target: newTarget,
            projectId: newTarget.kind === 'PROJECT' ? newTarget.id : null,
          };
          persistState(next);
          return next;
        });
      } else {
        // Show target change confirmation dialog
        setPendingTargetChange(newTarget);
      }
    },
    [persistState]
  );

  const handleSelectProject = useCallback(
    (newProjectId: number, projectName: string) => {
      handleSelectTarget({
        kind: 'PROJECT',
        id: newProjectId,
        label: projectName,
      });
    },
    [handleSelectTarget]
  );

  // Confirm target change
  const confirmTargetChange = useCallback(
    async (mode: 'continue' | 'finish' = 'continue') => {
      if (!pendingTargetChange) return;
      const current = engineStateRef.current;
      const currentDerived = getDerivedTimerState(current);

      if (!current.target) {
        setPendingTargetChange(null);
        return;
      }

      const clientReqId = activeClientRequestId || safeUUID();
      setActiveClientRequestId(clientReqId);
      setSubmissionError(null);
      setIsSubmitting(true);

      try {
        const startedAt = current.work.segmentStartedAt || new Date().toISOString();
        const payload: {
          durationSeconds: number;
          startedAt: string;
          clientRequestId: string;
          projectId?: number;
          taskId?: number;
        } = {
          durationSeconds: currentDerived.workSeconds,
          startedAt,
          clientRequestId: clientReqId,
        };

        if (current.target.kind === 'PROJECT') {
          payload.projectId = current.target.id;
        } else {
          payload.taskId = current.target.id;
        }

        const newSession = await submitWorkSession(payload);

        // Optimistically insert new session into cache
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

        // Save target to recent targets in localStorage
        saveRecentTarget(userId, current.target);

        // Local timer state changes only on success
        setEngineState((prev) => {
          const next = changeTarget(prev, pendingTargetChange, mode);
          persistState(next);
          return next;
        });

        setActiveClientRequestId(null);
        setPendingTargetChange(null);
        setSubmissionError(null);
        queryClient.invalidateQueries({ queryKey: ['attendance', 'today'] });
        queryClient.invalidateQueries({ queryKey: ['my-sessions-today'] });
        queryClient.invalidateQueries({ queryKey: ['work-targets', 'mine'] });
        queryClient.invalidateQueries({ queryKey: ['scrum'] });
        queryClient.invalidateQueries({ queryKey: ['scrum-tasks'] });
        queryClient.invalidateQueries({ queryKey: ['work-target-sessions'] });
        queryClient.invalidateQueries({ queryKey: ['scrum-admin', 'dashboard'] });
        toast.success('زمان هدف کاری ثبت و تغییر یافت');
      } catch (err: unknown) {
        const mapped = mapWorkSessionError(err, current.target.kind);
        if (mapped.canDiscardTarget) {
          removeRecentTarget(userId, current.target);
          queryClient.invalidateQueries({ queryKey: ['work-targets', 'mine'] });
          queryClient.invalidateQueries({ queryKey: ['projects', 'mine'] });
        }
        setSubmissionError({
          message: mapped.message,
          canDiscardTarget: mapped.canDiscardTarget,
        });
        toast.error(mapped.message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [pendingTargetChange, activeClientRequestId, persistState, userId]
  );

  // Discard unloggable target time and switch directly to pendingTargetChange
  const discardTargetAndSwitch = useCallback(() => {
    const current = engineStateRef.current;
    if (current.target) {
      removeRecentTarget(userId, current.target);
    }
    setEngineState((prev) => {
      const next = discardTarget(prev, pendingTargetChange || null);
      persistState(next);
      return next;
    });
    setActiveClientRequestId(null);
    setPendingTargetChange(null);
    setSubmissionError(null);
    setShowFocusBanner(false);
    toast.success(pendingTargetChange ? 'هدف کاری بدون ثبت زمان قبلی تغییر یافت' : 'تایمر ریست شد');
  }, [pendingTargetChange, persistState, userId]);

  // Cancel target change
  const cancelTargetChange = useCallback(() => {
    setPendingTargetChange(null);
    setSubmissionError(null);
  }, []);

  // Open register dialog
  const openRegisterDialog = useCallback(() => {
    const derivedState = getDerivedTimerState(engineStateRef.current);
    if (derivedState.canRegister) {
      setSubmissionError(null);
      setIsRegisterDialogOpen(true);
    }
  }, []);

  // Close register dialog
  const closeRegisterDialog = useCallback(() => {
    setIsRegisterDialogOpen(false);
    setSubmissionError(null);
  }, []);

  // Confirm registration
  const confirmRegister = useCallback(
    async (mode: 'continue' | 'finish') => {
      const current = engineStateRef.current;
      const currentDerived = getDerivedTimerState(current);

      if (!current.target || currentDerived.workSeconds < 1) {
        setIsRegisterDialogOpen(false);
        return;
      }

      const clientReqId = activeClientRequestId || safeUUID();
      setActiveClientRequestId(clientReqId);
      setSubmissionError(null);
      setIsSubmitting(true);

      try {
        const startedAt = current.work.segmentStartedAt || new Date().toISOString();
        const payload: {
          durationSeconds: number;
          startedAt: string;
          clientRequestId: string;
          projectId?: number;
          taskId?: number;
        } = {
          durationSeconds: currentDerived.workSeconds,
          startedAt,
          clientRequestId: clientReqId,
        };

        if (current.target.kind === 'PROJECT') {
          payload.projectId = current.target.id;
        } else {
          payload.taskId = current.target.id;
        }

        const newSession = await submitWorkSession(payload);

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

        // Save to recent targets
        saveRecentTarget(userId, current.target);

        // Local state changes ONLY after a successful response
        setEngineState((prev) => {
          const next = mode === 'continue' ? registerContinue(prev) : registerFinish(prev);
          persistState(next);
          return next;
        });

        setActiveClientRequestId(null);
        setIsRegisterDialogOpen(false);
        setSubmissionError(null);
        setShowFocusBanner(false);
        queryClient.invalidateQueries({ queryKey: ['attendance', 'today'] });
        queryClient.invalidateQueries({ queryKey: ['my-sessions-today'] });
        queryClient.invalidateQueries({ queryKey: ['admin-attendance'] });
        queryClient.invalidateQueries({ queryKey: ['work-targets', 'mine'] });
        queryClient.invalidateQueries({ queryKey: ['scrum'] });
        queryClient.invalidateQueries({ queryKey: ['scrum-tasks'] });
        queryClient.invalidateQueries({ queryKey: ['work-target-sessions'] });
        queryClient.invalidateQueries({ queryKey: ['scrum-admin', 'dashboard'] });
        toast.success('زمان کار با موفقیت ثبت شد');
      } catch (err: unknown) {
        const mapped = mapWorkSessionError(err, current.target.kind);
        if (mapped.canDiscardTarget) {
          removeRecentTarget(userId, current.target);
          queryClient.invalidateQueries({ queryKey: ['work-targets', 'mine'] });
          queryClient.invalidateQueries({ queryKey: ['projects', 'mine'] });
        }
        setSubmissionError({
          message: mapped.message,
          canDiscardTarget: mapped.canDiscardTarget,
        });
        toast.error(mapped.message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [activeClientRequestId, persistState, userId]
  );

  // Discard unloggable target time and reset timer so user can select an active target
  const discardTargetAndReset = useCallback(() => {
    const current = engineStateRef.current;
    if (current.target) {
      removeRecentTarget(userId, current.target);
    }
    setEngineState((prev) => {
      const next = discardTarget(prev, null);
      persistState(next);
      return next;
    });
    setActiveClientRequestId(null);
    setIsRegisterDialogOpen(false);
    setSubmissionError(null);
    setShowFocusBanner(false);
    toast.success('زمان ثبت‌نشده پاک شد. اکنون می‌توانید هدف جدیدی انتخاب کنید.');
  }, [persistState, userId]);

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

  const pendingProjectChange = pendingTargetChange
    ? { newProjectId: pendingTargetChange.id, newProjectName: pendingTargetChange.label }
    : null;

  return {
    state: mappedState,
    status: engineState.status,
    target: engineState.target,
    selectedTarget: engineState.target,
    projectId: engineState.target?.kind === 'PROJECT' ? engineState.target.id : null,
    workMs: derived.workMs,
    workSeconds: derived.workSeconds,
    pomodoroRemainingMs: derived.pomodoroRemainingMs,
    pomodoroRemainingSeconds: derived.pomodoroRemainingSeconds,
    pomodoroMode: derived.pomodoroMode as PomodoroMode,
    isBreakActive: derived.isBreakActive,
    canStart: derived.canStart && Boolean(engineState.target) && !isOtherTabActive && !isSubmitting,
    canRegister: derived.canRegister && !isOtherTabActive && !isSubmitting,
    mainButtonLabel: derived.mainButtonLabel,
    mainButtonDisabled: derived.mainButtonDisabled || !engineState.target || isOtherTabActive || isSubmitting,
    mainButtonDisabledReason: !engineState.target
      ? 'برای شروع، ابتدا یک پروژه یا هدف کاری انتخاب کنید.'
      : isOtherTabActive
      ? 'تایمر در تب دیگری فعال است.'
      : derived.mainButtonDisabledReason,
    registerButtonDisabled: derived.registerButtonDisabled || isOtherTabActive || isSubmitting,
    registerButtonDisabledReason: isOtherTabActive ? 'تایمر در تب دیگری فعال است.' : derived.registerButtonDisabledReason,
    isLocked: derived.projectSelectLocked || isSubmitting,
    savedProjectId: engineState.target?.kind === 'PROJECT' ? engineState.target.id : null,
    isOtherTabActive,
    dismissOtherTabLock,
    isSubmitting,
    submissionError,
    discardTargetAndSwitch,
    discardTargetAndReset,
    showRecoveredNotice,
    dismissRecoveredNotice: () => setShowRecoveredNotice(false),
    showFocusBanner,
    dismissFocusBanner: () => setShowFocusBanner(false),
    start,
    pause,
    clearTarget,
    clearProject,
    handleSelectTarget,
    handleSelectProject,
    openRegisterDialog,
    closeRegisterDialog,
    isRegisterDialogOpen,
    confirmRegister,
    pendingTargetChange,
    confirmTargetChange,
    cancelTargetChange,
    pendingProjectChange,
    confirmProjectChange: confirmTargetChange,
    cancelProjectChange: cancelTargetChange,
  };
}
