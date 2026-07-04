import { useSyncExternalStore, useCallback } from 'react';
import { isElectron } from '../utils/platform';
import {
  canInstall,
  isStandalone,
  promptInstall,
  subscribeInstallPrompt,
} from '../utils/installPrompt';

/**
 * Exposes the captured PWA install prompt (see utils/installPrompt.ts).
 * `canInstall` is false in Electron, when already installed (standalone),
 * or when the browser hasn't offered an install prompt.
 */
export function useInstallPrompt(): {
  canInstall: boolean;
  promptInstall: () => Promise<'accepted' | 'dismissed' | null>;
} {
  const installAvailable = useSyncExternalStore(subscribeInstallPrompt, canInstall);

  const handlePrompt = useCallback(() => promptInstall(), []);

  return {
    canInstall: installAvailable && !isElectron() && !isStandalone(),
    promptInstall: handlePrompt,
  };
}
