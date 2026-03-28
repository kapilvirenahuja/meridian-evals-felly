import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from '@opensearch-project/opensearch';
import { PrismaService } from '../prisma/prisma.service';
import { IMarketplaceFilters, MentorSortOrder } from '@felly/shared-types';

const INDEX_NAME = process.env['OPENSEARCH_INDEX_NAME'] || 'mentor_profiles';
const ALIAS_NAME = 'mentor_profiles_alias';

interface SearchResult {
  mentors: Array<{
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
  }>;
  total: number;
}

@Injectable()
export class MarketplaceSearchService implements OnModuleInit {
  private readonly logger = new Logger(MarketplaceSearchService.name);
  private client: Client | null = null;

  constructor(private readonly prisma: PrismaService) {
    if (process.env['SEARCH_PROVIDER'] === 'opensearch') {
      this.client = new Client({
        node: process.env['OPENSEARCH_URL'] || 'http://localhost:9200',
      });
    }
  }

  async onModuleInit(): Promise<void> {
    if (!this.client) return;

    try {
      const exists = await this.client.indices.exists({ index: INDEX_NAME });
      if (!exists.body) {
        await this.client.indices.create({
          index: INDEX_NAME,
          body: {
            mappings: {
              properties: {
                id: { type: 'keyword' },
                firstName: { type: 'text', boost: 3 },
                lastName: { type: 'text', boost: 3 },
                headline: { type: 'text', boost: 2 },
                bio: { type: 'text', boost: 1 },
                expertiseCategories: { type: 'keyword', boost: 1.5 },
                yearsOfExperience: { type: 'integer' },
                verifiedBadge: { type: 'boolean' },
                status: { type: 'keyword' },
                linkedinUrl: { type: 'keyword' },
                photoKey: { type: 'keyword' },
                minPriceInCents: { type: 'integer' },
                hasAvailability: { type: 'boolean' },
                sessionCount: { type: 'integer' },
                averageRating: { type: 'float' },
                updatedAt: { type: 'date' },
              },
            },
          },
        });

        await this.client.indices.putAlias({ index: INDEX_NAME, name: ALIAS_NAME });
        this.logger.log(`Created OpenSearch index ${INDEX_NAME} and alias ${ALIAS_NAME}`);

        // Bulk sync all VERIFIED profiles if index is empty
        const verifiedProfiles = await this.prisma.mentorProfile.findMany({
          where: { status: 'VERIFIED', verifiedBadge: true },
        });

        if (verifiedProfiles.length > 0) {
          await Promise.all(
            verifiedProfiles.map((p) => this.indexMentor(p.id).catch((e) => this.logger.error(e))),
          );
          this.logger.log(`Bulk indexed ${verifiedProfiles.length} VERIFIED mentor profiles`);
        }
      }
    } catch (error) {
      this.logger.error('OpenSearch initialization failed (will continue without search)', error);
    }
  }

  async indexMentor(mentorProfileId: string): Promise<void> {
    if (!this.client) {
      // Prisma adapter: validate mentor status but don't index
      const profile = await this.prisma.mentorProfile.findFirst({
        where: { id: mentorProfileId },
      });
      if (!profile || profile.status !== 'VERIFIED') {
        throw new Error(
          `Cannot index mentor ${mentorProfileId}: not found or not VERIFIED (status=${profile?.status})`,
        );
      }
      return;
    }

    const profile = await this.prisma.mentorProfile.findFirst({
      where: { id: mentorProfileId },
      include: { pricingTiers: true, availabilitySlots: true, user: true },
    });

    if (!profile || profile.status !== 'VERIFIED') {
      throw new Error(
        `Cannot index mentor ${mentorProfileId}: not found or not VERIFIED (status=${profile?.status})`,
      );
    }

    const activeTiers = profile.pricingTiers.filter((t) => t.isActive);
    const minPriceInCents =
      activeTiers.length > 0 ? Math.min(...activeTiers.map((t) => t.priceInCents)) : null;

    const doc = {
      id: profile.id,
      firstName: profile.user.firstName ?? '',
      lastName: profile.user.lastName ?? '',
      headline: profile.headline,
      bio: profile.bio,
      expertiseCategories: profile.expertiseCategories,
      yearsOfExperience: profile.yearsOfExperience,
      verifiedBadge: true,
      status: 'VERIFIED',
      linkedinUrl: profile.linkedinUrl,
      photoKey: profile.user.avatarUrl,
      minPriceInCents,
      hasAvailability: profile.availabilitySlots.length > 0,
      sessionCount: profile.sessionCount,
      averageRating: profile.averageRating,
      updatedAt: profile.updatedAt,
    };

    await this.client.index({
      index: INDEX_NAME,
      id: mentorProfileId,
      body: doc,
    });
  }

  async removeMentorFromIndex(mentorProfileId: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.delete({ index: INDEX_NAME, id: mentorProfileId });
    } catch (error: unknown) {
      if ((error as { meta?: { statusCode?: number } })?.meta?.statusCode === 404) return;
      throw error;
    }
  }

  async updateMentorInIndex(mentorProfileId: string): Promise<void> {
    if (!this.client) return;
    const profile = await this.prisma.mentorProfile.findFirst({
      where: { id: mentorProfileId },
    });

    if (!profile || profile.status !== 'VERIFIED') {
      await this.removeMentorFromIndex(mentorProfileId);
      return;
    }

    await this.indexMentor(mentorProfileId);
  }

  async bulkIndexMentors(mentorProfileIds: string[]): Promise<void> {
    if (!this.client || mentorProfileIds.length === 0) return;
    for (const id of mentorProfileIds) {
      try {
        await this.indexMentor(id);
      } catch (error) {
        this.logger.error(`Failed to bulk index mentor ${id}`, error);
      }
    }
  }

  async searchMentors(
    filters: IMarketplaceFilters,
    page: number,
    limit: number,
    sort: MentorSortOrder,
  ): Promise<SearchResult> {
    if (!this.client) {
      // No OpenSearch — return empty (caller should use Prisma adapter)
      return { mentors: [], total: 0 };
    }

    const { q, category, priceMin, priceMax, rating, hasAvailability } = filters;

    // Build bool query
    const must: unknown[] = [{ term: { verifiedBadge: true } }, { term: { status: 'VERIFIED' } }];

    const filter: unknown[] = [];

    if (category) {
      filter.push({ term: { expertiseCategories: category } });
    }

    if (rating !== undefined) {
      filter.push({ range: { averageRating: { gte: rating } } });
    }

    if (priceMin !== undefined || priceMax !== undefined) {
      const priceMinCents = priceMin !== undefined ? Math.round(priceMin * 100) : undefined;
      const priceMaxCents = priceMax !== undefined ? Math.round(priceMax * 100) : undefined;
      filter.push({
        range: {
          minPriceInCents: {
            ...(priceMinCents !== undefined && { gte: priceMinCents }),
            ...(priceMaxCents !== undefined && { lte: priceMaxCents }),
          },
        },
      });
    }

    if (hasAvailability === true) {
      filter.push({ term: { hasAvailability: true } });
    }

    let query: unknown;
    if (q) {
      query = {
        bool: {
          must,
          filter,
          should: [
            {
              multi_match: {
                query: q,
                fields: [
                  'firstName^3',
                  'lastName^3',
                  'headline^2',
                  'bio^1',
                  'expertiseCategories^1.5',
                ],
                type: 'best_fields',
              },
            },
          ],
          minimum_should_match: 1,
        },
      };
    } else {
      query = { bool: { must, filter } };
    }

    // Build sort
    let sortClause: unknown[];
    switch (sort) {
      case 'price_asc':
        sortClause = [{ minPriceInCents: { order: 'asc' } }];
        break;
      case 'price_desc':
        sortClause = [{ minPriceInCents: { order: 'desc' } }];
        break;
      case 'rating_desc':
        sortClause = [{ averageRating: { order: 'desc' } }];
        break;
      default:
        sortClause = [{ _score: { order: 'desc' } }];
    }

    const from = (page - 1) * limit;

    const response = await this.client.search({
      index: ALIAS_NAME,
      body: {
        query,
        sort: sortClause,
        from,
        size: limit,
      },
    });

    const hits = response.body.hits;
    const total = typeof hits.total === 'number' ? hits.total : (hits.total?.value ?? 0);

    // For OpenSearch results we need to fetch full profile from Prisma (source of truth for detail)
    const ids = (hits.hits as Array<{ _id: string }>).map((h) => h._id);

    if (ids.length === 0) return { mentors: [], total };

    const profiles = await this.prisma.mentorProfile.findMany({
      where: { id: { in: ids }, status: 'VERIFIED', verifiedBadge: true },
      include: {
        pricingTiers: true,
        availabilitySlots: true,
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    // Preserve order from OpenSearch
    const profileMap = new Map(profiles.map((p) => [p.id, p]));
    const ordered = ids
      .map((id) => profileMap.get(id))
      .filter((p): p is NonNullable<typeof p> => !!p);

    return {
      mentors: ordered.map((p) => ({
        id: p.id,
        firstName: p.user.firstName ?? '',
        lastName: p.user.lastName ?? '',
        headline: p.headline,
        bio: p.bio ?? '',
        expertiseCategories: p.expertiseCategories as string[],
        yearsOfExperience: p.yearsOfExperience,
        linkedinUrl: p.linkedinUrl,
        photoKey: p.user.avatarUrl,
        verifiedBadge: p.verifiedBadge,
        pricingTiers: p.pricingTiers,
        availabilitySlots: p.availabilitySlots,
        sessionCount: p.sessionCount,
        averageRating: p.averageRating,
      })),
      total,
    };
  }
}
