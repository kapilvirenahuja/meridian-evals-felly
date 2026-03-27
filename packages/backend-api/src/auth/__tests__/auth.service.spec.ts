import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AUTH_ADAPTER_TOKEN } from '../../common/constants';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../../user/user.service';
import { IAuthAdapter } from '../adapters/auth-adapter.interface';
import { AuthService } from '../auth.service';
import { RegisterDto } from '../dto/register.dto';

const mockUser = {
  id: 'user-uuid-1',
  email: 'test@example.com',
  passwordHash: 'hashed-password',
  role: 'MENTEE',
  status: 'PENDING_EMAIL_VERIFICATION',
  firstName: null,
  lastName: null,
  avatarUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockMenteeProfile = {
  id: 'profile-uuid-1',
  userId: mockUser.id,
  interests: [],
  bio: null,
  completeness: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AuthService', () => {
  let service: AuthService;
  let mockUserService: {
    createUserWithMenteeProfile: jest.Mock;
    findByEmail?: jest.Mock;
    findById?: jest.Mock;
  };
  let mockAuthAdapter: jest.Mocked<IAuthAdapter>;
  let mockPrismaService: {
    auditLog: { create: jest.Mock };
    user: { update: jest.Mock };
  };

  beforeEach(async () => {
    mockUserService = {
      createUserWithMenteeProfile: jest.fn().mockResolvedValue({
        user: mockUser,
        menteeProfile: mockMenteeProfile,
      }),
    };

    mockAuthAdapter = {
      hashPassword: jest.fn().mockResolvedValue('hashed-password'),
      verifyPassword: jest.fn().mockResolvedValue(true),
      generateAuthTokens: jest.fn().mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
      validateToken: jest.fn().mockResolvedValue(null),
      generateEmailVerificationToken: jest.fn().mockResolvedValue('verification-token-uuid'),
      verifyEmailToken: jest.fn().mockResolvedValue(mockUser.id),
      getSocialLoginUser: jest.fn().mockResolvedValue({
        userId: mockUser.id,
        email: mockUser.email,
        tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
      }),
    };

    mockPrismaService = {
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-uuid' }) },
      user: {
        update: jest.fn().mockResolvedValue({ ...mockUser, status: 'ACTIVE' }),
      },
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

  describe('register', () => {
    const dto: RegisterDto = {
      email: 'test@example.com',
      password: 'Password1',
    };

    it('should register a new user and return userId, email, and verificationToken', async () => {
      const result = await service.register(dto, '127.0.0.1');

      expect(result).toEqual({
        userId: mockUser.id,
        email: mockUser.email,
        verificationToken: 'verification-token-uuid',
      });
    });

    it('should hash the password before creating the user', async () => {
      await service.register(dto, '127.0.0.1');

      expect(mockAuthAdapter.hashPassword).toHaveBeenCalledWith(dto.password);
      expect(mockUserService.createUserWithMenteeProfile).toHaveBeenCalledWith({
        email: dto.email,
        passwordHash: 'hashed-password',
      });
    });

    it('should create user and mentee profile atomically via UserService', async () => {
      await service.register(dto, '127.0.0.1');

      expect(mockUserService.createUserWithMenteeProfile).toHaveBeenCalledTimes(1);
      expect(mockUserService.createUserWithMenteeProfile).toHaveBeenCalledWith({
        email: dto.email,
        passwordHash: 'hashed-password',
      });
    });

    it('should generate an email verification token after user creation', async () => {
      await service.register(dto, '127.0.0.1');

      expect(mockAuthAdapter.generateEmailVerificationToken).toHaveBeenCalledWith(mockUser.id);
    });

    it('should write USER_REGISTERED audit log with hashed IP', async () => {
      await service.register(dto, '192.168.1.1');

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUser.id,
          action: 'USER_REGISTERED',
          metadata: { role: 'MENTEE' },
          ipAddressHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      });
    });

    it('should never store raw IP address — only SHA-256 hash', async () => {
      const clientIp = '10.0.0.1';
      await service.register(dto, clientIp);

      const createCall = mockPrismaService.auditLog.create.mock.calls[0][0];
      expect(createCall.data.ipAddressHash).not.toBe(clientIp);
      expect(createCall.data.ipAddressHash).toHaveLength(64); // SHA-256 hex
    });

    it('should throw ConflictException when email already exists (P2002)', async () => {
      const prismaError = { code: 'P2002', message: 'Unique constraint failed' };
      mockUserService.createUserWithMenteeProfile.mockRejectedValue(prismaError);

      await expect(service.register(dto, '127.0.0.1')).rejects.toThrow(ConflictException);
      await expect(service.register(dto, '127.0.0.1')).rejects.toThrow('Email already in use');
    });

    it('should re-throw non-P2002 Prisma errors', async () => {
      const genericError = new Error('Unexpected database error');
      mockUserService.createUserWithMenteeProfile.mockRejectedValue(genericError);

      await expect(service.register(dto, '127.0.0.1')).rejects.toThrow('Unexpected database error');
    });

    it('should handle missing clientIp gracefully', async () => {
      const result = await service.register(dto, '');

      expect(result.userId).toBe(mockUser.id);
      expect(mockPrismaService.auditLog.create).toHaveBeenCalled();
    });

    it('should normalize email to lowercase before creating user', async () => {
      const dtoMixed: RegisterDto = { email: 'Test@Example.COM', password: 'Password1' };
      await service.register(dtoMixed, '127.0.0.1');

      expect(mockUserService.createUserWithMenteeProfile).toHaveBeenCalledWith({
        email: 'test@example.com',
        passwordHash: 'hashed-password',
      });
    });
  });

  describe('verifyEmail', () => {
    it('should activate user when token is valid', async () => {
      const result = await service.verifyEmail('valid-token');

      expect(result).toEqual({ success: true });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { status: 'ACTIVE' },
      });
    });

    it('should throw BadRequestException when token is invalid', async () => {
      mockAuthAdapter.verifyEmailToken.mockResolvedValue(null);

      await expect(service.verifyEmail('invalid-token')).rejects.toThrow(BadRequestException);
      await expect(service.verifyEmail('invalid-token')).rejects.toThrow(
        'Invalid or expired verification token',
      );
    });

    it('should call verifyEmailToken with the provided token', async () => {
      const token = 'test-token-123';
      await service.verifyEmail(token);

      expect(mockAuthAdapter.verifyEmailToken).toHaveBeenCalledWith(token);
    });

    it('should write EMAIL_VERIFIED audit log', async () => {
      await service.verifyEmail('valid-token');

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          action: 'EMAIL_VERIFIED',
        },
      });
    });

    it('should not update user status when token is invalid', async () => {
      mockAuthAdapter.verifyEmailToken.mockResolvedValue(null);

      await expect(service.verifyEmail('bad-token')).rejects.toThrow();
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });
  });

  describe('socialLogin', () => {
    it('should return tokens for google provider', async () => {
      const result = await service.socialLogin('google');

      expect(result).toEqual({
        userId: mockUser.id,
        email: mockUser.email,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(mockAuthAdapter.getSocialLoginUser).toHaveBeenCalledWith(
        'google',
        expect.stringContaining('stub-google-'),
      );
    });

    it('should return tokens for apple provider', async () => {
      const result = await service.socialLogin('apple');

      expect(mockAuthAdapter.getSocialLoginUser).toHaveBeenCalledWith(
        'apple',
        expect.stringContaining('stub-apple-'),
      );
      expect(result.accessToken).toBe('access-token');
    });
  });
});
