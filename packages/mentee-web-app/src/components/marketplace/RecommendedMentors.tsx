'use client';

import { IRecommendationResult } from '@felly/shared-types';
import { MentorCard } from './MentorCard';

interface RecommendedMentorsProps {
  recommendations: IRecommendationResult[];
  isLoading?: boolean;
}

export function RecommendedMentors({ recommendations, isLoading }: RecommendedMentorsProps) {
  if (isLoading) {
    return (
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">Recommended for You</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 rounded-xl border border-border bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-foreground mb-4">Recommended for You</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {recommendations.map((rec) => (
          <MentorCard
            key={rec.mentor.id}
            mentor={rec.mentor}
            matchingCategories={rec.matchingCategories}
          />
        ))}
      </div>
    </div>
  );
}
