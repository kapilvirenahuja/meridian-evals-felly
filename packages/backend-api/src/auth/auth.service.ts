import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { AUTH_ADAPTER_TOKEN } from '../common/constants';
import { IAuthAdapter } from './adapters/auth-adapter.interface';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

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

  async login(
    dto: LoginDto,
    clientIp: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    dto.email = dto.email.toLowerCase();

    const ipHash = crypto
      .createHash('sha256')
      .update(clientIp || '0.0.0.0')
      .digest('hex');

    // Check rate limit before any DB operation
    if (this.authAdapter.checkRateLimit(ipHash)) {
      throw new HttpException(
        'Too many login attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Find user and verify credentials
    const user = await this.userService.findByEmail(dto.email);
    const passwordValid =
      user !== null &&
      user.passwordHash !== null &&
      (await this.authAdapter.verifyPassword(dto.password, user.passwordHash));

    if (!user || !passwordValid) {
      this.authAdapter.recordFailedLogin(ipHash);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check email verification status
    if (user.status === 'PENDING_EMAIL_VERIFICATION') {
      throw new ForbiddenException('Email not verified');
    }

    // Clear rate limit on success
    this.authAdapter.clearFailedLogins(ipHash);

    // Generate tokens
    const tokens = await this.authAdapter.generateAuthTokens(user.id, user.email, [user.role]);

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_LOGGED_IN',
        ipAddressHash: ipHash,
      },
    });

    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  async logout(refreshToken: string, clientIp: string): Promise<void> {
    // Decode token to get userId for audit log (best-effort)
    const payload = await this.authAdapter.validateToken(refreshToken);

    // Always invalidate the refresh token
    this.authAdapter.invalidateRefreshToken(refreshToken);

    if (payload?.sub) {
      const ipHash = crypto
        .createHash('sha256')
        .update(clientIp || '0.0.0.0')
        .digest('hex');

      await this.prisma.auditLog.create({
        data: {
          userId: payload.sub,
          action: 'USER_LOGGED_OUT',
          ipAddressHash: ipHash,
        },
      });
    }
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    // Validate the token signature and expiry
    const payload = await this.authAdapter.validateToken(refreshToken);
    if (!payload) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Check if it has been invalidated (e.g. by logout)
    if (this.authAdapter.isRefreshTokenInvalidated(refreshToken)) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Fetch current user data for up-to-date roles
    const user = await this.userService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate: invalidate old refresh token, issue new pair
    this.authAdapter.invalidateRefreshToken(refreshToken);
    const tokens = await this.authAdapter.generateAuthTokens(user.id, user.email, [user.role]);

    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  async getMe(
    userId: string,
  ): Promise<{ id: string; email: string; role: string; status: string }> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    };
  }
}
