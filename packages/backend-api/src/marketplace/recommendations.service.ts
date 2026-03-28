import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { ExpertiseCategory } from '@felly/shared-types';
import { ExpertiseCategory as PrismaExpertiseCategory } from '@prisma/client';
import { IRecommendationResult } from '@felly/shared-types';

const RECOMMENDATIONS_LIMIT = 8;

interface MentorWithRelations {
  id: string;
  expertiseCategories: PrismaExpertiseCategory[];
  verifiedBadge: boolean;
  sessionCount: number;
  averageRating: number;
  headline: string | null;
  bio: string | null;
  yearsOfExperience: number | null;
  linkedinUrl: string | null;
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
  user: {
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
  };
}

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
  ) {}

  async getRecommendations(menteeUserId: string): Promise<IRecommendationResult[]> {
    // Get mentee user with menteeProfile to access interests
    const user = await this.userService.findById(menteeUserId);
    if (!user) return [];

    const menteeProfile = await this.prisma.menteeProfile.findUnique({
      where: { userId: menteeUserId },
    });

    const menteeInterests = menteeProfile?.interests ?? [];

    if (menteeInterests.length === 0) {
      this.logger.debug(
        `Mentee ${menteeUserId} has no interests — returning empty recommendations`,
      );
      return [];
    }

    // Query VERIFIED mentors with at least one matching category
    const candidates = (await this.prisma.mentorProfile.findMany({
      where: {
        status: 'VERIFIED',
        verifiedBadge: true,
        expertiseCategories: { hasSome: menteeInterests },
      },
      include: {
        pricingTiers: true,
        availabilitySlots: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
      take: RECOMMENDATIONS_LIMIT * 3,
    })) as MentorWithRelations[];

    // Sort by intersection count descending (INV-E2-04)
    const withIntersection = candidates.map((mentor) => {
      const matchingCategories = mentor.expertiseCategories.filter((cat) =>
        menteeInterests.includes(cat as PrismaExpertiseCategory),
      ) as ExpertiseCategory[];
      return { mentor, matchingCategories };
    });

    withIntersection.sort((a, b) => b.matchingCategories.length - a.matchingCategories.length);

    const top = withIntersection.slice(0, RECOMMENDATIONS_LIMIT);

    return top.map(({ mentor, matchingCategories }) => ({
      mentor: {
        id: mentor.id,
        firstName: mentor.user.firstName ?? '',
        lastName: mentor.user.lastName ?? '',
        headline: mentor.headline,
        bio: mentor.bio ?? '',
        expertiseCategories: mentor.expertiseCategories as ExpertiseCategory[],
        yearsOfExperience: mentor.yearsOfExperience,
        linkedinUrl: mentor.linkedinUrl,
        photoKey: mentor.user.avatarUrl,
        verifiedBadge: mentor.verifiedBadge,
        pricingTiers: mentor.pricingTiers,
        availabilitySlots: mentor.availabilitySlots,
        sessionCount: mentor.sessionCount,
        averageRating: mentor.averageRating,
      },
      matchingCategories,
    }));
  }
}
