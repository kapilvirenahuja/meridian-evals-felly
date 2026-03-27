import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { AUTH_ADAPTER_TOKEN } from '../common/constants';
import { IAuthAdapter } from './adapters/auth-adapter.interface';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    @Inject(AUTH_ADAPTER_TOKEN) private readonly authAdapter: IAuthAdapter,
    private readonly prisma: PrismaService,
  ) {}

  async register(
    dto: RegisterDto,
    clientIp: string,
  ): Promise<{ userId: string; email: string; verificationToken: string }> {
    dto.email = dto.email.toLowerCase();

    const passwordHash = await this.authAdapter.hashPassword(dto.password);

    try {
      const { user } = await this.userService.createUserWithMenteeProfile({
        email: dto.email,
        passwordHash,
      });

      const verificationToken = await this.authAdapter.generateEmailVerificationToken(user.id);

      const ipHash = crypto
        .createHash('sha256')
        .update(clientIp || '0.0.0.0')
        .digest('hex');

      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'USER_REGISTERED',
          metadata: { role: 'MENTEE' },
          ipAddressHash: ipHash,
        },
      });

      return {
        userId: user.id,
        email: user.email,
        verificationToken,
      };
    } catch (error: unknown) {
      if (
        error !== null &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException('Email already in use');
      }
      throw error;
    }
  }

  async verifyEmail(token: string): Promise<{ success: boolean }> {
    const userId = await this.authAdapter.verifyEmailToken(token);
    if (!userId) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE' },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'EMAIL_VERIFIED',
      },
    });

    return { success: true };
  }

  async socialLogin(
    provider: 'google' | 'apple',
  ): Promise<{ userId: string; email: string; accessToken: string; refreshToken: string }> {
    const mockEmail = `stub-${provider}-${Date.now()}@mock.felly.club`;
    const result = await this.authAdapter.getSocialLoginUser(provider, mockEmail);
    return {
      userId: result.userId,
      email: result.email,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    };
  }
}
