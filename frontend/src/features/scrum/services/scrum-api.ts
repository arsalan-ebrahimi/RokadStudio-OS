import { apiClient } from '@/shared/lib/api-client';
import type {
  Scrum,
  ScrumMember,
  Sprint,
  SprintProject,
  ScrumKpi,
  ScrumEvent,
  TodayScrumEvent,
  WorkTargetsResponse,
  ScrumReportData,
  ScrumColor,
  SprintStatus,
  ItemStatus,
} from '../types/scrum-types';

export async function fetchScrums(): Promise<Scrum[]> {
  const res = await apiClient<Scrum[]>('/api/scrums');
  return res.data;
}

export async function createScrum(payload: {
  name: string;
  description?: string;
  color?: ScrumColor;
  ownerId?: number;
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
  payload: { name?: string; description?: string; color?: ScrumColor; isActive?: boolean }
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

export async function fetchSprints(scrumId: number): Promise<Sprint[]> {
  const res = await apiClient<Sprint[]>(`/api/scrums/${scrumId}/sprints`);
  return res.data;
}

export async function createSprint(
  scrumId: number,
  payload?: { title?: string; description?: string; startDate?: string; endDate?: string }
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
  payload: { title?: string; description?: string; startDate?: string | null; endDate?: string | null }
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

export async function createSprintProject(
  sprintId: number,
  payload: { name: string; points?: number; assigneeId?: number | null }
): Promise<SprintProject> {
  const res = await apiClient<SprintProject>(`/api/sprints/${sprintId}/projects`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateSprintProject(
  id: number,
  payload: {
    name?: string;
    points?: number;
    assigneeId?: number | null;
    status?: ItemStatus;
    sortOrder?: number;
  }
): Promise<SprintProject> {
  const res = await apiClient<SprintProject>(`/api/sprint-projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function deleteSprintProject(id: number): Promise<void> {
  await apiClient<null>(`/api/sprint-projects/${id}`, {
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
  params?: { sprintId?: number; from?: string; to?: string }
): Promise<ScrumReportData> {
  const res = await apiClient<ScrumReportData>(`/api/scrums/${scrumId}/report`, {
    params,
  });
  return res.data;
}

