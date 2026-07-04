import { useEffect, useRef } from 'react';
import { isElectron } from '../utils/platform';
import { logger } from '../utils/logger';

/**
 * useWakeLock Hook
 *
 * Keeps the device screen awake while `active` is true using the Screen Wake
 * Lock API (`navigator.wakeLock`). This prevents the phone/tablet screen from
 * locking mid-call.
 *
 * - Feature-detects `navigator.wakeLock` and no-ops where unsupported.
 * - No-ops in Electron: the desktop app already keeps the machine awake via
 *   the `powerSaveBlocker` (see useBackgroundVoiceKeepAlive).
 * - Wake locks are automatically released by the browser when the page is
 *   hidden, so we re-acquire on `visibilitychange` back to visible.
 *
 * @param active Whether the wake lock should currently be held.
 */
export function useWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active) return;
    // Electron keeps the screen awake through the OS power-save blocker.
    if (isElectron()) return;
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let released = false;

    const requestLock = async () => {
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (released) {
          // Cleanup ran before the request resolved — release immediately so
          // we don't leak a lock.
          void sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
        // The browser auto-releases when the page is hidden; clear our ref so
        // the visibilitychange handler knows to re-acquire.
        sentinel.addEventListener('release', () => {
          sentinelRef.current = null;
        });
        logger.dev('[WakeLock] Screen wake lock acquired');
      } catch {
        // Requests can reject (page not visible, user setting, etc.) — the
        // wake lock is a nice-to-have, so failure is non-critical.
      }
    };

    const handleVisibilityChange = () => {
      // Re-acquire when the page becomes visible again if the lock was
      // auto-released while hidden.
      if (document.visibilityState === 'visible' && sentinelRef.current === null) {
        void requestLock();
      }
    };

    void requestLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      released = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (sentinelRef.current) {
        void sentinelRef.current.release().catch(() => {});
        sentinelRef.current = null;
      }
    };
  }, [active]);
}

export default useWakeLock;
