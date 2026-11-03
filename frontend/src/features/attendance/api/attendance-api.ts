import { apiClient } from '@/shared/lib/api-client';
import type { Attendance } from '@/shared/types/models';

export async function fetchTodayAttendance(): Promise<Attendance | null> {
  const res = await apiClient<Attendance | null>('/api/attendance/today');
  return res.data;
}

export async function submitTodayAttendance(status: 'PRESENT' | 'ABSENT' = 'PRESENT'): Promise<Attendance> {
  const res = await apiClient<Attendance>('/api/attendance/today', {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
  return res.data;
}

export async function fetchMyAttendance(params?: { page?: number; limit?: number; dateFrom?: string; dateTo?: string }) {
  const res = await apiClient<Attendance[]>('/api/attendance/me', { params });
  return res;
}
