import { Test, TestingModule } from '@nestjs/testing';
import { UserRepository } from '../user.repository';
import { UserService } from '../user.service';

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

describe('UserService', () => {
  let service: UserService;
  let mockUserRepository: {
    createUserWithMenteeProfile: jest.Mock;
    findByEmail: jest.Mock;
    findById: jest.Mock;
  };

  beforeEach(async () => {
    mockUserRepository = {
      createUserWithMenteeProfile: jest.fn().mockResolvedValue({
        user: mockUser,
        menteeProfile: mockMenteeProfile,
      }),
      findByEmail: jest.fn().mockResolvedValue(mockUser),
      findById: jest.fn().mockResolvedValue(mockUser),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UserService, { provide: UserRepository, useValue: mockUserRepository }],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  describe('createUserWithMenteeProfile', () => {
    it('should delegate to UserRepository and return result', async () => {
      const data = { email: 'test@example.com', passwordHash: 'hashed' };
      const result = await service.createUserWithMenteeProfile(data);

      expect(result).toEqual({ user: mockUser, menteeProfile: mockMenteeProfile });
      expect(mockUserRepository.createUserWithMenteeProfile).toHaveBeenCalledWith(data);
    });

    it('should propagate errors from UserRepository', async () => {
      const error = { code: 'P2002', message: 'Unique constraint failed' };
      mockUserRepository.createUserWithMenteeProfile.mockRejectedValue(error);

      await expect(
        service.createUserWithMenteeProfile({ email: 'dup@example.com', passwordHash: 'x' }),
      ).rejects.toEqual(error);
    });
  });

  describe('findByEmail', () => {
    it('should return user when found', async () => {
      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('should return null when user not found', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      const result = await service.findByEmail('unknown@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return user when found by id', async () => {
      const result = await service.findById(mockUser.id);

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findById).toHaveBeenCalledWith(mockUser.id);
    });

    it('should return null when user id not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      const result = await service.findById('unknown-id');

      expect(result).toBeNull();
    });
  });
});
