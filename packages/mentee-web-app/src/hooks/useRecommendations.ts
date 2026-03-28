'use client';

import { useQuery } from '@tanstack/react-query';
import { IRecommendationResult } from '@felly/shared-types';
import apiClient from '../lib/api-client';

async function fetchRecommendations(): Promise<IRecommendationResult[]> {
  const response = await apiClient.get<IRecommendationResult[]>('/marketplace/recommendations');
  return response.data;
}

export function useRecommendations(isAuthenticated: boolean) {
  return useQuery({
    queryKey: ['marketplace', 'recommendations'],
    queryFn: fetchRecommendations,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
}
