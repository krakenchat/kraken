import { ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { WsThrottleGuard } from './ws-throttle.guard';

describe('WsThrottleGuard', () => {
  let guard: WsThrottleGuard;
  let mockRedis: { eval: jest.Mock };
  const originalEnv = process.env.NODE_ENV;

  function createMockContext(socketId: string): ExecutionContext {
    return {
      switchToWs: () => ({
        getClient: () => ({ id: socketId }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    // Ensure NODE_ENV is not 'test' so the guard actually runs
    process.env.NODE_ENV = 'development';
    mockRedis = { eval: jest.fn() };
    guard = new WsThrottleGuard(mockRedis as any);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  it('allows a request on a fresh window and sets the TTL via the Lua script', async () => {
    mockRedis.eval.mockResolvedValue(1);
    const ctx = createMockContext('socket-1');

    await expect(guard.canActivate(ctx)).resolves.toBe(true);

    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'ws:throttle:socket-1',
      10000,
    );
  });

  it('allows requests within the rate limit', async () => {
    const ctx = createMockContext('socket-1');

    for (let i = 1; i <= 50; i++) {
      mockRedis.eval.mockResolvedValueOnce(i);
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    }
  });

  it('throws WsException when the count exceeds the limit (breach)', async () => {
    mockRedis.eval.mockResolvedValueOnce(51);
    mockRedis.eval.mockResolvedValueOnce(52);
    const ctx = createMockContext('socket-1');

    await expect(guard.canActivate(ctx)).rejects.toThrow(WsException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('Rate limit exceeded');
  });

  it('tracks limits per socket independently (separate Redis keys)', async () => {
    mockRedis.eval.mockResolvedValueOnce(51); // socket-1 breaches
    const ctx1 = createMockContext('socket-1');
    await expect(guard.canActivate(ctx1)).rejects.toThrow(WsException);

    mockRedis.eval.mockResolvedValueOnce(1); // socket-2 fresh window
    const ctx2 = createMockContext('socket-2');
    await expect(guard.canActivate(ctx2)).resolves.toBe(true);

    expect(mockRedis.eval).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      1,
      'ws:throttle:socket-1',
      10000,
    );
    expect(mockRedis.eval).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      1,
      'ws:throttle:socket-2',
      10000,
    );
  });

  it('fails open (allows) and logs a warning when Redis errors', async () => {
    const warnSpy = jest
      .spyOn(guard['logger'], 'warn')
      .mockImplementation(() => undefined);
    mockRedis.eval.mockRejectedValue(new Error('ECONNREFUSED'));
    const ctx = createMockContext('socket-1');

    await expect(guard.canActivate(ctx)).resolves.toBe(true);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('failing open');
    expect(warnSpy.mock.calls[0][0]).toContain('ECONNREFUSED');
  });

  it('fails open with a stringified reason for non-Error rejections', async () => {
    const warnSpy = jest
      .spyOn(guard['logger'], 'warn')
      .mockImplementation(() => undefined);

    mockRedis.eval.mockRejectedValue('string-error');
    const ctx = createMockContext('socket-1');

    await expect(guard.canActivate(ctx)).resolves.toBe(true);

    expect(warnSpy.mock.calls[0][0]).toContain('string-error');
  });

  it('bypasses rate limiting in test environment without touching Redis', async () => {
    process.env.NODE_ENV = 'test';
    const ctx = createMockContext('socket-1');

    for (let i = 0; i < 100; i++) {
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    }

    expect(mockRedis.eval).not.toHaveBeenCalled();
  });

  describe('hang protection (eval timeout)', () => {
    // Mirrors EVAL_TIMEOUT_MS in ws-throttle.guard.ts.
    const EVAL_TIMEOUT_MS = 1500;

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('fails open within the timeout window when eval never resolves, and logs a warning', async () => {
      const warnSpy = jest
        .spyOn(guard['logger'], 'warn')
        .mockImplementation(() => undefined);
      mockRedis.eval.mockReturnValue(new Promise(() => undefined));
      const ctx = createMockContext('socket-1');

      const resultPromise = guard.canActivate(ctx);
      await jest.advanceTimersByTimeAsync(EVAL_TIMEOUT_MS + 1);

      await expect(resultPromise).resolves.toBe(true);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('timed out');
    });

    it('does not fail open when eval resolves before the timeout', async () => {
      mockRedis.eval.mockResolvedValue(1);
      const ctx = createMockContext('socket-1');

      const result = await guard.canActivate(ctx);
      // Timeout was cleared on resolution; running remaining timers is a no-op.
      await jest.runAllTimersAsync();

      expect(result).toBe(true);
    });
  });

  describe('warn throttling on repeated failures', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('logs at most one warning per 30s window across repeated failures', async () => {
      const warnSpy = jest
        .spyOn(guard['logger'], 'warn')
        .mockImplementation(() => undefined);
      mockRedis.eval.mockRejectedValue(new Error('ECONNREFUSED'));
      const ctx = createMockContext('socket-1');

      await guard.canActivate(ctx);
      await guard.canActivate(ctx);
      await guard.canActivate(ctx);

      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('logs again after the 30s warn window elapses', async () => {
      const warnSpy = jest
        .spyOn(guard['logger'], 'warn')
        .mockImplementation(() => undefined);
      mockRedis.eval.mockRejectedValue(new Error('ECONNREFUSED'));
      const ctx = createMockContext('socket-1');

      await guard.canActivate(ctx);
      await jest.advanceTimersByTimeAsync(30_001);
      await guard.canActivate(ctx);

      expect(warnSpy).toHaveBeenCalledTimes(2);
    });
  });
});
