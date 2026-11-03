import { apiClient } from '@/shared/lib/api-client';
import type { WorkSessionSummaryRow } from '@/shared/types/models';

export interface ReportsSummaryParams {
  userId?: number;
  projectId?: number;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  groupBy?: 'user' | 'project' | 'user_project';
}

export async function fetchWorkSessionsSummary(params: ReportsSummaryParams = {}): Promise<WorkSessionSummaryRow[]> {
  const res = await apiClient<WorkSessionSummaryRow[]>('/api/work-sessions/summary', {
    params: params as Record<string, string | number>,
  });
  return res.data;
}

