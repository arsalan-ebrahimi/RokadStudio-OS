import { apiClient } from '@/shared/lib/api-client';
import type { User } from '@/shared/types/models';

export interface LoginResponseData {
  token: string;
  user: {
    id: number;
    name: string;
    role: User['role'];
  };
}

export async function loginWithCode(code: string): Promise<LoginResponseData> {
  const res = await apiClient<LoginResponseData>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
  return res.data;
}

export async function fetchCurrentUser(): Promise<User> {
  const res = await apiClient<User>('/api/auth/me');
  return res.data;
}
