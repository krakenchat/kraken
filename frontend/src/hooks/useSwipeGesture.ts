import { useRef, useEffect, TouchEvent } from 'react';
import { MOBILE_CONSTANTS } from '../utils/breakpoints';

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

interface SwipeGestureOptions {
  onSwipe?: (direction: SwipeDirection) => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number; // Minimum distance for swipe
  enabled?: boolean;
}

interface TouchPosition {
  x: number;
  y: number;
  time: number;
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
    threshold = MOBILE_CONSTANTS.SWIPE_THRESHOLD,
    enabled = true,
  } = options;

  const touchStart = useRef<TouchPosition | null>(null);
  const touchEnd = useRef<TouchPosition | null>(null);

  const handleTouchStart = (e: TouchEvent) => {
    if (!enabled) return;

    touchEnd.current = null;
    touchStart.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
      time: Date.now(),
    };
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!enabled) return;

    touchEnd.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
      time: Date.now(),
    };
  };

  const handleTouchEnd = () => {
    if (!enabled || !touchStart.current || !touchEnd.current) return;

    const deltaX = touchEnd.current.x - touchStart.current.x;
    const deltaY = touchEnd.current.y - touchStart.current.y;
    const deltaTime = touchEnd.current.time - touchStart.current.time;

    // Ignore if too slow (likely not a swipe)
    if (deltaTime > 500) return;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Determine swipe direction
    let direction: SwipeDirection | null = null;

    if (absX > absY) {
      // Horizontal swipe
      if (absX > threshold) {
        direction = deltaX > 0 ? 'right' : 'left';
      }
    } else {
      // Vertical swipe
      if (absY > threshold) {
        direction = deltaY > 0 ? 'down' : 'up';
      }
    }

    if (direction) {
      onSwipe?.(direction);

      switch (direction) {
        case 'left':
          onSwipeLeft?.();
          break;
        case 'right':
          onSwipeRight?.();
          break;
        case 'up':
          onSwipeUp?.();
          break;
        case 'down':
          onSwipeDown?.();
          break;
      }
    }

    touchStart.current = null;
    touchEnd.current = null;
  };

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };
};

/**
 * Hook for handling long press gestures
 */
export const useLongPress = (
  onLongPress: () => void,
  options: { delay?: number; enabled?: boolean } = {}
) => {
  const { delay = MOBILE_CONSTANTS.LONG_PRESS_DURATION, enabled = true } = options;

  const timeout = useRef<NodeJS.Timeout>();
  const target = useRef<EventTarget | null>(null);

  const start = (e: TouchEvent | React.MouseEvent) => {
    if (!enabled) return;

    target.current = e.target;
    timeout.current = setTimeout(() => {
      onLongPress();
    }, delay);
  };

  const cancel = (e: TouchEvent | React.MouseEvent) => {
    if (timeout.current) {
      clearTimeout(timeout.current);
    }
  };

  useEffect(() => {
    return () => {
      if (timeout.current) {
        clearTimeout(timeout.current);
      }
    };
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: cancel,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: cancel,
  };
};
