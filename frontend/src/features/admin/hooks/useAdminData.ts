import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../api/client';
import { AdminCommandCenterResponse } from '../../../types/enterprise';

export function useAdminCommandCenter() {
  const { data, isLoading, error } = useQuery<AdminCommandCenterResponse>({
    queryKey: ['admin-command-center'],
    queryFn: () => api.get('admin/command-center'),
  });

  return {
    commandCenter: data,
    isLoading,
    error,
  };
}

export function useStudentSpotlight(searchTerm: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['student-search', searchTerm],
    queryFn: () => api.get(`admin/students?search=${searchTerm}`),
    enabled: searchTerm.length > 2,
  });

  return {
    results: data,
    isLoading,
    error,
  };
}

export function useSubjectCatalog() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-subject-catalog'],
    queryFn: () => api.get('admin/subject-catalog'),
  });

  return { subjects: data, isLoading, error };
}

export function useSubjectLeaderboard(subjectCode: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-subject-leaderboard', subjectCode],
    queryFn: () => api.get(`admin/subject-leaderboard/${subjectCode}`),
    enabled: !!subjectCode,
  });

  return { leaderboard: data, isLoading, error };
}
