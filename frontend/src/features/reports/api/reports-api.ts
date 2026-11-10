import { apiClient } from '@/shared/lib/api-client';
import type { WorkSessionSummaryRow } from '@/shared/types/models';

export interface ReportsSummaryParams {
  userId?: number;
  targetType?: 'ALL' | 'PROJECT' | 'TASK';
  projectId?: number;
  taskId?: number;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  groupBy?: 'user' | 'project' | 'user_project';
}

export async function fetchWorkSessionsSummary(params: ReportsSummaryParams = {}): Promise<WorkSessionSummaryRow[]> {
  const cleanParams: Record<string, string | number> = {};
  if (params.userId) cleanParams.userId = params.userId;
  if (params.targetType && params.targetType !== 'ALL') cleanParams.targetType = params.targetType;
  if (params.projectId) cleanParams.projectId = params.projectId;
  if (params.taskId) cleanParams.taskId = params.taskId;
  if (params.date) cleanParams.date = params.date;
  if (params.dateFrom) cleanParams.dateFrom = params.dateFrom;
  if (params.dateTo) cleanParams.dateTo = params.dateTo;
  if (params.groupBy) cleanParams.groupBy = params.groupBy;

  const res = await apiClient<WorkSessionSummaryRow[]>('/api/work-sessions/summary', {
    params: cleanParams,
  });
  return res.data;
}

