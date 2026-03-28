import { Test, TestingModule } from '@nestjs/testing';
import { MarketplaceRepository } from '../marketplace.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { ExpertiseCategory } from '@felly/shared-types';

// ─── Variable indirection for test data ───────────────────────────────────────
const VERIFIED_MENTOR_ID = 'verified-repo-mentor-id';

const mockMentorProfile = {
  id: VERIFIED_MENTOR_ID,
  status: 'VERIFIED',
  verifiedBadge: true,
  headline: 'Expert Engineer',
  bio: 'Great mentor',
  expertiseCategories: ['SOFTWARE_ENGINEERING'],
  yearsOfExperience: 5,
  linkedinUrl: null,
  hourlyRate: 100,
  completeness: 100,
  rejectionReason: null,
  sessionCount: 3,
  averageRating: 4.5,
  updatedAt: new Date(),
  createdAt: new Date(),
  pricingTiers: [{ id: 'tier-1', priceInCents: 5000, durationMinutes: 60, isActive: true }],
  availabilitySlots: [
    { id: 'slot-1', dayOfWeek: 1, startTimeUtc: '09:00', endTimeUtc: '12:00', isRecurring: true },
  ],
  user: { id: 'user-1', firstName: 'Alice', lastName: 'Smith', avatarUrl: null },
};

// ─── Mock Prisma ──────────────────────────────────────────────────────────────
const mockPrisma = {
  mentorProfile: {
    count: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  $queryRaw: jest.fn(),
};

describe('MarketplaceRepository', () => {
  let repository: MarketplaceRepository;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [MarketplaceRepository, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    repository = module.get<MarketplaceRepository>(MarketplaceRepository);
  });

  // ─── INV-E2-01: Verified-only invariant ──────────────────────────────────

  describe('countAllVerifiedMentors', () => {
    it('should count only VERIFIED+verifiedBadge=true mentors', async () => {
      mockPrisma.mentorProfile.count.mockResolvedValue(5);

      const result = await repository.countAllVerifiedMentors();

      expect(result).toBe(5);
      expect(mockPrisma.mentorProfile.count).toHaveBeenCalledWith({
        where: { status: 'VERIFIED', verifiedBadge: true },
      });
    });
  });

  describe('countVerifiedByCategory', () => {
    it('should execute raw SQL query for category counts', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { category: 'SOFTWARE_ENGINEERING', count: BigInt(3) },
        { category: 'SPORT', count: BigInt(2) },
      ]);

      const result = await repository.countVerifiedByCategory();

      expect(result).toHaveLength(2);
      expect(result[0].category).toBe('SOFTWARE_ENGINEERING');
      expect(Number(result[0].count)).toBe(3);
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });
  });

  describe('searchMentors', () => {
    it('should include status=VERIFIED and verifiedBadge=true in every query (INV-E2-01)', async () => {
      mockPrisma.mentorProfile.findMany.mockResolvedValue([mockMentorProfile]);
      mockPrisma.mentorProfile.count.mockResolvedValue(1);

      await repository.searchMentors({
        filters: {},
        page: 1,
        limit: 12,
        sort: 'relevance',
      });

      const findManyCall = mockPrisma.mentorProfile.findMany.mock.calls[0][0];
      expect(findManyCall.where).toMatchObject({ status: 'VERIFIED', verifiedBadge: true });
    });

    it('should apply category filter', async () => {
      mockPrisma.mentorProfile.findMany.mockResolvedValue([]);
      mockPrisma.mentorProfile.count.mockResolvedValue(0);

      await repository.searchMentors({
        filters: { category: ExpertiseCategory.SPORT },
        page: 1,
        limit: 12,
        sort: 'relevance',
      });

      const findManyCall = mockPrisma.mentorProfile.findMany.mock.calls[0][0];
      expect(findManyCall.where.expertiseCategories).toEqual({ has: 'SPORT' });
    });

    it('should apply rating filter', async () => {
      mockPrisma.mentorProfile.findMany.mockResolvedValue([]);
      mockPrisma.mentorProfile.count.mockResolvedValue(0);

      await repository.searchMentors({
        filters: { rating: 4 },
        page: 1,
        limit: 12,
        sort: 'relevance',
      });

      const findManyCall = mockPrisma.mentorProfile.findMany.mock.calls[0][0];
      expect(findManyCall.where.averageRating).toEqual({ gte: 4 });
    });

    it('should apply text search filter (q)', async () => {
      mockPrisma.mentorProfile.findMany.mockResolvedValue([]);
      mockPrisma.mentorProfile.count.mockResolvedValue(0);

      await repository.searchMentors({
        filters: { q: 'sport' },
        page: 1,
        limit: 12,
        sort: 'relevance',
      });

      const findManyCall = mockPrisma.mentorProfile.findMany.mock.calls[0][0];
      expect(findManyCall.where.OR).toBeDefined();
      expect(Array.isArray(findManyCall.where.OR)).toBe(true);
    });

    it('should apply hasAvailability filter', async () => {
      mockPrisma.mentorProfile.findMany.mockResolvedValue([]);
      mockPrisma.mentorProfile.count.mockResolvedValue(0);

      await repository.searchMentors({
        filters: { hasAvailability: true },
        page: 1,
        limit: 12,
        sort: 'relevance',
      });

      const findManyCall = mockPrisma.mentorProfile.findMany.mock.calls[0][0];
      expect(findManyCall.where.availabilitySlots).toEqual({ some: {} });
    });

    it('should apply price range filter converting dollars to cents', async () => {
      mockPrisma.mentorProfile.findMany.mockResolvedValue([]);
      mockPrisma.mentorProfile.count.mockResolvedValue(0);

      await repository.searchMentors({
        filters: { priceMin: 50, priceMax: 100 },
        page: 1,
        limit: 12,
        sort: 'relevance',
      });

      const findManyCall = mockPrisma.mentorProfile.findMany.mock.calls[0][0];
      expect(findManyCall.where.pricingTiers).toEqual({
        some: {
          isActive: true,
          priceInCents: { gte: 5000, lte: 10000 },
        },
      });
    });

    it('should apply sort by rating_desc', async () => {
      mockPrisma.mentorProfile.findMany.mockResolvedValue([]);
      mockPrisma.mentorProfile.count.mockResolvedValue(0);

      await repository.searchMentors({
        filters: {},
        page: 1,
        limit: 12,
        sort: 'rating_desc',
      });

      const findManyCall = mockPrisma.mentorProfile.findMany.mock.calls[0][0];
      expect(findManyCall.orderBy).toEqual({ averageRating: 'desc' });
    });

    it('should apply pagination (skip and take)', async () => {
      mockPrisma.mentorProfile.findMany.mockResolvedValue([]);
      mockPrisma.mentorProfile.count.mockResolvedValue(25);

      await repository.searchMentors({
        filters: {},
        page: 3,
        limit: 5,
        sort: 'relevance',
      });

      const findManyCall = mockPrisma.mentorProfile.findMany.mock.calls[0][0];
      expect(findManyCall.skip).toBe(10); // (3-1) * 5
      expect(findManyCall.take).toBe(5);
    });

    it('should return total count alongside mentors', async () => {
      mockPrisma.mentorProfile.findMany.mockResolvedValue([mockMentorProfile]);
      mockPrisma.mentorProfile.count.mockResolvedValue(42);

      const result = await repository.searchMentors({
        filters: {},
        page: 1,
        limit: 12,
        sort: 'relevance',
      });

      expect(result.total).toBe(42);
      expect(result.mentors).toHaveLength(1);
    });
  });

  describe('findVerifiedMentorById', () => {
    it('should find a VERIFIED mentor by id (INV-E2-01)', async () => {
      mockPrisma.mentorProfile.findFirst.mockResolvedValue(mockMentorProfile);

      const result = await repository.findVerifiedMentorById(VERIFIED_MENTOR_ID);

      expect(result).toEqual(mockMentorProfile);
      expect(mockPrisma.mentorProfile.findFirst).toHaveBeenCalledWith({
        where: { id: VERIFIED_MENTOR_ID, status: 'VERIFIED', verifiedBadge: true },
        include: {
          pricingTiers: true,
          availabilitySlots: true,
          user: expect.objectContaining({ select: expect.any(Object) }),
        },
      });
    });

    it('should return null for non-VERIFIED mentor (invariant enforced by Prisma query)', async () => {
      mockPrisma.mentorProfile.findFirst.mockResolvedValue(null);

      const result = await repository.findVerifiedMentorById('pending-mentor-id');

      expect(result).toBeNull();
    });
  });
});
