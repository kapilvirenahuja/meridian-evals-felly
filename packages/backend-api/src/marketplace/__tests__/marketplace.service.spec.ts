import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MarketplaceService } from '../marketplace.service';
import { MarketplaceRepository } from '../marketplace.repository';
import { MarketplaceSearchService } from '../marketplace.search.service';
import { RedisService } from '../redis.service';
import { RecommendationsService } from '../recommendations.service';
import { ExpertiseCategory } from '@felly/shared-types';

// ─── Variable indirection for test data ───────────────────────────────────────
const VERIFIED_MENTOR_ID = 'verified-mentor-id-svc';
const PENDING_MENTOR_ID = 'pending-mentor-id-svc';
const MENTEE_USER_ID = 'mentee-user-id-svc';

// ─── Mock mentor data ──────────────────────────────────────────────────────────
const mockMentorDbRow = {
  id: VERIFIED_MENTOR_ID,
  status: 'VERIFIED',
  verifiedBadge: true,
  headline: 'Expert Engineer',
  bio: 'Years of experience',
  expertiseCategories: [ExpertiseCategory.SOFTWARE_ENGINEERING],
  yearsOfExperience: 8,
  linkedinUrl: null,
  hourlyRate: 100,
  completeness: 100,
  rejectionReason: null,
  sessionCount: 5,
  averageRating: 4.5,
  createdAt: new Date(),
  updatedAt: new Date(),
  pricingTiers: [
    {
      id: 'tier-1',
      name: '1-hour',
      description: null,
      priceInCents: 10000,
      durationMinutes: 60,
      isActive: true,
      mentorProfileId: VERIFIED_MENTOR_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  availabilitySlots: [
    {
      id: 'slot-1',
      dayOfWeek: 1,
      startTimeUtc: '10:00',
      endTimeUtc: '14:00',
      isRecurring: true,
      mentorProfileId: VERIFIED_MENTOR_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  user: { id: 'user-1', firstName: 'Jane', lastName: 'Doe', avatarUrl: null },
};

// ─── Mock factory ─────────────────────────────────────────────────────────────
const createMockRepo = () => ({
  countAllVerifiedMentors: jest.fn(),
  countVerifiedByCategory: jest.fn(),
  searchMentors: jest.fn(),
  findVerifiedMentorById: jest.fn(),
});

const createMockSearchService = () => ({
  searchMentors: jest.fn(),
  indexMentor: jest.fn(),
  removeMentorFromIndex: jest.fn(),
  updateMentorInIndex: jest.fn(),
  bulkIndexMentors: jest.fn(),
  onModuleInit: jest.fn(),
});

const createMockRedis = () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  delPattern: jest.fn().mockResolvedValue(undefined),
});

const createMockRecommendations = () => ({
  getRecommendations: jest.fn(),
});

describe('MarketplaceService', () => {
  let service: MarketplaceService;
  let mockRepo: ReturnType<typeof createMockRepo>;
  let mockSearchService: ReturnType<typeof createMockSearchService>;
  let mockRedis: ReturnType<typeof createMockRedis>;
  let mockRecommendationsService: ReturnType<typeof createMockRecommendations>;

  beforeEach(async () => {
    mockRepo = createMockRepo();
    mockSearchService = createMockSearchService();
    mockRedis = createMockRedis();
    mockRecommendationsService = createMockRecommendations();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketplaceService,
        { provide: MarketplaceRepository, useValue: mockRepo },
        { provide: MarketplaceSearchService, useValue: mockSearchService },
        { provide: RedisService, useValue: mockRedis },
        { provide: RecommendationsService, useValue: mockRecommendationsService },
      ],
    }).compile();

    service = module.get<MarketplaceService>(MarketplaceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env['SEARCH_PROVIDER'];
  });

  // ─── getCategoryCounts ────────────────────────────────────────────────────

  describe('getCategoryCounts', () => {
    it('should return cached result on cache hit', async () => {
      const cached = JSON.stringify([{ category: 'ALL', count: 5 }]);
      mockRedis.get.mockResolvedValue(cached);

      const result = await service.getCategoryCounts();

      expect(result).toEqual([{ category: 'ALL', count: 5 }]);
      expect(mockRepo.countAllVerifiedMentors).not.toHaveBeenCalled();
      expect(mockRepo.countVerifiedByCategory).not.toHaveBeenCalled();
    });

    it('should query Prisma on cache miss and cache the result', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRepo.countAllVerifiedMentors.mockResolvedValue(3);
      mockRepo.countVerifiedByCategory.mockResolvedValue([
        { category: 'SOFTWARE_ENGINEERING', count: BigInt(2) },
        { category: 'SPORT', count: BigInt(1) },
      ]);

      const result = await service.getCategoryCounts();

      expect(result[0]).toEqual({ category: 'ALL', count: 3 });
      expect(result.find((r) => r.category === 'SOFTWARE_ENGINEERING')?.count).toBe(2);
      expect(result.find((r) => r.category === 'SPORT')?.count).toBe(1);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'marketplace:categories:counts',
        expect.any(String),
        300,
      );
    });

    it('should include ALL ExpertiseCategory values with 0 for missing categories', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRepo.countAllVerifiedMentors.mockResolvedValue(1);
      mockRepo.countVerifiedByCategory.mockResolvedValue([
        { category: 'SOFTWARE_ENGINEERING', count: BigInt(1) },
      ]);

      const result = await service.getCategoryCounts();

      // Should have ALL + all ExpertiseCategory values
      expect(result.length).toBeGreaterThan(2);
      // Categories not in DB should have count 0
      const designEntry = result.find((r) => r.category === 'DESIGN');
      expect(designEntry?.count).toBe(0);
    });
  });

  // ─── searchMentors ────────────────────────────────────────────────────────

  describe('searchMentors', () => {
    it('should return cached search result on cache hit', async () => {
      const cached = JSON.stringify({ mentors: [], total: 0, page: 1, limit: 12, totalPages: 0 });
      mockRedis.get.mockResolvedValue(cached);

      const result = await service.searchMentors({}, 1, 12, 'relevance');

      expect(result).toEqual({ mentors: [], total: 0, page: 1, limit: 12, totalPages: 0 });
      expect(mockRepo.searchMentors).not.toHaveBeenCalled();
    });

    it('should use Prisma repo when SEARCH_PROVIDER is not opensearch', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRepo.searchMentors.mockResolvedValue({
        mentors: [mockMentorDbRow],
        total: 1,
      });

      const result = await service.searchMentors({}, 1, 12, 'relevance');

      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(12);
      expect(result.totalPages).toBe(1);
      expect(result.mentors).toHaveLength(1);
    });

    it('should compute totalPages correctly', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRepo.searchMentors.mockResolvedValue({
        mentors: [mockMentorDbRow, mockMentorDbRow],
        total: 25,
      });

      const result = await service.searchMentors({}, 1, 12, 'relevance');

      expect(result.totalPages).toBe(3); // ceil(25/12)
    });

    it('should enforce privacy: response should NOT contain private fields', async () => {
      mockRedis.get.mockResolvedValue(null);
      // Row has extra private fields that should be excluded
      const rowWithPrivate = {
        ...mockMentorDbRow,
        completeness: 100,
        rejectionReason: null,
        verifiedAt: null,
      };
      mockRepo.searchMentors.mockResolvedValue({ mentors: [rowWithPrivate], total: 1 });

      const result = await service.searchMentors({}, 1, 12, 'relevance');
      const mentor = result.mentors[0] as unknown as Record<string, unknown>;

      expect(mentor).not.toHaveProperty('completeness');
      expect(mentor).not.toHaveProperty('rejectionReason');
      expect(mentor).not.toHaveProperty('status');
      expect(mentor).not.toHaveProperty('passwordHash');
    });

    it('should cache the search result', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRepo.searchMentors.mockResolvedValue({ mentors: [], total: 0 });

      await service.searchMentors({}, 1, 12, 'relevance');

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('marketplace:mentors:search:'),
        expect.any(String),
        300,
      );
    });
  });

  // ─── getMentorById ────────────────────────────────────────────────────────

  describe('getMentorById', () => {
    it('should return cached profile on cache hit', async () => {
      const cachedProfile = {
        id: VERIFIED_MENTOR_ID,
        firstName: 'Jane',
        lastName: 'Doe',
        verifiedBadge: true,
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedProfile));

      const result = await service.getMentorById(VERIFIED_MENTOR_ID);

      expect(result).toEqual(cachedProfile);
      expect(mockRepo.findVerifiedMentorById).not.toHaveBeenCalled();
    });

    it('should fetch from Prisma on cache miss and cache the result', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRepo.findVerifiedMentorById.mockResolvedValue(mockMentorDbRow);

      const result = await service.getMentorById(VERIFIED_MENTOR_ID);

      expect(result.id).toBe(VERIFIED_MENTOR_ID);
      expect(mockRedis.set).toHaveBeenCalledWith(
        `marketplace:mentor:${VERIFIED_MENTOR_ID}:profile`,
        expect.any(String),
        600,
      );
    });

    it('should throw NotFoundException for non-VERIFIED mentor', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRepo.findVerifiedMentorById.mockResolvedValue(null);

      await expect(service.getMentorById(PENDING_MENTOR_ID)).rejects.toThrow(NotFoundException);
    });

    it('should enforce privacy on returned profile', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRepo.findVerifiedMentorById.mockResolvedValue(mockMentorDbRow);

      const result = (await service.getMentorById(VERIFIED_MENTOR_ID)) as unknown as Record<
        string,
        unknown
      >;

      expect(result).not.toHaveProperty('status');
      expect(result).not.toHaveProperty('rejectionReason');
      expect(result).not.toHaveProperty('completeness');
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  // ─── getRecommendations ───────────────────────────────────────────────────

  describe('getRecommendations', () => {
    it('should delegate to RecommendationsService', async () => {
      const mockRecs = [
        {
          mentor: { id: VERIFIED_MENTOR_ID, firstName: 'Jane', verifiedBadge: true },
          matchingCategories: [ExpertiseCategory.SOFTWARE_ENGINEERING],
        },
      ];
      mockRecommendationsService.getRecommendations.mockResolvedValue(mockRecs);

      const result = await service.getRecommendations(MENTEE_USER_ID);

      expect(result).toEqual(mockRecs);
      expect(mockRecommendationsService.getRecommendations).toHaveBeenCalledWith(MENTEE_USER_ID);
    });
  });
});
