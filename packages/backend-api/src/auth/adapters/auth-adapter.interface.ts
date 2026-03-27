import { IAuthTokens } from '@felly/shared-types';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

export interface IAuthAdapter {
  hashPassword(password: string): Promise<string>;
  verifyPassword(password: string, hash: string): Promise<boolean>;
  generateAuthTokens(userId: string, email: string, roles: string[]): Promise<IAuthTokens>;
  validateToken(token: string): Promise<JwtPayload | null>;
  generateEmailVerificationToken(userId: string): Promise<string>;
  verifyEmailToken(token: string): Promise<string | null>;
  getSocialLoginUser(
    provider: 'google' | 'apple',
    mockEmail: string,
  ): Promise<{ userId: string; email: string; tokens: IAuthTokens }>;

  // F1.2: Rate limiting
  checkRateLimit(ipHash: string): boolean;
  recordFailedLogin(ipHash: string): void;
  clearFailedLogins(ipHash: string): void;

  // F1.2: Refresh token invalidation
  isRefreshTokenInvalidated(refreshToken: string): boolean;
  invalidateRefreshToken(refreshToken: string): void;
}
