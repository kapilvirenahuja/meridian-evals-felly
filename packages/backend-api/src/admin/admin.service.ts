import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH_ADAPTER_TOKEN } from '../common/constants';
import { IAuthAdapter } from '../auth/adapters/auth-adapter.interface';
import { AdminRepository } from './admin.repository';
import { CreateMentorDto } from './dto/create-mentor.dto';
import { UploadArtefactDto } from './dto/upload-artefact.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly adminRepository: AdminRepository,
    @Inject(AUTH_ADAPTER_TOKEN) private readonly authAdapter: IAuthAdapter,
    private readonly prisma: PrismaService,
  ) {}

  async createMentor(dto: CreateMentorDto) {
    const passwordHash = await this.authAdapter.hashPassword(dto.password);
    const status = dto.saveDraft ? 'DRAFT' : 'PENDING_VERIFICATION';

    const { user, mentorProfile } = await this.adminRepository.createMentorWithUser(
      dto,
      passwordHash,
      status,
    );

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'MENTOR_APPLICATION_SUBMITTED',
        metadata: { status, createdBy: 'admin' },
      },
    });

    return mentorProfile;
  }

  async uploadArtefact(mentorProfileId: string, dto: UploadArtefactDto) {
    const profile = await this.adminRepository.findMentorProfileById(mentorProfileId);
    if (!profile) {
      throw new NotFoundException('Mentor profile not found');
    }

    return this.adminRepository.createArtefact(mentorProfileId, dto.type, dto.value);
  }
}
