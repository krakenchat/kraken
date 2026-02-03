/**
 * usePWA Hook
 *
 * PWA-specific utilities for detecting standalone mode,
 * managing status bar theming, and handling app-like behaviors.
 */

import { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';

interface PWAState {
  // Is the app running as installed PWA (standalone mode)?
  isStandalone: boolean;
  // Is the app installable (has install prompt)?
  isInstallable: boolean;
  // iOS specific detection
  isIOS: boolean;
  // Android specific detection
  isAndroid: boolean;
  // Can show install prompt
  canInstall: boolean;
}

// Store the install prompt event
let deferredPrompt: BeforeInstallPromptEvent | null = null;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Hook for PWA features and standalone detection
 */
export const usePWA = () => {
  const [state, setState] = useState<PWAState>({
    isStandalone: false,
    isInstallable: false,
    isIOS: false,
    isAndroid: false,
    canInstall: false,
  });

  useEffect(() => {
    // Detect platform
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);

    // Detect standalone mode
    // iOS: Check display-mode or navigator.standalone
    // Android/Desktop: Check display-mode media query
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://');

    setState((prev) => ({
      ...prev,
      isIOS,
      isAndroid,
      isStandalone,
    }));

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      setState((prev) => ({
        ...prev,
        isInstallable: true,
        canInstall: true,
      }));
    };

    // Listen for app installed
    const handleAppInstalled = () => {
      deferredPrompt = null;
      setState((prev) => ({
        ...prev,
        isInstallable: false,
        canInstall: false,
        isStandalone: true,
      }));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Listen for display mode changes
    const displayModeQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      setState((prev) => ({
        ...prev,
        isStandalone: e.matches,
      }));
    };
    displayModeQuery.addEventListener('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      displayModeQuery.removeEventListener('change', handleDisplayModeChange);
    };
  }, []);

  /**
   * Trigger the install prompt
   */
  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        deferredPrompt = null;
        setState((prev) => ({
          ...prev,
          isInstallable: false,
          canInstall: false,
        }));
        return true;
      }
      return false;
    } catch (e) {
      logger.error('Install prompt error:', e);
      return false;
    }
  }, []);

  return {
    ...state,
    promptInstall,
  };
};

/**
 * Hook for status bar/theme color management
 */
export const useStatusBarColor = () => {
  /**
   * Set the status bar/theme color
   * This affects the browser chrome and PWA status bar
   */
  const setColor = useCallback((color: string) => {
    // Update meta theme-color tags
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', color);
    } else {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = color;
      document.head.appendChild(meta);
    }

    // iOS Safari specific
    const appleStatusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (appleStatusBar) {
      // Determine if color is light or dark
      const isLight = isLightColor(color);
      appleStatusBar.setAttribute('content', isLight ? 'default' : 'black-translucent');
    }
  }, []);

  /**
   * Set dark theme status bar
   */
  const setDark = useCallback(() => {
    setColor('#1a1a2e');
  }, [setColor]);

  /**
   * Set light theme status bar
   */
  const setLight = useCallback(() => {
    setColor('#ffffff');
  }, [setColor]);

  return {
    setColor,
    setDark,
    setLight,
  };
};

/**
 * Helper to determine if a color is light or dark
 */
function isLightColor(color: string): boolean {
  // Convert hex to RGB
  let hex = color.replace('#', '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

/**
 * Hook for detecting if running in iOS Safari
 */
export const useIOSSafari = () => {
  const [isIOSSafari, setIsIOSSafari] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(ua);
    const webkit = /WebKit/.test(ua);
    const notChrome = !/CriOS/.test(ua);

    setIsIOSSafari(iOS && webkit && notChrome);
  }, []);

  return isIOSSafari;
};

export default usePWA;
