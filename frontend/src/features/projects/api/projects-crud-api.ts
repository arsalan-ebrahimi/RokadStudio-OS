import { apiClient } from '@/shared/lib/api-client';
import type { Project } from '@/shared/types/models';

export interface CreateProjectPayload {
  name: string;
  description?: string;
  memberIds?: number[];
}

export interface UpdateProjectPayload {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export async function createProject(payload: CreateProjectPayload): Promise<Project> {
  const res = await apiClient<Project>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateProject(id: number, payload: UpdateProjectPayload): Promise<Project> {
  const res = await apiClient<Project>(`/api/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function syncMembers(id: number, userIds: number[]) {
  const res = await apiClient(`/api/projects/${id}/members`, {
    method: 'PUT',
    body: JSON.stringify({ userIds }),
  });
  return res.data;
}

export async function deleteProject(id: number): Promise<void> {
  await apiClient(`/api/projects/${id}`, { method: 'DELETE' });
}

export async function fetchProjectDetails(id: number): Promise<Project & { members: { id: number; name: string }[] }> {
  const res = await apiClient<Project & { members: { id: number; name: string }[] }>(`/api/projects/${id}`);
  return res.data;
}

