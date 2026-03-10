import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { REDIS_CLIENT } from '@/redis/redis.constants';
import Redis from 'ioredis';

const CHECK_TIMEOUT_MS = 3000;

@Injectable()
export class RedisHealthIndicator {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await Promise.race([
        this.redis.ping(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Redis health check timed out')),
            CHECK_TIMEOUT_MS,
          ),
        ),
      ]);
      return { [key]: { status: 'up' } };
    } catch {
      throw new HealthCheckError('Redis check failed', {
        [key]: { status: 'down' },
      });
    }
  }
}
