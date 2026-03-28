'use client';

import { useQuery } from '@tanstack/react-query';
import { IPublicMentorProfile } from '@felly/shared-types';
import apiClient from '../lib/api-client';

async function fetchMentorDetail(id: string): Promise<IPublicMentorProfile> {
  const response = await apiClient.get<IPublicMentorProfile>(`/marketplace/mentors/${id}`);
  return response.data;
}

export function useMentorDetail(id: string) {
  return useQuery({
    queryKey: ['marketplace', 'mentor', id],
    queryFn: () => fetchMentorDetail(id),
    staleTime: 10 * 60 * 1000,
    enabled: !!id,
  });
}
