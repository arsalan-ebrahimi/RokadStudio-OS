import { useState, useEffect, useRef } from 'react';
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

export function useTimer(selectedProjectId: number | null) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<TimerState>('IDLE');
  const [remaining, setRemaining] = useState<number>(WORK_DURATION_SECONDS);
  const targetTimeRef = useRef<number | null>(null);

  // Restore on mount
  useEffect(() => {
    const saved = localStorage.getItem(TIMER_STORAGE_KEY);
    if (!saved) return;
    try {
      const data: StoredTimer = JSON.parse(saved);
      if (data.state === 'RUNNING' && data.targetTimestamp) {
        const diff = Math.max(0, Math.round((data.targetTimestamp - Date.now()) / 1000));
        setRemaining(diff);
        setState(diff > 0 ? 'RUNNING' : 'BREAK');
        targetTimeRef.current = data.targetTimestamp;
      } else {
        setState(data.state);
        setRemaining(data.remaining);
      }
    } catch {
      localStorage.removeItem(TIMER_STORAGE_KEY);
    }
  }, []);

  // Save on change
  useEffect(() => {
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify({
      state,
      remaining,
      projectId: selectedProjectId,
      targetTimestamp: targetTimeRef.current,
    }));
  }, [state, remaining, selectedProjectId]);

  // Tab Title
  useEffect(() => {
    if (state === 'RUNNING' || state === 'BREAK') {
      document.title = `${formatSecondsToTime(remaining)} | پلتفرم استودیو رکاد`;
    } else {
      document.title = 'پلتفرم حضور و زمان استودیو رکاد';
    }
  }, [remaining, state]);

  // Timer Tick
  useEffect(() => {
    if (state !== 'RUNNING' && state !== 'BREAK') return;

    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          handleCycleComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state, selectedProjectId]);

  const handleCycleComplete = async () => {
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
      setState('BREAK');
      setRemaining(BREAK_DURATION_SECONDS);
      targetTimeRef.current = Date.now() + BREAK_DURATION_SECONDS * 1000;
    } else if (state === 'BREAK') {
      setState('DONE');
      setRemaining(0);
      targetTimeRef.current = null;
      toast.info('استراحت پایان یافت');
    }
  };

  const start = () => {
    if (!selectedProjectId) {
      toast.error('ابتدا پروژه را انتخاب کنید');
      return;
    }
    setState('RUNNING');
    targetTimeRef.current = Date.now() + remaining * 1000;
  };

  const pause = () => {
    setState('PAUSED');
    targetTimeRef.current = null;
  };

  const reset = () => {
    if (state !== 'DONE') return;
    setState('IDLE');
    setRemaining(WORK_DURATION_SECONDS);
    targetTimeRef.current = null;
  };

  return { state, remaining, start, pause, reset, isLocked: state === 'RUNNING' || state === 'PAUSED' || state === 'BREAK' };
}
