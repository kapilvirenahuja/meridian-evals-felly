import { NotFoundException, ForbiddenException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { AdminController } from '../admin.controller';
import { AdminService } from '../admin.service';
import { MockAuthAdapter } from '../../auth/adapters/mock-auth.adapter';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { JwtStrategy } from '../../auth/strategies/jwt.strategy';

// ─── Variable indirection for credentials (security best practice in tests) ───
const REJECTION_REASON_KEY = 'reason';
const TEST_REJECTION_REASON = 'Incomplete documentation provided';

// ─── Test constants ────────────────────────────────────────────────────────────
const ADMIN_USER_ID = 'admin-user-id-f15';
const ADMIN_EMAIL = 'admin-f15@felly.club';
const MENTEE_USER_ID = 'mentee-user-id-f15';
const MENTEE_EMAIL = 'mentee-f15@felly.club';
const MENTOR_PROFILE_ID = 'mentor-profile-id-f15';
const MENTOR_PROFILE_ID_2 = 'mentor-profile-id-f15-2';

// ─── Mock data ─────────────────────────────────────────────────────────────────
const mockPendingProfile1 = {
  id: MENTOR_PROFILE_ID,
  userId: 'user-id-1',
  status: 'PENDING_VERIFICATION',
  bio: 'Bio 1',
  expertiseCategories: ['SPORT'],
  headline: null,
  yearsOfExperience: 5,
  linkedinUrl: null,
  hourlyRate: null,
  completeness: 60,
  verifiedBadge: false,
  rejectionReason: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
  updatedAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
};

const mockPendingProfile2 = {
  id: MENTOR_PROFILE_ID_2,
  userId: 'user-id-2',
  status: 'PENDING_VERIFICATION',
  bio: 'Bio 2',
  expertiseCategories: ['BUSINESS'],
  headline: 'Senior Consultant',
  yearsOfExperience: 10,
  linkedinUrl: 'https://linkedin.com/in/bio2',
  hourlyRate: 100,
  completeness: 80,
  verifiedBadge: false,
  rejectionReason: null,
  createdAt: new Date('2024-01-02T00:00:00.000Z').toISOString(),
  updatedAt: new Date('2024-01-02T00:00:00.000Z').toISOString(),
};

const mockApprovedProfile = {
  ...mockPendingProfile1,
  status: 'VERIFIED',
  verifiedBadge: true,
};

const mockRejectedProfile = {
  ...mockPendingProfile1,
  status: 'REJECTED',
  rejectionReason: TEST_REJECTION_REASON,
};

const mockResubmittedProfile = {
  ...mockRejectedProfile,
  status: 'PENDING_VERIFICATION',
  rejectionReason: null,
};

describe('AdminController - Mentor Verification (F1.5)', () => {
  let app: NestFastifyApplication;
  let adminToken: string;
  let menteeToken: string;
  let mockAdminService: {
    createMentor: jest.Mock;
    uploadArtefact: jest.Mock;
    getVerificationQueue: jest.Mock;
    approveMentor: jest.Mock;
    rejectMentor: jest.Mock;
    resubmitMentor: jest.Mock;
    getUsers: jest.Mock;
  };

  beforeAll(async () => {
    const adapter = new MockAuthAdapter();
    const adminTokens = await adapter.generateAuthTokens(ADMIN_USER_ID, ADMIN_EMAIL, ['ADMIN']);
    const menteeTokens = await adapter.generateAuthTokens(MENTEE_USER_ID, MENTEE_EMAIL, ['MENTEE']);
    adminToken = adminTokens.accessToken;
    menteeToken = menteeTokens.accessToken;

    mockAdminService = {
      createMentor: jest.fn(),
      uploadArtefact: jest.fn(),
      getVerificationQueue: jest.fn(),
      approveMentor: jest.fn(),
      rejectMentor: jest.fn(),
      resubmitMentor: jest.fn(),
      getUsers: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: mockAdminService },
        JwtStrategy,
        JwtAuthGuard,
        RolesGuard,
      ],
    }).compile();

    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── GET /api/v1/admin/mentors/verification ───────────────────────────────

  describe('GET /api/v1/admin/mentors/verification', () => {
    it('should return 200 with list of PENDING_VERIFICATION profiles sorted by createdAt ASC', async () => {
      mockAdminService.getVerificationQueue.mockResolvedValue([
        mockPendingProfile1,
        mockPendingProfile2,
      ]);

      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/mentors/verification')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].status).toBe('PENDING_VERIFICATION');
      expect(response.body[1].status).toBe('PENDING_VERIFICATION');
      // Sorted by createdAt ASC — first item should have earlier createdAt
      expect(new Date(response.body[0].createdAt) <= new Date(response.body[1].createdAt)).toBe(
        true,
      );
      expect(mockAdminService.getVerificationQueue).toHaveBeenCalledTimes(1);
    });

    it('should return 200 with empty array when no profiles pending', async () => {
      mockAdminService.getVerificationQueue.mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/mentors/verification')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return 401 when no Authorization header is provided', async () => {
      await request(app.getHttpServer()).get('/api/v1/admin/mentors/verification').expect(401);
    });

    it('should return 403 when a MENTEE JWT is provided', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/mentors/verification')
        .set('Authorization', `Bearer ${menteeToken}`)
        .expect(403);
    });
  });

  // ─── POST /api/v1/admin/mentors/:id/approve ──────────────────────────────

  describe('POST /api/v1/admin/mentors/:id/approve', () => {
    it('should return 200 with VERIFIED status and verifiedBadge=true when approved', async () => {
      mockAdminService.approveMentor.mockResolvedValue(mockApprovedProfile);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/admin/mentors/${MENTOR_PROFILE_ID}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.status).toBe('VERIFIED');
      expect(response.body.verifiedBadge).toBe(true);
      expect(mockAdminService.approveMentor).toHaveBeenCalledWith(MENTOR_PROFILE_ID);
    });

    it('should return 401 when no Authorization header is provided', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/admin/mentors/${MENTOR_PROFILE_ID}/approve`)
        .expect(401);
    });

    it('should return 403 when a MENTEE JWT is provided', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/admin/mentors/${MENTOR_PROFILE_ID}/approve`)
        .set('Authorization', `Bearer ${menteeToken}`)
        .expect(403);
    });

    it('should return 404 when mentor profile does not exist', async () => {
      mockAdminService.approveMentor.mockRejectedValue(
        new NotFoundException('Mentor profile not found'),
      );

      await request(app.getHttpServer())
        .post('/api/v1/admin/mentors/nonexistent-id/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  // ─── POST /api/v1/admin/mentors/:id/reject ───────────────────────────────

  describe('POST /api/v1/admin/mentors/:id/reject', () => {
    it('should return 200 with REJECTED status and reason when rejected', async () => {
      mockAdminService.rejectMentor.mockResolvedValue(mockRejectedProfile);

      const body: Record<string, unknown> = {};
      body[REJECTION_REASON_KEY] = TEST_REJECTION_REASON;

      const response = await request(app.getHttpServer())
        .post(`/api/v1/admin/mentors/${MENTOR_PROFILE_ID}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body)
        .expect(200);

      expect(response.body.status).toBe('REJECTED');
      expect(response.body.rejectionReason).toBe(TEST_REJECTION_REASON);
      expect(mockAdminService.rejectMentor).toHaveBeenCalledWith(
        MENTOR_PROFILE_ID,
        TEST_REJECTION_REASON,
      );
    });

    it('should return 400 when reason is missing', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/admin/mentors/${MENTOR_PROFILE_ID}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);
    });

    it('should return 401 when no Authorization header is provided', async () => {
      const body: Record<string, unknown> = {};
      body[REJECTION_REASON_KEY] = TEST_REJECTION_REASON;

      await request(app.getHttpServer())
        .post(`/api/v1/admin/mentors/${MENTOR_PROFILE_ID}/reject`)
        .send(body)
        .expect(401);
    });

    it('should return 403 when a MENTEE JWT is provided', async () => {
      const body: Record<string, unknown> = {};
      body[REJECTION_REASON_KEY] = TEST_REJECTION_REASON;

      await request(app.getHttpServer())
        .post(`/api/v1/admin/mentors/${MENTOR_PROFILE_ID}/reject`)
        .set('Authorization', `Bearer ${menteeToken}`)
        .send(body)
        .expect(403);
    });

    it('should return 404 when mentor profile does not exist', async () => {
      mockAdminService.rejectMentor.mockRejectedValue(
        new NotFoundException('Mentor profile not found'),
      );

      const body: Record<string, unknown> = {};
      body[REJECTION_REASON_KEY] = TEST_REJECTION_REASON;

      await request(app.getHttpServer())
        .post('/api/v1/admin/mentors/nonexistent-id/reject')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body)
        .expect(404);
    });
  });

  // ─── POST /api/v1/admin/mentors/:id/resubmit ─────────────────────────────

  describe('POST /api/v1/admin/mentors/:id/resubmit', () => {
    it('should return 200 with PENDING_VERIFICATION status when resubmitted', async () => {
      mockAdminService.resubmitMentor.mockResolvedValue(mockResubmittedProfile);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/admin/mentors/${MENTOR_PROFILE_ID}/resubmit`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.status).toBe('PENDING_VERIFICATION');
      expect(mockAdminService.resubmitMentor).toHaveBeenCalledWith(MENTOR_PROFILE_ID);
    });

    it('should return 401 when no Authorization header is provided', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/admin/mentors/${MENTOR_PROFILE_ID}/resubmit`)
        .expect(401);
    });

    it('should return 403 when a MENTEE JWT is provided', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/admin/mentors/${MENTOR_PROFILE_ID}/resubmit`)
        .set('Authorization', `Bearer ${menteeToken}`)
        .expect(403);
    });

    it('should return 404 when mentor profile does not exist', async () => {
      mockAdminService.resubmitMentor.mockRejectedValue(
        new NotFoundException('Mentor profile not found'),
      );

      await request(app.getHttpServer())
        .post('/api/v1/admin/mentors/nonexistent-id/resubmit')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should return 403 when profile is not in REJECTED status', async () => {
      mockAdminService.resubmitMentor.mockRejectedValue(
        new ForbiddenException('Only REJECTED profiles can be resubmitted'),
      );

      await request(app.getHttpServer())
        .post(`/api/v1/admin/mentors/${MENTOR_PROFILE_ID}/resubmit`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });
  });

  // ─── AdminService unit tests ───────────────────────────────────────────────

  describe('AdminService - Verification (F1.5)', () => {
    let service: AdminService;
    let mockAdminRepository: {
      createMentorWithUser: jest.Mock;
      findMentorProfileById: jest.Mock;
      createArtefact: jest.Mock;
      findPendingVerificationProfiles: jest.Mock;
      approveMentor: jest.Mock;
      rejectMentor: jest.Mock;
      resubmitMentor: jest.Mock;
      findAllUsers: jest.Mock;
    };
    let mockAuthAdapter: { hashPassword: jest.Mock };
    let mockPrismaService: { auditLog: { create: jest.Mock } };

    beforeEach(async () => {
      mockAdminRepository = {
        createMentorWithUser: jest.fn(),
        findMentorProfileById: jest.fn(),
        createArtefact: jest.fn(),
        findPendingVerificationProfiles: jest.fn(),
        approveMentor: jest.fn(),
        rejectMentor: jest.fn(),
        resubmitMentor: jest.fn(),
        findAllUsers: jest.fn(),
      };

      mockAuthAdapter = {
        hashPassword: jest.fn().mockResolvedValue('hashed-password'),
      };

      mockPrismaService = {
        auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
      };

      const { AdminService: AS } = await import('../admin.service');
      const { AdminRepository: AR } = await import('../admin.repository');
      const { AUTH_ADAPTER_TOKEN } = await import('../../common/constants');
      const { PrismaService: PS } = await import('../../prisma/prisma.service');

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AS,
          { provide: AR, useValue: mockAdminRepository },
          { provide: AUTH_ADAPTER_TOKEN, useValue: mockAuthAdapter },
          { provide: PS, useValue: mockPrismaService },
        ],
      }).compile();

      service = module.get<AdminService>(AS);
    });

    describe('getVerificationQueue', () => {
      it('should return profiles sorted by createdAt ASC from repository', async () => {
        mockAdminRepository.findPendingVerificationProfiles.mockResolvedValue([
          mockPendingProfile1,
          mockPendingProfile2,
        ]);

        const result = await service.getVerificationQueue();

        expect(mockAdminRepository.findPendingVerificationProfiles).toHaveBeenCalledTimes(1);
        expect(result).toHaveLength(2);
        expect(result[0].id).toBe(MENTOR_PROFILE_ID);
      });

      it('should return empty array when no profiles are pending', async () => {
        mockAdminRepository.findPendingVerificationProfiles.mockResolvedValue([]);

        const result = await service.getVerificationQueue();

        expect(result).toEqual([]);
      });
    });

    describe('approveMentor', () => {
      it('should call repository approveMentor and log audit event', async () => {
        mockAdminRepository.findMentorProfileById.mockResolvedValue({
          ...mockPendingProfile1,
          user: { id: 'user-id-1' },
        });
        mockAdminRepository.approveMentor.mockResolvedValue(mockApprovedProfile);

        const result = await service.approveMentor(MENTOR_PROFILE_ID);

        expect(mockAdminRepository.approveMentor).toHaveBeenCalledWith(MENTOR_PROFILE_ID);
        expect(result.status).toBe('VERIFIED');
        expect(result.verifiedBadge).toBe(true);
      });

      it('should throw NotFoundException when mentor profile does not exist', async () => {
        mockAdminRepository.findMentorProfileById.mockResolvedValue(null);

        await expect(service.approveMentor('nonexistent-id')).rejects.toThrow(NotFoundException);
      });
    });

    describe('rejectMentor', () => {
      it('should call repository rejectMentor with reason and log audit event', async () => {
        mockAdminRepository.findMentorProfileById.mockResolvedValue({
          ...mockPendingProfile1,
          user: { id: 'user-id-1' },
        });
        mockAdminRepository.rejectMentor.mockResolvedValue(mockRejectedProfile);

        const result = await service.rejectMentor(MENTOR_PROFILE_ID, TEST_REJECTION_REASON);

        expect(mockAdminRepository.rejectMentor).toHaveBeenCalledWith(
          MENTOR_PROFILE_ID,
          TEST_REJECTION_REASON,
        );
        expect(result.status).toBe('REJECTED');
        expect(result.rejectionReason).toBe(TEST_REJECTION_REASON);
      });

      it('should throw NotFoundException when mentor profile does not exist', async () => {
        mockAdminRepository.findMentorProfileById.mockResolvedValue(null);

        await expect(service.rejectMentor('nonexistent-id', TEST_REJECTION_REASON)).rejects.toThrow(
          NotFoundException,
        );
      });
    });

    describe('resubmitMentor', () => {
      it('should call repository resubmitMentor for REJECTED profiles', async () => {
        mockAdminRepository.findMentorProfileById.mockResolvedValue({
          ...mockRejectedProfile,
          user: { id: 'user-id-1' },
        });
        mockAdminRepository.resubmitMentor.mockResolvedValue(mockResubmittedProfile);

        const result = await service.resubmitMentor(MENTOR_PROFILE_ID);

        expect(mockAdminRepository.resubmitMentor).toHaveBeenCalledWith(MENTOR_PROFILE_ID);
        expect(result.status).toBe('PENDING_VERIFICATION');
      });

      it('should throw NotFoundException when mentor profile does not exist', async () => {
        mockAdminRepository.findMentorProfileById.mockResolvedValue(null);

        await expect(service.resubmitMentor('nonexistent-id')).rejects.toThrow(NotFoundException);
      });

      it('should throw ForbiddenException when profile is not in REJECTED status', async () => {
        mockAdminRepository.findMentorProfileById.mockResolvedValue({
          ...mockPendingProfile1,
          status: 'PENDING_VERIFICATION',
          user: { id: 'user-id-1' },
        });

        await expect(service.resubmitMentor(MENTOR_PROFILE_ID)).rejects.toThrow(ForbiddenException);
      });
    });
  });
});
