import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchScrums,
  createScrum,
  fetchScrumById,
  updateScrum,
  deleteScrum,
  syncScrumMembers,
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
} from '../services/scrum-api';
import type {
  Scrum,
  Sprint,
  ScrumKpi,
  ScrumEvent,
  ScrumColor,
  SprintStatus,
  ItemStatus,
} from '../types/scrum-types';
import { toast } from '@/shared/ui';

export function useScrums() {
  return useQuery({
    queryKey: ['scrums'],
    queryFn: fetchScrums,
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

export function useCreateScrum() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; description?: string; color?: ScrumColor; ownerId?: number }) =>
      createScrum(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scrums'] });
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
    mutationFn: (payload: { name?: string; description?: string; color?: ScrumColor; isActive?: boolean }) =>
      updateScrum(scrumId, payload),
    onSuccess: (updated: Scrum) => {
      queryClient.setQueryData(['scrum', scrumId], (old: Scrum | undefined) =>
        old ? { ...old, ...updated } : updated
      );
      queryClient.invalidateQueries({ queryKey: ['scrums'] });
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
      toast.success('اسکرام با موفقیت حذف شد');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در حذف اسکرام');
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
      toast.success('اعضای اسکرام با موفقیت بروزرسانی شدند');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در بروزرسانی اعضا');
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
    mutationFn: (payload: { title?: string; description?: string; startDate?: string | null; endDate?: string | null }) =>
      updateSprint(sprintId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint', sprintId] });
      queryClient.invalidateQueries({ queryKey: ['scrum', scrumId, 'sprints'] });
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
      queryClient.invalidateQueries({ queryKey: ['work-targets', 'mine'] });
      toast.success(`وضعیت اسپرینت به «${updated.status === 'ACTIVE' ? 'فعال' : updated.status === 'COMPLETED' ? 'تمام‌شده' : 'برنامه‌ریزی'}» تغییر یافت`);
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
      toast.success('اسپرینت با موفقیت حذف شد');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در حذف اسپرینت');
    },
  });
}

export function useCreateSprintProject(sprintId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; points?: number; assigneeId?: number | null }) =>
      createSprintProject(sprintId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint', sprintId] });
      queryClient.invalidateQueries({ queryKey: ['work-targets', 'mine'] });
      toast.success('پروژه جدید با موفقیت به اسپرینت اضافه شد');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در ایجاد پروژه اسپرینت');
    },
  });
}

export function useUpdateSprintProject(sprintId: number) {
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
        status?: ItemStatus;
        sortOrder?: number;
      };
    }) => updateSprintProject(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint', sprintId] });
      queryClient.invalidateQueries({ queryKey: ['work-targets', 'mine'] });
      toast.success('تغییرات پروژه اسپرینت ذخیره شد');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در ویرایش پروژه اسپرینت');
    },
  });
}

export function useDeleteSprintProject(sprintId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteSprintProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint', sprintId] });
      queryClient.invalidateQueries({ queryKey: ['work-targets', 'mine'] });
      toast.success('پروژه اسپرینت حذف شد');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در حذف پروژه اسپرینت');
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
      toast.success('ریتم جلسات با موفقیت ذخیره شد');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در ذخیره ریتم جلسات');
    },
  });
}

export function useTodayScrumEvents() {
  return useQuery({
    queryKey: ['scrums', 'today-events'],
    queryFn: fetchTodayScrumEvents,
    staleTime: 60_000,
  });
}

export function useWorkTargetsMine() {
  return useQuery({
    queryKey: ['work-targets', 'mine'],
    queryFn: fetchWorkTargetsMine,
    staleTime: 30_000,
  });
}

export function useScrumReport(scrumId: number, params?: { sprintId?: number; from?: string; to?: string }) {
  return useQuery({
    queryKey: ['scrum', scrumId, 'report', params?.sprintId, params?.from, params?.to],
    queryFn: () => fetchScrumReport(scrumId, params),
    enabled: Boolean(scrumId && !isNaN(scrumId)),
    staleTime: 30_000,
  });
}
