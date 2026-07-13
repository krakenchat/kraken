import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerException,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { WebhookThrottlerGuard } from './webhook-throttler.guard';

describe('WebhookThrottlerGuard', () => {
  let guard: WebhookThrottlerGuard;
  let storage: jest.Mocked<ThrottlerStorage>;
  const originalEnv = process.env.NODE_ENV;

  /**
   * Fake storage that mirrors the real ThrottlerStorage contract closely
   * enough for these tests: increments a per-key counter and reports
   * isBlocked once the caller-supplied limit is exceeded for that key.
   * Different keys (e.g. different webhook ids, or different throttler
   * names) never share a counter, since the guard's generateKey() folds
   * the throttler name, tracker, controller, and handler into the key.
   */
  function createFakeStorage(): jest.Mocked<ThrottlerStorage> {
    const counts = new Map<string, number>();
    const increment = jest.fn((key: string, ttl: number, limit: number) => {
      const totalHits = (counts.get(key) ?? 0) + 1;
      counts.set(key, totalHits);
      const isBlocked = totalHits > limit;
      return {
        totalHits,
        timeToExpire: ttl,
        isBlocked,
        timeToBlockExpire: isBlocked ? ttl : 0,
      };
    });
    // Cast rather than declaring the unused (blockDuration, throttlerName)
    // params: the real ThrottlerStorage#increment signature has 5 params,
    // but this fake only needs the first 3.
    return { increment } as unknown as jest.Mocked<ThrottlerStorage>;
  }

  function createContext(webhookId: string): ExecutionContext {
    const req: Record<string, any> = { params: { id: webhookId }, headers: {} };
    const res = { header: jest.fn() };
    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
      getClass: () => ({ name: 'WebhookExecutionController' }),
      getHandler: () => ({ name: 'execute' }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    storage = createFakeStorage();
    const options: ThrottlerModuleOptions = { throttlers: [] };
    guard = new WebhookThrottlerGuard(options, storage, new Reflector());
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  describe('getTracker', () => {
    it('returns webhook:<id> from the request params', async () => {
      const req = { params: { id: 'wh-123' } };

      const tracker = await (guard as any).getTracker(req);

      expect(tracker).toBe('webhook:wh-123');
    });
  });

  describe('test-mode skip', () => {
    it('allows the request without touching storage when NODE_ENV=test', async () => {
      process.env.NODE_ENV = 'test';
      const context = createContext('wh-1');

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(storage.increment).not.toHaveBeenCalled();
    });

    it('enforces the limit when NODE_ENV is not test', async () => {
      const context = createContext('wh-1');

      await guard.canActivate(context);

      expect(storage.increment).toHaveBeenCalled();
    });
  });

  describe('per-webhook limit enforcement', () => {
    it('allows requests up to the per-webhook limit and rejects beyond it', async () => {
      const context = createContext('wh-1');

      // webhookShort tier allows 10 requests per 10s.
      for (let i = 0; i < 10; i++) {
        await expect(guard.canActivate(context)).resolves.toBe(true);
      }

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        ThrottlerException,
      );
    });
  });

  describe('key-space isolation between webhook ids', () => {
    it('does not share counters across different webhook ids', async () => {
      const contextA = createContext('wh-a');
      const contextB = createContext('wh-b');

      // Exhaust the limit for webhook A.
      for (let i = 0; i < 10; i++) {
        await guard.canActivate(contextA);
      }
      await expect(guard.canActivate(contextA)).rejects.toBeInstanceOf(
        ThrottlerException,
      );

      // Webhook B has an independent counter and is unaffected.
      await expect(guard.canActivate(contextB)).resolves.toBe(true);
    });
  });
});
