import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Control platform detection (real store, mocked platform).
const isElectron = vi.fn(() => false);
const isDesktopBrowser = vi.fn(() => false);
vi.mock('../../utils/platform', () => ({
  isElectron: () => isElectron(),
  isDesktopBrowser: () => isDesktopBrowser(),
}));

import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { _resetInstallPromptForTests } from '../../utils/installPrompt';

function fireBeforeInstallPrompt() {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: string; platform: string }>;
  };
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
  window.dispatchEvent(event);
  return event;
}

describe('useInstallPrompt (consolidated)', () => {
  beforeEach(() => {
    _resetInstallPromptForTests();
    localStorage.clear();
    isElectron.mockReturnValue(false);
    isDesktopBrowser.mockReturnValue(false);
    // Non-iOS user agent by default.
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Linux; Android 13)',
    });
  });

  it('reports not installable before any prompt is captured', () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canInstall).toBe(false);
    expect(result.current.isInstallable).toBe(false);
  });

  it('becomes installable once beforeinstallprompt fires (mobile)', () => {
    const { result } = renderHook(() => useInstallPrompt());
    act(() => {
      fireBeforeInstallPrompt();
    });
    expect(result.current.canInstall).toBe(true);
    expect(result.current.isInstallable).toBe(true);
  });

  it('suppresses the mobile snackbar on desktop but still allows settings install', () => {
    isDesktopBrowser.mockReturnValue(true);
    const { result } = renderHook(() => useInstallPrompt());
    act(() => {
      fireBeforeInstallPrompt();
    });
    // Settings card (canInstall) allowed on desktop; mobile snackbar suppressed.
    expect(result.current.canInstall).toBe(true);
    expect(result.current.isInstallable).toBe(false);
  });

  it('honors the 7-day dismissal for the mobile snackbar', () => {
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    const { result } = renderHook(() => useInstallPrompt());
    act(() => {
      fireBeforeInstallPrompt();
    });
    expect(result.current.isInstallable).toBe(false);
    // canInstall (settings) is not gated by dismissal.
    expect(result.current.canInstall).toBe(true);
  });

  it('dismiss() persists a timestamp and hides the snackbar', () => {
    const { result } = renderHook(() => useInstallPrompt());
    act(() => {
      fireBeforeInstallPrompt();
    });
    expect(result.current.isInstallable).toBe(true);
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.isInstallable).toBe(false);
    expect(localStorage.getItem('pwa-install-dismissed')).not.toBeNull();
  });

  it('detects iOS and marks installable without a captured prompt', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    });
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.isIOS).toBe(true);
    // No beforeinstallprompt on iOS, but the manual-instructions prompt shows.
    expect(result.current.isInstallable).toBe(true);
    expect(result.current.canInstall).toBe(false);
  });

  it('is not installable in Electron', () => {
    isElectron.mockReturnValue(true);
    const { result } = renderHook(() => useInstallPrompt());
    act(() => {
      fireBeforeInstallPrompt();
    });
    expect(result.current.canInstall).toBe(false);
  });
});
