/**
 * PWA install-prompt capture.
 *
 * Chromium fires `beforeinstallprompt` once, often before React mounts, so
 * the listener must be registered at module-import time (imported for side
 * effect in main.tsx). The deferred event is held here and exposed to the
 * UI via useInstallPrompt().
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type Listener = () => void;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Suppress the browser's mini-infobar; we surface our own button
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

/** Whether an install prompt has been captured and can be shown. */
export function canInstall(): boolean {
  return deferredPrompt !== null;
}

/** Whether the app is already running as an installed PWA. */
export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari legacy flag
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Show the browser install prompt. Returns the user's choice, or null if
 * no prompt is available. The captured event is single-use.
 */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | null> {
  if (!deferredPrompt) {
    return null;
  }
  const prompt = deferredPrompt;
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  // The event can only be used once regardless of outcome
  deferredPrompt = null;
  notify();
  return outcome;
}

/** Subscribe to install-availability changes. Returns an unsubscribe fn. */
export function subscribeInstallPrompt(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test-only: reset captured state. */
export function _resetInstallPromptForTests(): void {
  deferredPrompt = null;
  listeners.clear();
}
