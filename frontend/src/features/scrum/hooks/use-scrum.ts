import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchScrums,
  createScrum,
  fetchScrumById,
  updateScrum,
  deleteScrum,
  syncScrumAdmins,
  syncScrumMembers,
  fetchScrumProjects,
  createScrumProject,
  fetchAvailableScrumProjects,
  linkProjectToScrum,
  unlinkProjectFromScrum,
  syncScrumProjectMembers,
  fetchSprints,
  createSprint,
  fetchSprintById,
  updateSprint,
  updateSprintStatus,
  deleteSprint,
  createSprintProject,
  updateSprintProject,
  deleteSprintProject,
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
  ItemStatus,
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
      queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
      queryClient.invalidateQueries({ queryKey: ['work-targets', 'mine'] });
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
      queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
      queryClient.invalidateQueries({ queryKey: ['work-targets', 'mine'] });
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

export function useScrumProjects(scrumId: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['scrum', scrumId, 'projects'],
    queryFn: () => fetchScrumProjects(scrumId),
    enabled: Boolean(scrumId && !isNaN(scrumId)) && (options?.enabled ?? true),
    staleTime: 20_000,
  });
}

export function useAvailableScrumProjects(
  scrumId: number,
  q?: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['scrum', scrumId, 'projects', 'available', q || ''],
    queryFn: () => fetchAvailableScrumProjects(scrumId, q),
    enabled: Boolean(scrumId && !isNaN(scrumId)) && (options?.enabled ?? true),
    staleTime: 15_000,
  });
}

export function useCreateScrumProject(scrumId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; description?: string | null; memberIds?: number[] }) =>
      createScrumProject(scrumId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId, 'projects'] });
      queryClient.invalidateQueries({ queryKey: ['scrum-admin', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
      queryClient.invalidateQueries({ queryKey: ['work-targets', 'mine'] });
      toast.success('پروژه جدید ایجاد و به اسکرام متصل شد');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در ایجاد پروژه اسکرام');
    },
  });
}

export function useLinkProjectToScrum(scrumId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: number) => linkProjectToScrum(scrumId, projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId, 'projects'] });
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId, 'projects', 'available'] });
      queryClient.invalidateQueries({ queryKey: ['scrum-admin', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
      queryClient.invalidateQueries({ queryKey: ['work-targets', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId, 'report'] });
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId, 'leaderboard'] });
      toast.success('پروژه به اسکرام متصل شد');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در اتصال پروژه به اسکرام');
    },
  });
}

export function useUnlinkProjectFromScrum(scrumId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: number) => unlinkProjectFromScrum(scrumId, projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId, 'projects'] });
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId, 'projects', 'available'] });
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId, 'sprints'] });
      queryClient.invalidateQueries({ queryKey: ['sprint'] });
      queryClient.invalidateQueries({ queryKey: ['scrum-admin', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
      queryClient.invalidateQueries({ queryKey: ['work-targets', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId, 'report'] });
      toast.success('اتصال پروژه از اسکرام جدا شد');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در جدا کردن پروژه از اسکرام');
    },
  });
}

export function useSyncScrumProjectMembers(scrumId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, userIds }: { projectId: number; userIds: number[] }) =>
      syncScrumProjectMembers(scrumId, projectId, userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId, 'projects'] });
      queryClient.invalidateQueries({ queryKey: ['admin-projects'] });
      queryClient.invalidateQueries({ queryKey: ['work-targets', 'mine'] });
      toast.success('اعضای پروژه بروزرسانی شدند');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در تخصیص اعضای پروژه');
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
    mutationFn: (payload?: { title?: string; description?: string; startDate?: string; endDate?: string }) =>
      createSprint(scrumId, payload),
    onSuccess: (newSprint: Sprint) => {
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId, 'sprints'] });
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId] });
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
      description?: string;
      startDate?: string | null;
      endDate?: string | null;
    }) => updateSprint(sprintId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint', sprintId] });
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId, 'sprints'] });
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
      queryClient.invalidateQueries({ queryKey: ['scrum-admin', 'dashboard'] });
      toast.success('اسپرینت با موفقیت حذف شد');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در حذف اسپرینت');
    },
  });
}

export function useCreateSprintProject(sprintId: number, scrumId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      name: string;
      points?: number;
      assigneeId?: number | null;
      projectId?: number | null;
    }) => createSprintProject(sprintId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint', sprintId] });
      if (scrumId) {
        queryClient.invalidateQueries({ queryKey: ['scrum', scrumId, 'sprints'] });
      }
      queryClient.invalidateQueries({ queryKey: ['scrum-admin', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['work-targets', 'mine'] });
      toast.success('آیتم جدید با موفقیت به اسپرینت اضافه شد');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در ایجاد آیتم اسپرینت');
    },
  });
}

export function useUpdateSprintProject(sprintId: number, scrumId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: {
        name?: string;
        points?: number;
        assigneeId?: number | null;
        projectId?: number | null;
        status?: ItemStatus;
        sortOrder?: number;
      };
    }) => updateSprintProject(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint', sprintId] });
      if (scrumId) {
        queryClient.invalidateQueries({ queryKey: ['scrum', scrumId, 'sprints'] });
      }
      queryClient.invalidateQueries({ queryKey: ['scrum-admin', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['work-targets', 'mine'] });
      toast.success('تغییرات آیتم اسپرینت ذخیره شد');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در ویرایش آیتم اسپرینت');
    },
  });
}

export function useDeleteSprintProject(sprintId: number, scrumId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteSprintProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint', sprintId] });
      if (scrumId) {
        queryClient.invalidateQueries({ queryKey: ['scrum', scrumId, 'sprints'] });
      }
      queryClient.invalidateQueries({ queryKey: ['scrum-admin', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['work-targets', 'mine'] });
      toast.success('آیتم اسپرینت حذف شد');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در حذف آیتم اسپرینت');
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
  params?: { sprintId?: number; from?: string; to?: string }
) {
  return useQuery({
    queryKey: ['scrum', scrumId, 'report', params?.sprintId, params?.from, params?.to],
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
