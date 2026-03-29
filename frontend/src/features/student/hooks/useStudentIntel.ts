import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../api/client';
import { buildStudentIntelligence } from '../../../services/academicService';
import { useAuthStore } from '../../../store/authStore';

export function useStudentCommandCenter(rollNo: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['student-command-center', rollNo],
    queryFn: () => api.get(`students/command-center/${rollNo}`),
    enabled: !!rollNo,
  });

  return { commandCenter: data, isLoading, error };
}

export function useStudentPerformance(rollNo: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['performance', rollNo],
    queryFn: () => api.get(`students/performance/${rollNo}`),
    enabled: !!rollNo,
  });

  return { performance: data, isLoading, error };
}

export function useStudentIntelligence(rollNo: string) {
  const { user } = useAuthStore();
  const { performance, isLoading } = useStudentPerformance(rollNo);

  const intelligence = useMemo(() => {
    if (!user || !performance) return null;
    return buildStudentIntelligence(user, performance);
  }, [user, performance]);

  return { intelligence, isLoading };
}
