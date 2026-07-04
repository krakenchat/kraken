import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';

/** Build a touch-like event accepted by the swipe handlers. */
function touch(x: number, y: number, target: EventTarget = document.createElement('div')) {
  const point = { clientX: x, clientY: y };
  return {
    target,
    targetTouches: [point],
    touches: [point],
    changedTouches: [point],
  } as unknown as React.TouchEvent;
}

function swipe(
  result: { current: ReturnType<typeof useSwipeGesture> },
  from: [number, number],
  to: [number, number],
  target?: EventTarget,
) {
  act(() => result.current.onTouchStart(touch(from[0], from[1], target)));
  act(() => result.current.onTouchMove(touch(to[0], to[1], target)));
  act(() => result.current.onTouchEnd());
}

describe('useSwipeGesture', () => {
  // jsdom default innerWidth is 1024; edges are near 0 and near 1024.

  it('fires onSwipeRight for a clear rightward drag', () => {
    const onSwipeRight = vi.fn();
    const onSwipeLeft = vi.fn();
    const { result } = renderHook(() =>
      useSwipeGesture({ onSwipeRight, onSwipeLeft, directionRatio: 1.5 }),
    );

    swipe(result, [200, 100], [360, 100]);

    expect(onSwipeRight).toHaveBeenCalledTimes(1);
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('fires onSwipeLeft for a clear leftward drag', () => {
    const onSwipeRight = vi.fn();
    const onSwipeLeft = vi.fn();
    const { result } = renderHook(() =>
      useSwipeGesture({ onSwipeRight, onSwipeLeft, directionRatio: 1.5 }),
    );

    swipe(result, [360, 100], [200, 100]);

    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('does not fire horizontal callbacks for a mostly-vertical drag (scroll)', () => {
    const onSwipeRight = vi.fn();
    const onSwipeLeft = vi.fn();
    const onSwipeDown = vi.fn();
    const { result } = renderHook(() =>
      useSwipeGesture({ onSwipeRight, onSwipeLeft, onSwipeDown, directionRatio: 1.5 }),
    );

    // Large vertical, small horizontal — must not register as left/right.
    swipe(result, [200, 100], [215, 320]);

    expect(onSwipeRight).not.toHaveBeenCalled();
    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeDown).toHaveBeenCalledTimes(1);
  });

  it('ignores a swipe that starts within the edge zone when ignoreEdgeSwipes is set', () => {
    const onSwipeRight = vi.fn();
    const { result } = renderHook(() =>
      useSwipeGesture({ onSwipeRight, ignoreEdgeSwipes: true, edgeZone: 24, directionRatio: 1.5 }),
    );

    // Starts at x=10 (< 24px from left edge) → ignored.
    swipe(result, [10, 100], [250, 100]);

    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('still fires when ignoreEdgeSwipes is off even if started near the edge', () => {
    const onSwipeRight = vi.fn();
    const { result } = renderHook(() =>
      useSwipeGesture({ onSwipeRight, ignoreEdgeSwipes: false, edgeZone: 24, directionRatio: 1.5 }),
    );

    swipe(result, [10, 100], [250, 100]);

    expect(onSwipeRight).toHaveBeenCalledTimes(1);
  });

  it('ignores a swipe that starts on an exempt element', () => {
    const onSwipeRight = vi.fn();
    const exemptEl = document.createElement('pre');
    const { result } = renderHook(() =>
      useSwipeGesture({
        onSwipeRight,
        directionRatio: 1.5,
        isExempt: (t) => t instanceof Element && !!t.closest('pre'),
      }),
    );

    swipe(result, [200, 100], [360, 100], exemptEl);

    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('does nothing when disabled', () => {
    const onSwipeRight = vi.fn();
    const { result } = renderHook(() =>
      useSwipeGesture({ onSwipeRight, enabled: false }),
    );

    swipe(result, [200, 100], [360, 100]);

    expect(onSwipeRight).not.toHaveBeenCalled();
  });
});
