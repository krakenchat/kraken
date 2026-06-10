import { Logger } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';

const FAIL_OPEN_RECORD: ThrottlerStorageRecord = {
  totalHits: 0,
  timeToExpire: 0,
  isBlocked: false,
  timeToBlockExpire: 0,
};

/**
 * Redis-backed throttler storage that fails OPEN: if Redis is unreachable or
 * slow, requests proceed unthrottled instead of erroring/hanging. Rate limiting
 * is a protection layer — its backing store must never become an availability
 * dependency for the whole API.
 *
 * Wraps ThrottlerStorageRedisService (the real implementation) and races each
 * increment() against a configurable timeout. On timeout or error, returns a
 * zero-hit record (fail open) and emits a warning log.
 *
 * Pass a ThrottlerStorageRedisService directly (constructor overload) for tests
 * so the inner service can be mocked without touching Redis.
 */
export class FailOpenThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(FailOpenThrottlerStorage.name);
  private readonly inner: ThrottlerStorageRedisService;
  private readonly timeoutMs: number;

  constructor(inner: ThrottlerStorageRedisService, timeoutMs?: number);
  constructor(redis: Redis, timeoutMs?: number);
  constructor(
    redisOrInner: Redis | ThrottlerStorageRedisService,
    timeoutMs = 1500,
  ) {
    this.timeoutMs = timeoutMs;
    if (redisOrInner instanceof ThrottlerStorageRedisService) {
      this.inner = redisOrInner;
    } else {
      this.inner = new ThrottlerStorageRedisService(redisOrInner);
    }
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error(`Throttler storage timed out after ${this.timeoutMs}ms`)),
        this.timeoutMs,
      );
      // Don't let the pending timeout keep the Node event loop alive after the
      // increment() resolves successfully and clearTimeout() is called.
      timeoutHandle.unref?.();
    });

    try {
      const result = await Promise.race([
        this.inner.increment(key, ttl, limit, blockDuration, throttlerName),
        timeoutPromise,
      ]);
      return result;
    } catch (error) {
      this.logger.warn(
        `Throttler storage unavailable, failing open (request allowed): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return FAIL_OPEN_RECORD;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}
