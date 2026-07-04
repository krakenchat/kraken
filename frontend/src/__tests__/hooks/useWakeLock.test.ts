import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWakeLock } from '../../hooks/useWakeLock';

let mockIsElectron = false;

vi.mock('../../utils/platform', () => ({
  isElectron: vi.fn(() => mockIsElectron),
}));

vi.mock('../../utils/logger', () => ({
  logger: { dev: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Fake WakeLockSentinel that records its 'release' listeners so tests can
// simulate the browser auto-releasing the lock (e.g. when the tab is hidden).
interface FakeSentinel {
  release: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  fireRelease: () => void;
}

function makeSentinel(): FakeSentinel {
  const listeners: Array<() => void> = [];
  return {
    release: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn((type: string, cb: () => void) => {
      if (type === 'release') listeners.push(cb);
    }),
    fireRelease: () => listeners.forEach((cb) => cb()),
  };
}

let requestSpy: ReturnType<typeof vi.fn>;
let sentinels: FakeSentinel[];

const originalWakeLock = Object.getOwnPropertyDescriptor(navigator, 'wakeLock');

function installWakeLock() {
  sentinels = [];
  requestSpy = vi.fn(async () => {
    const s = makeSentinel();
    sentinels.push(s);
    return s;
  });
  Object.defineProperty(navigator, 'wakeLock', {
    value: { request: requestSpy },
    writable: true,
    configurable: true,
  });
}

function removeWakeLock() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (navigator as any).wakeLock;
}

describe('useWakeLock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsElectron = false;
    installWakeLock();
  });

  afterEach(() => {
    if (originalWakeLock) {
      Object.defineProperty(navigator, 'wakeLock', originalWakeLock);
    } else {
      removeWakeLock();
    }
  });

  it('acquires a screen wake lock when active', async () => {
    renderHook(() => useWakeLock(true));

    await waitFor(() => expect(requestSpy).toHaveBeenCalledWith('screen'));
    expect(requestSpy).toHaveBeenCalledTimes(1);
  });

  it('does not acquire when inactive', () => {
    renderHook(() => useWakeLock(false));
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it('releases the wake lock on unmount', async () => {
    const { unmount } = renderHook(() => useWakeLock(true));

    await waitFor(() => expect(sentinels).toHaveLength(1));
    unmount();

    expect(sentinels[0].release).toHaveBeenCalledTimes(1);
  });

  it('releases the wake lock when it becomes inactive', async () => {
    const { rerender } = renderHook(({ active }) => useWakeLock(active), {
      initialProps: { active: true },
    });

    await waitFor(() => expect(sentinels).toHaveLength(1));
    rerender({ active: false });

    expect(sentinels[0].release).toHaveBeenCalledTimes(1);
  });

  it('re-acquires the wake lock when the page becomes visible again', async () => {
    renderHook(() => useWakeLock(true));

    await waitFor(() => expect(sentinels).toHaveLength(1));

    // Simulate the browser auto-releasing the lock while hidden.
    act(() => {
      sentinels[0].fireRelease();
    });

    // Page becomes visible again → hook should request a fresh lock.
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(requestSpy).toHaveBeenCalledTimes(2));
  });

  it('no-ops when the Wake Lock API is unsupported', () => {
    removeWakeLock();
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
  });

  it('no-ops in Electron', () => {
    mockIsElectron = true;
    renderHook(() => useWakeLock(true));
    expect(requestSpy).not.toHaveBeenCalled();
  });
});
