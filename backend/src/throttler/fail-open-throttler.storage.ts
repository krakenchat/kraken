import { Logger } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import Redis from 'ioredis';

const FAIL_OPEN_RECORD: ThrottlerStorageRecord = {
  totalHits: 0,
  timeToExpire: 0,
  isBlocked: false,
  timeToBlockExpire: 0,
};

const DEFAULT_TIMEOUT_MS = 1500;
const WARN_INTERVAL_MS = 30_000;

export interface FailOpenThrottlerStorageOptions {
  /**
   * Optional Redis client used only for a fast connection-status check: when
   * the client is not 'ready', increment() fails open immediately instead of
   * waiting out the full timeout on every request during a sustained outage.
   */
  redis?: Redis;
  /** Max time to wait for the inner storage before failing open. */
  timeoutMs?: number;
}

/**
 * Throttler storage wrapper that fails OPEN: if the backing store (Redis) is
 * unreachable or slow, requests proceed unthrottled instead of erroring or
 * hanging. Rate limiting is a protection layer — its backing store must never
 * become an availability dependency for the whole API.
 *
 * Wraps any ThrottlerStorage implementation and races each increment()
 * against a configurable timeout. On timeout or error, returns a zero-hit
 * record (fail open) and emits a warning log, rate-limited to one per
 * 30 seconds so a sustained outage doesn't flood the logs.
 */
export class FailOpenThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(FailOpenThrottlerStorage.name);
  private readonly redis?: Redis;
  private readonly timeoutMs: number;
  private lastWarnAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly inner: ThrottlerStorage,
    options: FailOpenThrottlerStorageOptions = {},
  ) {
    this.redis = options.redis;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    // Fast path during outages: if we know the Redis connection isn't ready,
    // fail open immediately instead of paying the full timeout per request.
    if (this.redis && this.redis.status !== 'ready') {
      this.warnFailOpen(`Redis connection status is '${this.redis.status}'`);
      return FAIL_OPEN_RECORD;
    }

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () =>
          reject(
            new Error(`Throttler storage timed out after ${this.timeoutMs}ms`),
          ),
        this.timeoutMs,
      );
      // Don't let the pending timeout keep the Node event loop alive after the
      // increment() resolves successfully and clearTimeout() is called.
      timeoutHandle.unref?.();
    });

    try {
      return await Promise.race([
        this.inner.increment(key, ttl, limit, blockDuration, throttlerName),
        timeoutPromise,
      ]);
    } catch (error) {
      this.warnFailOpen(error instanceof Error ? error.message : String(error));
      return FAIL_OPEN_RECORD;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  /** Logs a fail-open warning, at most once per WARN_INTERVAL_MS. */
  private warnFailOpen(reason: string): void {
    const now = Date.now();
    if (now - this.lastWarnAt < WARN_INTERVAL_MS) {
      return;
    }
    this.lastWarnAt = now;
    this.logger.warn(
      `Throttler storage unavailable, failing open (request allowed): ${reason}`,
    );
  }
}
