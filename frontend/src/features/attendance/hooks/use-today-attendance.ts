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
  });

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
