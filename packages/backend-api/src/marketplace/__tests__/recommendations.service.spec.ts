import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationsService } from '../recommendations.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../../user/user.service';
import { ExpertiseCategory } from '@felly/shared-types';

// ─── Variable indirection for test data ───────────────────────────────────────
const MENTEE_USER_ID = 'mentee-user-rec-id';
const MENTOR_ID_1 = 'mentor-rec-id-1';
const MENTOR_ID_2 = 'mentor-rec-id-2';
const MENTOR_ID_3 = 'mentor-rec-id-3';

// Mock mentee user
const mockMenteeUser = {
  id: MENTEE_USER_ID,
  email: 'mentee@felly.club',
  role: 'MENTEE',
};

// Mock mentee profile
const mockMenteeProfile = {
  id: 'mentee-profile-id',
  userId: MENTEE_USER_ID,
  interests: ['SOFTWARE_ENGINEERING', 'BUSINESS'] as unknown as string[],
  bio: null,
  completeness: 50,
};

// Mock mentor profiles
const makeMentor = (id: string, categories: string[]) => ({
  id,
  status: 'VERIFIED',
  verifiedBadge: true,
  headline: 'Expert Mentor',
  bio: 'Great mentor',
  expertiseCategories: categories,
  yearsOfExperience: 5,
  linkedinUrl: null,
  sessionCount: 0,
  averageRating: 0,
  pricingTiers: [],
  availabilitySlots: [],
  user: { firstName: 'Test', lastName: 'Mentor', avatarUrl: null },
});

describe('RecommendationsService', () => {
  let service: RecommendationsService;
  let mockPrisma: {
    menteeProfile: { findUnique: jest.Mock };
    mentorProfile: { findMany: jest.Mock };
  };
  let mockUserService: { findById: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockPrisma = {
      menteeProfile: { findUnique: jest.fn() },
      mentorProfile: { findMany: jest.fn() },
    };

    mockUserService = { findById: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: UserService, useValue: mockUserService },
      ],
    }).compile();

    service = module.get<RecommendationsService>(RecommendationsService);
  });

  describe('getRecommendations', () => {
    it('should return empty array when mentee has no interests', async () => {
      mockUserService.findById.mockResolvedValue(mockMenteeUser);
      mockPrisma.menteeProfile.findUnique.mockResolvedValue({
        ...mockMenteeProfile,
        interests: [],
      });

      const result = await service.getRecommendations(MENTEE_USER_ID);

      expect(result).toEqual([]);
      expect(mockPrisma.mentorProfile.findMany).not.toHaveBeenCalled();
    });

    it('should return empty array when user not found', async () => {
      mockUserService.findById.mockResolvedValue(null);

      const result = await service.getRecommendations(MENTEE_USER_ID);

      expect(result).toEqual([]);
    });

    it('should return mentors matching mentee interests with correct matchingCategories', async () => {
      mockUserService.findById.mockResolvedValue(mockMenteeUser);
      mockPrisma.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);
      mockPrisma.mentorProfile.findMany.mockResolvedValue([
        makeMentor(MENTOR_ID_1, ['SOFTWARE_ENGINEERING', 'BUSINESS']), // 2 matches
        makeMentor(MENTOR_ID_2, ['SOFTWARE_ENGINEERING', 'SPORT']), // 1 match
      ]);

      const result = await service.getRecommendations(MENTEE_USER_ID);

      expect(result).toHaveLength(2);
      // Sorted by overlap count desc — MENTOR_ID_1 should be first (2 matches)
      expect(result[0].mentor.id).toBe(MENTOR_ID_1);
      expect(result[0].matchingCategories).toHaveLength(2);
      expect(result[0].matchingCategories).toContain(ExpertiseCategory.SOFTWARE_ENGINEERING);
      expect(result[0].matchingCategories).toContain(ExpertiseCategory.BUSINESS);

      expect(result[1].mentor.id).toBe(MENTOR_ID_2);
      expect(result[1].matchingCategories).toHaveLength(1);
      expect(result[1].matchingCategories).toContain(ExpertiseCategory.SOFTWARE_ENGINEERING);
    });

    it('matchingCategories should be ONLY the intersection (not full mentor category list)', async () => {
      mockUserService.findById.mockResolvedValue(mockMenteeUser);
      mockPrisma.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);
      mockPrisma.mentorProfile.findMany.mockResolvedValue([
        // Mentor has SOFTWARE_ENGINEERING, SPORT, ENTERTAINMENT — only SOFTWARE_ENGINEERING matches mentee
        makeMentor(MENTOR_ID_1, ['SOFTWARE_ENGINEERING', 'SPORT', 'ENTERTAINMENT']),
      ]);

      const result = await service.getRecommendations(MENTEE_USER_ID);

      expect(result).toHaveLength(1);
      // matchingCategories must be intersection only (INV-E2-04)
      expect(result[0].matchingCategories).toHaveLength(1);
      expect(result[0].matchingCategories).toContain(ExpertiseCategory.SOFTWARE_ENGINEERING);
      // Must NOT contain SPORT or ENTERTAINMENT (not in mentee interests)
      expect(result[0].matchingCategories).not.toContain(ExpertiseCategory.SPORT);
      expect(result[0].matchingCategories).not.toContain(ExpertiseCategory.ENTERTAINMENT);
    });

    it('should never return more than 8 results', async () => {
      mockUserService.findById.mockResolvedValue(mockMenteeUser);
      mockPrisma.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);

      // 10 candidates
      const tenMentors = Array.from({ length: 10 }, (_, i) =>
        makeMentor(`mentor-${i}`, ['SOFTWARE_ENGINEERING']),
      );
      mockPrisma.mentorProfile.findMany.mockResolvedValue(tenMentors);

      const result = await service.getRecommendations(MENTEE_USER_ID);

      expect(result.length).toBeLessThanOrEqual(8);
    });

    it('should only include VERIFIED mentors (Prisma query enforces this)', async () => {
      mockUserService.findById.mockResolvedValue(mockMenteeUser);
      mockPrisma.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);
      mockPrisma.mentorProfile.findMany.mockResolvedValue([]);

      await service.getRecommendations(MENTEE_USER_ID);

      expect(mockPrisma.mentorProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'VERIFIED',
            verifiedBadge: true,
          }),
        }),
      );
    });

    it('should sort results by intersection count descending', async () => {
      mockUserService.findById.mockResolvedValue(mockMenteeUser);
      mockPrisma.menteeProfile.findUnique.mockResolvedValue(mockMenteeProfile);
      mockPrisma.mentorProfile.findMany.mockResolvedValue([
        makeMentor(MENTOR_ID_3, ['SOFTWARE_ENGINEERING']), // 1 match
        makeMentor(MENTOR_ID_2, ['SOFTWARE_ENGINEERING', 'SPORT']), // 1 match
        makeMentor(MENTOR_ID_1, ['SOFTWARE_ENGINEERING', 'BUSINESS', 'SPORT']), // 2 matches
      ]);

      const result = await service.getRecommendations(MENTEE_USER_ID);

      // MENTOR_ID_1 should be first (2 matches)
      expect(result[0].mentor.id).toBe(MENTOR_ID_1);
      expect(result[0].matchingCategories).toHaveLength(2);
    });
  });
});
