import { ExpertiseCategory } from '../enums';

// ─── Public-facing marketplace interfaces ─────────────────────────────────────

export interface IPublicPricingTier {
  id: string;
  name: string;
  description: string | null;
  priceInCents: number;
  durationMinutes: number;
  isActive: boolean;
}

export interface IPublicAvailabilitySlot {
  id: string;
  dayOfWeek: number;
  startTimeUtc: string;
  endTimeUtc: string;
  isRecurring: boolean;
}

export interface IPublicMentorProfile {
  id: string;
  firstName: string;
  lastName: string;
  headline: string | null;
  bio: string;
  expertiseCategories: ExpertiseCategory[];
  yearsOfExperience: number | null;
  linkedinUrl: string | null;
  photoKey: string | null;
  verifiedBadge: boolean;
  pricingTiers: IPublicPricingTier[];
  availabilitySlots: IPublicAvailabilitySlot[];
  sessionCount: number;
  averageRating: number;
}

export interface IMarketplaceFilters {
  q?: string;
  category?: ExpertiseCategory;
  priceMin?: number;
  priceMax?: number;
  rating?: number;
  hasAvailability?: boolean;
}

export interface IMentorSearchResponse {
  mentors: IPublicMentorProfile[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IMentorCategoryCount {
  category: ExpertiseCategory | 'ALL';
  count: number;
}

export interface IRecommendationResult {
  mentor: IPublicMentorProfile;
  matchingCategories: ExpertiseCategory[];
}

// ─── Sort order string union ───────────────────────────────────────────────────

export type MentorSortOrder = 'relevance' | 'price_asc' | 'price_desc' | 'rating_desc';
