import { Injectable } from '@nestjs/common';
import { ExpertiseCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface CreateUserData {
  email: string;
  passwordHash: string;
}

interface UpdateMenteeProfileData {
  bio?: string;
  interests?: string[];
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

interface UpdateMentorProfileData {
  headline?: string;
  bio?: string;
  expertiseCategories?: string[];
  yearsOfExperience?: number;
  linkedinUrl?: string;
  hourlyRate?: number;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createUserWithMenteeProfile(data: CreateUserData) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          passwordHash: data.passwordHash,
          role: 'MENTEE',
          status: 'PENDING_EMAIL_VERIFICATION',
        },
      });

      const menteeProfile = await tx.menteeProfile.create({
        data: {
          userId: user.id,
          interests: [],
          completeness: 0,
        },
      });

      return { user, menteeProfile };
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  // ─── F1.6: Profile management ─────────────────────────────────────────────

  async findUserWithProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        menteeProfile: true,
        mentorProfile: {
          select: {
            id: true,
            userId: true,
            status: true,
            headline: true,
            bio: true,
            expertiseCategories: true,
            yearsOfExperience: true,
            linkedinUrl: true,
            hourlyRate: true,
            completeness: true,
            verifiedBadge: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!user) return null;

    // Determine profile and recalculate completeness
    if (user.role === 'MENTEE' && user.menteeProfile) {
      const profile = user.menteeProfile;
      const completeness = this.calculateMenteeCompleteness(profile);
      return {
        ...user,
        profile: { ...profile, completeness },
        menteeProfile: undefined,
        mentorProfile: undefined,
      };
    }

    if (user.role === 'MENTOR' && user.mentorProfile) {
      const profile = user.mentorProfile;
      const completeness = this.calculateMentorCompleteness(profile);
      return {
        ...user,
        profile: { ...profile, completeness },
        menteeProfile: undefined,
        mentorProfile: undefined,
      };
    }

    return { ...user, profile: null, menteeProfile: undefined, mentorProfile: undefined };
  }

  async updateMenteeProfile(userId: string, data: UpdateMenteeProfileData) {
    const { bio, interests, firstName, lastName, avatarUrl } = data;

    return this.prisma.$transaction(async (tx) => {
      // Update user fields if provided
      if (firstName !== undefined || lastName !== undefined || avatarUrl !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(firstName !== undefined && { firstName }),
            ...(lastName !== undefined && { lastName }),
            ...(avatarUrl !== undefined && { avatarUrl }),
          },
        });
      }

      // Build mentee profile update data
      const profileData: {
        bio?: string | null;
        interests?: ExpertiseCategory[];
        completeness?: number;
      } = {};
      if (bio !== undefined) profileData.bio = bio;
      if (interests !== undefined) profileData.interests = interests as ExpertiseCategory[];

      // Recalculate completeness
      const existingProfile = await tx.menteeProfile.findUnique({ where: { userId } });
      const mergedBio = bio !== undefined ? bio : existingProfile?.bio;
      const mergedInterests =
        interests !== undefined ? interests : existingProfile?.interests || [];
      profileData.completeness = this.calculateMenteeCompleteness({
        bio: mergedBio ?? null,
        interests: mergedInterests as ExpertiseCategory[],
      });

      const updatedProfile = await tx.menteeProfile.update({
        where: { userId },
        data: profileData,
      });

      const updatedUser = await tx.user.findUnique({ where: { id: userId } });

      return {
        ...updatedUser,
        profile: updatedProfile,
        menteeProfile: undefined,
        mentorProfile: undefined,
      };
    });
  }

  async updateMentorProfile(userId: string, data: UpdateMentorProfileData) {
    const {
      headline,
      bio,
      expertiseCategories,
      yearsOfExperience,
      linkedinUrl,
      hourlyRate,
      firstName,
      lastName,
      avatarUrl,
    } = data;

    return this.prisma.$transaction(async (tx) => {
      // Update user fields if provided
      if (firstName !== undefined || lastName !== undefined || avatarUrl !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(firstName !== undefined && { firstName }),
            ...(lastName !== undefined && { lastName }),
            ...(avatarUrl !== undefined && { avatarUrl }),
          },
        });
      }

      // Build mentor profile update data (cannot change status/verifiedBadge)
      const profileData: Record<string, unknown> = {};
      if (headline !== undefined) profileData.headline = headline;
      if (bio !== undefined) profileData.bio = bio;
      if (expertiseCategories !== undefined)
        profileData.expertiseCategories = expertiseCategories as ExpertiseCategory[];
      if (yearsOfExperience !== undefined) profileData.yearsOfExperience = yearsOfExperience;
      if (linkedinUrl !== undefined) profileData.linkedinUrl = linkedinUrl;
      if (hourlyRate !== undefined) profileData.hourlyRate = hourlyRate;

      // Recalculate completeness
      const existingProfile = await tx.mentorProfile.findUnique({ where: { userId } });
      const mergedFields = {
        headline: headline !== undefined ? headline : existingProfile?.headline,
        bio: bio !== undefined ? bio : existingProfile?.bio,
        expertiseCategories:
          expertiseCategories !== undefined
            ? expertiseCategories
            : existingProfile?.expertiseCategories || [],
        yearsOfExperience:
          yearsOfExperience !== undefined ? yearsOfExperience : existingProfile?.yearsOfExperience,
        linkedinUrl: linkedinUrl !== undefined ? linkedinUrl : existingProfile?.linkedinUrl,
        hourlyRate: hourlyRate !== undefined ? hourlyRate : existingProfile?.hourlyRate,
      };
      profileData.completeness = this.calculateMentorCompleteness(mergedFields);

      const updatedProfile = await tx.mentorProfile.update({
        where: { userId },
        data: profileData as Parameters<typeof tx.mentorProfile.update>[0]['data'],
      });

      const updatedUser = await tx.user.findUnique({ where: { id: userId } });

      return {
        ...updatedUser,
        profile: updatedProfile,
        menteeProfile: undefined,
        mentorProfile: undefined,
      };
    });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private calculateMenteeCompleteness(profile: {
    bio?: string | null;
    interests?: ExpertiseCategory[];
  }): number {
    const optionalFields = [!!profile.bio, (profile.interests?.length ?? 0) > 0];
    const filled = optionalFields.filter(Boolean).length;
    return Math.round((filled / optionalFields.length) * 100);
  }

  private calculateMentorCompleteness(profile: {
    headline?: string | null;
    bio?: string | null;
    expertiseCategories?: string[];
    yearsOfExperience?: number | null;
    linkedinUrl?: string | null;
    hourlyRate?: number | null;
  }): number {
    const optionalFields = [
      !!profile.headline,
      !!profile.bio,
      (profile.expertiseCategories?.length ?? 0) > 0,
      profile.yearsOfExperience !== null && profile.yearsOfExperience !== undefined,
      !!profile.linkedinUrl,
      profile.hourlyRate !== null && profile.hourlyRate !== undefined,
    ];
    const filled = optionalFields.filter(Boolean).length;
    return Math.round((filled / optionalFields.length) * 100);
  }
}
