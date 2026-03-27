import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRepository } from '../user.repository';

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
  userId: 'user-uuid-1',
  interests: [],
  bio: null,
  completeness: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UserRepository', () => {
  let repository: UserRepository;
  let mockTx: {
    user: { create: jest.Mock };
    menteeProfile: { create: jest.Mock };
  };
  let mockPrismaService: {
    $transaction: jest.Mock;
    user: { findUnique: jest.Mock };
  };

  beforeEach(async () => {
    mockTx = {
      user: { create: jest.fn().mockResolvedValue(mockUser) },
      menteeProfile: { create: jest.fn().mockResolvedValue(mockMenteeProfile) },
    };

    mockPrismaService = {
      $transaction: jest
        .fn()
        .mockImplementation((callback: (tx: typeof mockTx) => Promise<unknown>) =>
          callback(mockTx),
        ),
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UserRepository, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    repository = module.get<UserRepository>(UserRepository);
  });

  describe('createUserWithMenteeProfile', () => {
    it('should create user and mentee profile in a transaction', async () => {
      const data = { email: 'test@example.com', passwordHash: 'hashed' };
      const result = await repository.createUserWithMenteeProfile(data);

      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ user: mockUser, menteeProfile: mockMenteeProfile });
    });

    it('should create user with correct data', async () => {
      const data = { email: 'test@example.com', passwordHash: 'hashed-pw' };
      await repository.createUserWithMenteeProfile(data);

      expect(mockTx.user.create).toHaveBeenCalledWith({
        data: {
          email: data.email,
          passwordHash: data.passwordHash,
          role: 'MENTEE',
          status: 'PENDING_EMAIL_VERIFICATION',
        },
      });
    });

    it('should create mentee profile with empty defaults', async () => {
      await repository.createUserWithMenteeProfile({
        email: 'test@example.com',
        passwordHash: 'hashed',
      });

      expect(mockTx.menteeProfile.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          interests: [],
          completeness: 0,
        },
      });
    });

    it('should propagate P2002 error from transaction', async () => {
      const prismaError = { code: 'P2002', message: 'Unique constraint failed' };
      mockPrismaService.$transaction.mockRejectedValue(prismaError);

      await expect(
        repository.createUserWithMenteeProfile({ email: 'dup@test.com', passwordHash: 'x' }),
      ).rejects.toEqual(prismaError);
    });
  });

  describe('findByEmail', () => {
    it('should return user when found by email', async () => {
      const result = await repository.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null when user email not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      const result = await repository.findByEmail('notfound@example.com');

      expect(result).toBeNull();
    });

    it('should normalize email to lowercase before querying', async () => {
      await repository.findByEmail('TEST@EXAMPLE.COM');

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });
  });

  describe('findById', () => {
    it('should return user when found by id', async () => {
      const result = await repository.findById('user-uuid-1');

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
      });
    });

    it('should return null when user id not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      const result = await repository.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });
});
