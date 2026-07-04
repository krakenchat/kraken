import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePullToRefresh } from '../../hooks/useSwipeGesture';

function touchY(y: number) {
  return { touches: [{ clientY: y }] } as unknown as React.TouchEvent;
}

/** A ref to a fake scroll element with a controllable scrollTop. */
function scrollRef(scrollTop = 0) {
  return { current: { scrollTop } as unknown as HTMLElement };
}

describe('usePullToRefresh', () => {
  it('triggers onRefresh when pulled past the threshold from the top', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const ref = scrollRef(0);
    const { result } = renderHook(() =>
      usePullToRefresh(onRefresh, { threshold: 80, scrollElementRef: ref }),
    );

    act(() => result.current.onTouchStart(touchY(0)));
    act(() => result.current.onTouchMove(touchY(120))); // 120 > 80
    await act(async () => {
      await result.current.onTouchEnd();
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('does not trigger when the pull is short of the threshold', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const ref = scrollRef(0);
    const { result } = renderHook(() =>
      usePullToRefresh(onRefresh, { threshold: 80, scrollElementRef: ref }),
    );

    act(() => result.current.onTouchStart(touchY(0)));
    act(() => result.current.onTouchMove(touchY(40))); // 40 < 80
    await act(async () => {
      await result.current.onTouchEnd();
    });

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('does not trigger when the scroll region is not at the top', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const ref = scrollRef(50); // scrolled down
    const { result } = renderHook(() =>
      usePullToRefresh(onRefresh, { threshold: 80, scrollElementRef: ref }),
    );

    act(() => result.current.onTouchStart(touchY(0)));
    act(() => result.current.onTouchMove(touchY(120)));
    await act(async () => {
      await result.current.onTouchEnd();
    });

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('does nothing when disabled', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const ref = scrollRef(0);
    const { result } = renderHook(() =>
      usePullToRefresh(onRefresh, { threshold: 80, enabled: false, scrollElementRef: ref }),
    );

    act(() => result.current.onTouchStart(touchY(0)));
    act(() => result.current.onTouchMove(touchY(120)));
    await act(async () => {
      await result.current.onTouchEnd();
    });

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('exposes reactive isRefreshing state during the refresh', async () => {
    let resolveRefresh: () => void = () => {};
    const onRefresh = vi.fn(
      () => new Promise<void>((resolve) => { resolveRefresh = resolve; }),
    );
    const ref = scrollRef(0);
    const { result } = renderHook(() =>
      usePullToRefresh(onRefresh, { threshold: 80, scrollElementRef: ref }),
    );

    act(() => result.current.onTouchStart(touchY(0)));
    act(() => result.current.onTouchMove(touchY(120)));

    let endPromise: Promise<void>;
    act(() => {
      endPromise = result.current.onTouchEnd();
    });

    await waitFor(() => expect(result.current.isRefreshing).toBe(true));

    await act(async () => {
      resolveRefresh();
      await endPromise;
    });

    expect(result.current.isRefreshing).toBe(false);
  });
});
