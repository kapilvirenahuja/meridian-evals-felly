import { ForbiddenException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { UserController } from '../user.controller';
import { UserService } from '../user.service';
import { AdminController } from '../../admin/admin.controller';
import { AdminService } from '../../admin/admin.service';
import { MockAuthAdapter } from '../../auth/adapters/mock-auth.adapter';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { JwtStrategy } from '../../auth/strategies/jwt.strategy';

// ─── Test constants ────────────────────────────────────────────────────────────
const MENTEE_USER_ID = 'mentee-user-id-f16';
const MENTEE_EMAIL = 'mentee-f16@felly.club';
const OTHER_USER_ID = 'other-user-id-f16';
const OTHER_USER_EMAIL = 'other-f16@felly.club';
const ADMIN_USER_ID = 'admin-user-id-f16';
const ADMIN_EMAIL = 'admin-f16@felly.club';

// ─── Mock data ─────────────────────────────────────────────────────────────────
const mockMenteeWithProfile = {
  id: MENTEE_USER_ID,
  email: MENTEE_EMAIL,
  role: 'MENTEE',
  status: 'ACTIVE',
  firstName: 'Alice',
  lastName: 'Smith',
  avatarUrl: null,
  profile: {
    id: 'mentee-profile-id-1',
    userId: MENTEE_USER_ID,
    bio: 'I love sports',
    interests: ['SPORT'],
    completeness: 50,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
};

const mockUpdatedMenteeProfile = {
  ...mockMenteeWithProfile,
  profile: {
    ...mockMenteeWithProfile.profile,
    bio: 'Updated bio',
    interests: ['SPORT', 'BUSINESS'],
    completeness: 100,
  },
};

const mockPaginatedUsers = {
  users: [
    {
      id: MENTEE_USER_ID,
      email: MENTEE_EMAIL,
      role: 'MENTEE',
      status: 'ACTIVE',
      firstName: 'Alice',
      lastName: 'Smith',
      avatarUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  total: 1,
  page: 1,
  limit: 20,
};

describe('UserController + AdminController - Profile Management (F1.6)', () => {
  let app: NestFastifyApplication;
  let menteeToken: string;
  let otherUserToken: string;
  let adminToken: string;
  let mockUserService: {
    getMe: jest.Mock;
    updateProfile: jest.Mock;
    getUserProfile: jest.Mock;
    createUserWithMenteeProfile: jest.Mock;
    findByEmail: jest.Mock;
    findById: jest.Mock;
  };
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
    const menteeTokens = await adapter.generateAuthTokens(MENTEE_USER_ID, MENTEE_EMAIL, ['MENTEE']);
    const otherTokens = await adapter.generateAuthTokens(OTHER_USER_ID, OTHER_USER_EMAIL, [
      'MENTEE',
    ]);
    const adminTokens = await adapter.generateAuthTokens(ADMIN_USER_ID, ADMIN_EMAIL, ['ADMIN']);
    menteeToken = menteeTokens.accessToken;
    otherUserToken = otherTokens.accessToken;
    adminToken = adminTokens.accessToken;

    mockUserService = {
      getMe: jest.fn(),
      updateProfile: jest.fn(),
      getUserProfile: jest.fn(),
      createUserWithMenteeProfile: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
    };

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
      controllers: [UserController, AdminController],
      providers: [
        { provide: UserService, useValue: mockUserService },
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

  // ─── GET /api/v1/users/me (enhanced) ─────────────────────────────────────

  describe('GET /api/v1/users/me', () => {
    it('should return 200 with profile including completeness percentage', async () => {
      mockUserService.getMe.mockResolvedValue(mockMenteeWithProfile);

      const response = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${menteeToken}`)
        .expect(200);

      expect(response.body.id).toBe(MENTEE_USER_ID);
      expect(response.body.profile).toBeDefined();
      expect(response.body.profile.completeness).toBe(50);
      expect(mockUserService.getMe).toHaveBeenCalledWith(MENTEE_USER_ID);
    });

    it('should return 401 when no Authorization header is provided', async () => {
      await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
    });
  });

  // ─── PATCH /api/v1/users/me/profile ──────────────────────────────────────

  describe('PATCH /api/v1/users/me/profile', () => {
    it('should return 200 with updated profile and recalculated completeness', async () => {
      mockUserService.updateProfile.mockResolvedValue(mockUpdatedMenteeProfile);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/users/me/profile')
        .set('Authorization', `Bearer ${menteeToken}`)
        .send({ bio: 'Updated bio', interests: ['SPORT', 'BUSINESS'] })
        .expect(200);

      expect(response.body.profile.bio).toBe('Updated bio');
      expect(response.body.profile.completeness).toBe(100);
      expect(mockUserService.updateProfile).toHaveBeenCalledWith(
        MENTEE_USER_ID,
        expect.objectContaining({ bio: 'Updated bio' }),
      );
    });

    it('should return 401 when no Authorization header is provided', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/users/me/profile')
        .send({ bio: 'Test' })
        .expect(401);
    });

    it('should return 400 when unknown fields are provided', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/users/me/profile')
        .set('Authorization', `Bearer ${menteeToken}`)
        .send({ unknownField: 'value' })
        .expect(400);
    });
  });

  // ─── GET /api/v1/users/:id/profile ───────────────────────────────────────

  describe('GET /api/v1/users/:id/profile', () => {
    it('should return 200 when user accesses their own profile', async () => {
      mockUserService.getUserProfile.mockResolvedValue(mockMenteeWithProfile);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/users/${MENTEE_USER_ID}/profile`)
        .set('Authorization', `Bearer ${menteeToken}`)
        .expect(200);

      expect(response.body.id).toBe(MENTEE_USER_ID);
    });

    it('should return 403 when a non-admin user accesses another user profile', async () => {
      mockUserService.getUserProfile.mockRejectedValue(
        new ForbiddenException('Cannot access another user profile'),
      );

      await request(app.getHttpServer())
        .get(`/api/v1/users/${MENTEE_USER_ID}/profile`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);
    });

    it('should return 200 when admin accesses any user profile', async () => {
      mockUserService.getUserProfile.mockResolvedValue(mockMenteeWithProfile);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/users/${MENTEE_USER_ID}/profile`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.id).toBe(MENTEE_USER_ID);
    });

    it('should return 404 when user does not exist', async () => {
      mockUserService.getUserProfile.mockRejectedValue(new NotFoundException('User not found'));

      await request(app.getHttpServer())
        .get('/api/v1/users/nonexistent-id/profile')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should return 401 when no Authorization header is provided', async () => {
      await request(app.getHttpServer()).get(`/api/v1/users/${MENTEE_USER_ID}/profile`).expect(401);
    });
  });

  // ─── GET /api/v1/admin/users ──────────────────────────────────────────────

  describe('GET /api/v1/admin/users', () => {
    it('should return 200 with paginated user list for ADMIN', async () => {
      mockAdminService.getUsers.mockResolvedValue(mockPaginatedUsers);

      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.users).toHaveLength(1);
      expect(response.body.total).toBe(1);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(20);
    });

    it('should pass status filter to service', async () => {
      mockAdminService.getUsers.mockResolvedValue({ ...mockPaginatedUsers, users: [] });

      await request(app.getHttpServer())
        .get('/api/v1/admin/users?status=ACTIVE&page=2&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(mockAdminService.getUsers).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ACTIVE', page: 2, limit: 10 }),
      );
    });

    it('should pass role filter to service', async () => {
      mockAdminService.getUsers.mockResolvedValue(mockPaginatedUsers);

      await request(app.getHttpServer())
        .get('/api/v1/admin/users?role=MENTEE')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(mockAdminService.getUsers).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'MENTEE' }),
      );
    });

    it('should return 401 when no Authorization header is provided', async () => {
      await request(app.getHttpServer()).get('/api/v1/admin/users').expect(401);
    });

    it('should return 403 when a MENTEE JWT is provided', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${menteeToken}`)
        .expect(403);
    });
  });

  // ─── UserService unit tests ───────────────────────────────────────────────

  describe('UserService - Profile Management (F1.6)', () => {
    let service: UserService;
    let mockUserRepository: {
      createUserWithMenteeProfile: jest.Mock;
      findByEmail: jest.Mock;
      findById: jest.Mock;
      findUserWithProfile: jest.Mock;
      updateMenteeProfile: jest.Mock;
      updateMentorProfile: jest.Mock;
    };

    beforeEach(async () => {
      mockUserRepository = {
        createUserWithMenteeProfile: jest.fn(),
        findByEmail: jest.fn(),
        findById: jest.fn(),
        findUserWithProfile: jest.fn(),
        updateMenteeProfile: jest.fn(),
        updateMentorProfile: jest.fn(),
      };

      const { UserService: US } = await import('../user.service');
      const { UserRepository: UR } = await import('../user.repository');

      const module: TestingModule = await Test.createTestingModule({
        providers: [US, { provide: UR, useValue: mockUserRepository }],
      }).compile();

      service = module.get<UserService>(US);
    });

    describe('getMe (enhanced)', () => {
      it('should return user with profile data including completeness', async () => {
        mockUserRepository.findUserWithProfile.mockResolvedValue(mockMenteeWithProfile);

        const result = await service.getMe(MENTEE_USER_ID);

        expect(result.id).toBe(MENTEE_USER_ID);
        expect(result.profile).toBeDefined();
        expect(result.profile?.completeness).toBe(50);
      });

      it('should throw NotFoundException when user not found', async () => {
        mockUserRepository.findUserWithProfile.mockResolvedValue(null);

        await expect(service.getMe('nonexistent-id')).rejects.toThrow(NotFoundException);
      });
    });

    describe('updateProfile', () => {
      it('should call updateMenteeProfile for MENTEE users', async () => {
        const updatedUser = {
          ...mockMenteeWithProfile,
          profile: { ...mockMenteeWithProfile.profile, bio: 'New bio', completeness: 100 },
        };
        mockUserRepository.findUserWithProfile.mockResolvedValue(mockMenteeWithProfile);
        mockUserRepository.updateMenteeProfile.mockResolvedValue(updatedUser);

        const result = await service.updateProfile(MENTEE_USER_ID, { bio: 'New bio' });

        expect(mockUserRepository.updateMenteeProfile).toHaveBeenCalledWith(
          MENTEE_USER_ID,
          expect.objectContaining({ bio: 'New bio' }),
        );
        expect(result.profile.completeness).toBe(100);
      });

      it('should throw NotFoundException when user not found', async () => {
        mockUserRepository.findUserWithProfile.mockResolvedValue(null);

        await expect(service.updateProfile('nonexistent-id', { bio: 'Bio' })).rejects.toThrow(
          NotFoundException,
        );
      });
    });

    describe('getUserProfile', () => {
      it('should return profile when user accesses their own profile', async () => {
        mockUserRepository.findUserWithProfile.mockResolvedValue(mockMenteeWithProfile);

        const result = await service.getUserProfile(MENTEE_USER_ID, MENTEE_USER_ID, 'MENTEE');

        expect(result.id).toBe(MENTEE_USER_ID);
      });

      it('should return profile when admin accesses any profile', async () => {
        mockUserRepository.findUserWithProfile.mockResolvedValue(mockMenteeWithProfile);

        const result = await service.getUserProfile(ADMIN_USER_ID, MENTEE_USER_ID, 'ADMIN');

        expect(result.id).toBe(MENTEE_USER_ID);
      });

      it('should throw ForbiddenException when non-admin accesses another user profile', async () => {
        await expect(
          service.getUserProfile(OTHER_USER_ID, MENTEE_USER_ID, 'MENTEE'),
        ).rejects.toThrow(ForbiddenException);
      });

      it('should throw NotFoundException when user does not exist', async () => {
        mockUserRepository.findUserWithProfile.mockResolvedValue(null);

        await expect(
          service.getUserProfile(ADMIN_USER_ID, 'nonexistent-id', 'ADMIN'),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('completeness calculation', () => {
      it('should calculate 0% completeness when no optional fields filled', async () => {
        const emptyProfile = {
          ...mockMenteeWithProfile,
          profile: {
            ...mockMenteeWithProfile.profile,
            bio: null,
            interests: [],
            completeness: 0,
          },
        };
        mockUserRepository.findUserWithProfile.mockResolvedValue(emptyProfile);

        const result = await service.getMe(MENTEE_USER_ID);

        expect(result.profile?.completeness).toBe(0);
      });

      it('should calculate 100% completeness when all optional fields filled', async () => {
        const fullProfile = {
          ...mockMenteeWithProfile,
          profile: {
            ...mockMenteeWithProfile.profile,
            bio: 'Full bio',
            interests: ['SPORT'],
            completeness: 100,
          },
        };
        mockUserRepository.findUserWithProfile.mockResolvedValue(fullProfile);

        const result = await service.getMe(MENTEE_USER_ID);

        expect(result.profile?.completeness).toBe(100);
      });
    });
  });
});
