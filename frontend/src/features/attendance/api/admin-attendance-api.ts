import { apiClient } from '@/shared/lib/api-client';
import type { Attendance } from '@/shared/types/models';
import type { ApiResponse } from '@/shared/types/api';

export interface AdminAttendanceParams {
  page?: number;
  limit?: number;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  approval?: 'PENDING' | 'APPROVED' | 'REJECTED';
  status?: 'PRESENT' | 'ABSENT';
  userId?: number;
}

export async function fetchAdminAttendance(params: AdminAttendanceParams = {}): Promise<ApiResponse<Attendance[]>> {
  return apiClient<Attendance[]>('/api/attendance/admin', { params: params as Record<string, string | number> });
}

export async function decideAttendance(id: number, decision: 'APPROVED' | 'REJECTED'): Promise<Attendance> {
  const res = await apiClient<Attendance>(`/api/attendance/admin/${id}/decision`, {
    method: 'PATCH',
    body: JSON.stringify({ decision }),
  });
  return res.data;
}

