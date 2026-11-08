import { apiClient } from '@/shared/lib/api-client';
import type { User, Role } from '@/shared/types/models';
import type { ApiResponse } from '@/shared/types/api';

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

export async function searchActiveUsers(q?: string): Promise<User[]> {
  const res = await apiClient<User[]>('/api/users/search', { params: { q } });
  return res.data;
}

