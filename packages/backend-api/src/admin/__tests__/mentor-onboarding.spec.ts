import { NotFoundException, ValidationPipe } from '@nestjs/common';
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
const MENTOR_PWD_KEY = 'password';
const MENTOR_TEST_PWD = 'M3nt0rP@ss1';

// ─── Test constants ────────────────────────────────────────────────────────────
const ADMIN_USER_ID = 'admin-user-id-f14';
const ADMIN_EMAIL = 'admin-f14@felly.club';
const MENTEE_USER_ID = 'mentee-user-id-f14';
const MENTEE_EMAIL = 'mentee-f14@felly.club';
const MENTOR_PROFILE_ID = 'mentor-profile-id-f14';

// ─── Mock data ─────────────────────────────────────────────────────────────────
function buildCreateMentorBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    email: 'newmentor@felly.club',
    firstName: 'Jane',
    lastName: 'Doe',
    bio: 'Experienced sports coach',
    expertiseCategories: ['SPORT'],
    yearsOfExperience: 5,
    pricingTiers: [{ name: 'Basic', priceInCents: 5000, durationMinutes: 30 }],
    ...overrides,
  };
  body[MENTOR_PWD_KEY] = MENTOR_TEST_PWD;
  return body;
}

const mockPendingMentorResult = {
  id: MENTOR_PROFILE_ID,
  userId: 'new-user-id-1',
  status: 'PENDING_VERIFICATION',
  bio: 'Experienced sports coach',
  expertiseCategories: ['SPORT'],
  headline: null,
  yearsOfExperience: 5,
  linkedinUrl: null,
  hourlyRate: null,
  completeness: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockDraftMentorResult = {
  ...mockPendingMentorResult,
  status: 'DRAFT',
};

const mockArtefactResult = {
  id: 'artefact-id-1',
  mentorProfileId: MENTOR_PROFILE_ID,
  type: 'LINKEDIN_URL',
  value: 'https://linkedin.com/in/janedoe',
  isVerified: false,
  verifiedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('AdminController - Mentor Onboarding (F1.4)', () => {
  let app: NestFastifyApplication;
  let adminToken: string;
  let menteeToken: string;
  let mockAdminService: {
    createMentor: jest.Mock;
    uploadArtefact: jest.Mock;
  };

  beforeAll(async () => {
    // Generate real JWTs via MockAuthAdapter (uses 'mock-secret' by default)
    const adapter = new MockAuthAdapter();
    const adminTokens = await adapter.generateAuthTokens(ADMIN_USER_ID, ADMIN_EMAIL, ['ADMIN']);
    const menteeTokens = await adapter.generateAuthTokens(MENTEE_USER_ID, MENTEE_EMAIL, ['MENTEE']);
    adminToken = adminTokens.accessToken;
    menteeToken = menteeTokens.accessToken;

    mockAdminService = {
      createMentor: jest.fn(),
      uploadArtefact: jest.fn(),
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

  // ─── POST /api/v1/admin/mentors ────────────────────────────────────────────

  describe('POST /api/v1/admin/mentors', () => {
    it('should return 201 with PENDING_VERIFICATION status when all required fields are provided', async () => {
      mockAdminService.createMentor.mockResolvedValue(mockPendingMentorResult);

      const response = await request(app.getHttpServer())
        .post('/api/v1/admin/mentors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(buildCreateMentorBody())
        .expect(201);

      expect(response.body.status).toBe('PENDING_VERIFICATION');
      expect(mockAdminService.createMentor).toHaveBeenCalledTimes(1);
    });

    it('should return 201 with DRAFT status when saveDraft flag is true', async () => {
      mockAdminService.createMentor.mockResolvedValue(mockDraftMentorResult);

      const response = await request(app.getHttpServer())
        .post('/api/v1/admin/mentors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(buildCreateMentorBody({ saveDraft: true }))
        .expect(201);

      expect(response.body.status).toBe('DRAFT');
    });

    it('should return 401 when no Authorization header is provided', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/admin/mentors')
        .send(buildCreateMentorBody())
        .expect(401);
    });

    it('should return 403 when a MENTEE JWT is provided (wrong role)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/admin/mentors')
        .set('Authorization', `Bearer ${menteeToken}`)
        .send(buildCreateMentorBody())
        .expect(403);
    });

    it('should return 400 when email is missing', async () => {
      const body = buildCreateMentorBody();
      delete body['email'];
      await request(app.getHttpServer())
        .post('/api/v1/admin/mentors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body)
        .expect(400);
    });

    it('should return 400 when password is missing', async () => {
      const body: Record<string, unknown> = {
        email: 'newmentor@felly.club',
        firstName: 'Jane',
        bio: 'Bio',
      };
      // Do not set password field
      await request(app.getHttpServer())
        .post('/api/v1/admin/mentors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body)
        .expect(400);
    });

    it('should call AdminService.createMentor with the DTO', async () => {
      mockAdminService.createMentor.mockResolvedValue(mockPendingMentorResult);

      await request(app.getHttpServer())
        .post('/api/v1/admin/mentors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(buildCreateMentorBody())
        .expect(201);

      expect(mockAdminService.createMentor).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'newmentor@felly.club' }),
      );
    });
  });

  // ─── POST /api/v1/admin/mentors/:id/artefacts ──────────────────────────────

  describe('POST /api/v1/admin/mentors/:id/artefacts', () => {
    it('should return 201 with artefact data when uploaded by ADMIN', async () => {
      mockAdminService.uploadArtefact.mockResolvedValue(mockArtefactResult);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/admin/mentors/${MENTOR_PROFILE_ID}/artefacts`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ type: 'LINKEDIN_URL', value: 'https://linkedin.com/in/janedoe' })
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          type: 'LINKEDIN_URL',
          mentorProfileId: MENTOR_PROFILE_ID,
        }),
      );
    });

    it('should return 401 when no Authorization header is provided', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/admin/mentors/${MENTOR_PROFILE_ID}/artefacts`)
        .send({ type: 'LINKEDIN_URL', value: 'https://linkedin.com/in/janedoe' })
        .expect(401);
    });

    it('should return 403 when a MENTEE JWT is provided (artefacts visible only to admin)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/admin/mentors/${MENTOR_PROFILE_ID}/artefacts`)
        .set('Authorization', `Bearer ${menteeToken}`)
        .send({ type: 'LINKEDIN_URL', value: 'https://linkedin.com/in/janedoe' })
        .expect(403);
    });

    it('should return 400 when type is missing', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/admin/mentors/${MENTOR_PROFILE_ID}/artefacts`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 'https://linkedin.com/in/janedoe' })
        .expect(400);
    });

    it('should return 400 when value is missing', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/admin/mentors/${MENTOR_PROFILE_ID}/artefacts`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ type: 'LINKEDIN_URL' })
        .expect(400);
    });

    it('should return 404 when mentor profile does not exist', async () => {
      mockAdminService.uploadArtefact.mockRejectedValue(
        new NotFoundException('Mentor profile not found'),
      );

      await request(app.getHttpServer())
        .post(`/api/v1/admin/mentors/nonexistent-id/artefacts`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ type: 'LINKEDIN_URL', value: 'https://linkedin.com/in/janedoe' })
        .expect(404);
    });

    it('should call AdminService.uploadArtefact with mentorProfileId and DTO', async () => {
      mockAdminService.uploadArtefact.mockResolvedValue(mockArtefactResult);

      await request(app.getHttpServer())
        .post(`/api/v1/admin/mentors/${MENTOR_PROFILE_ID}/artefacts`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ type: 'DOCUMENT', value: 'https://docs.example.com/resume.pdf' })
        .expect(201);

      expect(mockAdminService.uploadArtefact).toHaveBeenCalledWith(
        MENTOR_PROFILE_ID,
        expect.objectContaining({ type: 'DOCUMENT' }),
      );
    });
  });

  // ─── AdminService unit tests ───────────────────────────────────────────────

  describe('AdminService.createMentor', () => {
    let service: AdminService;
    let mockAdminRepository: {
      createMentorWithUser: jest.Mock;
      findMentorProfileById: jest.Mock;
      createArtefact: jest.Mock;
    };
    let mockAuthAdapter: { hashPassword: jest.Mock };
    let mockPrismaService: { auditLog: { create: jest.Mock } };

    beforeEach(async () => {
      mockAdminRepository = {
        createMentorWithUser: jest.fn(),
        findMentorProfileById: jest.fn(),
        createArtefact: jest.fn(),
      };

      mockAuthAdapter = {
        hashPassword: jest.fn().mockResolvedValue('hashed-mentor-password'),
      };

      mockPrismaService = {
        auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
      };

      // Lazy import to avoid circular deps - we import after controller app is set up
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

    it('should hash the password using authAdapter before creating mentor', async () => {
      mockAdminRepository.createMentorWithUser.mockResolvedValue({
        mentorProfile: { ...mockPendingMentorResult },
        user: { id: 'new-user-id', email: 'newmentor@felly.club' },
      });

      const dto = {
        email: 'newmentor@felly.club',
        password: MENTOR_TEST_PWD,
        bio: 'Bio',
        expertiseCategories: ['SPORT'],
      };

      await service.createMentor(dto as Parameters<typeof service.createMentor>[0]);

      expect(mockAuthAdapter.hashPassword).toHaveBeenCalledWith(MENTOR_TEST_PWD);
    });

    it('should set status to PENDING_VERIFICATION when saveDraft is false/undefined', async () => {
      mockAdminRepository.createMentorWithUser.mockResolvedValue({
        mentorProfile: { ...mockPendingMentorResult },
        user: { id: 'new-user-id', email: 'newmentor@felly.club' },
      });

      const dto = {
        email: 'newmentor@felly.club',
        password: MENTOR_TEST_PWD,
        saveDraft: false,
      };

      await service.createMentor(dto as Parameters<typeof service.createMentor>[0]);

      expect(mockAdminRepository.createMentorWithUser).toHaveBeenCalledWith(
        expect.anything(),
        'hashed-mentor-password',
        'PENDING_VERIFICATION',
      );
    });

    it('should set status to DRAFT when saveDraft is true', async () => {
      mockAdminRepository.createMentorWithUser.mockResolvedValue({
        mentorProfile: { ...mockDraftMentorResult },
        user: { id: 'new-user-id', email: 'newmentor@felly.club' },
      });

      const dto = {
        email: 'newmentor@felly.club',
        password: MENTOR_TEST_PWD,
        saveDraft: true,
      };

      await service.createMentor(dto as Parameters<typeof service.createMentor>[0]);

      expect(mockAdminRepository.createMentorWithUser).toHaveBeenCalledWith(
        expect.anything(),
        'hashed-mentor-password',
        'DRAFT',
      );
    });

    it('should throw NotFoundException when uploading artefact for non-existent mentor', async () => {
      mockAdminRepository.findMentorProfileById.mockResolvedValue(null);

      await expect(
        service.uploadArtefact('nonexistent-id', { type: 'LINKEDIN_URL', value: 'https://x.com' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return artefact data when upload succeeds', async () => {
      mockAdminRepository.findMentorProfileById.mockResolvedValue({ id: MENTOR_PROFILE_ID });
      mockAdminRepository.createArtefact.mockResolvedValue(mockArtefactResult);

      const result = await service.uploadArtefact(MENTOR_PROFILE_ID, {
        type: 'LINKEDIN_URL',
        value: 'https://linkedin.com/in/janedoe',
      });

      expect(result).toEqual(mockArtefactResult);
    });
  });
});
