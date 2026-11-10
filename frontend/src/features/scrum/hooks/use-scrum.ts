import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchScrums,
  createScrum,
  fetchScrumById,
  updateScrum,
  deleteScrum,
  syncScrumAdmins,
  syncScrumMembers,
  fetchScrumTasks,
  createScrumTask,
  updateScrumTask,
  syncTaskMembers,
  deleteScrumTask,
  fetchSprints,
  createSprint,
  fetchSprintById,
  updateSprint,
  updateSprintStatus,
  deleteSprint,
  fetchKpis,
  batchUpdateKpis,
  fetchEvents,
  batchUpdateEvents,
  fetchTodayScrumEvents,
  fetchWorkTargetsMine,
  fetchScrumReport,
  fetchScrumLeaderboard,
  fetchScrumAdminDashboard,
} from '../services/scrum-api';
import { fetchScrumAdmins } from '@/features/users/api/users-api';
import type {
  Scrum,
  Sprint,
  ScrumKpi,
  ScrumEvent,
  ScrumColor,
  SprintStatus,
  LeaderboardPeriod,
} from '../types/scrum-types';
import { toast } from '@/shared/ui';

export function useScrums(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['scrums'],
    queryFn: fetchScrums,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useScrum(scrumId: number) {
  return useQuery({
    queryKey: ['scrum', scrumId],
    queryFn: () => fetchScrumById(scrumId),
    enabled: Boolean(scrumId && !isNaN(scrumId)),
    staleTime: 30_000,
  });
}

export function useScrumAdminsList(q?: string, enabled = true) {
  return useQuery({
    queryKey: ['scrum-admins', q || ''],
    queryFn: () => fetchScrumAdmins(q),
    enabled,
    staleTime: 30_000,
  });
}

export function useScrumAdminDashboard(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['scrum-admin', 'dashboard'],
    queryFn: fetchScrumAdminDashboard,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useCreateScrum() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      name: string;
      description?: string | null;
      color?: ScrumColor;
      adminIds?: number[];
    }) => createScrum(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scrums'] });
      queryClient.invalidateQueries({ queryKey: ['scrum-admin', 'dashboard'] });
      toast.success('اسکرام جدید با موفقیت ایجاد شد');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در ایجاد اسکرام');
    },
  });
}

export function useUpdateScrum(scrumId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      name?: string;
      description?: string | null;
      color?: ScrumColor;
      isActive?: boolean;
    }) => updateScrum(scrumId, payload),
    onSuccess: (updated: Scrum) => {
      queryClient.setQueryData(['scrum', scrumId], (old: Scrum | undefined) =>
        old ? { ...old, ...updated } : updated
      );
      queryClient.invalidateQueries({ queryKey: ['scrums'] });
      queryClient.invalidateQueries({ queryKey: ['scrum-admin', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['work-targets', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['work-session-targets'] });
      toast.success('تغییرات اسکرام ذخیره شد');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در ویرایش اسکرام');
    },
  });
}

export function useDeleteScrum() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteScrum(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scrums'] });
      queryClient.invalidateQueries({ queryKey: ['scrum-admin', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['work-targets', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['work-session-targets'] });
      toast.success('اسکرام با موفقیت حذف شد');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در حذف اسکرام');
    },
  });
}

export function useSyncScrumAdmins(scrumId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userIds: number[]) => syncScrumAdmins(scrumId, userIds),
    onSuccess: (admins) => {
      queryClient.setQueryData(['scrum', scrumId], (old: Scrum | undefined) =>
        old ? { ...old, admins } : old
      );
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId] });
      queryClient.invalidateQueries({ queryKey: ['scrums'] });
      queryClient.invalidateQueries({ queryKey: ['scrum-admin', 'dashboard'] });
      toast.success('ادمین‌های اسکرام بروزرسانی شدند');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در بروزرسانی ادمین‌های اسکرام');
    },
  });
}

export function useSyncScrumMembers(scrumId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (members: { userId: number; label?: string | null }[]) =>
      syncScrumMembers(scrumId, members),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId] });
      queryClient.invalidateQueries({ queryKey: ['scrums'] });
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId, 'leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['scrum-admin', 'dashboard'] });
      toast.success('اعضای اسکرام با موفقیت بروزرسانی شدند');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در بروزرسانی اعضا');
    },
  });
}

export function useScrumTasks(
  scrumId: number,
  params?: { isActive?: boolean; search?: string },
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['scrum-tasks', scrumId, params?.isActive ?? 'all', params?.search || ''],
    queryFn: () => fetchScrumTasks(scrumId, params),
    enabled: Boolean(scrumId && !isNaN(scrumId)) && (options?.enabled ?? true),
    staleTime: 20_000,
  });
}

export function useCreateScrumTask(scrumId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      name: string;
      description?: string | null;
      points?: number;
      isActive?: boolean;
      memberIds?: number[];
    }) => createScrumTask(scrumId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scrum-tasks', scrumId] });
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId] });
      queryClient.invalidateQueries({ queryKey: ['scrums'] });
      queryClient.invalidateQueries({ queryKey: ['scrum-admin', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['work-targets', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['work-session-targets'] });
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId, 'report'] });
      toast.success('تسک جدید با موفقیت ایجاد شد');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در ایجاد تسک');
    },
  });
}

export function useUpdateScrumTask(scrumId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      payload,
    }: {
      taskId: number;
      payload: {
        name?: string;
        description?: string | null;
        points?: number;
        isActive?: boolean;
      };
    }) => updateScrumTask(taskId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scrum-tasks', scrumId] });
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId] });
      queryClient.invalidateQueries({ queryKey: ['scrums'] });
      queryClient.invalidateQueries({ queryKey: ['scrum-admin', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['work-targets', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['work-target-sessions', 'TASK'] });
      queryClient.invalidateQueries({ queryKey: ['work-session-targets'] });
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId, 'report'] });
      toast.success('تغییرات تسک ذخیره شد');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در ویرایش تسک');
    },
  });
}

export function useSyncTaskMembers(scrumId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, userIds }: { taskId: number; userIds: number[] }) =>
      syncTaskMembers(taskId, userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scrum-tasks', scrumId] });
      queryClient.invalidateQueries({ queryKey: ['work-targets', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId, 'report'] });
      toast.success('اعضای تسک بروزرسانی شدند');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در تخصیص اعضای تسک');
    },
  });
}

export function useDeleteScrumTask(scrumId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: number) => deleteScrumTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scrum-tasks', scrumId] });
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId] });
      queryClient.invalidateQueries({ queryKey: ['scrums'] });
      queryClient.invalidateQueries({ queryKey: ['scrum-admin', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['work-targets', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['work-session-targets'] });
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId, 'report'] });
      toast.success('تسک با موفقیت حذف شد');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در حذف تسک');
    },
  });
}

export function useSprints(scrumId: number) {
  return useQuery({
    queryKey: ['scrum', scrumId, 'sprints'],
    queryFn: () => fetchSprints(scrumId),
    enabled: Boolean(scrumId && !isNaN(scrumId)),
    staleTime: 15_000,
  });
}

export function useSprint(sprintId: number | null) {
  return useQuery({
    queryKey: ['sprint', sprintId],
    queryFn: () => fetchSprintById(sprintId!),
    enabled: Boolean(sprintId && !isNaN(sprintId)),
    staleTime: 15_000,
  });
}

export function useCreateSprint(scrumId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload?: {
      title?: string;
      description?: string | null;
      startDate?: string | null;
      endDate?: string | null;
      progressPercent?: number;
    }) => createSprint(scrumId, payload),
    onSuccess: (newSprint: Sprint) => {
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId, 'sprints'] });
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId] });
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId, 'report'] });
      queryClient.invalidateQueries({ queryKey: ['scrum-admin', 'dashboard'] });
      toast.success(`اسپرینت ${newSprint.number} با موفقیت ایجاد شد`);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در ایجاد اسپرینت');
    },
  });
}

export function useUpdateSprint(sprintId: number, scrumId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      title?: string;
      description?: string | null;
      startDate?: string | null;
      endDate?: string | null;
      progressPercent?: number;
    }) => updateSprint(sprintId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint', sprintId] });
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId, 'sprints'] });
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId] });
      queryClient.invalidateQueries({ queryKey: ['scrums'] });
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId, 'report'] });
      queryClient.invalidateQueries({ queryKey: ['scrum-admin', 'dashboard'] });
      toast.success('اطلاعات اسپرینت بروزرسانی شد');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در ویرایش اسپرینت');
    },
  });
}

export function useUpdateSprintStatus(sprintId: number, scrumId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: SprintStatus) => updateSprintStatus(sprintId, status),
    onSuccess: (updated: Sprint) => {
      queryClient.invalidateQueries({ queryKey: ['sprint', sprintId] });
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId, 'sprints'] });
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId] });
      queryClient.invalidateQueries({ queryKey: ['scrums'] });
      queryClient.invalidateQueries({ queryKey: ['scrum-admin', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['work-targets', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId, 'leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId, 'report'] });
      toast.success(
        `وضعیت اسپرینت به «${updated.status === 'ACTIVE' ? 'فعال' : updated.status === 'COMPLETED' ? 'تمام‌شده' : 'برنامه‌ریزی'}» تغییر یافت`
      );
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در تغییر وضعیت اسپرینت');
    },
  });
}

export function useDeleteSprint(scrumId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sprintId: number) => deleteSprint(sprintId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId, 'sprints'] });
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId] });
      queryClient.invalidateQueries({ queryKey: ['scrums'] });
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId, 'report'] });
      queryClient.invalidateQueries({ queryKey: ['scrum-admin', 'dashboard'] });
      toast.success('اسپرینت با موفقیت حذف شد');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در حذف اسپرینت');
    },
  });
}

export function useKpis(scrumId: number) {
  return useQuery({
    queryKey: ['scrum', scrumId, 'kpis'],
    queryFn: () => fetchKpis(scrumId),
    enabled: Boolean(scrumId && !isNaN(scrumId)),
    staleTime: 30_000,
  });
}

export function useBatchUpdateKpis(scrumId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rows: ScrumKpi[]) => batchUpdateKpis(scrumId, rows),
    onSuccess: (updated: ScrumKpi[]) => {
      queryClient.setQueryData(['scrum', scrumId, 'kpis'], updated);
      queryClient.invalidateQueries({ queryKey: ['scrum-admin', 'dashboard'] });
      toast.success('جدول شاخص‌های کلیدی (KPI) با موفقیت ذخیره شد');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در ذخیره شاخص‌های کلیدی');
    },
  });
}

export function useEvents(scrumId: number) {
  return useQuery({
    queryKey: ['scrum', scrumId, 'events'],
    queryFn: () => fetchEvents(scrumId),
    enabled: Boolean(scrumId && !isNaN(scrumId)),
    staleTime: 30_000,
  });
}

export function useBatchUpdateEvents(scrumId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rows: ScrumEvent[]) => batchUpdateEvents(scrumId, rows),
    onSuccess: (updated: ScrumEvent[]) => {
      queryClient.setQueryData(['scrum', scrumId, 'events'], updated);
      queryClient.invalidateQueries({ queryKey: ['scrums', 'today-events'] });
      queryClient.invalidateQueries({ queryKey: ['scrum-admin', 'dashboard'] });
      toast.success('ریتم جلسات با موفقیت ذخیره شد');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در ذخیره ریتم جلسات');
    },
  });
}

export function useTodayScrumEvents(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['scrums', 'today-events'],
    queryFn: fetchTodayScrumEvents,
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
  });
}

export function useWorkTargetsMine(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['work-targets', 'mine'],
    queryFn: fetchWorkTargetsMine,
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useScrumReport(
  scrumId: number,
  params?: { sprintId?: number; taskId?: number; from?: string; to?: string }
) {
  return useQuery({
    queryKey: ['scrum', scrumId, 'report', params?.sprintId, params?.taskId, params?.from, params?.to],
    queryFn: () => fetchScrumReport(scrumId, params),
    enabled: Boolean(scrumId && !isNaN(scrumId)),
    staleTime: 30_000,
  });
}

export function useScrumLeaderboard(
  scrumId: number,
  params?: { period?: LeaderboardPeriod; sprintId?: number },
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['scrum', scrumId, 'leaderboard', params?.period || 'SPRINT', params?.sprintId || null],
    queryFn: () => fetchScrumLeaderboard(scrumId, params),
    enabled: Boolean(scrumId && !isNaN(scrumId)) && (options?.enabled ?? true),
    staleTime: 20_000,
  });
}
