import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private readonly enabled: boolean;

  constructor() {
    this.enabled = !!process.env['REDIS_URL'];
  }

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.warn('REDIS_URL not set — cache disabled (graceful degradation)');
      return;
    }

    const redisUrl = process.env['REDIS_URL'] as string;
    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
    });

    this.client.on('error', (err: Error) => {
      this.logger.error('Redis connection error', err.message);
    });

    this.logger.log('Redis client initialized');
  }

  onModuleDestroy(): void {
    if (this.client) {
      void this.client.quit();
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    try {
      return await this.client.get(key);
    } catch (err) {
      this.logger.error(`Redis get error for key ${key}`, err);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } catch (err) {
      this.logger.error(`Redis set error for key ${key}`, err);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.del(key);
    } catch (err) {
      this.logger.error(`Redis del error for key ${key}`, err);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    if (!this.client) return;
    try {
      let cursor = '0';
      do {
        const result = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = result[0];
        const keys = result[1];
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== '0');
    } catch (err) {
      this.logger.error(`Redis delPattern error for pattern ${pattern}`, err);
    }
  }
}
