import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLongPress } from '../../hooks/useSwipeGesture';

/** Build a touch-like event object accepted by the hook's handlers. */
function touchEvent(
  target: EventTarget,
  currentTarget: EventTarget,
  x = 0,
  y = 0,
) {
  const point = { clientX: x, clientY: y };
  return {
    target,
    currentTarget,
    touches: [point],
    changedTouches: [point],
  } as unknown as React.TouchEvent;
}

describe('useLongPress', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires onLongPress with the origin point after the delay', () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const el = document.createElement('div');
    const { result } = renderHook(() => useLongPress(onLongPress, { delay: 500 }));

    act(() => result.current.onTouchStart(touchEvent(el, el, 12, 34)));
    expect(onLongPress).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onLongPress).toHaveBeenCalledWith({ x: 12, y: 34 });
  });

  it('cancels when the pointer moves beyond the slop threshold', () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const el = document.createElement('div');
    const { result } = renderHook(() =>
      useLongPress(onLongPress, { delay: 500, slop: 10 }),
    );

    act(() => result.current.onTouchStart(touchEvent(el, el, 0, 0)));
    act(() => result.current.onTouchMove(touchEvent(el, el, 25, 0)));
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('does not cancel on small movements within the slop threshold', () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const el = document.createElement('div');
    const { result } = renderHook(() =>
      useLongPress(onLongPress, { delay: 500, slop: 10 }),
    );

    act(() => result.current.onTouchStart(touchEvent(el, el, 0, 0)));
    act(() => result.current.onTouchMove(touchEvent(el, el, 5, 5)));
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('cancels on early release', () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const el = document.createElement('div');
    const { result } = renderHook(() => useLongPress(onLongPress, { delay: 500 }));

    act(() => result.current.onTouchStart(touchEvent(el, el)));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => result.current.onTouchEnd());
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('skips gestures that start on a nested interactive element', () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const wrapper = document.createElement('div');
    const button = document.createElement('button');
    wrapper.appendChild(button);
    const { result } = renderHook(() => useLongPress(onLongPress, { delay: 500 }));

    // target is the nested <button>, currentTarget is the bound wrapper
    act(() => result.current.onTouchStart(touchEvent(button, wrapper)));
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('still fires when the bound element itself is a role=button row', () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const row = document.createElement('div');
    row.setAttribute('role', 'button');
    const { result } = renderHook(() => useLongPress(onLongPress, { delay: 500 }));

    // target === currentTarget === the role=button row
    act(() => result.current.onTouchStart(touchEvent(row, row)));
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('does nothing when disabled', () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const el = document.createElement('div');
    const { result } = renderHook(() =>
      useLongPress(onLongPress, { delay: 500, enabled: false }),
    );

    act(() => result.current.onTouchStart(touchEvent(el, el)));
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('suppresses the native context menu only right after a long-press fires', () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const el = document.createElement('div');
    const { result } = renderHook(() => useLongPress(onLongPress, { delay: 500 }));

    // Before any long-press, a context menu event passes through
    const passthrough = { preventDefault: vi.fn() } as unknown as React.MouseEvent;
    act(() => result.current.onContextMenu(passthrough));
    expect(passthrough.preventDefault).not.toHaveBeenCalled();

    // After a long-press fires, the following context menu is suppressed
    act(() => result.current.onTouchStart(touchEvent(el, el)));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const suppressed = { preventDefault: vi.fn() } as unknown as React.MouseEvent;
    act(() => result.current.onContextMenu(suppressed));
    expect(suppressed.preventDefault).toHaveBeenCalledTimes(1);

    // The triggered flag persists until the next press starts (consumers read
    // isLongPressTriggered() in onClick to swallow post-long-press ghost
    // clicks on browsers that never fire the synthetic contextmenu)
    expect(result.current.isLongPressTriggered()).toBe(true);

    // A new press resets the flag, so its context menu passes through again
    act(() => result.current.onTouchStart(touchEvent(el, el)));
    act(() => result.current.onTouchEnd());
    const next = { preventDefault: vi.fn() } as unknown as React.MouseEvent;
    act(() => result.current.onContextMenu(next));
    expect(next.preventDefault).not.toHaveBeenCalled();
    expect(result.current.isLongPressTriggered()).toBe(false);
  });
});
