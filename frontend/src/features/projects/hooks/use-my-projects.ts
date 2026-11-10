import { useQuery } from '@tanstack/react-query';
import { fetchMyProjects } from '../api/projects-api';

export const projectKeys = {
  minePrefix: () => ['projects', 'mine'] as const,
  mine: (includeInactive?: boolean) =>
    includeInactive ? (['projects', 'mine', 'all'] as const) : (['projects', 'mine'] as const),
  all: (params?: Record<string, unknown>) => ['projects', 'all', params] as const,
};

export function useMyProjects(options?: { includeInactive?: boolean }) {
  const includeInactive = Boolean(options?.includeInactive);
  return useQuery({
    queryKey: projectKeys.mine(includeInactive),
    queryFn: () => fetchMyProjects(includeInactive ? { includeInactive: true } : undefined),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });
}

