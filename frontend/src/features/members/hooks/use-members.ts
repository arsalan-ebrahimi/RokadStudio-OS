import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchMemberCalendar,
  fetchMemberDay,
  fetchMemberProfile,
  fetchMemberWork,
  updateUserStudioPerformance,
} from '../api/members-api';
import { updateScrumMemberPerformance } from '@/features/scrum/services/scrum-api';
import type { Scrum } from '@/features/scrum/types/scrum-types';
import type { User } from '@/shared/types/models';
import { toast } from '@/shared/ui';
import type {
  MemberIdParam,
  MemberProfile,
  MemberWorkQuery,
  PerformanceLevel,
} from '../types';

interface UsersListCache {
  data: User[];
  meta?: unknown;
}

export function useMemberProfile(
  userId: MemberIdParam | null,
  options?: { scrumId?: number; enabled?: boolean }
) {
  return useQuery({
    queryKey: ['member-profile', userId, options?.scrumId ?? null],
    queryFn: () =>
      fetchMemberProfile(userId!, {
        scrumId: options?.scrumId,
      }),
    enabled: Boolean(userId) && (options?.enabled ?? true),
    staleTime: 30_000,
  });
}

export function useMemberCalendar(
  userId: MemberIdParam | null,
  params: { from: string; to: string; scrumId?: number },
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['member-calendar', userId, params.from, params.to, params.scrumId ?? null],
    queryFn: () => fetchMemberCalendar(userId!, params),
    enabled:
      Boolean(userId) &&
      Boolean(params.from) &&
      Boolean(params.to) &&
      (options?.enabled ?? true),
    staleTime: 20_000,
  });
}

export function useMemberDay(
  userId: MemberIdParam | null,
  params: { date: string; scrumId?: number },
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['member-day', userId, params.date, params.scrumId ?? null],
    queryFn: () => fetchMemberDay(userId!, params),
    enabled: Boolean(userId) && Boolean(params.date) && (options?.enabled ?? true),
    staleTime: 15_000,
  });
}

export function useMemberWork(
  userId: MemberIdParam | null,
  params: MemberWorkQuery,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: [
      'member-work',
      userId,
      params.from || '',
      params.to || '',
      params.scrumId ?? null,
      params.sprintId ?? null,
      params.projectId ?? null,
      params.approval || 'ALL',
      params.page ?? 1,
      params.limit ?? 20,
    ],
    queryFn: () => fetchMemberWork(userId!, params),
    enabled: Boolean(userId) && (options?.enabled ?? true),
    staleTime: 15_000,
  });
}

export function useUpdateScrumPerformance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scrumId,
      userId,
      level,
      note,
    }: {
      scrumId: number;
      userId: number;
      level: PerformanceLevel | null;
      note?: string | null;
    }) => updateScrumMemberPerformance(scrumId, userId, { level, note }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['member-profile'] });
      await queryClient.cancelQueries({ queryKey: ['scrum', variables.scrumId] });

      const previousProfiles = queryClient.getQueriesData<MemberProfile>({
        queryKey: ['member-profile'],
      });
      const previousScrum = queryClient.getQueryData<Scrum>(['scrum', variables.scrumId]);

      const optimisticNote = variables.level === null ? null : (variables.note?.trim() || null);
      const optimisticUpdatedAt = variables.level === null ? null : new Date().toISOString();

      queryClient.setQueriesData<MemberProfile>({ queryKey: ['member-profile'] }, (old) => {
        if (!old || old.id !== variables.userId) return old;
        return {
          ...old,
          memberships: old.memberships.map((m) =>
            m.scrum.id === variables.scrumId
              ? {
                  ...m,
                  performance: variables.level,
                  performanceNote: optimisticNote,
                  performanceUpdatedAt: optimisticUpdatedAt,
                }
              : m
          ),
        };
      });

      queryClient.setQueryData<Scrum>(['scrum', variables.scrumId], (old) => {
        if (!old?.members) return old;
        return {
          ...old,
          members: old.members.map((m) =>
            m.id === variables.userId
              ? {
                  ...m,
                  performance: variables.level,
                  performanceNote: optimisticNote,
                  performanceUpdatedAt: optimisticUpdatedAt,
                }
              : m
          ),
        };
      });

      return { previousProfiles, previousScrum };
    },
    onError: (err: Error, variables, context) => {
      if (context?.previousProfiles) {
        for (const [key, data] of context.previousProfiles) {
          queryClient.setQueryData(key, data);
        }
      }
      if (context?.previousScrum !== undefined) {
        queryClient.setQueryData(['scrum', variables.scrumId], context.previousScrum);
      }
      toast.error(err.message || 'خطا در ثبت وضعیت عملکرد اسکرام');
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['member-profile'] });
      queryClient.invalidateQueries({ queryKey: ['scrum', variables.scrumId] });
      queryClient.invalidateQueries({ queryKey: ['scrum', variables.scrumId, 'leaderboard'] });
      toast.success(
        variables.level ? 'وضعیت عملکرد در اسکرام ذخیره شد' : 'وضعیت عملکرد در اسکرام پاک شد'
      );
    },
  });
}

export function useUpdateStudioPerformance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      level,
      note,
    }: {
      userId: number;
      level: PerformanceLevel | null;
      note?: string | null;
    }) => updateUserStudioPerformance(userId, { level, note }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['member-profile'] });
      await queryClient.cancelQueries({ queryKey: ['admin-users'] });

      const previousProfiles = queryClient.getQueriesData<MemberProfile>({
        queryKey: ['member-profile'],
      });
      const previousUsers = queryClient.getQueriesData<UsersListCache>({
        queryKey: ['admin-users'],
      });

      const nextPerf =
        variables.level === null
          ? null
          : {
              level: variables.level,
              note: variables.note?.trim() || null,
              updatedAt: new Date().toISOString(),
            };

      queryClient.setQueriesData<MemberProfile>({ queryKey: ['member-profile'] }, (old) => {
        if (!old || old.id !== variables.userId) return old;
        return {
          ...old,
          studioPerformance: nextPerf,
        };
      });

      queryClient.setQueriesData<UsersListCache>({ queryKey: ['admin-users'] }, (old) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((u) =>
            u.id === variables.userId ? { ...u, studioPerformance: nextPerf } : u
          ),
        };
      });

      return { previousProfiles, previousUsers };
    },
    onError: (err: Error, _variables, context) => {
      if (context?.previousProfiles) {
        for (const [key, data] of context.previousProfiles) {
          queryClient.setQueryData(key, data);
        }
      }
      if (context?.previousUsers) {
        for (const [key, data] of context.previousUsers) {
          queryClient.setQueryData(key, data);
        }
      }
      toast.error(err.message || 'خطا در ثبت وضعیت عملکرد استودیو');
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['member-profile'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(
        res.studioPerformance
          ? 'وضعیت عملکرد استودیو ذخیره شد'
          : 'وضعیت عملکرد استودیو پاک شد'
      );
    },
  });
}

