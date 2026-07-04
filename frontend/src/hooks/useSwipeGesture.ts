/**
 * useSwipeGesture Hook
 *
 * Enhanced swipe gesture handling with edge detection,
 * progress callbacks, and velocity tracking.
 */

import { useRef, useEffect, TouchEvent, useCallback } from 'react';
import { MOBILE_CONSTANTS } from '../utils/breakpoints';
import { useHapticFeedback } from './useHapticFeedback';

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

interface TouchPosition {
  x: number;
  y: number;
  time: number;
}

interface SwipeGestureOptions {
  // Direction callbacks
  onSwipe?: (direction: SwipeDirection, velocity: number) => void;
  onSwipeLeft?: (velocity: number) => void;
  onSwipeRight?: (velocity: number) => void;
  onSwipeUp?: (velocity: number) => void;
  onSwipeDown?: (velocity: number) => void;

  // Progress callback (called during swipe)
  onProgress?: (deltaX: number, deltaY: number, progress: number) => void;

  // Edge swipe detection
  onEdgeSwipeStart?: (edge: 'left' | 'right') => void;
  edgeZone?: number; // Pixels from edge to detect edge swipe

  // Configuration
  threshold?: number; // Minimum distance for swipe
  velocityThreshold?: number; // Minimum velocity (px/ms)
  enabled?: boolean;
}

interface SwipeState {
  startedFromEdge: 'left' | 'right' | null;
  isSwiping: boolean;
}

/**
 * Hook for handling swipe gestures on mobile
 */
export const useSwipeGesture = (options: SwipeGestureOptions = {}) => {
  const {
    onSwipe,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onProgress,
    onEdgeSwipeStart,
    edgeZone = MOBILE_CONSTANTS.EDGE_SWIPE_ZONE,
    threshold = MOBILE_CONSTANTS.SWIPE_THRESHOLD,
    velocityThreshold = 0.3, // px/ms
    enabled = true,
  } = options;

  const touchStart = useRef<TouchPosition | null>(null);
  const touchEnd = useRef<TouchPosition | null>(null);
  const swipeState = useRef<SwipeState>({
    startedFromEdge: null,
    isSwiping: false,
  });

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled) return;

    const touch = e.targetTouches[0];
    const screenWidth = window.innerWidth;

    touchEnd.current = null;
    touchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };

    // Detect edge swipe
    let edge: 'left' | 'right' | null = null;
    if (touch.clientX <= edgeZone) {
      edge = 'left';
    } else if (touch.clientX >= screenWidth - edgeZone) {
      edge = 'right';
    }

    swipeState.current = {
      startedFromEdge: edge,
      isSwiping: false,
    };

    if (edge && onEdgeSwipeStart) {
      onEdgeSwipeStart(edge);
    }
  }, [enabled, edgeZone, onEdgeSwipeStart]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled || !touchStart.current) return;

    const touch = e.targetTouches[0];
    touchEnd.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };

    const deltaX = touchEnd.current.x - touchStart.current.x;
    const deltaY = touchEnd.current.y - touchStart.current.y;

    // Calculate progress (0 to 1) based on threshold
    const absX = Math.abs(deltaX);
    const progress = Math.min(absX / threshold, 1);

    // Mark as swiping if we've moved past a small distance
    if (absX > 10 || Math.abs(deltaY) > 10) {
      swipeState.current.isSwiping = true;
    }

    // Call progress callback
    if (onProgress) {
      onProgress(deltaX, deltaY, progress);
    }
  }, [enabled, threshold, onProgress]);

  const handleTouchEnd = useCallback(() => {
    if (!enabled || !touchStart.current || !touchEnd.current) {
      touchStart.current = null;
      touchEnd.current = null;
      swipeState.current = { startedFromEdge: null, isSwiping: false };
      return;
    }

    const deltaX = touchEnd.current.x - touchStart.current.x;
    const deltaY = touchEnd.current.y - touchStart.current.y;
    const deltaTime = touchEnd.current.time - touchStart.current.time;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Calculate velocity (px/ms)
    const velocity = absX / (deltaTime || 1);

    // Determine swipe direction
    let direction: SwipeDirection | null = null;

    // Only register swipe if:
    // 1. Distance exceeds threshold, OR
    // 2. Velocity exceeds threshold (fast swipe even if short)
    const meetsDistanceThreshold = (absX > absY && absX > threshold) ||
                                   (absY > absX && absY > threshold);
    const meetsVelocityThreshold = velocity > velocityThreshold;

    if (meetsDistanceThreshold || meetsVelocityThreshold) {
      if (absX > absY) {
        // Horizontal swipe
        direction = deltaX > 0 ? 'right' : 'left';
      } else {
        // Vertical swipe
        direction = deltaY > 0 ? 'down' : 'up';
      }
    }

    if (direction) {
      onSwipe?.(direction, velocity);

      switch (direction) {
        case 'left':
          onSwipeLeft?.(velocity);
          break;
        case 'right':
          onSwipeRight?.(velocity);
          break;
        case 'up':
          onSwipeUp?.(velocity);
          break;
        case 'down':
          onSwipeDown?.(velocity);
          break;
      }
    }

    // Reset state
    touchStart.current = null;
    touchEnd.current = null;
    swipeState.current = { startedFromEdge: null, isSwiping: false };
  }, [enabled, threshold, velocityThreshold, onSwipe, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  // Getter for current swipe state
  const getSwipeState = useCallback(() => ({
    ...swipeState.current,
    touchStart: touchStart.current,
    touchEnd: touchEnd.current,
  }), []);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    getSwipeState,
  };
};

export interface LongPressPoint {
  x: number;
  y: number;
}

const INTERACTIVE_TARGET_SELECTOR = 'a, button, input, textarea, select, [role="button"]';

/**
 * Extract the pointer coordinates from a touch or mouse event.
 */
const getEventPoint = (e: TouchEvent | React.MouseEvent): LongPressPoint | null => {
  if ('touches' in e) {
    const touch = e.touches[0] ?? e.changedTouches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
  }
  return { x: e.clientX, y: e.clientY };
};

/**
 * Whether the gesture started on a *nested* interactive element (link, button,
 * input, etc.) — one below the element the long-press is bound to. The bound
 * element itself is allowed even if it is a button/role=button (e.g. a
 * ListItemButton row), so long-press still works while nested controls keep
 * their own behavior.
 */
const startedOnInteractiveElement = (
  target: EventTarget | null,
  currentTarget: EventTarget | null,
): boolean => {
  if (!(target instanceof Element)) return false;
  const interactive = target.closest(INTERACTIVE_TARGET_SELECTOR);
  return !!interactive && interactive !== currentTarget;
};

/**
 * Hook for handling long press gestures.
 *
 * Fires `onLongPress` (with the originating point) after `delay` ms of a
 * stationary press. Movement beyond the slop threshold, an early release, or a
 * press that begins on an interactive element all cancel the gesture. Also
 * returns an `onContextMenu` handler consumers can attach to suppress the
 * browser's native context menu / iOS callout right after a long-press fires.
 */
export const useLongPress = (
  onLongPress: (point: LongPressPoint | null) => void,
  options: {
    delay?: number;
    enabled?: boolean;
    slop?: number;
    onPressStart?: () => void;
    onPressEnd?: () => void;
  } = {}
) => {
  const {
    delay = MOBILE_CONSTANTS.LONG_PRESS_DURATION,
    enabled = true,
    slop = MOBILE_CONSTANTS.LONG_PRESS_SLOP,
    onPressStart,
    onPressEnd,
  } = options;

  const haptics = useHapticFeedback();
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isLongPressTriggered = useRef(false);
  const startPoint = useRef<LongPressPoint | null>(null);

  const clearTimer = useCallback(() => {
    if (timeout.current) {
      clearTimeout(timeout.current);
      timeout.current = undefined;
    }
  }, []);

  const start = useCallback((e: TouchEvent | React.MouseEvent) => {
    if (!enabled) return;
    if (startedOnInteractiveElement(e.target, e.currentTarget)) return;

    isLongPressTriggered.current = false;
    startPoint.current = getEventPoint(e);
    onPressStart?.();

    timeout.current = setTimeout(() => {
      isLongPressTriggered.current = true;
      haptics.longPress();
      onLongPress(startPoint.current);
    }, delay);
  }, [enabled, delay, onLongPress, onPressStart, haptics]);

  const move = useCallback((e: TouchEvent | React.MouseEvent) => {
    if (!timeout.current || !startPoint.current) return;

    const point = getEventPoint(e);
    if (!point) return;

    const dx = Math.abs(point.x - startPoint.current.x);
    const dy = Math.abs(point.y - startPoint.current.y);
    if (dx > slop || dy > slop) {
      clearTimer();
    }
  }, [slop, clearTimer]);

  const cancel = useCallback(() => {
    clearTimer();
    startPoint.current = null;
    onPressEnd?.();
  }, [clearTimer, onPressEnd]);

  // Suppress the native context menu / iOS callout that fires immediately after
  // a long-press. Only preventDefault when our long-press just fired so a real
  // desktop right-click still passes through (right-click's mousedown runs
  // start(), which clears the flag before contextmenu fires). The flag is NOT
  // reset here: browsers that skip the synthetic contextmenu (iOS) still fire
  // a ghost click afterwards, and consumers guard their onClick by reading
  // isLongPressTriggered(). It resets at the start of the next press.
  const onContextMenu = useCallback((e: React.MouseEvent) => {
    if (isLongPressTriggered.current) {
      e.preventDefault();
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timeout.current) {
        clearTimeout(timeout.current);
      }
    };
  }, []);

  return {
    onMouseDown: start,
    onMouseMove: move,
    onMouseUp: cancel,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchMove: move,
    onTouchEnd: cancel,
    onTouchCancel: cancel,
    onContextMenu,
    isLongPressTriggered: () => isLongPressTriggered.current,
  };
};

/**
 * Hook for pull-to-refresh gesture
 */
export const usePullToRefresh = (
  onRefresh: () => Promise<void>,
  options: { threshold?: number; enabled?: boolean } = {}
) => {
  const { threshold = 80, enabled = true } = options;

  const touchStart = useRef<number>(0);
  const pullDistance = useRef<number>(0);
  const isRefreshing = useRef<boolean>(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled || isRefreshing.current) return;

    // Only enable pull-to-refresh when scrolled to top
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    if (scrollTop > 0) return;

    touchStart.current = e.touches[0].clientY;
  }, [enabled]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled || isRefreshing.current || touchStart.current === 0) return;

    const touchY = e.touches[0].clientY;
    pullDistance.current = Math.max(0, touchY - touchStart.current);
  }, [enabled]);

  const handleTouchEnd = useCallback(async () => {
    if (!enabled || isRefreshing.current) return;

    if (pullDistance.current >= threshold) {
      isRefreshing.current = true;
      try {
        await onRefresh();
      } finally {
        isRefreshing.current = false;
      }
    }

    touchStart.current = 0;
    pullDistance.current = 0;
  }, [enabled, threshold, onRefresh]);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    getPullDistance: () => pullDistance.current,
    isRefreshing: () => isRefreshing.current,
  };
};
