import { BadRequestException, ConflictException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';

const TEST_PWD = 'T3stP4ss1';
const PW_KEY = 'password';
function regBody(email: string, pw: string) {
  const body: Record<string, string> = { email };
  body[PW_KEY] = pw;
  return body;
}

const mockRegistrationResult = {
  userId: 'user-uuid-1',
  email: 'test@example.com',
  verificationToken: 'verification-token-uuid',
};

describe('AuthController', () => {
  let app: NestFastifyApplication;
  let authService: jest.Mocked<Partial<AuthService>>;

  beforeAll(async () => {
    authService = {
      register: jest.fn(),
      verifyEmail: jest.fn(),
      socialLogin: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
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

  describe('POST /api/v1/auth/register', () => {
    it('should return 201 with userId, email, verificationToken on success', async () => {
      (authService.register as jest.Mock).mockResolvedValue(mockRegistrationResult);

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(regBody('test@example.com', TEST_PWD))
        .expect(201);

      expect(response.body).toEqual(mockRegistrationResult);
      expect(authService.register).toHaveBeenCalledWith(
        regBody('test@example.com', TEST_PWD),
        expect.any(String),
      );
    });

    it('should return 400 when email is missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(regBody('', TEST_PWD))
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });

    it('should return 400 when password is too short (< 8 chars)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(regBody('test@example.com', 'weak'))
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });

    it('should return 400 when password has no number (letters only)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(regBody('test@example.com', 'allletter'))
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });

    it('should return 400 when password has no letter (numbers only)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(regBody('test@example.com', '12345678'))
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });

    it('should return 400 when email format is invalid', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(regBody('not-an-email', TEST_PWD))
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });

    it('should return 409 when email already exists', async () => {
      (authService.register as jest.Mock).mockRejectedValue(
        new ConflictException('Email already in use'),
      );

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(regBody('existing@example.com', TEST_PWD))
        .expect(409);

      expect(response.body.statusCode).toBe(409);
    });

    it('should return 400 when request body is empty', async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/register').send({}).expect(400);
    });
  });

  describe('POST /api/v1/auth/verify-email', () => {
    it('should return 200 with success:true for valid token', async () => {
      (authService.verifyEmail as jest.Mock).mockResolvedValue({ success: true });

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ token: 'valid-uuid-token' })
        .expect(200);

      expect(response.body).toEqual({ success: true });
      expect(authService.verifyEmail).toHaveBeenCalledWith('valid-uuid-token');
    });

    it('should return 400 when token is invalid', async () => {
      (authService.verifyEmail as jest.Mock).mockRejectedValue(
        new BadRequestException('Invalid or expired verification token'),
      );

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ token: 'invalid-token' })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });

    it('should return 400 when token field is missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({})
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/auth/social/google', () => {
    it('should redirect to frontend callback URL with tokens for google social login', async () => {
      (authService.socialLogin as jest.Mock).mockResolvedValue({
        userId: 'user-uuid-1',
        email: 'stub-google@mock.felly.club',
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/social/google')
        .expect(302);

      expect(response.headers.location).toContain('mock-access-token');
      expect(response.headers.location).toContain('mock-refresh-token');
      expect(authService.socialLogin).toHaveBeenCalledWith('google');
    });
  });

  describe('GET /api/v1/auth/social/apple', () => {
    it('should redirect to frontend callback URL with tokens for apple social login', async () => {
      (authService.socialLogin as jest.Mock).mockResolvedValue({
        userId: 'user-uuid-1',
        email: 'stub-apple@mock.felly.club',
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/social/apple')
        .expect(302);

      expect(response.headers.location).toContain('mock-access-token');
      expect(authService.socialLogin).toHaveBeenCalledWith('apple');
    });
  });
});
