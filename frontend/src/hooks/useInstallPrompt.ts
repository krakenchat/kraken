import { useSyncExternalStore, useCallback, useEffect, useMemo, useState } from 'react';
import { isElectron, isDesktopBrowser } from '../utils/platform';
import {
  canInstall as canInstallStore,
  isStandalone,
  promptInstall,
  subscribeInstallPrompt,
} from '../utils/installPrompt';

const DISMISS_KEY = 'pwa-install-dismissed';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface UseInstallPromptResult {
  /**
   * A real browser install prompt has been captured and the app is eligible
   * to install (not Electron, not already standalone). Used by the Settings
   * "Install app" card — shown on desktop too, ignores the 7-day dismissal.
   */
  canInstall: boolean;
  /**
   * Whether to surface the auto mobile install snackbar: eligible AND not
   * dismissed (7-day) AND not a desktop browser, plus iOS (which has no
   * beforeinstallprompt and needs manual "Add to Home Screen" instructions).
   */
  isInstallable: boolean;
  /** Running on iOS (needs manual Add-to-Home-Screen instructions). */
  isIOS: boolean;
  /** Already installed / running as a standalone PWA. */
  isInstalled: boolean;
  /** Show the native prompt; returns the user's choice or null. */
  promptInstall: () => Promise<'accepted' | 'dismissed' | null>;
  /** Convenience wrapper: true when the user accepted the install. */
  install: () => Promise<boolean>;
  /** Dismiss the mobile prompt for 7 days. */
  dismiss: () => void;
}

/**
 * Single source of truth for PWA install UX, backed by the early-capture store
 * in utils/installPrompt.ts (which registers the beforeinstallprompt listener
 * before React mounts). Consolidates the former usePWAInstall + useInstallPrompt
 * hooks: 7-day dismissal, iOS detection, desktop suppression, standalone
 * detection. Consumed by both PWAInstallPrompt (mobile snackbar) and
 * InstallAppSettings (settings card).
 */
export function useInstallPrompt(): UseInstallPromptResult {
  const installAvailable = useSyncExternalStore(subscribeInstallPrompt, canInstallStore);

  const isIOS = useMemo(
    () =>
      typeof navigator !== 'undefined' &&
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as unknown as { MSStream?: unknown }).MSStream,
    [],
  );

  // Standalone detection with live updates on display-mode change.
  const [isInstalled, setIsInstalled] = useState(() => isStandalone());
  useEffect(() => {
    const check = () => setIsInstalled(isStandalone());
    check();
    const mediaQuery = window.matchMedia?.('(display-mode: standalone)');
    mediaQuery?.addEventListener('change', check);
    window.addEventListener('appinstalled', check);
    return () => {
      mediaQuery?.removeEventListener('change', check);
      window.removeEventListener('appinstalled', check);
    };
  }, []);

  // 7-day dismissal (persisted in localStorage).
  const [isDismissed, setIsDismissed] = useState(false);
  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (!dismissed) return;
    const dismissedAt = parseInt(dismissed, 10);
    if (Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_TTL_MS) {
      setIsDismissed(true);
    } else {
      localStorage.removeItem(DISMISS_KEY);
    }
  }, []);

  const handlePrompt = useCallback(() => promptInstall(), []);

  const install = useCallback(async () => {
    const outcome = await promptInstall();
    return outcome === 'accepted';
  }, []);

  const dismiss = useCallback(() => {
    setIsDismissed(true);
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  }, []);

  const canInstall = installAvailable && !isElectron() && !isInstalled;
  const isInstallable =
    !isDismissed && !isInstalled && !isDesktopBrowser() && (canInstall || isIOS);

  return {
    canInstall,
    isInstallable,
    isIOS,
    isInstalled,
    promptInstall: handlePrompt,
    install,
    dismiss,
  };
}
