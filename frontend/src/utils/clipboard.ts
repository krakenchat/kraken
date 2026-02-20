import { isElectron, getElectronAPI } from './platform';

/**
 * Cross-platform clipboard write.
 * Uses Electron's native clipboard module when running in the desktop app
 * (where navigator.clipboard requires a secure context that file:// doesn't provide),
 * and falls back to the standard Web Clipboard API in browsers.
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (isElectron()) {
    const api = getElectronAPI();
    if (api?.writeClipboard) {
      api.writeClipboard(text);
      return;
    }
  }
  await navigator.clipboard.writeText(text);
}
