import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTodayAttendance, submitTodayAttendance } from '../api/attendance-api';
import { toast } from '@/shared/ui';
import { useTimerStore } from '@/features/timer';

export const attendanceKeys = {
  today: () => ['attendance', 'today'] as const,
  me: (params?: Record<string, unknown>) => ['attendance', 'me', params] as const,
  admin: (params?: Record<string, unknown>) => ['attendance', 'admin', params] as const,
};

export function useTodayAttendance() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: attendanceKeys.today(),
    queryFn: fetchTodayAttendance,
    refetchInterval: 5000,
  });

  useEffect(() => {
    const timerResetAt = query.data?.timerResetAt;
    if (timerResetAt) {
      const lastAck = Number(localStorage.getItem('rokad_last_timer_reset_ack') || 0);
      if (timerResetAt > lastAck) {
        localStorage.setItem('rokad_last_timer_reset_ack', String(timerResetAt));
        useTimerStore.getState().forceReset();
        toast.info('قفل پروژه باز شد و تایمر ریست گردید');
      }
    }
  }, [query.data?.timerResetAt]);

  const mutation = useMutation({
    mutationFn: submitTodayAttendance,
    onSuccess: (data) => {
      queryClient.setQueryData(attendanceKeys.today(), data);
      toast.success('حضور امروز ثبت شد');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در ثبت حضور');
    },
  });

  return {
    attendance: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    markPresent: () => mutation.mutate('PRESENT'),
    isSubmitting: mutation.isPending,
  };
}

