/**
 * useResponsive Hook
 *
 * Provides responsive breakpoint detection for different device types.
 * Aligns with DEVICE_BREAKPOINTS from utils/breakpoints.ts
 */

import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { DEVICE_BREAKPOINTS } from '../utils/breakpoints';
import { isElectron } from '../utils/platform';

export type DeviceType = 'phone' | 'tablet' | 'desktop';

/**
 * Hook to detect device type and provide responsive utilities
 */
export const useResponsive = () => {
  const theme = useTheme();

  // Device type detection using our custom breakpoints
  const isPhone = useMediaQuery(`(max-width: ${DEVICE_BREAKPOINTS.PHONE - 1}px)`);
  const isPhoneLandscape = useMediaQuery(
    `(min-width: ${DEVICE_BREAKPOINTS.PHONE}px) and (max-width: ${DEVICE_BREAKPOINTS.PHONE_LANDSCAPE - 1}px)`
  );
  const isTabletPortrait = useMediaQuery(
    `(min-width: ${DEVICE_BREAKPOINTS.PHONE_LANDSCAPE}px) and (max-width: ${DEVICE_BREAKPOINTS.TABLET - 1}px)`
  );
  const isTabletLandscape = useMediaQuery(
    `(min-width: ${DEVICE_BREAKPOINTS.TABLET}px) and (max-width: ${DEVICE_BREAKPOINTS.DESKTOP - 1}px)`
  );
  const isDesktop = useMediaQuery(`(min-width: ${DEVICE_BREAKPOINTS.DESKTOP}px)`);

  // Electron is a desktop app — never use mobile layout regardless of window size
  const electron = isElectron();

  // Grouped checks for convenience
  const isMobile = electron ? false : (isPhone || isPhoneLandscape); // < 768px (use single-column mobile layout)
  const isTablet = isTabletPortrait || isTabletLandscape; // 768-1199px (use split-view tablet layout)

  // MUI breakpoint checks (for backward compatibility)
  const isXs = useMediaQuery(theme.breakpoints.only('xs')); // < 600px
  const isSm = useMediaQuery(theme.breakpoints.only('sm')); // 600-899px
  const isMd = useMediaQuery(theme.breakpoints.only('md')); // 900-1199px
  const isLg = useMediaQuery(theme.breakpoints.only('lg')); // 1200-1535px
  const isXl = useMediaQuery(theme.breakpoints.up('xl')); // >= 1536px

  // Orientation
  const isPortrait = useMediaQuery('(orientation: portrait)');
  const isLandscape = useMediaQuery('(orientation: landscape)');

  // Device type
  const effectiveIsPhone = electron ? false : isPhone;
  const effectiveIsPhoneLandscape = electron ? false : isPhoneLandscape;
  const deviceType: DeviceType = isMobile ? 'phone' : isTablet ? 'tablet' : 'desktop';

  // Touch capability
  const isTouchDevice = useMediaQuery('(hover: none) and (pointer: coarse)');

  // Should use mobile/tablet-optimized UI (touch-friendly, larger targets)
  const shouldUseTouchUI = electron ? false : (isTouchDevice || isMobile || isTablet);

  return {
    // Device type
    isMobile,    // < 768px - single column layout (always false on Electron)
    isTablet,    // 768-1199px - split view layout
    isDesktop,   // >= 1200px - full desktop layout
    deviceType,

    // Granular phone/tablet detection
    isPhone: effectiveIsPhone,           // < 600px (always false on Electron)
    isPhoneLandscape: effectiveIsPhoneLandscape,  // 600-767px (always false on Electron)
    isTabletPortrait,  // 768-1023px
    isTabletLandscape, // 1024-1199px

    // MUI breakpoints (backward compatibility)
    isXs,
    isSm,
    isMd,
    isLg,
    isXl,

    // Orientation
    isPortrait,
    isLandscape,

    // Capabilities
    isTouchDevice,
    shouldUseTouchUI,
  };
};

/**
 * Simple hook for just mobile detection
 * Returns true for phone and phone landscape (< 768px).
 * Always false in Electron — a narrow desktop window is not a phone
 * (mirrors the Electron gate in useResponsive).
 */
export const useMobileBreakpoint = (): boolean => {
  const matches = useMediaQuery(`(max-width: ${DEVICE_BREAKPOINTS.PHONE_LANDSCAPE - 1}px)`);
  return matches && !isElectron();
};

/**
 * Hook for tablet detection
 * Returns true for tablet portrait and landscape (768-1199px)
 */
export const useTabletBreakpoint = (): boolean => {
  return useMediaQuery(
    `(min-width: ${DEVICE_BREAKPOINTS.PHONE_LANDSCAPE}px) and (max-width: ${DEVICE_BREAKPOINTS.DESKTOP - 1}px)`
  );
};

/**
 * Hook for detecting if we should show mobile/tablet UI
 * Returns true for anything < 1200px
 */
export const useCompactLayout = (): boolean => {
  return useMediaQuery(`(max-width: ${DEVICE_BREAKPOINTS.DESKTOP - 1}px)`);
};
