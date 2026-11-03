import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { WORK_DURATION_SECONDS, BREAK_DURATION_SECONDS, TIMER_STORAGE_KEY } from '@/shared/config/constants';
import { submitWorkSession } from '../api/timer-api';
import { playCompletionChime } from '../lib/sound';
import { formatSecondsToTime } from '@/shared/lib/formatters';
import { toast } from '@/shared/ui';

export type TimerState = 'IDLE' | 'RUNNING' | 'PAUSED' | 'BREAK' | 'DONE';

interface StoredTimer {
  state: TimerState;
  remaining: number;
  projectId: number | null;
  targetTimestamp: number | null;
}

function getStoredTimer(): StoredTimer {
  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY);
    if (!raw) return { state: 'IDLE', remaining: WORK_DURATION_SECONDS, projectId: null, targetTimestamp: null };
    const data: StoredTimer = JSON.parse(raw);

    // If it was running, calculate exact time elapsed since targetTimestamp
    if (data.state === 'RUNNING' && data.targetTimestamp) {
      const diff = Math.max(0, Math.round((data.targetTimestamp - Date.now()) / 1000));
      if (diff > 0) {
        return { ...data, remaining: diff };
      }
      // If time expired while away, enter break
      return { state: 'BREAK', remaining: BREAK_DURATION_SECONDS, projectId: data.projectId, targetTimestamp: Date.now() + BREAK_DURATION_SECONDS * 1000 };
    }

    if (data.state === 'BREAK' && data.targetTimestamp) {
      const diff = Math.max(0, Math.round((data.targetTimestamp - Date.now()) / 1000));
      if (diff > 0) {
        return { ...data, remaining: diff };
      }
      return { state: 'DONE', remaining: 0, projectId: data.projectId, targetTimestamp: null };
    }

    return data;
  } catch {
    return { state: 'IDLE', remaining: WORK_DURATION_SECONDS, projectId: null, targetTimestamp: null };
  }
}

export function useTimer(selectedProjectId: number | null) {
  const queryClient = useQueryClient();
  const initial = useRef(getStoredTimer());

  const [state, setState] = useState<TimerState>(initial.current.state);
  const [remaining, setRemaining] = useState<number>(initial.current.remaining);
  const targetTimeRef = useRef<number | null>(initial.current.targetTimestamp);
  const isCompletedRef = useRef(false);

  // Sync to localStorage
  const saveState = useCallback((s: TimerState, r: number, target: number | null, pid: number | null) => {
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify({
      state: s,
      remaining: r,
      projectId: pid,
      targetTimestamp: target,
    }));
  }, []);

  const handleCycleComplete = useCallback(async () => {
    if (isCompletedRef.current) return;
    isCompletedRef.current = true;
    playCompletionChime();

    if (state === 'RUNNING') {
      if (selectedProjectId) {
        try {
          await submitWorkSession({ projectId: selectedProjectId, durationSeconds: WORK_DURATION_SECONDS });
          queryClient.invalidateQueries({ queryKey: ['attendance'] });
          queryClient.invalidateQueries({ queryKey: ['sessions'] });
          toast.success('سشن ۲۵ دقیقه‌ای با موفقیت ثبت شد');
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'خطا در ثبت سشن';
          toast.error(msg);
        }
      }
      const newTarget = Date.now() + BREAK_DURATION_SECONDS * 1000;
      targetTimeRef.current = newTarget;
      setState('BREAK');
      setRemaining(BREAK_DURATION_SECONDS);
      saveState('BREAK', BREAK_DURATION_SECONDS, newTarget, selectedProjectId);
    } else if (state === 'BREAK') {
      targetTimeRef.current = null;
      setState('DONE');
      setRemaining(0);
      saveState('DONE', 0, null, selectedProjectId);
      toast.info('استراحت پایان یافت');
    }

    setTimeout(() => {
      isCompletedRef.current = false;
    }, 1000);
  }, [state, selectedProjectId, queryClient, saveState]);

  // Timer Tick based on wall-clock target time
  useEffect(() => {
    if (state !== 'RUNNING' && state !== 'BREAK') return;

    const interval = setInterval(() => {
      if (targetTimeRef.current) {
        const diff = Math.max(0, Math.round((targetTimeRef.current - Date.now()) / 1000));
        setRemaining(diff);
        saveState(state, diff, targetTimeRef.current, selectedProjectId);

        if (diff <= 0) {
          clearInterval(interval);
          handleCycleComplete();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [state, selectedProjectId, handleCycleComplete, saveState]);

  // Tab Title
  useEffect(() => {
    if (state === 'RUNNING' || state === 'BREAK') {
      document.title = `${formatSecondsToTime(remaining)} | راکاد استودیو`;
    } else {
      document.title = 'راکاد استودیو | Rokad Studio OS';
    }
  }, [remaining, state]);

  const start = () => {
    if (!selectedProjectId) {
      toast.error('ابتدا پروژه را انتخاب کنید');
      return;
    }
    const currentRemaining = remaining > 0 ? remaining : WORK_DURATION_SECONDS;
    const target = Date.now() + currentRemaining * 1000;
    targetTimeRef.current = target;
    setState('RUNNING');
    setRemaining(currentRemaining);
    saveState('RUNNING', currentRemaining, target, selectedProjectId);
  };

  const pause = () => {
    targetTimeRef.current = null;
    setState('PAUSED');
    saveState('PAUSED', remaining, null, selectedProjectId);
  };

  const reset = () => {
    if (state !== 'DONE') return;
    targetTimeRef.current = null;
    setState('IDLE');
    setRemaining(WORK_DURATION_SECONDS);
    saveState('IDLE', WORK_DURATION_SECONDS, null, selectedProjectId);
  };

  return {
    state,
    remaining,
    start,
    pause,
    reset,
    savedProjectId: initial.current.projectId,
    isLocked: state === 'RUNNING' || state === 'PAUSED' || state === 'BREAK',
  };
}
