import { apiClient } from '@/shared/lib/api-client';
import type {
  MemberCalendarResponse,
  MemberDayResponse,
  MemberIdParam,
  MemberProfile,
  MemberWorkQuery,
  MemberWorkResponse,
  PerformanceLevel,
  StudioPerformanceInfo,
} from '../types';

export async function fetchMemberProfile(
  userId: MemberIdParam,
  options?: { scrumId?: number }
): Promise<MemberProfile> {
  const res = await apiClient<MemberProfile>(`/api/members/${userId}/profile`, {
    params: options?.scrumId ? { scrumId: options.scrumId } : undefined,
  });
  return res.data;
}

export async function fetchMemberCalendar(
  userId: MemberIdParam,
  params: { from: string; to: string; scrumId?: number }
): Promise<MemberCalendarResponse> {
  const res = await apiClient<MemberCalendarResponse>(`/api/members/${userId}/calendar`, {
    params: {
      from: params.from,
      to: params.to,
      scrumId: params.scrumId,
    },
  });
  return res.data;
}

export async function fetchMemberDay(
  userId: MemberIdParam,
  params: { date: string; scrumId?: number }
): Promise<MemberDayResponse> {
  const res = await apiClient<MemberDayResponse>(`/api/members/${userId}/day`, {
    params: {
      date: params.date,
      scrumId: params.scrumId,
    },
  });
  return res.data;
}

export async function fetchMemberWork(
  userId: MemberIdParam,
  params: MemberWorkQuery = {}
): Promise<MemberWorkResponse> {
  const cleanParams: Record<string, string | number> = {};
  if (params.from) cleanParams.from = params.from;
  if (params.to) cleanParams.to = params.to;
  if (params.scrumId) cleanParams.scrumId = params.scrumId;
  if (params.sprintId) cleanParams.sprintId = params.sprintId;
  if (params.projectId) cleanParams.projectId = params.projectId;
  if (params.approval) cleanParams.approval = params.approval;
  if (params.page) cleanParams.page = params.page;
  if (params.limit) cleanParams.limit = params.limit;

  const res = await apiClient<MemberWorkResponse>(`/api/members/${userId}/work`, {
    params: cleanParams,
  });
  return res.data;
}

export async function updateUserStudioPerformance(
  userId: number,
  payload: { level: PerformanceLevel | null; note?: string | null }
): Promise<{ userId: number; studioPerformance: StudioPerformanceInfo | null }> {
  const res = await apiClient<{ userId: number; studioPerformance: StudioPerformanceInfo | null }>(
    `/api/users/${userId}/performance`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    }
  );
  return res.data;
}

