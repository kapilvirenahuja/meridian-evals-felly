import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateUserData {
  email: string;
  passwordHash: string;
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
}
