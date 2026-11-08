import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTodayAttendance, submitTodayAttendance } from '../api/attendance-api';
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
    refetchInterval: 5000,
  });

  const mutation = useMutation({
    mutationFn: submitTodayAttendance,
    onSuccess: (data) => {
      queryClient.setQueryData(attendanceKeys.today(), data);
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

