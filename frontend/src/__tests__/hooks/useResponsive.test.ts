import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock isElectron
let mockIsElectron = false;
vi.mock('../../utils/platform', () => ({
  isElectron: () => mockIsElectron,
}));

// Mock useMediaQuery to simulate viewport sizes
let mockMediaQueryResults: Record<string, boolean> = {};
vi.mock('@mui/material/useMediaQuery', () => ({
  default: (query: string) => mockMediaQueryResults[query] ?? false,
}));

// Mock useTheme — only needs breakpoints for MUI backward-compat queries
vi.mock('@mui/material/styles', () => ({
  useTheme: () => ({
    breakpoints: {
      only: (key: string) => `(only-${key})`,
      up: (key: string) => `(up-${key})`,
    },
  }),
}));

import { DEVICE_BREAKPOINTS } from '../../utils/breakpoints';
import { useResponsive } from '../../hooks/useResponsive';

function setViewportPhone() {
  // < 600px = phone
  mockMediaQueryResults = {
    [`(max-width: ${DEVICE_BREAKPOINTS.PHONE - 1}px)`]: true,
  };
}

function setViewportPhoneLandscape() {
  // 600-767px = phone landscape
  mockMediaQueryResults = {
    [`(min-width: ${DEVICE_BREAKPOINTS.PHONE}px) and (max-width: ${DEVICE_BREAKPOINTS.PHONE_LANDSCAPE - 1}px)`]: true,
  };
}

function setViewportDesktop() {
  // >= 1200px = desktop
  mockMediaQueryResults = {
    [`(min-width: ${DEVICE_BREAKPOINTS.DESKTOP}px)`]: true,
  };
}

describe('useResponsive', () => {
  beforeEach(() => {
    mockIsElectron = false;
    mockMediaQueryResults = {};
  });

  describe('browser (non-Electron)', () => {
    it('returns isMobile=true at phone viewport', () => {
      setViewportPhone();
      const { result } = renderHook(() => useResponsive());
      expect(result.current.isMobile).toBe(true);
      expect(result.current.isPhone).toBe(true);
      expect(result.current.deviceType).toBe('phone');
    });

    it('returns isMobile=true at phone landscape viewport', () => {
      setViewportPhoneLandscape();
      const { result } = renderHook(() => useResponsive());
      expect(result.current.isMobile).toBe(true);
      expect(result.current.isPhoneLandscape).toBe(true);
      expect(result.current.deviceType).toBe('phone');
    });

    it('returns isMobile=false at desktop viewport', () => {
      setViewportDesktop();
      const { result } = renderHook(() => useResponsive());
      expect(result.current.isMobile).toBe(false);
      expect(result.current.isDesktop).toBe(true);
      expect(result.current.deviceType).toBe('desktop');
    });
  });

  describe('Electron', () => {
    beforeEach(() => {
      mockIsElectron = true;
    });

    it('returns isMobile=false even at phone viewport', () => {
      setViewportPhone();
      const { result } = renderHook(() => useResponsive());
      expect(result.current.isMobile).toBe(false);
      expect(result.current.isPhone).toBe(false);
      expect(result.current.deviceType).not.toBe('phone');
    });

    it('returns isMobile=false at phone landscape viewport', () => {
      setViewportPhoneLandscape();
      const { result } = renderHook(() => useResponsive());
      expect(result.current.isMobile).toBe(false);
      expect(result.current.isPhoneLandscape).toBe(false);
      expect(result.current.deviceType).not.toBe('phone');
    });

    it('returns shouldUseTouchUI=false regardless of viewport', () => {
      setViewportPhone();
      // Also simulate touch device
      mockMediaQueryResults['(hover: none) and (pointer: coarse)'] = true;
      const { result } = renderHook(() => useResponsive());
      expect(result.current.shouldUseTouchUI).toBe(false);
    });

    it('preserves tablet/desktop detection', () => {
      setViewportDesktop();
      const { result } = renderHook(() => useResponsive());
      expect(result.current.isDesktop).toBe(true);
      expect(result.current.deviceType).toBe('desktop');
    });
  });
});
