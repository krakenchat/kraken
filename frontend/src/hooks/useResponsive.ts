import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

/**
 * Hook to detect device type and provide responsive utilities
 */
export const useResponsive = () => {
  const theme = useTheme();

  // Breakpoint checks
  const isMobile = useMediaQuery(theme.breakpoints.down('md')); // < 900px
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg')); // 900-1199px
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg')); // >= 1200px

  // More specific checks
  const isXs = useMediaQuery(theme.breakpoints.only('xs')); // < 600px
  const isSm = useMediaQuery(theme.breakpoints.only('sm')); // 600-899px
  const isMd = useMediaQuery(theme.breakpoints.only('md')); // 900-1199px
  const isLg = useMediaQuery(theme.breakpoints.only('lg')); // 1200-1535px
  const isXl = useMediaQuery(theme.breakpoints.up('xl')); // >= 1536px

  // Orientation
  const isPortrait = useMediaQuery('(orientation: portrait)');
  const isLandscape = useMediaQuery('(orientation: landscape)');

  // Device type
  const deviceType: DeviceType = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';

  // Touch capability
  const isTouchDevice = useMediaQuery('(hover: none) and (pointer: coarse)');

  return {
    // Device type
    isMobile,
    isTablet,
    isDesktop,
    deviceType,

    // Specific breakpoints
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
  };
};

/**
 * Simple hook for just mobile detection
 */
export const useMobileBreakpoint = (): boolean => {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down('md'));
};
