/**
 * Responsive breakpoint constants
 * Based on Material-UI breakpoint system
 */

export const BREAKPOINTS = {
  xs: 0,      // Phone portrait
  sm: 600,    // Phone landscape / Small tablet
  md: 900,    // Tablet portrait
  lg: 1200,   // Desktop
  xl: 1536,   // Large desktop
} as const;

export const MOBILE_MAX_WIDTH = BREAKPOINTS.md - 1;  // 899px
export const TABLET_MAX_WIDTH = BREAKPOINTS.lg - 1;  // 1199px

/**
 * Layout dimensions
 */
export const LAYOUT_CONSTANTS = {
  APPBAR_HEIGHT: 64,
  APPBAR_HEIGHT_MOBILE: 56,
  SIDEBAR_WIDTH: 80,
  SIDEBAR_WIDTH_EXPANDED: 320,
  CHANNEL_LIST_WIDTH: 280,
  VOICE_BAR_HEIGHT: 64,
  VOICE_BAR_HEIGHT_MOBILE: 72,
  BOTTOM_NAV_HEIGHT: 56,
  BOTTOM_NAV_HEIGHT_MOBILE: 56,
  MIN_TOUCH_TARGET: 48,
} as const;

/**
 * Mobile-specific constants
 */
export const MOBILE_CONSTANTS = {
  DRAWER_WIDTH: 280,
  DRAWER_WIDTH_FULL: '85vw',
  COMMUNITY_AVATAR_SIZE: 64,
  CHANNEL_ITEM_HEIGHT: 56,
  MESSAGE_AVATAR_SIZE: 32,
  SWIPE_THRESHOLD: 50, // pixels
  LONG_PRESS_DURATION: 500, // milliseconds
} as const;
