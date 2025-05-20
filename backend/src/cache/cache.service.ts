import { Injectable } from '@nestjs/common';
import { RedisService } from '@/redis/redis.service';

@Injectable()
export class CacheService {
  constructor(private readonly redisService: RedisService) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redisService.get(key);
    if (value === null) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  async set<T>(
    key: string,
    value: T,
    expireSeconds?: number,
  ): Promise<'OK' | null> {
    const serialized = JSON.stringify(value);
    return this.redisService.set(key, serialized, expireSeconds);
  }

  async del(key: string): Promise<number> {
    return this.redisService.del(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.redisService.expire(key, seconds);
  }

  getClient() {
    return this.redisService.getClient();
  }
}
