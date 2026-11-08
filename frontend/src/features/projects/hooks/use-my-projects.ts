import { useQuery } from '@tanstack/react-query';
import { fetchMyProjects } from '../api/projects-api';

export const projectKeys = {
  mine: () => ['projects', 'mine'] as const,
  all: (params?: Record<string, unknown>) => ['projects', 'all', params] as const,
};

export function useMyProjects() {
  return useQuery({
    queryKey: projectKeys.mine(),
    queryFn: fetchMyProjects,
  });
}

