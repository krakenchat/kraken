import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import Redis from 'ioredis';
import { FailOpenThrottlerStorage } from './fail-open-throttler.storage';

const ARGS: [string, number, number, number, string] = [
  'key',
  1000,
  10,
  0,
  'short',
];

const SUCCESS_RECORD: ThrottlerStorageRecord = {
  totalHits: 3,
  timeToExpire: 900,
  isBlocked: false,
  timeToBlockExpire: 0,
};

const FAIL_OPEN_RECORD: ThrottlerStorageRecord = {
  totalHits: 0,
  timeToExpire: 0,
  isBlocked: false,
  timeToBlockExpire: 0,
};

function makeInner(impl: () => Promise<ThrottlerStorageRecord>): {
  inner: ThrottlerStorage;
  increment: jest.Mock;
} {
  const increment = jest.fn(impl);
  return { inner: { increment }, increment };
}

function makeRedis(status: string): Redis {
  return { status } as unknown as Redis;
}

function spyOnWarn(storage: FailOpenThrottlerStorage): jest.SpyInstance {
  return jest
    .spyOn(
      (storage as unknown as { logger: { warn: (msg: string) => void } })
        .logger,
      'warn',
    )
    .mockImplementation(() => undefined);
}

describe('FailOpenThrottlerStorage', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('happy path', () => {
    it('delegates to inner and returns its record on success', async () => {
      const { inner, increment } = makeInner(() =>
        Promise.resolve(SUCCESS_RECORD),
      );
      const storage = new FailOpenThrottlerStorage(inner);

      const result = await storage.increment(...ARGS);

      expect(result).toBe(SUCCESS_RECORD);
      expect(increment).toHaveBeenCalledWith(...ARGS);
    });
  });

  describe('fail-open on inner rejection', () => {
    it('returns zero-hit record when inner rejects', async () => {
      const { inner } = makeInner(() =>
        Promise.reject(new Error('ECONNREFUSED')),
      );
      const storage = new FailOpenThrottlerStorage(inner);
      spyOnWarn(storage);

      const result = await storage.increment(...ARGS);

      expect(result).toEqual(FAIL_OPEN_RECORD);
    });

    it('logs a warning containing the error message when inner rejects', async () => {
      const { inner } = makeInner(() =>
        Promise.reject(new Error('Redis down')),
      );
      const storage = new FailOpenThrottlerStorage(inner);
      const warnSpy = spyOnWarn(storage);

      await storage.increment(...ARGS);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('Redis down');
    });

    it('logs a warning with stringified non-Error rejections', async () => {
      const { inner } = makeInner(() =>
        // Intentionally reject with a non-Error to exercise String() fallback.
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        Promise.reject('string-error'),
      );
      const storage = new FailOpenThrottlerStorage(inner);
      const warnSpy = spyOnWarn(storage);

      await storage.increment(...ARGS);

      expect(warnSpy.mock.calls[0][0]).toContain('string-error');
    });
  });

  describe('fail-open on timeout', () => {
    it('returns zero-hit record when inner exceeds timeout', async () => {
      // Inner never resolves
      const { inner } = makeInner(() => new Promise(() => undefined));
      const storage = new FailOpenThrottlerStorage(inner, { timeoutMs: 200 });
      spyOnWarn(storage);

      const incrementPromise = storage.increment(...ARGS);
      await jest.advanceTimersByTimeAsync(201);

      await expect(incrementPromise).resolves.toEqual(FAIL_OPEN_RECORD);
    });

    it('logs a warning on timeout', async () => {
      const { inner } = makeInner(() => new Promise(() => undefined));
      const storage = new FailOpenThrottlerStorage(inner, { timeoutMs: 200 });
      const warnSpy = spyOnWarn(storage);

      const incrementPromise = storage.increment(...ARGS);
      await jest.advanceTimersByTimeAsync(201);
      await incrementPromise;

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('timed out');
    });

    it('does not fail open when inner resolves before timeout', async () => {
      const { inner } = makeInner(() => Promise.resolve(SUCCESS_RECORD));
      const storage = new FailOpenThrottlerStorage(inner, { timeoutMs: 200 });

      const result = await storage.increment(...ARGS);
      // Timeout was cleared on resolution; running remaining timers is a no-op.
      await jest.runAllTimersAsync();

      expect(result).toBe(SUCCESS_RECORD);
    });
  });

  describe('fast fail-open when Redis is not ready', () => {
    it('fails open immediately without calling inner', async () => {
      const { inner, increment } = makeInner(() =>
        Promise.resolve(SUCCESS_RECORD),
      );
      const storage = new FailOpenThrottlerStorage(inner, {
        redis: makeRedis('reconnecting'),
      });
      const warnSpy = spyOnWarn(storage);

      const result = await storage.increment(...ARGS);

      expect(result).toEqual(FAIL_OPEN_RECORD);
      expect(increment).not.toHaveBeenCalled();
      expect(warnSpy.mock.calls[0][0]).toContain('reconnecting');
    });

    it('calls inner normally when Redis is ready', async () => {
      const { inner, increment } = makeInner(() =>
        Promise.resolve(SUCCESS_RECORD),
      );
      const storage = new FailOpenThrottlerStorage(inner, {
        redis: makeRedis('ready'),
      });

      const result = await storage.increment(...ARGS);

      expect(result).toBe(SUCCESS_RECORD);
      expect(increment).toHaveBeenCalledWith(...ARGS);
    });
  });

  describe('warning rate limiting', () => {
    it('logs at most one warning per 30 seconds', async () => {
      const { inner } = makeInner(() =>
        Promise.reject(new Error('Redis down')),
      );
      const storage = new FailOpenThrottlerStorage(inner);
      const warnSpy = spyOnWarn(storage);

      await storage.increment(...ARGS);
      await storage.increment(...ARGS);

      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('logs again after the rate-limit window elapses', async () => {
      const { inner } = makeInner(() =>
        Promise.reject(new Error('Redis down')),
      );
      const storage = new FailOpenThrottlerStorage(inner);
      const warnSpy = spyOnWarn(storage);

      await storage.increment(...ARGS);
      await jest.advanceTimersByTimeAsync(30_001);
      await storage.increment(...ARGS);

      expect(warnSpy).toHaveBeenCalledTimes(2);
    });
  });
});
