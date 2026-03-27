import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { IAuthTokens } from '@felly/shared-types';
import {
  BCRYPT_ROUNDS,
  EMAIL_VERIFICATION_TTL_MS,
  JWT_ACCESS_EXPIRY,
  JWT_AUDIENCE,
  JWT_ISSUER,
  JWT_REFRESH_EXPIRY,
} from '../../common/constants';
import { IAuthAdapter } from './auth-adapter.interface';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

interface EmailVerificationEntry {
  userId: string;
  expiresAt: Date;
}

@Injectable()
export class MockAuthAdapter implements IAuthAdapter {
  private readonly emailVerificationTokens = new Map<string, EmailVerificationEntry>();

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async generateAuthTokens(userId: string, email: string, roles: string[]): Promise<IAuthTokens> {
    const secret = process.env['JWT_SECRET'] || 'mock-secret';

    const payload: Omit<JwtPayload, 'exp' | 'iat'> = {
      sub: userId,
      email,
      realm_access: { roles },
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE,
    };

    const accessToken = jwt.sign(payload, secret, { expiresIn: JWT_ACCESS_EXPIRY });
    const refreshToken = jwt.sign({ sub: userId }, secret, { expiresIn: JWT_REFRESH_EXPIRY });

    return { accessToken, refreshToken };
  }

  async validateToken(token: string): Promise<JwtPayload | null> {
    try {
      const secret = process.env['JWT_SECRET'] || 'mock-secret';
      const payload = jwt.verify(token, secret) as JwtPayload;
      return payload;
    } catch {
      return null;
    }
  }

  async generateEmailVerificationToken(userId: string): Promise<string> {
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
    this.emailVerificationTokens.set(token, { userId, expiresAt });
    return token;
  }

  async verifyEmailToken(token: string): Promise<string | null> {
    const entry = this.emailVerificationTokens.get(token);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt < new Date()) {
      this.emailVerificationTokens.delete(token);
      return null;
    }
    this.emailVerificationTokens.delete(token);
    return entry.userId;
  }

  async getSocialLoginUser(
    provider: 'google' | 'apple',
    mockEmail: string,
  ): Promise<{ userId: string; email: string; tokens: IAuthTokens }> {
    const userId = uuidv4();
    const email = mockEmail || `stub-${provider}-${Date.now()}@mock.felly.club`;
    const tokens = await this.generateAuthTokens(userId, email, ['MENTEE']);
    return { userId, email, tokens };
  }
}
