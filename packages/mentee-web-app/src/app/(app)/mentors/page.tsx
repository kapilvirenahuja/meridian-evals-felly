'use client';

import { useState, useCallback } from 'react';
import { ExpertiseCategory, IMarketplaceFilters, MentorSortOrder } from '@felly/shared-types';
import { useCategoryCount } from '../../../hooks/useCategoryCount';
import { useMentors } from '../../../hooks/useMentors';
import { useRecommendations } from '../../../hooks/useRecommendations';
import { useAuth } from '../../../lib/auth-context';
import { CategoryTabs } from '../../../components/marketplace/CategoryTabs';
import { SearchBar } from '../../../components/marketplace/SearchBar';
import { MentorFilters } from '../../../components/marketplace/MentorFilters';
import { MentorCard } from '../../../components/marketplace/MentorCard';
import { EmptyState } from '../../../components/marketplace/EmptyState';
import { PaginationControls } from '../../../components/marketplace/PaginationControls';
import { SortControl } from '../../../components/marketplace/SortControl';
import { RecommendedMentors } from '../../../components/marketplace/RecommendedMentors';

export default function MentorsPage() {
  const { isAuthenticated } = useAuth();
  const [activeCategory, setActiveCategory] = useState<ExpertiseCategory | 'ALL'>('ALL');
  const [filters, setFilters] = useState<IMarketplaceFilters>({});
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<MentorSortOrder>('relevance');

  const { data: categories, isLoading: categoriesLoading } = useCategoryCount();
  const { data: mentorData, isLoading: mentorsLoading } = useMentors({
    filters: {
      ...filters,
      ...(activeCategory !== 'ALL' && { category: activeCategory }),
    },
    page,
    limit: 12,
    sort,
  });
  const { data: recommendations, isLoading: recsLoading } = useRecommendations(isAuthenticated);

  const handleCategoryChange = useCallback((category: ExpertiseCategory | 'ALL') => {
    setActiveCategory(category);
    setPage(1);
  }, []);

  const handleFiltersChange = useCallback((newFilters: IMarketplaceFilters) => {
    setFilters(newFilters);
    setPage(1);
  }, []);

  const handleSortChange = useCallback((newSort: MentorSortOrder) => {
    setSort(newSort);
    setPage(1);
  }, []);

  const handleSearchChange = useCallback((q: string) => {
    setFilters((prev) => ({ ...prev, q: q || undefined }));
    setPage(1);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Find Your Mentor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse verified mentors and book your first session.
        </p>
      </div>

      {/* Recommendations — client-side only, visible to authenticated users */}
      {isAuthenticated && (
        <RecommendedMentors recommendations={recommendations ?? []} isLoading={recsLoading} />
      )}

      {/* Search bar */}
      <SearchBar value={filters.q ?? ''} onChange={handleSearchChange} />

      {/* Category tabs */}
      {!categoriesLoading && categories && categories.length > 0 && (
        <CategoryTabs
          categories={categories}
          activeCategory={activeCategory}
          onCategoryChange={handleCategoryChange}
        />
      )}

      {/* Filters + Sort row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <MentorFilters filters={filters} onChange={handleFiltersChange} />
        <SortControl value={sort} onChange={handleSortChange} />
      </div>

      {/* Results */}
      {mentorsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-52 rounded-xl border border-border bg-muted animate-pulse" />
          ))}
        </div>
      ) : mentorData && mentorData.mentors.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {mentorData.mentors.map((mentor) => (
              <MentorCard key={mentor.id} mentor={mentor} />
            ))}
          </div>

          <PaginationControls
            page={mentorData.page}
            totalPages={mentorData.totalPages}
            total={mentorData.total}
            limit={mentorData.limit}
            onPageChange={setPage}
          />
        </>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
