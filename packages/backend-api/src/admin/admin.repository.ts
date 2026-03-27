import { Injectable } from '@nestjs/common';
import { ArtefactType, ExpertiseCategory, MentorProfileStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMentorDto } from './dto/create-mentor.dto';

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
}
