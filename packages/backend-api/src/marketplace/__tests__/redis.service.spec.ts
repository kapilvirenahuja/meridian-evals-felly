import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../redis.service';

// ─── Variable indirection for test data ───────────────────────────────────────
const CACHE_KEY = 'test:key';
const CACHE_VALUE = JSON.stringify({ data: 'test-value' });
const CACHE_TTL = 60;

// ─── ioredis mock ─────────────────────────────────────────────────────────────
const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
const mockRedisDel = jest.fn();
const mockRedisScan = jest.fn();
const mockRedisQuit = jest.fn();
const mockRedisOn = jest.fn();

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: mockRedisGet,
    set: mockRedisSet,
    del: mockRedisDel,
    scan: mockRedisScan,
    quit: mockRedisQuit,
    on: mockRedisOn,
  }));
});

describe('RedisService', () => {
  let service: RedisService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Enable Redis for most tests
    process.env['REDIS_URL'] = 'redis://localhost:6379';

    const module: TestingModule = await Test.createTestingModule({
      providers: [RedisService],
    }).compile();

    service = module.get<RedisService>(RedisService);
    service.onModuleInit();
  });

  afterEach(() => {
    delete process.env['REDIS_URL'];
  });

  describe('get', () => {
    it('returns cached value when key exists', async () => {
      mockRedisGet.mockResolvedValue(CACHE_VALUE);

      const result = await service.get(CACHE_KEY);

      expect(result).toBe(CACHE_VALUE);
      expect(mockRedisGet).toHaveBeenCalledWith(CACHE_KEY);
    });

    it('returns null when key does not exist', async () => {
      mockRedisGet.mockResolvedValue(null);

      const result = await service.get(CACHE_KEY);

      expect(result).toBeNull();
    });

    it('returns null and does not throw on Redis error', async () => {
      mockRedisGet.mockRejectedValue(new Error('Connection refused'));

      const result = await service.get(CACHE_KEY);

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('sets a key with TTL', async () => {
      mockRedisSet.mockResolvedValue('OK');

      await service.set(CACHE_KEY, CACHE_VALUE, CACHE_TTL);

      expect(mockRedisSet).toHaveBeenCalledWith(CACHE_KEY, CACHE_VALUE, 'EX', CACHE_TTL);
    });

    it('does not throw on Redis error', async () => {
      mockRedisSet.mockRejectedValue(new Error('Connection refused'));

      await expect(service.set(CACHE_KEY, CACHE_VALUE, CACHE_TTL)).resolves.not.toThrow();
    });
  });

  describe('del', () => {
    it('deletes a key', async () => {
      mockRedisDel.mockResolvedValue(1);

      await service.del(CACHE_KEY);

      expect(mockRedisDel).toHaveBeenCalledWith(CACHE_KEY);
    });

    it('does not throw on Redis error', async () => {
      mockRedisDel.mockRejectedValue(new Error('Connection refused'));

      await expect(service.del(CACHE_KEY)).resolves.not.toThrow();
    });
  });

  describe('delPattern', () => {
    it('scans and deletes matching keys', async () => {
      // First scan: returns some keys, next cursor is '0' (done)
      mockRedisScan.mockResolvedValue([
        '0',
        ['marketplace:categories:counts', 'marketplace:mentors:search:abc'],
      ]);
      mockRedisDel.mockResolvedValue(2);

      await service.delPattern('marketplace:*');

      expect(mockRedisScan).toHaveBeenCalled();
      expect(mockRedisDel).toHaveBeenCalledWith(
        'marketplace:categories:counts',
        'marketplace:mentors:search:abc',
      );
    });

    it('does not throw on Redis error', async () => {
      mockRedisScan.mockRejectedValue(new Error('Connection refused'));

      await expect(service.delPattern('marketplace:*')).resolves.not.toThrow();
    });
  });

  describe('graceful degradation (no REDIS_URL)', () => {
    it('returns null for get when Redis is disabled', async () => {
      delete process.env['REDIS_URL'];

      const module: TestingModule = await Test.createTestingModule({
        providers: [RedisService],
      }).compile();

      const svc = module.get<RedisService>(RedisService);
      svc.onModuleInit(); // No Redis client created

      const result = await svc.get(CACHE_KEY);
      expect(result).toBeNull();

      // set/del/delPattern should not throw
      await expect(svc.set(CACHE_KEY, CACHE_VALUE, CACHE_TTL)).resolves.not.toThrow();
      await expect(svc.del(CACHE_KEY)).resolves.not.toThrow();
      await expect(svc.delPattern('*')).resolves.not.toThrow();
    });
  });
});
