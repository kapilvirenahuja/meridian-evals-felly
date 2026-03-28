import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { UserRepository } from './user.repository';
import { MarketplaceSearchService } from '../marketplace/marketplace.search.service';

interface CreateUserData {
  email: string;
  passwordHash: string;
}

interface UpdateProfileData {
  bio?: string;
  interests?: string[];
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  headline?: string;
  expertiseCategories?: string[];
  yearsOfExperience?: number;
  linkedinUrl?: string;
  hourlyRate?: number;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly userRepository: UserRepository,
    @Optional() private readonly marketplaceSearchService?: MarketplaceSearchService,
  ) {}

  async createUserWithMenteeProfile(data: CreateUserData) {
    return this.userRepository.createUserWithMenteeProfile(data);
  }

  async findByEmail(email: string) {
    return this.userRepository.findByEmail(email);
  }

  async findById(id: string) {
    return this.userRepository.findById(id);
  }

  async getMe(userId: string) {
    const user = await this.userRepository.findUserWithProfile(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  // ─── F1.6: Profile management ─────────────────────────────────────────────

  async updateProfile(userId: string, data: UpdateProfileData) {
    const user = await this.userRepository.findUserWithProfile(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === 'MENTEE') {
      return this.userRepository.updateMenteeProfile(userId, {
        bio: data.bio,
        interests: data.interests,
        firstName: data.firstName,
        lastName: data.lastName,
        avatarUrl: data.avatarUrl,
      });
    }

    // MENTOR — cannot change status/verifiedBadge (INV-03)
    const updated = await this.userRepository.updateMentorProfile(userId, {
      headline: data.headline,
      bio: data.bio,
      expertiseCategories: data.expertiseCategories,
      yearsOfExperience: data.yearsOfExperience,
      linkedinUrl: data.linkedinUrl,
      hourlyRate: data.hourlyRate,
      firstName: data.firstName,
      lastName: data.lastName,
      avatarUrl: data.avatarUrl,
    });

    // E2: Fire-and-forget index sync (INV-E2-05)
    if (this.marketplaceSearchService && updated.profile) {
      const profileId = (updated.profile as { id: string }).id;
      void this.marketplaceSearchService
        .updateMentorInIndex(profileId)
        .catch((e: unknown) => this.logger.error(e));
    }

    return updated;
  }

  async getUserProfile(requesterId: string, targetUserId: string, requesterRole: string) {
    // Only admin or the user themselves can access the profile (INV-01 / domain rule)
    if (requesterRole !== 'ADMIN' && requesterId !== targetUserId) {
      throw new ForbiddenException('Cannot access another user profile');
    }

    const user = await this.userRepository.findUserWithProfile(targetUserId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}
