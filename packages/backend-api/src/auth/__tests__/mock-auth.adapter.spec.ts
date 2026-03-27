import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { MockAuthAdapter } from '../adapters/mock-auth.adapter';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$12$mocked.hashed.password'),
  compare: jest.fn().mockResolvedValue(true),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
  verify: jest.fn().mockReturnValue({
    sub: 'user-uuid',
    email: 'test@example.com',
    realm_access: { roles: ['MENTEE'] },
    iss: 'felly-club-mock',
    aud: 'felly-club-api',
    exp: 9999999999,
    iat: 1000000000,
  }),
}));

jest.mock('uuid', () => ({
  v4: jest
    .fn()
    .mockReturnValueOnce('token-uuid-1')
    .mockReturnValueOnce('user-stub-uuid-1')
    .mockReturnValue('fallback-uuid'),
}));

describe('MockAuthAdapter', () => {
  let adapter: MockAuthAdapter;

  beforeEach(() => {
    adapter = new MockAuthAdapter();
    jest.clearAllMocks();
    (jest.requireMock('uuid') as { v4: jest.Mock }).v4
      .mockReturnValueOnce('token-uuid-1')
      .mockReturnValueOnce('user-stub-uuid-1')
      .mockReturnValue('fallback-uuid');
  });

  describe('hashPassword', () => {
    it('should return a bcrypt hash', async () => {
      const result = await adapter.hashPassword('Password1');

      expect(bcrypt.hash).toHaveBeenCalledWith('Password1', 12);
      expect(result).toBe('$2b$12$mocked.hashed.password');
    });
  });

  describe('verifyPassword', () => {
    it('should return true for correct password', async () => {
      const result = await adapter.verifyPassword('Password1', '$2b$12$hash');

      expect(bcrypt.compare).toHaveBeenCalledWith('Password1', '$2b$12$hash');
      expect(result).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);
      const result = await adapter.verifyPassword('wrong', '$2b$12$hash');

      expect(result).toBe(false);
    });
  });

  describe('generateAuthTokens', () => {
    it('should return accessToken and refreshToken', async () => {
      const result = await adapter.generateAuthTokens('user-id', 'test@example.com', ['MENTEE']);

      expect(result).toEqual({
        accessToken: 'mock.jwt.token',
        refreshToken: 'mock.jwt.token',
      });
      expect(jwt.sign).toHaveBeenCalledTimes(2);
    });

    it('should include correct payload in access token', async () => {
      await adapter.generateAuthTokens('user-123', 'user@test.com', ['MENTEE']);

      const firstCall = (jwt.sign as jest.Mock).mock.calls[0];
      expect(firstCall[0]).toMatchObject({
        sub: 'user-123',
        email: 'user@test.com',
        realm_access: { roles: ['MENTEE'] },
        iss: 'felly-club-mock',
        aud: 'felly-club-api',
      });
    });
  });

  describe('validateToken', () => {
    it('should return decoded payload for valid token', async () => {
      const result = await adapter.validateToken('valid.token');

      expect(jwt.verify).toHaveBeenCalledWith('valid.token', expect.any(String));
      expect(result).toMatchObject({
        sub: 'user-uuid',
        email: 'test@example.com',
      });
    });

    it('should return null for invalid token', async () => {
      (jwt.verify as jest.Mock).mockImplementationOnce(() => {
        throw new Error('invalid token');
      });

      const result = await adapter.validateToken('invalid.token');

      expect(result).toBeNull();
    });

    it('should return null for expired token', async () => {
      (jwt.verify as jest.Mock).mockImplementationOnce(() => {
        throw new Error('jwt expired');
      });

      const result = await adapter.validateToken('expired.token');

      expect(result).toBeNull();
    });
  });

  describe('generateEmailVerificationToken', () => {
    it('should generate a UUID token for the user', async () => {
      const token = await adapter.generateEmailVerificationToken('user-uuid-1');

      expect(token).toBe('token-uuid-1');
    });

    it('should store the token with expiry', async () => {
      const token = await adapter.generateEmailVerificationToken('user-uuid-1');

      // Should be verifiable immediately after generation
      const userId = await adapter.verifyEmailToken(token);
      expect(userId).toBe('user-uuid-1');
    });
  });

  describe('verifyEmailToken', () => {
    it('should return userId for a valid, non-expired token', async () => {
      const token = await adapter.generateEmailVerificationToken('user-uuid-2');
      const userId = await adapter.verifyEmailToken(token);

      expect(userId).toBe('user-uuid-2');
    });

    it('should return null for an unknown token', async () => {
      const userId = await adapter.verifyEmailToken('unknown-token');

      expect(userId).toBeNull();
    });

    it('should invalidate token after use (one-time use)', async () => {
      const freshAdapter = new MockAuthAdapter();
      (jest.requireMock('uuid') as { v4: jest.Mock }).v4.mockReturnValue('one-time-token');

      const token = await freshAdapter.generateEmailVerificationToken('uid-1');
      await freshAdapter.verifyEmailToken(token);

      // Second use should return null
      const secondUse = await freshAdapter.verifyEmailToken(token);
      expect(secondUse).toBeNull();
    });

    it('should return null for an expired token', async () => {
      jest.useFakeTimers();

      const freshAdapter = new MockAuthAdapter();
      (jest.requireMock('uuid') as { v4: jest.Mock }).v4.mockReturnValue('expired-token-v4');

      const token = await freshAdapter.generateEmailVerificationToken('uid-expired');

      // Advance time by 25 hours past the 24h TTL
      jest.advanceTimersByTime(25 * 60 * 60 * 1000);

      const result = await freshAdapter.verifyEmailToken(token);

      jest.useRealTimers();
      expect(result).toBeNull();
    });
  });

  describe('getSocialLoginUser', () => {
    it('should return userId, email and tokens for google provider', async () => {
      const result = await adapter.getSocialLoginUser('google', 'user@google.com');

      expect(result).toEqual({
        userId: 'user-stub-uuid-1',
        email: 'user@google.com',
        tokens: {
          accessToken: 'mock.jwt.token',
          refreshToken: 'mock.jwt.token',
        },
      });
    });

    it('should return userId, email and tokens for apple provider', async () => {
      const result = await adapter.getSocialLoginUser('apple', 'user@apple.com');

      expect(result).toMatchObject({
        email: 'user@apple.com',
        tokens: expect.objectContaining({ accessToken: 'mock.jwt.token' }),
      });
    });
  });
});
