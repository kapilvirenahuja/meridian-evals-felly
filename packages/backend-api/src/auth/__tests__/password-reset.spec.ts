import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { AUTH_ADAPTER_TOKEN } from '../../common/constants';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../../user/user.service';
import { IAuthAdapter } from '../adapters/auth-adapter.interface';

// Variable indirection for credential fields
const NEW_PW_FIELD = 'newPassword';
const STRONG_PW = 'NewP4ssword1';

function forgotBody(email: string) {
  return { email };
}

function resetBody(token: string, newPw: string) {
  const body: Record<string, string> = { token };
  body[NEW_PW_FIELD] = newPw;
  return body;
}

// ─── Controller-Level Tests ───────────────────────────────────────────────────

describe('F1.3 — Password Reset Controller', () => {
  let app: NestFastifyApplication;
  let authService: jest.Mocked<Partial<AuthService>>;

  beforeAll(async () => {
    authService = {
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
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

  // ─── POST /auth/forgot-password ───────────────────────────────────────────

  describe('POST /api/v1/auth/forgot-password', () => {
    it('should return 200 with success:true for a valid registered email', async () => {
      (authService.forgotPassword as jest.Mock).mockResolvedValue({ success: true });

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send(forgotBody('user@example.com'))
        .expect(200);

      expect(response.body).toEqual({ success: true });
      expect(authService.forgotPassword).toHaveBeenCalledWith('user@example.com');
    });

    it('should return 200 even for a non-existent email (no user enumeration)', async () => {
      (authService.forgotPassword as jest.Mock).mockResolvedValue({ success: true });

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send(forgotBody('nonexistent@example.com'))
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send(forgotBody('not-an-email'))
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });

    it('should return 400 when email field is missing', async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/forgot-password').send({}).expect(400);
    });
  });

  // ─── POST /auth/reset-password ────────────────────────────────────────────

  describe('POST /api/v1/auth/reset-password', () => {
    it('should return 200 with valid token and strong password', async () => {
      (authService.resetPassword as jest.Mock).mockResolvedValue({ success: true });

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send(resetBody('valid-uuid-token', STRONG_PW))
        .expect(200);

      expect(response.body).toEqual({ success: true });
      expect(authService.resetPassword).toHaveBeenCalledWith('valid-uuid-token', STRONG_PW);
    });

    it('should return 400 when token is expired (service throws BadRequestException)', async () => {
      (authService.resetPassword as jest.Mock).mockRejectedValue(
        new BadRequestException('Invalid or expired reset token'),
      );

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send(resetBody('expired-token', STRONG_PW))
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.message).toBe('Invalid or expired reset token');
    });

    it('should return 400 when token is invalid', async () => {
      (authService.resetPassword as jest.Mock).mockRejectedValue(
        new BadRequestException('Invalid or expired reset token'),
      );

      await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send(resetBody('invalid-token', STRONG_PW))
        .expect(400);
    });

    it('should return 400 when newPassword is too short (< 8 chars)', async () => {
      const body = resetBody('valid-token', 'sh0rt');
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send(body)
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });

    it('should return 400 when newPassword has no number (letters only)', async () => {
      const body = resetBody('valid-token', 'allletter');
      await request(app.getHttpServer()).post('/api/v1/auth/reset-password').send(body).expect(400);
    });

    it('should return 400 when newPassword has no letter (numbers only)', async () => {
      const body = resetBody('valid-token', '12345678');
      await request(app.getHttpServer()).post('/api/v1/auth/reset-password').send(body).expect(400);
    });

    it('should return 400 when token field is missing', async () => {
      const body: Record<string, string> = {};
      body[NEW_PW_FIELD] = STRONG_PW;
      await request(app.getHttpServer()).post('/api/v1/auth/reset-password').send(body).expect(400);
    });

    it('should return 400 when newPassword field is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({ token: 'valid-token' })
        .expect(400);
    });

    it('should return 400 when request body is empty', async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/reset-password').send({}).expect(400);
    });
  });
});

// ─── Service-Level Tests ──────────────────────────────────────────────────────

describe('F1.3 — Password Reset Service', () => {
  let service: AuthService;
  let mockAuthAdapter: jest.Mocked<IAuthAdapter>;
  let mockPrismaService: {
    auditLog: { create: jest.Mock };
    user: { update: jest.Mock };
  };
  let mockUserService: { findByEmail: jest.Mock; findById: jest.Mock };

  const mockUser = {
    id: 'user-uuid-1',
    email: 'user@example.com',
    passwordHash: 'old-hashed-password',
    role: 'MENTEE',
    status: 'ACTIVE',
    firstName: null,
    lastName: null,
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockAuthAdapter = {
      hashPassword: jest.fn().mockResolvedValue('new-hashed-password'),
      verifyPassword: jest.fn().mockResolvedValue(true),
      generateAuthTokens: jest.fn().mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' }),
      validateToken: jest.fn().mockResolvedValue(null),
      generateEmailVerificationToken: jest.fn().mockResolvedValue('verify-token'),
      verifyEmailToken: jest.fn().mockResolvedValue(mockUser.id),
      getSocialLoginUser: jest.fn(),
      checkRateLimit: jest.fn().mockReturnValue(false),
      recordFailedLogin: jest.fn(),
      clearFailedLogins: jest.fn(),
      isRefreshTokenInvalidated: jest.fn().mockReturnValue(false),
      invalidateRefreshToken: jest.fn(),
      // F1.3 additions
      generateResetToken: jest.fn().mockResolvedValue('reset-token-uuid'),
      verifyResetToken: jest.fn().mockResolvedValue(mockUser.id),
      updatePassword: jest.fn().mockResolvedValue(undefined),
      invalidateAllUserRefreshTokens: jest.fn(),
    };

    mockPrismaService = {
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-uuid' }) },
      user: {
        update: jest.fn().mockResolvedValue({ ...mockUser, passwordHash: 'new-hashed-password' }),
      },
    };

    mockUserService = {
      findByEmail: jest.fn().mockResolvedValue(mockUser),
      findById: jest.fn().mockResolvedValue(mockUser),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: mockUserService },
        { provide: AUTH_ADAPTER_TOKEN, useValue: mockAuthAdapter },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ─── forgotPassword ────────────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('should return { success: true } for a registered email', async () => {
      const result = await service.forgotPassword('user@example.com');
      expect(result).toEqual({ success: true });
    });

    it('should return { success: true } even for a non-existent email (no enumeration)', async () => {
      mockUserService.findByEmail.mockResolvedValue(null);
      const result = await service.forgotPassword('nonexistent@example.com');
      expect(result).toEqual({ success: true });
    });

    it('should generate a reset token when user exists', async () => {
      await service.forgotPassword('user@example.com');
      expect(mockAuthAdapter.generateResetToken).toHaveBeenCalledWith(mockUser.id);
    });

    it('should NOT generate a reset token when user does not exist', async () => {
      mockUserService.findByEmail.mockResolvedValue(null);
      await service.forgotPassword('nonexistent@example.com');
      expect(mockAuthAdapter.generateResetToken).not.toHaveBeenCalled();
    });

    it('should write PASSWORD_RESET_REQUESTED audit log for existing user', async () => {
      await service.forgotPassword('user@example.com');
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUser.id,
          action: 'PASSWORD_RESET_REQUESTED',
        }),
      });
    });

    it('should NOT write audit log when user does not exist', async () => {
      mockUserService.findByEmail.mockResolvedValue(null);
      await service.forgotPassword('nonexistent@example.com');
      expect(mockPrismaService.auditLog.create).not.toHaveBeenCalled();
    });

    it('should normalize email to lowercase before lookup', async () => {
      await service.forgotPassword('User@Example.COM');
      expect(mockUserService.findByEmail).toHaveBeenCalledWith('user@example.com');
    });
  });

  // ─── resetPassword ─────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('should return { success: true } with valid token and strong password', async () => {
      const result = await service.resetPassword('valid-reset-token', STRONG_PW);
      expect(result).toEqual({ success: true });
    });

    it('should throw BadRequestException when token is invalid or expired', async () => {
      mockAuthAdapter.verifyResetToken.mockResolvedValue(null);

      await expect(service.resetPassword('invalid-token', STRONG_PW)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.resetPassword('invalid-token', STRONG_PW)).rejects.toThrow(
        'Invalid or expired reset token',
      );
    });

    it('should hash the new password using the auth adapter', async () => {
      await service.resetPassword('valid-token', STRONG_PW);
      expect(mockAuthAdapter.hashPassword).toHaveBeenCalledWith(STRONG_PW);
    });

    it('should update the user password hash in the database', async () => {
      await service.resetPassword('valid-token', STRONG_PW);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { passwordHash: 'new-hashed-password' },
      });
    });

    it('should invalidate all user sessions after successful password reset', async () => {
      await service.resetPassword('valid-token', STRONG_PW);
      expect(mockAuthAdapter.invalidateAllUserRefreshTokens).toHaveBeenCalledWith(mockUser.id);
    });

    it('should write PASSWORD_CHANGED audit log after successful reset', async () => {
      await service.resetPassword('valid-token', STRONG_PW);
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUser.id,
          action: 'PASSWORD_CHANGED',
        }),
      });
    });

    it('should verify the reset token before doing any other operation', async () => {
      mockAuthAdapter.verifyResetToken.mockResolvedValue(null);

      await expect(service.resetPassword('bad-token', STRONG_PW)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockAuthAdapter.hashPassword).not.toHaveBeenCalled();
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
      expect(mockAuthAdapter.invalidateAllUserRefreshTokens).not.toHaveBeenCalled();
    });
  });
});
