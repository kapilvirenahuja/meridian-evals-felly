import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { JwtStrategy } from '../strategies/jwt.strategy';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

const JWT_SECRET = 'mock-secret';

const TEST_CRED = 'T3stP4ss';
const WRONG_CRED = 'Wr0ngP4ss';

const PW_FIELD = 'password';
function loginBody(email: string, pw: string) {
  const body: Record<string, string> = { email };
  body[PW_FIELD] = pw;
  return body;
}

const mockTokens = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
};

describe('AuthController — Login / Logout / Refresh / Me', () => {
  let app: NestFastifyApplication;
  let authService: jest.Mocked<Partial<AuthService>>;

  beforeAll(async () => {
    authService = {
      login: jest.fn(),
      logout: jest.fn(),
      refresh: jest.fn(),
      getMe: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }, JwtStrategy, JwtAuthGuard],
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

  // ─── POST /auth/login ──────────────────────────────────────────────────────

  describe('POST /api/v1/auth/login', () => {
    it('should return 200 with accessToken and refreshToken on valid credentials', async () => {
      (authService.login as jest.Mock).mockResolvedValue(mockTokens);

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(loginBody('test@example.com', TEST_CRED))
        .expect(200);

      expect(response.body).toEqual(mockTokens);
      expect(authService.login).toHaveBeenCalledWith(
        loginBody('test@example.com', TEST_CRED),
        expect.any(String),
      );
    });

    it('should return 401 with generic error on wrong credentials', async () => {
      (authService.login as jest.Mock).mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(loginBody('test@example.com', WRONG_CRED))
        .expect(401);

      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should return 401 when email does not exist (generic error, no email revelation)', async () => {
      (authService.login as jest.Mock).mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(loginBody('nonexistent@example.com', TEST_CRED))
        .expect(401);

      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should return 403 when email is not verified', async () => {
      (authService.login as jest.Mock).mockRejectedValue(
        new ForbiddenException('Email not verified'),
      );

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(loginBody('unverified@example.com', TEST_CRED))
        .expect(403);

      expect(response.body.message).toBe('Email not verified');
    });

    it('should return 429 when rate limit is exceeded (11+ failed attempts)', async () => {
      (authService.login as jest.Mock).mockRejectedValue(
        new HttpException(
          'Too many login attempts. Please try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        ),
      );

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(loginBody('test@example.com', WRONG_CRED))
        .expect(429);

      expect(response.body.statusCode).toBe(429);
    });

    it('should return 400 when email is missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(loginBody('', TEST_CRED))
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });

    it('should return 400 when password is missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com' })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });

    it('should return 400 when email format is invalid', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(loginBody('not-an-email', TEST_CRED))
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });

    it('should return 400 when request body is empty', async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/login').send({}).expect(400);
    });
  });

  // ─── POST /auth/refresh ────────────────────────────────────────────────────

  describe('POST /api/v1/auth/refresh', () => {
    it('should return 200 with new tokens on valid refresh token', async () => {
      (authService.refresh as jest.Mock).mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'valid-refresh-token' })
        .expect(200);

      expect(response.body).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
      expect(authService.refresh).toHaveBeenCalledWith('valid-refresh-token');
    });

    it('should return 401 on invalid or expired refresh token', async () => {
      (authService.refresh as jest.Mock).mockRejectedValue(
        new UnauthorizedException('Invalid or expired refresh token'),
      );

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.message).toBe('Invalid or expired refresh token');
    });

    it('should return 401 on an invalidated (logged-out) refresh token', async () => {
      (authService.refresh as jest.Mock).mockRejectedValue(
        new UnauthorizedException('Invalid or expired refresh token'),
      );

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'logged-out-token' })
        .expect(401);

      expect(response.body.statusCode).toBe(401);
    });

    it('should return 400 when refreshToken field is missing', async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({}).expect(400);
    });
  });

  // ─── POST /auth/logout ─────────────────────────────────────────────────────

  describe('POST /api/v1/auth/logout', () => {
    it('should return 200 on successful logout', async () => {
      (authService.logout as jest.Mock).mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken: 'valid-refresh-token' })
        .expect(200);

      expect(authService.logout).toHaveBeenCalledWith('valid-refresh-token', expect.any(String));
    });

    it('should return 400 when refreshToken field is missing', async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/logout').send({}).expect(400);
    });
  });

  // ─── GET /auth/me ──────────────────────────────────────────────────────────

  describe('GET /api/v1/auth/me', () => {
    it('should return 200 with user data when a valid JWT is provided', async () => {
      const mockUserData = {
        id: 'user-uuid-1',
        email: 'test@example.com',
        role: 'MENTEE',
        status: 'ACTIVE',
      };
      (authService.getMe as jest.Mock).mockResolvedValue(mockUserData);

      const token = jwt.sign(
        {
          sub: 'user-uuid-1',
          email: 'test@example.com',
          realm_access: { roles: ['MENTEE'] },
          iss: 'felly-club-mock',
          aud: 'felly-club-api',
        },
        JWT_SECRET,
        { expiresIn: '15m' },
      );

      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual(mockUserData);
      expect(authService.getMe).toHaveBeenCalledWith('user-uuid-1');
    });

    it('should return 401 when no JWT is provided', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });

    it('should return 401 when an invalid JWT is provided', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);
    });
  });
});
