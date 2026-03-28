import { Test, TestingModule } from '@nestjs/testing';
import { MarketplaceSearchService } from '../marketplace.search.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ExpertiseCategory } from '@felly/shared-types';

// ─── Variable indirection for test data ───────────────────────────────────────
const VERIFIED_MENTOR_ID = 'verified-mentor-search-id';
const PENDING_MENTOR_ID = 'pending-mentor-search-id';

// ─── OpenSearch mock ──────────────────────────────────────────────────────────
const mockOsIndex = jest.fn();
const mockOsDelete = jest.fn();
const mockOsSearch = jest.fn();
const mockOsIndicesExists = jest.fn();
const mockOsIndicesCreate = jest.fn();
const mockOsIndicesPutAlias = jest.fn();

jest.mock('@opensearch-project/opensearch', () => ({
  Client: jest.fn().mockImplementation(() => ({
    index: mockOsIndex,
    delete: mockOsDelete,
    search: mockOsSearch,
    indices: {
      exists: mockOsIndicesExists,
      create: mockOsIndicesCreate,
      putAlias: mockOsIndicesPutAlias,
    },
  })),
}));

const mockPrismaFindFirst = jest.fn();
const mockPrismaFindMany = jest.fn();

const mockPrisma = {
  mentorProfile: {
    findFirst: mockPrismaFindFirst,
    findMany: mockPrismaFindMany,
    count: jest.fn(),
  },
};

// Verified mentor profile from Prisma
const mockVerifiedProfile = {
  id: VERIFIED_MENTOR_ID,
  status: 'VERIFIED',
  verifiedBadge: true,
  headline: 'Software Expert',
  bio: 'Great mentor',
  expertiseCategories: ['SOFTWARE_ENGINEERING'],
  yearsOfExperience: 5,
  linkedinUrl: null,
  sessionCount: 0,
  averageRating: 0,
  updatedAt: new Date(),
  pricingTiers: [{ id: 'tier-1', priceInCents: 5000, isActive: true }],
  availabilitySlots: [
    { id: 'slot-1', dayOfWeek: 1, startTimeUtc: '09:00', endTimeUtc: '12:00', isRecurring: true },
  ],
  user: { id: 'user-1', firstName: 'Alice', lastName: 'Smith', avatarUrl: null },
};

// Mock OpenSearch search response helper
const makeSearchResponse = (ids: string[], total = 1) => ({
  body: {
    hits: {
      total: { value: total },
      hits: ids.map((id) => ({ _id: id })),
    },
  },
});

describe('MarketplaceSearchService', () => {
  let service: MarketplaceSearchService;

  describe('with SEARCH_PROVIDER=opensearch', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      process.env['SEARCH_PROVIDER'] = 'opensearch';
      process.env['OPENSEARCH_URL'] = 'http://localhost:9200';

      const module: TestingModule = await Test.createTestingModule({
        providers: [MarketplaceSearchService, { provide: PrismaService, useValue: mockPrisma }],
      }).compile();

      service = module.get<MarketplaceSearchService>(MarketplaceSearchService);
    });

    afterEach(() => {
      delete process.env['SEARCH_PROVIDER'];
    });

    describe('onModuleInit', () => {
      it('should create index and alias when index does not exist', async () => {
        mockOsIndicesExists.mockResolvedValue({ body: false });
        mockOsIndicesCreate.mockResolvedValue({ body: { acknowledged: true } });
        mockOsIndicesPutAlias.mockResolvedValue({ body: { acknowledged: true } });
        mockPrismaFindMany.mockResolvedValue([mockVerifiedProfile]);
        mockPrismaFindFirst.mockResolvedValue(mockVerifiedProfile);
        mockOsIndex.mockResolvedValue({ body: { result: 'created' } });

        await service.onModuleInit();

        expect(mockOsIndicesExists).toHaveBeenCalled();
        expect(mockOsIndicesCreate).toHaveBeenCalled();
        expect(mockOsIndicesPutAlias).toHaveBeenCalled();
      });

      it('should skip creation if index already exists', async () => {
        mockOsIndicesExists.mockResolvedValue({ body: true });

        await service.onModuleInit();

        expect(mockOsIndicesCreate).not.toHaveBeenCalled();
      });

      it('should handle OpenSearch initialization errors gracefully', async () => {
        mockOsIndicesExists.mockRejectedValue(new Error('Connection refused'));

        await expect(service.onModuleInit()).resolves.not.toThrow();
      });
    });

    describe('indexMentor', () => {
      it('should index a VERIFIED mentor into OpenSearch', async () => {
        mockPrismaFindFirst.mockResolvedValue(mockVerifiedProfile);
        mockOsIndex.mockResolvedValue({ body: { result: 'created' } });

        await service.indexMentor(VERIFIED_MENTOR_ID);

        expect(mockOsIndex).toHaveBeenCalledWith(
          expect.objectContaining({
            id: VERIFIED_MENTOR_ID,
            body: expect.objectContaining({
              verifiedBadge: true,
              status: 'VERIFIED',
              hasAvailability: true,
            }),
          }),
        );
      });

      it('should throw if mentor is not VERIFIED', async () => {
        mockPrismaFindFirst.mockResolvedValue({
          ...mockVerifiedProfile,
          status: 'PENDING_VERIFICATION',
        });

        await expect(service.indexMentor(PENDING_MENTOR_ID)).rejects.toThrow();
        expect(mockOsIndex).not.toHaveBeenCalled();
      });

      it('should throw if mentor is null', async () => {
        mockPrismaFindFirst.mockResolvedValue(null);

        await expect(service.indexMentor(PENDING_MENTOR_ID)).rejects.toThrow();
      });

      it('should set hasAvailability=false when no slots', async () => {
        mockPrismaFindFirst.mockResolvedValue({ ...mockVerifiedProfile, availabilitySlots: [] });
        mockOsIndex.mockResolvedValue({ body: { result: 'updated' } });

        await service.indexMentor(VERIFIED_MENTOR_ID);

        expect(mockOsIndex).toHaveBeenCalledWith(
          expect.objectContaining({
            body: expect.objectContaining({ hasAvailability: false }),
          }),
        );
      });

      it('should compute minPriceInCents from active pricing tiers only', async () => {
        mockPrismaFindFirst.mockResolvedValue({
          ...mockVerifiedProfile,
          pricingTiers: [
            { id: 'tier-1', priceInCents: 10000, isActive: true },
            { id: 'tier-2', priceInCents: 5000, isActive: true },
            { id: 'tier-3', priceInCents: 1000, isActive: false }, // inactive, should be excluded
          ],
        });
        mockOsIndex.mockResolvedValue({ body: { result: 'created' } });

        await service.indexMentor(VERIFIED_MENTOR_ID);

        expect(mockOsIndex).toHaveBeenCalledWith(
          expect.objectContaining({
            body: expect.objectContaining({ minPriceInCents: 5000 }),
          }),
        );
      });

      it('should set minPriceInCents=null when no active pricing tiers', async () => {
        mockPrismaFindFirst.mockResolvedValue({
          ...mockVerifiedProfile,
          pricingTiers: [],
        });
        mockOsIndex.mockResolvedValue({ body: { result: 'created' } });

        await service.indexMentor(VERIFIED_MENTOR_ID);

        expect(mockOsIndex).toHaveBeenCalledWith(
          expect.objectContaining({
            body: expect.objectContaining({ minPriceInCents: null }),
          }),
        );
      });
    });

    describe('removeMentorFromIndex', () => {
      it('should delete a mentor from OpenSearch', async () => {
        mockOsDelete.mockResolvedValue({ body: { result: 'deleted' } });

        await service.removeMentorFromIndex(VERIFIED_MENTOR_ID);

        expect(mockOsDelete).toHaveBeenCalledWith(
          expect.objectContaining({ id: VERIFIED_MENTOR_ID }),
        );
      });

      it('should ignore 404 errors (document not in index)', async () => {
        mockOsDelete.mockRejectedValue({ meta: { statusCode: 404 } });

        await expect(service.removeMentorFromIndex(VERIFIED_MENTOR_ID)).resolves.not.toThrow();
      });

      it('should rethrow non-404 errors', async () => {
        mockOsDelete.mockRejectedValue(new Error('Connection error'));

        await expect(service.removeMentorFromIndex(VERIFIED_MENTOR_ID)).rejects.toThrow();
      });
    });

    describe('updateMentorInIndex', () => {
      it('should re-index a VERIFIED mentor', async () => {
        mockPrismaFindFirst
          .mockResolvedValueOnce(mockVerifiedProfile)
          .mockResolvedValueOnce(mockVerifiedProfile);
        mockOsIndex.mockResolvedValue({ body: { result: 'updated' } });

        await service.updateMentorInIndex(VERIFIED_MENTOR_ID);

        expect(mockOsIndex).toHaveBeenCalled();
      });

      it('should remove mentor from index if no longer VERIFIED', async () => {
        mockPrismaFindFirst.mockResolvedValue({ ...mockVerifiedProfile, status: 'REJECTED' });
        mockOsDelete.mockResolvedValue({ body: { result: 'deleted' } });

        await service.updateMentorInIndex(VERIFIED_MENTOR_ID);

        expect(mockOsDelete).toHaveBeenCalledWith(
          expect.objectContaining({ id: VERIFIED_MENTOR_ID }),
        );
      });

      it('should remove from index if mentor not found', async () => {
        mockPrismaFindFirst.mockResolvedValue(null);
        mockOsDelete.mockResolvedValue({ body: { result: 'deleted' } });

        await service.updateMentorInIndex(VERIFIED_MENTOR_ID);

        expect(mockOsDelete).toHaveBeenCalled();
      });
    });

    describe('bulkIndexMentors', () => {
      it('should index multiple mentors', async () => {
        mockPrismaFindFirst.mockResolvedValue(mockVerifiedProfile);
        mockOsIndex.mockResolvedValue({ body: { result: 'created' } });

        await service.bulkIndexMentors([VERIFIED_MENTOR_ID, 'another-id']);

        expect(mockOsIndex).toHaveBeenCalledTimes(2);
      });

      it('should handle empty list gracefully', async () => {
        await service.bulkIndexMentors([]);
        expect(mockOsIndex).not.toHaveBeenCalled();
      });

      it('should continue if one mentor fails to index', async () => {
        mockPrismaFindFirst
          .mockResolvedValueOnce(null) // first fails
          .mockResolvedValueOnce(mockVerifiedProfile); // second succeeds
        mockOsIndex.mockResolvedValue({ body: { result: 'created' } });

        await expect(
          service.bulkIndexMentors([PENDING_MENTOR_ID, VERIFIED_MENTOR_ID]),
        ).resolves.not.toThrow();
      });
    });

    describe('searchMentors', () => {
      it('should execute OpenSearch query and return hydrated results from Prisma', async () => {
        mockOsSearch.mockResolvedValue(makeSearchResponse([VERIFIED_MENTOR_ID]));
        mockPrismaFindMany.mockResolvedValue([mockVerifiedProfile]);

        const result = await service.searchMentors({}, 1, 12, 'relevance');

        expect(result.total).toBe(1);
        expect(result.mentors).toHaveLength(1);
        expect(result.mentors[0].id).toBe(VERIFIED_MENTOR_ID);
      });

      it('should include mandatory VERIFIED filters (INV-E2-01)', async () => {
        mockOsSearch.mockResolvedValue(makeSearchResponse([]));
        mockPrismaFindMany.mockResolvedValue([]);

        await service.searchMentors({}, 1, 12, 'relevance');

        const searchCall = mockOsSearch.mock.calls[0][0];
        const mustClauses = searchCall.body.query.bool.must;
        expect(mustClauses).toEqual(
          expect.arrayContaining([
            { term: { verifiedBadge: true } },
            { term: { status: 'VERIFIED' } },
          ]),
        );
      });

      it('should apply category filter in bool query', async () => {
        mockOsSearch.mockResolvedValue(makeSearchResponse([]));
        mockPrismaFindMany.mockResolvedValue([]);

        await service.searchMentors({ category: ExpertiseCategory.SPORT }, 1, 12, 'relevance');

        const searchCall = mockOsSearch.mock.calls[0][0];
        const filter = searchCall.body.query.bool.filter;
        expect(filter).toEqual(
          expect.arrayContaining([{ term: { expertiseCategories: 'SPORT' } }]),
        );
      });

      it('should apply rating filter', async () => {
        mockOsSearch.mockResolvedValue(makeSearchResponse([]));
        mockPrismaFindMany.mockResolvedValue([]);

        await service.searchMentors({ rating: 4 }, 1, 12, 'relevance');

        const searchCall = mockOsSearch.mock.calls[0][0];
        const filter = searchCall.body.query.bool.filter;
        expect(filter).toEqual(expect.arrayContaining([{ range: { averageRating: { gte: 4 } } }]));
      });

      it('should apply hasAvailability filter', async () => {
        mockOsSearch.mockResolvedValue(makeSearchResponse([]));
        mockPrismaFindMany.mockResolvedValue([]);

        await service.searchMentors({ hasAvailability: true }, 1, 12, 'relevance');

        const searchCall = mockOsSearch.mock.calls[0][0];
        const filter = searchCall.body.query.bool.filter;
        expect(filter).toEqual(expect.arrayContaining([{ term: { hasAvailability: true } }]));
      });

      it('should apply price range filter in cents', async () => {
        mockOsSearch.mockResolvedValue(makeSearchResponse([]));
        mockPrismaFindMany.mockResolvedValue([]);

        await service.searchMentors({ priceMin: 50, priceMax: 100 }, 1, 12, 'relevance');

        const searchCall = mockOsSearch.mock.calls[0][0];
        const filter = searchCall.body.query.bool.filter;
        expect(filter).toEqual(
          expect.arrayContaining([{ range: { minPriceInCents: { gte: 5000, lte: 10000 } } }]),
        );
      });

      it('should use multi_match query when q is provided', async () => {
        mockOsSearch.mockResolvedValue(makeSearchResponse([]));
        mockPrismaFindMany.mockResolvedValue([]);

        await service.searchMentors({ q: 'sport mentor' }, 1, 12, 'relevance');

        const searchCall = mockOsSearch.mock.calls[0][0];
        expect(searchCall.body.query.bool.should).toBeDefined();
      });

      it('should sort by price_asc', async () => {
        mockOsSearch.mockResolvedValue(makeSearchResponse([]));
        mockPrismaFindMany.mockResolvedValue([]);

        await service.searchMentors({}, 1, 12, 'price_asc');

        const searchCall = mockOsSearch.mock.calls[0][0];
        expect(searchCall.body.sort).toEqual(
          expect.arrayContaining([{ minPriceInCents: { order: 'asc' } }]),
        );
      });

      it('should sort by price_desc', async () => {
        mockOsSearch.mockResolvedValue(makeSearchResponse([]));
        mockPrismaFindMany.mockResolvedValue([]);

        await service.searchMentors({}, 1, 12, 'price_desc');

        const searchCall = mockOsSearch.mock.calls[0][0];
        expect(searchCall.body.sort).toEqual(
          expect.arrayContaining([{ minPriceInCents: { order: 'desc' } }]),
        );
      });

      it('should sort by rating_desc', async () => {
        mockOsSearch.mockResolvedValue(makeSearchResponse([]));
        mockPrismaFindMany.mockResolvedValue([]);

        await service.searchMentors({}, 1, 12, 'rating_desc');

        const searchCall = mockOsSearch.mock.calls[0][0];
        expect(searchCall.body.sort).toEqual(
          expect.arrayContaining([{ averageRating: { order: 'desc' } }]),
        );
      });

      it('should apply pagination (from/size)', async () => {
        mockOsSearch.mockResolvedValue(makeSearchResponse([]));
        mockPrismaFindMany.mockResolvedValue([]);

        await service.searchMentors({}, 3, 5, 'relevance');

        const searchCall = mockOsSearch.mock.calls[0][0];
        expect(searchCall.body.from).toBe(10); // (3-1) * 5
        expect(searchCall.body.size).toBe(5);
      });

      it('should return empty when OpenSearch hits are empty', async () => {
        mockOsSearch.mockResolvedValue(makeSearchResponse([], 0));

        const result = await service.searchMentors({}, 1, 12, 'relevance');

        expect(result).toEqual({ mentors: [], total: 0 });
      });
    });
  });

  describe('with SEARCH_PROVIDER=prisma (default)', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      delete process.env['SEARCH_PROVIDER'];

      const module: TestingModule = await Test.createTestingModule({
        providers: [MarketplaceSearchService, { provide: PrismaService, useValue: mockPrisma }],
      }).compile();

      service = module.get<MarketplaceSearchService>(MarketplaceSearchService);
    });

    it('indexMentor should validate status but not call OpenSearch', async () => {
      mockPrismaFindFirst.mockResolvedValue(mockVerifiedProfile);

      await expect(service.indexMentor(VERIFIED_MENTOR_ID)).resolves.not.toThrow();
      expect(mockOsIndex).not.toHaveBeenCalled();
    });

    it('indexMentor should throw for non-VERIFIED mentor even without OpenSearch', async () => {
      mockPrismaFindFirst.mockResolvedValue({
        ...mockVerifiedProfile,
        status: 'PENDING_VERIFICATION',
      });

      await expect(service.indexMentor(PENDING_MENTOR_ID)).rejects.toThrow();
    });

    it('removeMentorFromIndex should be a no-op', async () => {
      await expect(service.removeMentorFromIndex(VERIFIED_MENTOR_ID)).resolves.not.toThrow();
      expect(mockOsDelete).not.toHaveBeenCalled();
    });

    it('updateMentorInIndex should be a no-op', async () => {
      await expect(service.updateMentorInIndex(VERIFIED_MENTOR_ID)).resolves.not.toThrow();
    });

    it('bulkIndexMentors should be a no-op', async () => {
      await expect(service.bulkIndexMentors([VERIFIED_MENTOR_ID])).resolves.not.toThrow();
      expect(mockOsIndex).not.toHaveBeenCalled();
    });

    it('searchMentors should return empty result (Prisma path handles search)', async () => {
      const result = await service.searchMentors({}, 1, 12, 'relevance');

      expect(result).toEqual({ mentors: [], total: 0 });
      expect(mockOsSearch).not.toHaveBeenCalled();
    });

    it('onModuleInit should be a no-op without client', async () => {
      await expect(service.onModuleInit()).resolves.not.toThrow();
      expect(mockOsIndicesExists).not.toHaveBeenCalled();
    });
  });
});
