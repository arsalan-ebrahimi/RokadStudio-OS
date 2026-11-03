import { apiClient } from '@/shared/lib/api-client';
import type { Project } from '@/shared/types/models';

export async function fetchMyProjects(): Promise<Project[]> {
  const res = await apiClient<Project[]>('/api/projects/mine');
  return res.data;
}

export async function fetchAllProjects(params?: { page?: number; limit?: number; isActive?: boolean; search?: string }) {
  const res = await apiClient<Project[]>('/api/projects', { params });
  return res;
}

