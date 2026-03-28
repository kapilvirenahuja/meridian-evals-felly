import { Injectable } from '@nestjs/common';
import { ExpertiseCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IMarketplaceFilters, MentorSortOrder } from '@felly/shared-types';

interface SearchMentorsParams {
  filters: IMarketplaceFilters;
  page: number;
  limit: number;
  sort: MentorSortOrder;
}

@Injectable()
export class MarketplaceRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─── INV-E2-01: Every query includes VERIFIED + verifiedBadge=true ─────────

  async countAllVerifiedMentors(): Promise<number> {
    return this.prisma.mentorProfile.count({
      where: { status: 'VERIFIED', verifiedBadge: true },
    });
  }

  /**
   * Count VERIFIED mentors per ExpertiseCategory using raw SQL + unnest()
   * because Prisma cannot groupBy on array fields.
   * Returns array of { category, count } rows.
   */
  async countVerifiedByCategory(): Promise<Array<{ category: string; count: bigint }>> {
    const rows = await this.prisma.$queryRaw<Array<{ category: string; count: bigint }>>`
      SELECT unnested.category, COUNT(*) as count
      FROM (
        SELECT unnest("expertise_categories") as category
        FROM mentor_profiles
        WHERE status = 'VERIFIED' AND "verified_badge" = true
      ) AS unnested
      GROUP BY unnested.category
    `;
    return rows;
  }

  async searchMentors(params: SearchMentorsParams) {
    const { filters, page, limit, sort } = params;
    const { q, category, priceMin, priceMax, rating, hasAvailability } = filters;

    const offset = (page - 1) * limit;

    // Build WHERE clause
    const where: Prisma.MentorProfileWhereInput = {
      status: 'VERIFIED',
      verifiedBadge: true,
    };

    if (category) {
      where.expertiseCategories = { has: category as ExpertiseCategory };
    }

    if (rating !== undefined) {
      where.averageRating = { gte: rating };
    }

    if (q) {
      // ILIKE search on text fields (Prisma adapter path)
      where.OR = [
        { user: { firstName: { contains: q, mode: 'insensitive' } } },
        { user: { lastName: { contains: q, mode: 'insensitive' } } },
        { headline: { contains: q, mode: 'insensitive' } },
        { bio: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Handle hasAvailability filter
    if (hasAvailability === true) {
      where.availabilitySlots = { some: {} };
    }

    // Handle price range filter
    if (priceMin !== undefined || priceMax !== undefined) {
      const priceMinCents = priceMin !== undefined ? Math.round(priceMin * 100) : undefined;
      const priceMaxCents = priceMax !== undefined ? Math.round(priceMax * 100) : undefined;
      where.pricingTiers = {
        some: {
          isActive: true,
          priceInCents: {
            ...(priceMinCents !== undefined && { gte: priceMinCents }),
            ...(priceMaxCents !== undefined && { lte: priceMaxCents }),
          },
        },
      };
    }

    // Build ORDER BY
    let orderBy: Prisma.MentorProfileOrderByWithRelationInput;
    switch (sort) {
      case 'price_asc':
      case 'price_desc':
        // Sort by count of pricing tiers as proxy; actual price_asc/desc requires different approach
        orderBy = { updatedAt: 'desc' };
        break;
      case 'rating_desc':
        orderBy = { averageRating: 'desc' };
        break;
      default:
        orderBy = { updatedAt: 'desc' };
    }

    const [mentors, total] = await Promise.all([
      this.prisma.mentorProfile.findMany({
        where,
        include: {
          pricingTiers: true,
          availabilitySlots: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.prisma.mentorProfile.count({ where }),
    ]);

    return { mentors, total };
  }

  async findVerifiedMentorById(id: string) {
    return this.prisma.mentorProfile.findFirst({
      where: { id, status: 'VERIFIED', verifiedBadge: true },
      include: {
        pricingTiers: true,
        availabilitySlots: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });
  }
}
