import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH_ADAPTER_TOKEN } from '../common/constants';
import { IAuthAdapter } from '../auth/adapters/auth-adapter.interface';
import { MarketplaceSearchService } from '../marketplace/marketplace.search.service';
import { AdminRepository, UserFilters } from './admin.repository';
import { CreateMentorDto } from './dto/create-mentor.dto';
import { UploadArtefactDto } from './dto/upload-artefact.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly adminRepository: AdminRepository,
    @Inject(AUTH_ADAPTER_TOKEN) private readonly authAdapter: IAuthAdapter,
    private readonly prisma: PrismaService,
    @Optional() private readonly marketplaceSearchService?: MarketplaceSearchService,
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

  // ─── F1.5: Verification queue ─────────────────────────────────────────────

  async getVerificationQueue() {
    return this.adminRepository.findPendingVerificationProfiles();
  }

  async approveMentor(mentorProfileId: string) {
    const profile = await this.adminRepository.findMentorProfileById(mentorProfileId);
    if (!profile) {
      throw new NotFoundException('Mentor profile not found');
    }

    const approved = await this.adminRepository.approveMentor(mentorProfileId);

    await this.prisma.auditLog.create({
      data: {
        userId: profile.userId,
        action: 'MENTOR_APPLICATION_APPROVED',
        metadata: { mentorProfileId, approvedBy: 'admin' },
      },
    });

    // In E1 the credential delivery is mocked — in production this would trigger
    // an email with login credentials via the auth adapter / email service.
    // Mocked: credentials delivered (no-op in E1)

    // E2: Fire-and-forget index sync (INV-E2-05)
    if (this.marketplaceSearchService) {
      void this.marketplaceSearchService
        .indexMentor(mentorProfileId)
        .catch((e: unknown) => this.logger.error(e));
    }

    return approved;
  }

  async rejectMentor(mentorProfileId: string, reason: string) {
    const profile = await this.adminRepository.findMentorProfileById(mentorProfileId);
    if (!profile) {
      throw new NotFoundException('Mentor profile not found');
    }

    const rejected = await this.adminRepository.rejectMentor(mentorProfileId, reason);

    await this.prisma.auditLog.create({
      data: {
        userId: profile.userId,
        action: 'MENTOR_APPLICATION_REJECTED',
        metadata: { mentorProfileId, reason, rejectedBy: 'admin' },
      },
    });

    // E2: Fire-and-forget index sync (INV-E2-05)
    if (this.marketplaceSearchService) {
      void this.marketplaceSearchService
        .removeMentorFromIndex(mentorProfileId)
        .catch((e: unknown) => this.logger.error(e));
    }

    return rejected;
  }

  async resubmitMentor(mentorProfileId: string) {
    const profile = await this.adminRepository.findMentorProfileById(mentorProfileId);
    if (!profile) {
      throw new NotFoundException('Mentor profile not found');
    }

    if (profile.status !== 'REJECTED') {
      throw new ForbiddenException('Only REJECTED profiles can be resubmitted');
    }

    return this.adminRepository.resubmitMentor(mentorProfileId);
  }

  // ─── F1.6: User management ────────────────────────────────────────────────

  async getUsers(filters: UserFilters) {
    return this.adminRepository.findAllUsers(filters);
  }
}
