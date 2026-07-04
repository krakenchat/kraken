import { CriticalTimers } from 'livekit-client';
import { logger } from './logger';

/**
 * Backs livekit-client's CriticalTimers with Web Worker timers.
 *
 * Chrome intensively throttles main-thread setTimeout/setInterval in
 * backgrounded/locked tabs (1 fire per minute after ~5 minutes), which
 * starves livekit's signal ping/pong and reconnect timers and silently
 * kills voice calls on mobile (#350). Worker timers are exempt from that
 * throttling, so we route CriticalTimers through the shared
 * background-timer worker.
 *
 * Handle contract: livekit only ever passes the values returned by
 * CriticalTimers.setTimeout/setInterval back to CriticalTimers.clearTimeout/
 * clearInterval (verified against livekit-client 2.13 — every call site
 * pairs CriticalTimers.set* with CriticalTimers.clear*). That lets us
 * return our own numeric ids instead of native timer handles. Revisit if
 * a livekit upgrade ever mixes native clearTimeout with these handles.
 */

type TimerCallback = (...args: unknown[]) => void;

interface PendingTimer {
  fn: TimerCallback;
  args: unknown[];
  /** One-shot timers are removed from the map when they fire. */
  once: boolean;
}

let worker: Worker | null = null;
let installed = false;
// Start at 1 so ids are always truthy (livekit does `if (this.pingTimeout)`).
let nextId = 1;
const pending = new Map<number, PendingTimer>();

const nativeTimers = {
  setTimeout: CriticalTimers.setTimeout,
  setInterval: CriticalTimers.setInterval,
  clearTimeout: CriticalTimers.clearTimeout,
  clearInterval: CriticalTimers.clearInterval,
};

function revertToNativeTimers(): void {
  CriticalTimers.setTimeout = nativeTimers.setTimeout;
  CriticalTimers.setInterval = nativeTimers.setInterval;
  CriticalTimers.clearTimeout = nativeTimers.clearTimeout;
  CriticalTimers.clearInterval = nativeTimers.clearInterval;
  worker?.terminate();
  worker = null;
  installed = false;
  pending.clear();
}

/**
 * Override livekit's CriticalTimers with worker-backed implementations.
 * Idempotent; call before constructing a Room. Falls back to (or reverts
 * to) native timers if the worker can't be created or errors, in which
 * case livekit behaves exactly as before this override existed.
 */
export function installLivekitWorkerTimers(): void {
  if (installed || typeof Worker === 'undefined') {
    return;
  }

  try {
    worker = new Worker(
      new URL('../workers/background-timer.worker.ts', import.meta.url),
      { type: 'module' }
    );
  } catch (error) {
    logger.warn('[Voice] Background timer worker unavailable, livekit timers stay native:', error);
    worker = null;
    return;
  }

  worker.onmessage = (e: MessageEvent) => {
    if (e.data?.type !== 'timer-fired') {
      return;
    }
    const timer = pending.get(e.data.id);
    if (!timer) {
      return;
    }
    if (timer.once) {
      pending.delete(e.data.id);
    }
    timer.fn(...timer.args);
  };

  worker.onerror = (event) => {
    // Worker script failed — revert so livekit's own timers keep working.
    // Any in-flight SDK timers are lost, but livekit's connection-reconcile
    // watchdog re-arms itself and self-heals.
    logger.error('[Voice] Background timer worker errored, reverting livekit timers to native:', event.message);
    revertToNativeTimers();
  };

  CriticalTimers.setTimeout = ((fn: TimerCallback, delay?: number, ...args: unknown[]) => {
    const id = nextId++;
    pending.set(id, { fn, args, once: true });
    worker?.postMessage({ type: 'set-timeout', id, delay: delay ?? 0 });
    return id as unknown as ReturnType<typeof setTimeout>;
  }) as typeof CriticalTimers.setTimeout;

  CriticalTimers.setInterval = ((fn: TimerCallback, delay?: number, ...args: unknown[]) => {
    const id = nextId++;
    pending.set(id, { fn, args, once: false });
    worker?.postMessage({ type: 'set-interval', id, delay: delay ?? 0 });
    return id as unknown as ReturnType<typeof setInterval>;
  }) as typeof CriticalTimers.setInterval;

  CriticalTimers.clearTimeout = ((handle: unknown) => {
    const id = handle as number;
    if (pending.delete(id)) {
      worker?.postMessage({ type: 'clear-timer', id });
    }
  }) as typeof CriticalTimers.clearTimeout;

  CriticalTimers.clearInterval = CriticalTimers.clearTimeout as typeof CriticalTimers.clearInterval;

  installed = true;
  logger.info('[Voice] livekit CriticalTimers now worker-backed (background-throttling safe)');
}

/** Test-only: undo the override and reset module state. */
export function _uninstallLivekitWorkerTimersForTests(): void {
  revertToNativeTimers();
  nextId = 1;
}
