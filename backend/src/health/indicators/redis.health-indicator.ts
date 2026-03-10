import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { REDIS_CLIENT } from '@/redis/redis.constants';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.redis.ping();
      return { [key]: { status: 'up' } };
    } catch {
      throw new HealthCheckError('Redis check failed', {
        [key]: { status: 'down' },
      });
    }
  }
}
