import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CriticalTimers } from 'livekit-client';
import {
  installLivekitWorkerTimers,
  _uninstallLivekitWorkerTimersForTests,
} from '../../utils/livekitWorkerTimers';

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

let lastWorkerInstance: MockWorker | null = null;
let workerShouldFail = false;

class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();

  constructor() {
    if (workerShouldFail) {
      throw new Error('Worker not supported');
    }
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    lastWorkerInstance = this;
  }

  fire(id: number) {
    this.onmessage?.({ data: { type: 'timer-fired', id } } as MessageEvent);
  }
}

const OriginalWorker = globalThis.Worker;
const nativeSetTimeout = CriticalTimers.setTimeout;
const nativeSetInterval = CriticalTimers.setInterval;
const nativeClearTimeout = CriticalTimers.clearTimeout;
const nativeClearInterval = CriticalTimers.clearInterval;

describe('livekitWorkerTimers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastWorkerInstance = null;
    workerShouldFail = false;
    globalThis.Worker = MockWorker as unknown as typeof Worker;
  });

  afterEach(() => {
    _uninstallLivekitWorkerTimersForTests();
    globalThis.Worker = OriginalWorker;
  });

  it('replaces CriticalTimers statics with worker-backed implementations', () => {
    installLivekitWorkerTimers();

    expect(lastWorkerInstance).not.toBeNull();
    expect(CriticalTimers.setTimeout).not.toBe(nativeSetTimeout);
    expect(CriticalTimers.setInterval).not.toBe(nativeSetInterval);
    expect(CriticalTimers.clearTimeout).not.toBe(nativeClearTimeout);
    expect(CriticalTimers.clearInterval).not.toBe(nativeClearInterval);
  });

  it('is idempotent — second install does not create a second worker', () => {
    installLivekitWorkerTimers();
    const first = lastWorkerInstance;
    installLivekitWorkerTimers();
    expect(lastWorkerInstance).toBe(first);
  });

  it('setTimeout posts set-timeout and fires callback once on timer-fired', () => {
    installLivekitWorkerTimers();
    const cb = vi.fn();

    const handle = CriticalTimers.setTimeout(cb, 500, 'a', 'b');
    const id = handle as unknown as number;

    expect(id).toBeGreaterThanOrEqual(1);
    expect(lastWorkerInstance!.postMessage).toHaveBeenCalledWith({
      type: 'set-timeout',
      id,
      delay: 500,
    });

    lastWorkerInstance!.fire(id);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith('a', 'b');

    // One-shot: a stray second fire must not invoke the callback again
    lastWorkerInstance!.fire(id);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('setInterval fires callback on every timer-fired message', () => {
    installLivekitWorkerTimers();
    const cb = vi.fn();

    const id = CriticalTimers.setInterval(cb, 1000) as unknown as number;
    expect(lastWorkerInstance!.postMessage).toHaveBeenCalledWith({
      type: 'set-interval',
      id,
      delay: 1000,
    });

    lastWorkerInstance!.fire(id);
    lastWorkerInstance!.fire(id);
    lastWorkerInstance!.fire(id);
    expect(cb).toHaveBeenCalledTimes(3);
  });

  it('clearTimeout posts clear-timer and prevents the callback from firing', () => {
    installLivekitWorkerTimers();
    const cb = vi.fn();

    const handle = CriticalTimers.setTimeout(cb, 500);
    const id = handle as unknown as number;
    CriticalTimers.clearTimeout(handle);

    expect(lastWorkerInstance!.postMessage).toHaveBeenCalledWith({
      type: 'clear-timer',
      id,
    });

    lastWorkerInstance!.fire(id);
    expect(cb).not.toHaveBeenCalled();
  });

  it('clearInterval stops an interval callback', () => {
    installLivekitWorkerTimers();
    const cb = vi.fn();

    const handle = CriticalTimers.setInterval(cb, 1000);
    lastWorkerInstance!.fire(handle as unknown as number);
    expect(cb).toHaveBeenCalledTimes(1);

    CriticalTimers.clearInterval(handle);
    lastWorkerInstance!.fire(handle as unknown as number);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('returns distinct truthy ids across calls', () => {
    installLivekitWorkerTimers();
    const a = CriticalTimers.setTimeout(vi.fn(), 1) as unknown as number;
    const b = CriticalTimers.setInterval(vi.fn(), 1) as unknown as number;
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
  });

  it('leaves native timers in place when Worker construction throws', () => {
    workerShouldFail = true;
    installLivekitWorkerTimers();

    expect(CriticalTimers.setTimeout).toBe(nativeSetTimeout);
    expect(CriticalTimers.setInterval).toBe(nativeSetInterval);
    expect(CriticalTimers.clearTimeout).toBe(nativeClearTimeout);
    expect(CriticalTimers.clearInterval).toBe(nativeClearInterval);
  });

  it('reverts to native timers when the worker errors', () => {
    installLivekitWorkerTimers();
    const worker = lastWorkerInstance!;

    worker.onerror?.({ message: 'script failed' } as ErrorEvent);

    expect(CriticalTimers.setTimeout).toBe(nativeSetTimeout);
    expect(CriticalTimers.setInterval).toBe(nativeSetInterval);
    expect(worker.terminate).toHaveBeenCalled();

    // A new install after revert should work again
    installLivekitWorkerTimers();
    expect(CriticalTimers.setTimeout).not.toBe(nativeSetTimeout);
  });
});
