import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getTehranTodayString } from '@/shared/lib/date';
import { attendanceKeys } from './use-today-attendance';

export function useMidnightWatcher(onMidnightPassed?: () => void) {
  const queryClient = useQueryClient();
  const currentDayRef = useRef(getTehranTodayString());

  useEffect(() => {
    const checkMidnight = () => {
      const today = getTehranTodayString();
      if (today !== currentDayRef.current) {
        currentDayRef.current = today;
        queryClient.invalidateQueries({ queryKey: attendanceKeys.today() });
        onMidnightPassed?.();
      }
    };

    const interval = setInterval(checkMidnight, 30_000);
    window.addEventListener('visibilitychange', checkMidnight);
    window.addEventListener('focus', checkMidnight);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', checkMidnight);
      window.removeEventListener('focus', checkMidnight);
    };
  }, [queryClient, onMidnightPassed]);
}

