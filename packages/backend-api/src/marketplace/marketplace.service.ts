import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import * as crypto from 'crypto';
import {
  ExpertiseCategory,
  IMarketplaceFilters,
  IMentorCategoryCount,
  IMentorSearchResponse,
  MentorSortOrder,
} from '@felly/shared-types';
import { MarketplaceRepository } from './marketplace.repository';
import { MarketplaceSearchService } from './marketplace.search.service';
import { RedisService } from './redis.service';
import { RecommendationsService } from './recommendations.service';
import { PublicMentorProfileDto } from './dto/public-mentor-profile.dto';
import { IRecommendationResult } from '@felly/shared-types';

const CATEGORIES_CACHE_KEY = 'marketplace:categories:counts';
const CATEGORIES_TTL = 300; // 5 minutes
const SEARCH_TTL = 300; // 5 minutes
const PROFILE_TTL = 600; // 10 minutes

@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(
    private readonly marketplaceRepository: MarketplaceRepository,
    private readonly marketplaceSearchService: MarketplaceSearchService,
    private readonly redisService: RedisService,
    private readonly recommendationsService: RecommendationsService,
  ) {}

  // ─── F2.2: Category counts ───────────────────────────────────────────────

  async getCategoryCounts(): Promise<IMentorCategoryCount[]> {
    // Check cache
    const cached = await this.redisService.get(CATEGORIES_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as IMentorCategoryCount[];
    }

    const allCategories = Object.values(ExpertiseCategory);

    // Get total verified count
    const totalCount = await this.marketplaceRepository.countAllVerifiedMentors();

    // Get per-category counts via raw SQL
    const categoryRows = await this.marketplaceRepository.countVerifiedByCategory();

    // Build count map
    const countMap = new Map<string, number>();
    for (const row of categoryRows) {
      countMap.set(row.category, Number(row.count));
    }

    // Build result: ALL + each ExpertiseCategory value
    const result: IMentorCategoryCount[] = [
      { category: 'ALL', count: totalCount },
      ...allCategories.map((cat) => ({
        category: cat,
        count: countMap.get(cat) ?? 0,
      })),
    ];

    // Cache
    await this.redisService.set(CATEGORIES_CACHE_KEY, JSON.stringify(result), CATEGORIES_TTL);

    return result;
  }

  // ─── F2.1 + F2.5: Mentor search ──────────────────────────────────────────

  async searchMentors(
    filters: IMarketplaceFilters,
    page = 1,
    limit = 12,
    sort: MentorSortOrder = 'relevance',
  ): Promise<IMentorSearchResponse> {
    // Build cache key from query string
    const queryStr = JSON.stringify({ filters, page, limit, sort });
    const cacheKey = `marketplace:mentors:search:${crypto.createHash('sha256').update(queryStr).digest('hex')}`;

    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as IMentorSearchResponse;
    }

    let mentors: ReturnType<typeof plainToInstance<PublicMentorProfileDto, object>>[] = [];
    let total = 0;

    if (process.env['SEARCH_PROVIDER'] === 'opensearch') {
      const result = await this.marketplaceSearchService.searchMentors(filters, page, limit, sort);
      total = result.total;
      mentors = result.mentors.map((m) =>
        plainToInstance(PublicMentorProfileDto, this.mapToPublicDto(m), {
          excludeExtraneousValues: true,
        }),
      );
    } else {
      // Use Prisma for search
      const result = await this.marketplaceRepository.searchMentors({
        filters,
        page,
        limit,
        sort,
      });
      total = result.total;
      mentors = result.mentors.map((m) => {
        const flat = {
          id: m.id,
          firstName: m.user.firstName ?? '',
          lastName: m.user.lastName ?? '',
          headline: m.headline,
          bio: m.bio ?? '',
          expertiseCategories: m.expertiseCategories,
          yearsOfExperience: m.yearsOfExperience,
          linkedinUrl: m.linkedinUrl,
          photoKey: m.user.avatarUrl,
          verifiedBadge: m.verifiedBadge,
          pricingTiers: m.pricingTiers,
          availabilitySlots: m.availabilitySlots,
          sessionCount: m.sessionCount,
          averageRating: m.averageRating,
        };
        return plainToInstance(PublicMentorProfileDto, flat, { excludeExtraneousValues: true });
      });
    }

    const totalPages = Math.ceil(total / limit);

    const response: IMentorSearchResponse = {
      mentors: mentors as unknown as IMentorSearchResponse['mentors'],
      total,
      page,
      limit,
      totalPages,
    };

    await this.redisService.set(cacheKey, JSON.stringify(response), SEARCH_TTL);

    return response;
  }

  // ─── F2.3: Single mentor profile ─────────────────────────────────────────

  async getMentorById(id: string): Promise<PublicMentorProfileDto> {
    const cacheKey = `marketplace:mentor:${id}:profile`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as PublicMentorProfileDto;
    }

    const mentor = await this.marketplaceRepository.findVerifiedMentorById(id);
    if (!mentor) {
      throw new NotFoundException('Mentor not found');
    }

    const flat = {
      id: mentor.id,
      firstName: mentor.user.firstName ?? '',
      lastName: mentor.user.lastName ?? '',
      headline: mentor.headline,
      bio: mentor.bio ?? '',
      expertiseCategories: mentor.expertiseCategories,
      yearsOfExperience: mentor.yearsOfExperience,
      linkedinUrl: mentor.linkedinUrl,
      photoKey: mentor.user.avatarUrl,
      verifiedBadge: mentor.verifiedBadge,
      pricingTiers: mentor.pricingTiers,
      availabilitySlots: mentor.availabilitySlots,
      sessionCount: mentor.sessionCount,
      averageRating: mentor.averageRating,
    };

    const dto = plainToInstance(PublicMentorProfileDto, flat, { excludeExtraneousValues: true });

    await this.redisService.set(cacheKey, JSON.stringify(dto), PROFILE_TTL);

    return dto;
  }

  // ─── F2.4: Recommendations ────────────────────────────────────────────────

  async getRecommendations(menteeUserId: string): Promise<IRecommendationResult[]> {
    return this.recommendationsService.getRecommendations(menteeUserId);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private mapToPublicDto(m: {
    id: string;
    firstName: string;
    lastName: string;
    headline: string | null;
    bio: string | null;
    expertiseCategories: string[];
    yearsOfExperience: number | null;
    linkedinUrl: string | null;
    photoKey: string | null;
    verifiedBadge: boolean;
    pricingTiers: Array<{
      id: string;
      name: string;
      description: string | null;
      priceInCents: number;
      durationMinutes: number;
      isActive: boolean;
    }>;
    availabilitySlots: Array<{
      id: string;
      dayOfWeek: number;
      startTimeUtc: string;
      endTimeUtc: string;
      isRecurring: boolean;
    }>;
    sessionCount: number;
    averageRating: number;
  }) {
    return {
      id: m.id,
      firstName: m.firstName,
      lastName: m.lastName,
      headline: m.headline,
      bio: m.bio ?? '',
      expertiseCategories: m.expertiseCategories,
      yearsOfExperience: m.yearsOfExperience,
      linkedinUrl: m.linkedinUrl,
      photoKey: m.photoKey,
      verifiedBadge: m.verifiedBadge,
      pricingTiers: m.pricingTiers,
      availabilitySlots: m.availabilitySlots,
      sessionCount: m.sessionCount,
      averageRating: m.averageRating,
    };
  }
}
