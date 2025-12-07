/**
 * useHapticFeedback Hook
 *
 * Provides haptic feedback using the Vibration API.
 * Falls back gracefully on unsupported devices.
 */

import { useCallback } from 'react';

// Haptic feedback patterns (in milliseconds)
export const HAPTIC_PATTERNS = {
  // Light tap - selection, toggle
  light: [10],
  // Medium tap - button press
  medium: [20],
  // Heavy tap - important action
  heavy: [30],
  // Success - completion feedback
  success: [10, 50, 10],
  // Warning - attention needed
  warning: [30, 50, 30],
  // Error - something went wrong
  error: [50, 100, 50],
  // Selection change
  selection: [5],
  // Long press activation
  longPress: [15],
} as const;

export type HapticPattern = keyof typeof HAPTIC_PATTERNS;

/**
 * Check if haptic feedback is supported
 */
const isHapticSupported = (): boolean => {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
};

/**
 * Hook for triggering haptic feedback
 */
export const useHapticFeedback = () => {
  /**
   * Trigger a haptic pattern
   */
  const trigger = useCallback((pattern: HapticPattern | number[]) => {
    if (!isHapticSupported()) return;

    try {
      const vibrationPattern = Array.isArray(pattern)
        ? pattern
        : HAPTIC_PATTERNS[pattern];

      navigator.vibrate(vibrationPattern);
    } catch {
      // Silently fail - haptic feedback is optional
    }
  }, []);

  /**
   * Cancel any ongoing vibration
   */
  const cancel = useCallback(() => {
    if (!isHapticSupported()) return;

    try {
      navigator.vibrate(0);
    } catch {
      // Silently fail
    }
  }, []);

  // Convenience methods for common patterns
  const light = useCallback(() => trigger('light'), [trigger]);
  const medium = useCallback(() => trigger('medium'), [trigger]);
  const heavy = useCallback(() => trigger('heavy'), [trigger]);
  const success = useCallback(() => trigger('success'), [trigger]);
  const warning = useCallback(() => trigger('warning'), [trigger]);
  const error = useCallback(() => trigger('error'), [trigger]);
  const selection = useCallback(() => trigger('selection'), [trigger]);
  const longPress = useCallback(() => trigger('longPress'), [trigger]);

  return {
    trigger,
    cancel,
    isSupported: isHapticSupported(),
    // Convenience methods
    light,
    medium,
    heavy,
    success,
    warning,
    error,
    selection,
    longPress,
  };
};

export default useHapticFeedback;
