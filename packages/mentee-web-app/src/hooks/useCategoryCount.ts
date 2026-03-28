'use client';

import { useQuery } from '@tanstack/react-query';
import { IMentorCategoryCount } from '@felly/shared-types';
import apiClient from '../lib/api-client';

async function fetchCategoryCounts(): Promise<IMentorCategoryCount[]> {
  const response = await apiClient.get<IMentorCategoryCount[]>('/marketplace/categories');
  return response.data;
}

export function useCategoryCount() {
  return useQuery({
    queryKey: ['marketplace', 'categories'],
    queryFn: fetchCategoryCounts,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
