import { apiClient } from '@/shared/lib/api-client';
import type { WorkSession } from '@/shared/types/models';

export interface LogSessionPayload {
  projectId: number;
  durationSeconds: number;
  startedAt: string;
  clientRequestId: string;
}

export interface MySessionsResponse {
  totalSeconds: number;
  sessions: WorkSession[];
}

export async function submitWorkSession(payload: LogSessionPayload): Promise<WorkSession> {
  const res = await apiClient<WorkSession>('/api/work-sessions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function fetchMySessionsToday(): Promise<MySessionsResponse> {
  const res = await apiClient<MySessionsResponse>('/api/work-sessions/me');
  return res.data;
}

