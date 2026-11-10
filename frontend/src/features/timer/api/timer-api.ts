import { apiClient } from '@/shared/lib/api-client';
import type { PaginationMeta } from '@/shared/types/api';
import type {
  WorkSession,
  WorkSessionTargetsResponse,
  WorkTargetKind,
  WorkTargetSessionsData,
  WorkTargetSessionsQuery,
} from '@/shared/types/models';

export interface LogSessionPayload {
  projectId?: number;
  taskId?: number;
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

export interface AdminSessionsParams {
  page?: number;
  limit?: number;
  userId?: number;
  targetType?: 'ALL' | 'PROJECT' | 'TASK';
  projectId?: number;
  taskId?: number;
  approval?: string;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface AdminSessionsResponse {
  totalSeconds: number;
  sessions: WorkSession[];
}

export async function fetchAdminWorkSessions(
  params: AdminSessionsParams = {},
): Promise<{ data: AdminSessionsResponse; meta?: PaginationMeta }> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.userId) query.set('userId', String(params.userId));
  if (params.targetType && params.targetType !== 'ALL') query.set('targetType', params.targetType);
  if (params.projectId) query.set('projectId', String(params.projectId));
  if (params.taskId) query.set('taskId', String(params.taskId));
  if (params.approval && params.approval !== 'ALL') query.set('approval', params.approval);
  if (params.date) query.set('date', params.date);
  if (params.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params.dateTo) query.set('dateTo', params.dateTo);

  const qs = query.toString();
  const url = `/api/work-sessions${qs ? `?${qs}` : ''}`;
  const res = await apiClient<AdminSessionsResponse>(url);
  return { data: res.data, meta: res.meta };
}

export async function fetchWorkSessionTargets(): Promise<WorkSessionTargetsResponse> {
  const res = await apiClient<WorkSessionTargetsResponse>('/api/work-sessions/targets');
  return res.data;
}

export async function fetchWorkTargetSessions(
  targetKind: WorkTargetKind,
  targetId: number,
  query: WorkTargetSessionsQuery = {},
): Promise<{ data: WorkTargetSessionsData; meta?: PaginationMeta }> {
  const params: Record<string, string | number> = {};
  if (query.date) params.date = query.date;
  if (query.dateFrom) params.dateFrom = query.dateFrom;
  if (query.dateTo) params.dateTo = query.dateTo;
  if (query.approval && query.approval !== 'ALL') params.approval = query.approval;
  if (query.userId) params.userId = query.userId;
  if (query.page) params.page = query.page;
  if (query.limit) params.limit = query.limit;

  const endpoint =
    targetKind === 'PROJECT'
      ? `/api/projects/${targetId}/work-sessions`
      : `/api/tasks/${targetId}/work-sessions`;

  const res = await apiClient<WorkTargetSessionsData>(endpoint, { params });
  return { data: res.data, meta: res.meta };
}

export async function decideWorkSession(id: number, decision: 'APPROVED' | 'REJECTED'): Promise<WorkSession> {
  const res = await apiClient<WorkSession>(`/api/work-sessions/${id}/decision`, {
    method: 'PATCH',
    body: JSON.stringify({ decision }),
  });
  return res.data;
}

export async function deleteWorkSession(id: number): Promise<{ id: number }> {
  const res = await apiClient<{ id: number }>(`/api/work-sessions/${id}`, {
    method: 'DELETE',
  });
  return res.data;
}

