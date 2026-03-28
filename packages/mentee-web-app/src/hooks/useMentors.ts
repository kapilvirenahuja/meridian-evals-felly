'use client';

import { useQuery } from '@tanstack/react-query';
import { IMentorSearchResponse, IMarketplaceFilters, MentorSortOrder } from '@felly/shared-types';
import apiClient from '../lib/api-client';

interface UseMentorsParams {
  filters: IMarketplaceFilters;
  page?: number;
  limit?: number;
  sort?: MentorSortOrder;
}

async function fetchMentors(params: UseMentorsParams): Promise<IMentorSearchResponse> {
  const { filters, page = 1, limit = 12, sort = 'relevance' } = params;

  const queryParams = new URLSearchParams();
  if (filters.q) queryParams.set('q', filters.q);
  if (filters.category) queryParams.set('category', filters.category);
  if (filters.priceMin !== undefined) queryParams.set('priceMin', String(filters.priceMin));
  if (filters.priceMax !== undefined) queryParams.set('priceMax', String(filters.priceMax));
  if (filters.rating !== undefined) queryParams.set('rating', String(filters.rating));
  if (filters.hasAvailability !== undefined)
    queryParams.set('hasAvailability', String(filters.hasAvailability));
  queryParams.set('page', String(page));
  queryParams.set('limit', String(limit));
  queryParams.set('sort', sort);

  const response = await apiClient.get<IMentorSearchResponse>(
    `/marketplace/mentors?${queryParams.toString()}`,
  );
  return response.data;
}

export function useMentors(params: UseMentorsParams) {
  return useQuery({
    queryKey: ['marketplace', 'mentors', params],
    queryFn: () => fetchMentors(params),
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });
}
