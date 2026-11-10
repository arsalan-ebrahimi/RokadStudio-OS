import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchTodayAttendance,
  saveTodayWorkNote,
  submitTodayAttendance,
} from '../api/attendance-api';
import type { Attendance } from '@/shared/types/models';
import { toast } from '@/shared/ui';

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
    staleTime: 1000 * 60, // 60s
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
    // Only poll in background when user is actively PRESENT (every 30s)
    // Never poll while undeclared (prevents interrupting user in modal) or when ABSENT
    refetchInterval: (q) => {
      const data = q.state.data;
      return data?.status === 'PRESENT' ? 30_000 : false;
    },
  });

  const mutation = useMutation({
    mutationFn: submitTodayAttendance,
    onSuccess: (data) => {
      queryClient.setQueryData(attendanceKeys.today(), (old: typeof data | undefined) => ({
        ...(old || {}),
        ...data,
        sessionsCount: data.sessionsCount ?? old?.sessionsCount ?? 0,
        totalSeconds: data.totalSeconds ?? old?.totalSeconds ?? 0,
      }));
      queryClient.invalidateQueries({ queryKey: attendanceKeys.today() });
      if (data.status === 'ABSENT') {
        toast.info('عدم حضور شما برای امروز ثبت شد');
      } else {
        toast.success('حضور شما با موفقیت ثبت شد');
      }
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
    markPresent: () => mutation.mutate({ status: 'PRESENT' }),
    markAbsent: (reason?: string) => mutation.mutate({ status: 'ABSENT', reason }),
    isSubmitting: mutation.isPending,
  };
}

export function useSaveTodayWorkNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { text: string } | { skipped: true }) => saveTodayWorkNote(payload),
    onSuccess: (res) => {
      queryClient.setQueryData<Attendance | null>(attendanceKeys.today(), (old) => {
        if (!old) return old;
        return {
          ...old,
          workNote: res.workNote,
          workNoteAt: res.workNoteAt,
          workNotePrompted: res.workNotePrompted,
        };
      });
      queryClient.invalidateQueries({ queryKey: attendanceKeys.today() });
      queryClient.invalidateQueries({ queryKey: ['member-day'] });
      queryClient.invalidateQueries({ queryKey: ['member-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['admin-attendance'] });
    },
  });
}

