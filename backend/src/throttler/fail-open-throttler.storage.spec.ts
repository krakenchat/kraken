import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
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

function makeInner(
  impl: () => Promise<ThrottlerStorageRecord>,
): ThrottlerStorageRedisService {
  return {
    increment: jest.fn(impl),
    onModuleDestroy: jest.fn(),
  } as unknown as ThrottlerStorageRedisService;
}

/**
 * Flush all pending microtasks so that Promise.resolve() callbacks complete
 * before we run any timer-based assertions.
 */
async function flushMicrotasks(): Promise<void> {
  // Yielding via await Promise.resolve() multiple times drains the microtask
  // queue through several depths of chaining.
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
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
      const inner = makeInner(() => Promise.resolve(SUCCESS_RECORD));
      const storage = new FailOpenThrottlerStorage(inner, 1500);

      const resultPromise = storage.increment(...ARGS);
      // Let microtasks (Promise.resolve) settle BEFORE running timers.
      // Running timers first would fire the timeout before the inner resolves.
      await flushMicrotasks();
      jest.runAllTimers();

      const result = await resultPromise;
      expect(result).toBe(SUCCESS_RECORD);
      expect(inner.increment).toHaveBeenCalledWith(...ARGS);
    });
  });

  describe('fail-open on inner rejection', () => {
    it('returns zero-hit record when inner rejects', async () => {
      const inner = makeInner(() => Promise.reject(new Error('ECONNREFUSED')));
      const storage = new FailOpenThrottlerStorage(inner, 1500);

      const resultPromise = storage.increment(...ARGS);
      await flushMicrotasks();
      jest.runAllTimers();

      const result = await resultPromise;
      expect(result).toEqual(FAIL_OPEN_RECORD);
    });

    it('logs a warning when inner rejects', async () => {
      const inner = makeInner(() => Promise.reject(new Error('Redis down')));
      const storage = new FailOpenThrottlerStorage(inner, 1500);
      const warnSpy = jest
        .spyOn((storage as any).logger, 'warn')
        .mockImplementation(() => undefined);

      const resultPromise = storage.increment(...ARGS);
      await flushMicrotasks();
      jest.runAllTimers();
      await resultPromise;

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('Redis down');
    });

    it('logs a warning with stringified non-Error rejections', async () => {
      const inner = makeInner(() => Promise.reject('string-error'));
      const storage = new FailOpenThrottlerStorage(inner, 1500);
      const warnSpy = jest
        .spyOn((storage as any).logger, 'warn')
        .mockImplementation(() => undefined);

      const resultPromise = storage.increment(...ARGS);
      await flushMicrotasks();
      jest.runAllTimers();
      await resultPromise;

      expect(warnSpy.mock.calls[0][0]).toContain('string-error');
    });
  });

  describe('fail-open on timeout', () => {
    it('returns zero-hit record when inner exceeds timeout', async () => {
      // Inner never resolves
      const inner = makeInner(() => new Promise(() => undefined));
      const storage = new FailOpenThrottlerStorage(inner, 200);

      const incrementPromise = storage.increment(...ARGS);
      jest.advanceTimersByTime(201);
      // Yield so the timeout-rejection catch handler runs
      await flushMicrotasks();

      const result = await incrementPromise;
      expect(result).toEqual(FAIL_OPEN_RECORD);
    });

    it('logs a warning on timeout', async () => {
      const inner = makeInner(() => new Promise(() => undefined));
      const storage = new FailOpenThrottlerStorage(inner, 200);
      const warnSpy = jest
        .spyOn((storage as any).logger, 'warn')
        .mockImplementation(() => undefined);

      const incrementPromise = storage.increment(...ARGS);
      jest.advanceTimersByTime(201);
      await flushMicrotasks();
      await incrementPromise;

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('timed out');
    });

    it('does not fail open when inner resolves before timeout', async () => {
      const inner = makeInner(() => Promise.resolve(SUCCESS_RECORD));
      const storage = new FailOpenThrottlerStorage(inner, 200);

      const incrementPromise = storage.increment(...ARGS);
      // Drain microtasks first so inner resolves and clearTimeout fires
      await flushMicrotasks();
      // Then run timers (already cleared — no-op) to clean up any residuals
      jest.runAllTimers();

      const result = await incrementPromise;
      expect(result).toBe(SUCCESS_RECORD);
    });
  });
});
