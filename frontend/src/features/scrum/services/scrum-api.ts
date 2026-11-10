import { apiClient } from '@/shared/lib/api-client';
import type { PaginationMeta } from '@/shared/types/api';
import type {
  WorkTargetSessionsData,
  WorkTargetSessionsQuery,
} from '@/shared/types/models';
import type {
  Scrum,
  ScrumMember,
  ScrumUserRef,
  Sprint,
  ScrumTask,
  ScrumKpi,
  ScrumEvent,
  TodayScrumEvent,
  WorkTargetsResponse,
  ScrumReportData,
  ScrumLeaderboardData,
  ScrumAdminDashboardData,
  LeaderboardPeriod,
  ScrumColor,
  SprintStatus,
} from '../types/scrum-types';

export async function fetchScrums(): Promise<Scrum[]> {
  const res = await apiClient<Scrum[]>('/api/scrums');
  return res.data;
}

export async function createScrum(payload: {
  name: string;
  description?: string | null;
  color?: ScrumColor;
  adminIds?: number[];
}): Promise<Scrum> {
  const res = await apiClient<Scrum>('/api/scrums', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function fetchScrumById(id: number): Promise<Scrum> {
  const res = await apiClient<Scrum>(`/api/scrums/${id}`);
  return res.data;
}

export async function updateScrum(
  id: number,
  payload: { name?: string; description?: string | null; color?: ScrumColor; isActive?: boolean }
): Promise<Scrum> {
  const res = await apiClient<Scrum>(`/api/scrums/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function deleteScrum(id: number): Promise<void> {
  await apiClient<null>(`/api/scrums/${id}`, {
    method: 'DELETE',
  });
}

export async function syncScrumAdmins(id: number, userIds: number[]): Promise<ScrumUserRef[]> {
  const res = await apiClient<ScrumUserRef[]>(`/api/scrums/${id}/admins`, {
    method: 'PUT',
    body: JSON.stringify({ userIds }),
  });
  return res.data;
}

export async function syncScrumMembers(
  id: number,
  members: { userId: number; label?: string | null }[]
): Promise<ScrumMember[]> {
  const res = await apiClient<ScrumMember[]>(`/api/scrums/${id}/members`, {
    method: 'PUT',
    body: JSON.stringify({ members }),
  });
  return res.data;
}

export async function fetchScrumTasks(
  scrumId: number,
  params?: { isActive?: boolean; search?: string; sprintId?: number }
): Promise<ScrumTask[]> {
  const cleanParams: Record<string, string | number | boolean> = {};
  if (typeof params?.isActive === 'boolean') cleanParams.isActive = params.isActive;
  if (params?.search && params.search.trim()) cleanParams.search = params.search.trim();
  if (params?.sprintId) cleanParams.sprintId = params.sprintId;

  const res = await apiClient<ScrumTask[]>(`/api/scrums/${scrumId}/tasks`, {
    params: cleanParams,
  });
  return res.data;
}

export async function createScrumTask(
  scrumId: number,
  payload: {
    name: string;
    description?: string | null;
    points?: number;
    isActive?: boolean;
    sprintId?: number | null;
    memberIds?: number[];
  }
): Promise<ScrumTask> {
  const res = await apiClient<ScrumTask>(`/api/scrums/${scrumId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateScrumTask(
  taskId: number,
  payload: {
    name?: string;
    description?: string | null;
    points?: number;
    isActive?: boolean;
    sprintId?: number | null;
  }
): Promise<ScrumTask> {
  const res = await apiClient<ScrumTask>(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function syncTaskMembers(taskId: number, userIds: number[]): Promise<ScrumUserRef[]> {
  const res = await apiClient<ScrumUserRef[]>(`/api/tasks/${taskId}/members`, {
    method: 'PUT',
    body: JSON.stringify({ userIds }),
  });
  return res.data;
}

export async function deleteScrumTask(taskId: number): Promise<void> {
  await apiClient<null>(`/api/tasks/${taskId}`, {
    method: 'DELETE',
  });
}

export async function fetchTaskWorkSessions(
  taskId: number,
  query: WorkTargetSessionsQuery = {}
): Promise<{ data: WorkTargetSessionsData; meta?: PaginationMeta }> {
  const cleanParams: Record<string, string | number> = {};
  if (query.date) cleanParams.date = query.date;
  if (query.dateFrom) cleanParams.dateFrom = query.dateFrom;
  if (query.dateTo) cleanParams.dateTo = query.dateTo;
  if (query.approval && query.approval !== 'ALL') cleanParams.approval = query.approval;
  if (query.userId) cleanParams.userId = query.userId;
  if (query.page) cleanParams.page = query.page;
  if (query.limit) cleanParams.limit = query.limit;

  const res = await apiClient<WorkTargetSessionsData>(`/api/tasks/${taskId}/work-sessions`, {
    params: cleanParams,
  });
  return { data: res.data, meta: res.meta };
}

export async function fetchSprints(scrumId: number): Promise<Sprint[]> {
  const res = await apiClient<Sprint[]>(`/api/scrums/${scrumId}/sprints`);
  return res.data;
}

export async function createSprint(
  scrumId: number,
  payload?: {
    title?: string;
    description?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    progressPercent?: number;
  }
): Promise<Sprint> {
  const res = await apiClient<Sprint>(`/api/scrums/${scrumId}/sprints`, {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  });
  return res.data;
}

export async function fetchSprintById(id: number): Promise<Sprint> {
  const res = await apiClient<Sprint>(`/api/sprints/${id}`);
  return res.data;
}

export async function updateSprint(
  id: number,
  payload: {
    title?: string;
    description?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    progressPercent?: number;
  }
): Promise<Sprint> {
  const res = await apiClient<Sprint>(`/api/sprints/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateSprintStatus(id: number, status: SprintStatus): Promise<Sprint> {
  const res = await apiClient<Sprint>(`/api/sprints/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return res.data;
}

export async function deleteSprint(id: number): Promise<void> {
  await apiClient<null>(`/api/sprints/${id}`, {
    method: 'DELETE',
  });
}

export async function fetchKpis(scrumId: number): Promise<ScrumKpi[]> {
  const res = await apiClient<ScrumKpi[]>(`/api/scrums/${scrumId}/kpis`);
  return res.data;
}

export async function batchUpdateKpis(scrumId: number, rows: ScrumKpi[]): Promise<ScrumKpi[]> {
  const res = await apiClient<ScrumKpi[]>(`/api/scrums/${scrumId}/kpis`, {
    method: 'PUT',
    body: JSON.stringify({ rows }),
  });
  return res.data;
}

export async function fetchEvents(scrumId: number): Promise<ScrumEvent[]> {
  const res = await apiClient<ScrumEvent[]>(`/api/scrums/${scrumId}/events`);
  return res.data;
}

export async function batchUpdateEvents(scrumId: number, rows: ScrumEvent[]): Promise<ScrumEvent[]> {
  const res = await apiClient<ScrumEvent[]>(`/api/scrums/${scrumId}/events`, {
    method: 'PUT',
    body: JSON.stringify({ rows }),
  });
  return res.data;
}

export async function fetchTodayScrumEvents(): Promise<TodayScrumEvent[]> {
  const res = await apiClient<TodayScrumEvent[]>('/api/scrums/today-events');
  return res.data;
}

export async function fetchWorkTargetsMine(): Promise<WorkTargetsResponse> {
  const res = await apiClient<WorkTargetsResponse>('/api/work-targets/mine');
  return res.data;
}

export async function fetchScrumReport(
  scrumId: number,
  params?: { sprintId?: number; taskId?: number; from?: string; to?: string }
): Promise<ScrumReportData> {
  const cleanParams: Record<string, string | number> = {};
  if (params?.sprintId) cleanParams.sprintId = params.sprintId;
  if (params?.taskId) cleanParams.taskId = params.taskId;
  if (params?.from) cleanParams.from = params.from;
  if (params?.to) cleanParams.to = params.to;

  const res = await apiClient<ScrumReportData>(`/api/scrums/${scrumId}/report`, {
    params: cleanParams,
  });
  return res.data;
}

export async function fetchScrumLeaderboard(
  scrumId: number,
  params?: { period?: LeaderboardPeriod; sprintId?: number }
): Promise<ScrumLeaderboardData> {
  const res = await apiClient<ScrumLeaderboardData>(`/api/scrums/${scrumId}/leaderboard`, {
    params: {
      period: params?.period,
      sprintId: params?.period === 'SPRINT' && params?.sprintId ? params.sprintId : undefined,
    },
  });
  return res.data;
}

export async function fetchScrumAdminDashboard(): Promise<ScrumAdminDashboardData> {
  const res = await apiClient<ScrumAdminDashboardData>('/api/scrum-admin/dashboard');
  return res.data;
}
