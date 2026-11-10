import { apiClient } from '@/shared/lib/api-client';
import type { User, Role } from '@/shared/types/models';
import type { ApiResponse } from '@/shared/types/api';

export interface UserBasic {
  id: number;
  name: string;
}

export interface CreateUserPayload {
  code: string;
  name: string;
  role?: Role;
}

export interface UpdateUserPayload {
  code?: string;
  name?: string;
  role?: Role;
  isActive?: boolean;
}

export async function fetchUsers(params?: { page?: number; limit?: number; role?: Role; isActive?: boolean; search?: string }): Promise<ApiResponse<User[]>> {
  return apiClient<User[]>('/api/users', { params });
}

export async function createUser(payload: CreateUserPayload): Promise<User> {
  const res = await apiClient<User>('/api/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateUser(id: number, payload: UpdateUserPayload): Promise<User> {
  const res = await apiClient<User>(`/api/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function deleteUser(id: number): Promise<void> {
  await apiClient(`/api/users/${id}`, { method: 'DELETE' });
}

export async function searchActiveUsers(
  q?: string,
  scope?: 'all' | 'managed'
): Promise<User[]> {
  const params: Record<string, string> = {};
  if (q && q.trim()) params.q = q.trim();
  if (scope && scope !== 'all') params.scope = scope;
  const res = await apiClient<User[]>('/api/users/search', {
    params: Object.keys(params).length > 0 ? params : undefined,
  });
  return res.data;
}

export async function fetchScrumAdmins(q?: string): Promise<UserBasic[]> {
  const res = await apiClient<UserBasic[]>('/api/users/scrum-admins', {
    params: q && q.trim() ? { q: q.trim() } : undefined,
  });
  return res.data;
}

