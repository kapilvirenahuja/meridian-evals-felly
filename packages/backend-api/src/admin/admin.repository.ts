import { Injectable } from '@nestjs/common';
import {
  ArtefactType,
  ExpertiseCategory,
  MentorProfileStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMentorDto } from './dto/create-mentor.dto';

export interface UserFilters {
  status?: UserStatus;
  role?: UserRole;
  page?: number;
  limit?: number;
}

@Injectable()
export class AdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createMentorWithUser(dto: CreateMentorDto, passwordHash: string, status: string) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          role: 'MENTOR',
          status: 'ACTIVE',
        },
      });

      const mentorProfile = await tx.mentorProfile.create({
        data: {
          userId: user.id,
          bio: dto.bio || null,
          expertiseCategories: (dto.expertiseCategories || []) as ExpertiseCategory[],
          yearsOfExperience: dto.yearsOfExperience || null,
          status: status as MentorProfileStatus,
          completeness: 0,
        },
      });

      if (dto.pricingTiers && dto.pricingTiers.length > 0) {
        await tx.mentorPricingTier.createMany({
          data: dto.pricingTiers.map((tier) => ({
            mentorProfileId: mentorProfile.id,
            name: tier.name,
            priceInCents: tier.priceInCents,
            durationMinutes: tier.durationMinutes,
          })),
        });
      }

      return { user, mentorProfile };
    });
  }

  async findMentorProfileById(id: string) {
    return this.prisma.mentorProfile.findUnique({ where: { id } });
  }

  async createArtefact(mentorProfileId: string, type: string, value: string) {
    return this.prisma.verificationArtefact.create({
      data: {
        mentorProfileId,
        type: type as ArtefactType,
        value,
      },
    });
  }

  // ─── F1.5: Verification queue ─────────────────────────────────────────────

  async findPendingVerificationProfiles() {
    return this.prisma.mentorProfile.findMany({
      where: { status: 'PENDING_VERIFICATION' as MentorProfileStatus },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
  }

  async approveMentor(id: string) {
    return this.prisma.mentorProfile.update({
      where: { id },
      data: {
        status: 'VERIFIED' as MentorProfileStatus,
        verifiedBadge: true,
      },
    });
  }

  async rejectMentor(id: string, reason: string) {
    return this.prisma.mentorProfile.update({
      where: { id },
      data: {
        status: 'REJECTED' as MentorProfileStatus,
        rejectionReason: reason,
      },
    });
  }

  async resubmitMentor(id: string) {
    return this.prisma.mentorProfile.update({
      where: { id },
      data: {
        status: 'PENDING_VERIFICATION' as MentorProfileStatus,
        rejectionReason: null,
      },
    });
  }

  // ─── F1.6: User management ────────────────────────────────────────────────

  async findAllUsers(filters: UserFilters) {
    const { status, role, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: { status?: UserStatus; role?: UserRole } = {};
    if (status) where.status = status;
    if (role) where.role = role;

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total, page, limit };
  }
}
