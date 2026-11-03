import { create } from 'zustand';
import { WORK_DURATION_SECONDS, BREAK_DURATION_SECONDS, TIMER_STORAGE_KEY } from '@/shared/config/constants';
import { submitWorkSession } from '../api/timer-api';
import { playCompletionChime } from '../lib/sound';
import { formatSecondsToTime } from '@/shared/lib/formatters';
import { toast } from '@/shared/ui';
import { queryClient } from '@/shared/lib/query-client';

export type TimerState = 'IDLE' | 'RUNNING' | 'PAUSED' | 'BREAK' | 'DONE';

interface StoredData {
  state: TimerState;
  remaining: number;
  projectId: number | null;
  targetTimestamp: number | null;
}

function loadInitialState(): StoredData {
  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY);
    if (!raw) {
      return { state: 'IDLE', remaining: WORK_DURATION_SECONDS, projectId: null, targetTimestamp: null };
    }
    const data: StoredData = JSON.parse(raw);

    if (data.state === 'RUNNING' && data.targetTimestamp) {
      const diff = Math.max(0, Math.round((data.targetTimestamp - Date.now()) / 1000));
      if (diff > 0) {
        return { ...data, remaining: diff };
      }
      return {
        state: 'BREAK',
        remaining: BREAK_DURATION_SECONDS,
        projectId: data.projectId,
        targetTimestamp: Date.now() + BREAK_DURATION_SECONDS * 1000,
      };
    }

    if (data.state === 'BREAK' && data.targetTimestamp) {
      const diff = Math.max(0, Math.round((data.targetTimestamp - Date.now()) / 1000));
      if (diff > 0) {
        return { ...data, remaining: diff };
      }
      return { state: 'DONE', remaining: 0, projectId: data.projectId, targetTimestamp: null };
    }

    return {
      state: data.state || 'IDLE',
      remaining: typeof data.remaining === 'number' ? data.remaining : WORK_DURATION_SECONDS,
      projectId: data.projectId || null,
      targetTimestamp: data.targetTimestamp || null,
    };
  } catch {
    return { state: 'IDLE', remaining: WORK_DURATION_SECONDS, projectId: null, targetTimestamp: null };
  }
}

function persistState(state: StoredData) {
  try {
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

interface TimerStore extends StoredData {
  start: (projectIdOverride?: number | null) => void;
  pause: () => void;
  reset: () => void;
  forceReset: () => void;
  setProjectId: (projectId: number | null) => void;
  tick: () => void;
}

const initialData = loadInitialState();

export const useTimerStore = create<TimerStore>((set, get) => ({
  ...initialData,

  setProjectId: (projectId: number | null) => {
    set({ projectId });
    const { state, remaining, targetTimestamp } = get();
    persistState({ state, remaining, projectId, targetTimestamp });
  },

  start: (projectIdOverride?: number | null) => {
    const currentPid = projectIdOverride ?? get().projectId;
    if (!currentPid) {
      toast.error('ابتدا پروژه را انتخاب کنید');
      return;
    }

    const { remaining } = get();
    const duration = remaining > 0 ? remaining : WORK_DURATION_SECONDS;
    const target = Date.now() + duration * 1000;

    const newState: StoredData = {
      state: 'RUNNING',
      remaining: duration,
      projectId: currentPid,
      targetTimestamp: target,
    };

    set(newState);
    persistState(newState);
  },

  pause: () => {
    const { targetTimestamp, state, projectId, remaining } = get();
    if (state !== 'RUNNING') return;

    const currentRem = targetTimestamp
      ? Math.max(0, Math.round((targetTimestamp - Date.now()) / 1000))
      : remaining;

    const newState: StoredData = {
      state: 'PAUSED',
      remaining: currentRem,
      projectId,
      targetTimestamp: null,
    };

    set(newState);
    persistState(newState);
  },

  reset: () => {
    const { state, projectId } = get();
    if (state !== 'DONE') return;

    const newState: StoredData = {
      state: 'IDLE',
      remaining: WORK_DURATION_SECONDS,
      projectId,
      targetTimestamp: null,
    };

    set(newState);
    persistState(newState);
  },

  forceReset: () => {
    const defaultState: StoredData = {
      state: 'IDLE',
      remaining: WORK_DURATION_SECONDS,
      projectId: null,
      targetTimestamp: null,
    };
    set(defaultState);
    persistState(defaultState);
    try {
      localStorage.removeItem('rokad_selected_project');
    } catch {}
    if (typeof document !== 'undefined') {
      document.title = 'رکاد استودیو | Rokad Studio OS';
    }
  },

  tick: async () => {
    const { state, targetTimestamp, projectId } = get();

    if (state === 'RUNNING') {
      if (!targetTimestamp) return;
      const diff = Math.max(0, Math.round((targetTimestamp - Date.now()) / 1000));

      document.title = `${formatSecondsToTime(diff)} | رکاد استودیو`;
      set({ remaining: diff });

      if (diff <= 0) {
        playCompletionChime();
        if (projectId) {
          try {
            await submitWorkSession({ projectId, durationSeconds: WORK_DURATION_SECONDS });
            queryClient.invalidateQueries({ queryKey: ['attendance'] });
            toast.success('سشن ۲۵ دقیقه‌ای با موفقیت ثبت شد');
          } catch {
            toast.error('خطا در ثبت سشن در سرور');
          }
        }

        const breakTarget = Date.now() + BREAK_DURATION_SECONDS * 1000;
        const breakState: StoredData = {
          state: 'BREAK',
          remaining: BREAK_DURATION_SECONDS,
          projectId,
          targetTimestamp: breakTarget,
        };
        set(breakState);
        persistState(breakState);
      } else {
        persistState({ state, remaining: diff, projectId, targetTimestamp });
      }
    } else if (state === 'BREAK') {
      if (!targetTimestamp) return;
      const diff = Math.max(0, Math.round((targetTimestamp - Date.now()) / 1000));

      document.title = `${formatSecondsToTime(diff)} | استراحت رکاد`;
      set({ remaining: diff });

      if (diff <= 0) {
        playCompletionChime();
        toast.info('زمان استراحت پایان یافت');
        const doneState: StoredData = {
          state: 'DONE',
          remaining: 0,
          projectId,
          targetTimestamp: null,
        };
        set(doneState);
        persistState(doneState);
        document.title = 'رکاد استودیو | Rokad Studio OS';
      } else {
        persistState({ state, remaining: diff, projectId, targetTimestamp });
      }
    } else {
      document.title = 'رکاد استودیو | Rokad Studio OS';
    }
  },
}));

// Run ticker continuously in background
if (typeof window !== 'undefined') {
  setInterval(() => {
    useTimerStore.getState().tick();
  }, 1000);
}

// React hook adapter for component compatibility
export function useTimer(selectedProjectId?: number | null) {
  const store = useTimerStore();

  const handleStart = () => {
    store.start(selectedProjectId);
  };

  return {
    state: store.state,
    remaining: store.remaining,
    start: handleStart,
    pause: store.pause,
    reset: store.reset,
    savedProjectId: store.projectId,
    isLocked: store.state === 'RUNNING' || store.state === 'PAUSED' || store.state === 'BREAK',
  };
}
