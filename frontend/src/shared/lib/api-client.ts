import { TOKEN_STORAGE_KEY } from '../config/constants';
import { ApiError, type ApiResponse } from '../types/api';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export async function apiClient<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const { params, headers, ...rest } = options;
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);

  let url = `${BASE_URL}${endpoint}`;
  if (params) {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) search.set(k, String(v));
    }
    const qs = search.toString();
    if (qs) url += `?${qs}`;
  }

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (token) {
    reqHeaders['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { headers: reqHeaders, ...rest });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('rokad:unauthorized'));
    }
    const message = data?.message || `Request failed (${res.status})`;
    throw new ApiError(message, res.status, data?.errors);
  }

  return data as ApiResponse<T>;
}
