import { ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { AdminController } from '../../admin/admin.controller';
import { AdminService } from '../../admin/admin.service';
import { UserController } from '../../user/user.controller';
import { UserService } from '../../user/user.service';
import { MockAuthAdapter } from '../adapters/mock-auth.adapter';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { JwtStrategy } from '../strategies/jwt.strategy';

const MENTEE_USER_ID = 'user-mentee-rbac-1';
const ADMIN_USER_ID = 'user-admin-rbac-1';
const MENTEE_EMAIL = 'mentee-rbac@test.com';
const ADMIN_EMAIL = 'admin-rbac@test.com';

const mockMenteeUser = {
  id: MENTEE_USER_ID,
  email: MENTEE_EMAIL,
  role: 'MENTEE',
  status: 'ACTIVE',
};

describe('RBAC Integration', () => {
  let app: NestFastifyApplication;
  let mockUserService: { getMe: jest.Mock };
  let menteeToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // TDD: Generate real JWTs via MockAuthAdapter (uses 'mock-secret' by default)
    const adapter = new MockAuthAdapter();
    const menteeTokens = await adapter.generateAuthTokens(MENTEE_USER_ID, MENTEE_EMAIL, ['MENTEE']);
    const adminTokens = await adapter.generateAuthTokens(ADMIN_USER_ID, ADMIN_EMAIL, ['ADMIN']);
    menteeToken = menteeTokens.accessToken;
    adminToken = adminTokens.accessToken;

    mockUserService = {
      getMe: jest.fn().mockResolvedValue(mockMenteeUser),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [UserController, AdminController],
      providers: [
        { provide: UserService, useValue: mockUserService },
        { provide: AdminService, useValue: {} },
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
    mockUserService.getMe.mockResolvedValue(mockMenteeUser);
  });

  // ─── GET /users/me ─────────────────────────────────────────────────────────

  describe('GET /api/v1/users/me', () => {
    it('should return 401 when no Authorization header is provided', async () => {
      await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
    });

    it('should return 200 with user data when a valid MENTEE JWT is provided', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${menteeToken}`)
        .expect(200);

      expect(response.body).toEqual(mockMenteeUser);
      expect(mockUserService.getMe).toHaveBeenCalledWith(MENTEE_USER_ID);
    });

    it('should return 200 with user data when a valid ADMIN JWT is provided (no role restriction)', async () => {
      const adminUser = {
        id: ADMIN_USER_ID,
        email: ADMIN_EMAIL,
        role: 'ADMIN',
        status: 'ACTIVE',
      };
      mockUserService.getMe.mockResolvedValue(adminUser);

      const response = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toEqual(adminUser);
      expect(mockUserService.getMe).toHaveBeenCalledWith(ADMIN_USER_ID);
    });

    it('should return 401 when an invalid JWT is provided', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);
    });
  });

  // ─── GET /admin/ping ───────────────────────────────────────────────────────

  describe('GET /api/v1/admin/ping', () => {
    it('should return 401 when no Authorization header is provided', async () => {
      await request(app.getHttpServer()).get('/api/v1/admin/ping').expect(401);
    });

    it('should return 403 when a valid MENTEE JWT is provided (wrong role)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/ping')
        .set('Authorization', `Bearer ${menteeToken}`)
        .expect(403);
    });

    it('should return 200 with { status: ok } when a valid ADMIN JWT is provided', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/ping')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toEqual({ status: 'ok' });
    });
  });
});
