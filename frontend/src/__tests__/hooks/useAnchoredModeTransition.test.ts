import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAnchoredModeTransition } from '../../hooks/useAnchoredModeTransition';

describe('useAnchoredModeTransition', () => {
  it('does not call jumpToPresent on initial mount even if atBottom/hasNewer already satisfy the condition', () => {
    // Regression: atBottom starts as the stale default (true) on the very
    // render where mode first flips to 'anchored' — VirtualMessageList's own
    // centering effect hasn't reported the real (centered) position yet.
    // Without the "has been away from bottom" guard this would fire a false
    // jumpToPresent before the reader ever saw the anchored view.
    const jumpToPresent = vi.fn();
    renderHook(() =>
      useAnchoredModeTransition({
        mode: 'anchored',
        atBottom: true,
        hasNewer: false,
        isLoadingNewer: false,
        jumpToPresent,
      }),
    );
    expect(jumpToPresent).not.toHaveBeenCalled();
  });

  it('calls jumpToPresent once atBottom has been observed false and then becomes true with no newer pages left', () => {
    const jumpToPresent = vi.fn();
    const { rerender } = renderHook(
      (props: { atBottom: boolean; hasNewer?: boolean; isLoadingNewer?: boolean }) =>
        useAnchoredModeTransition({
          mode: 'anchored',
          jumpToPresent,
          ...props,
        }),
      { initialProps: { atBottom: false, hasNewer: true, isLoadingNewer: false } },
    );
    expect(jumpToPresent).not.toHaveBeenCalled();

    // The reader scrolls to the bottom of the loaded anchored window; newer
    // pages are still available, so no auto-exit yet.
    rerender({ atBottom: true, hasNewer: true, isLoadingNewer: false });
    expect(jumpToPresent).not.toHaveBeenCalled();

    // Loading catches up; hasNewer flips false while pinned to the bottom.
    rerender({ atBottom: true, hasNewer: false, isLoadingNewer: false });
    expect(jumpToPresent).toHaveBeenCalledTimes(1);
  });

  it('does not call jumpToPresent while isLoadingNewer is true', () => {
    const jumpToPresent = vi.fn();
    const { rerender } = renderHook(
      (props: { atBottom: boolean; hasNewer?: boolean; isLoadingNewer?: boolean }) =>
        useAnchoredModeTransition({
          mode: 'anchored',
          jumpToPresent,
          ...props,
        }),
      { initialProps: { atBottom: false, hasNewer: false, isLoadingNewer: true } },
    );
    rerender({ atBottom: true, hasNewer: false, isLoadingNewer: true });
    expect(jumpToPresent).not.toHaveBeenCalled();
  });

  it('does not call jumpToPresent in normal mode', () => {
    const jumpToPresent = vi.fn();
    const { rerender } = renderHook(
      (props: { atBottom: boolean; hasNewer?: boolean }) =>
        useAnchoredModeTransition({
          mode: 'normal',
          isLoadingNewer: false,
          jumpToPresent,
          ...props,
        }),
      { initialProps: { atBottom: false, hasNewer: true } },
    );
    rerender({ atBottom: true, hasNewer: false });
    expect(jumpToPresent).not.toHaveBeenCalled();
  });

  it('resets the away-from-bottom guard when mode leaves anchored, so a later re-entry needs a fresh away-from-bottom observation', () => {
    const jumpToPresent = vi.fn();
    const { rerender } = renderHook(
      (props: {
        mode: 'normal' | 'anchored';
        atBottom: boolean;
        hasNewer?: boolean;
      }) =>
        useAnchoredModeTransition({
          isLoadingNewer: false,
          jumpToPresent,
          ...props,
        }),
      {
        initialProps: {
          mode: 'anchored' as 'normal' | 'anchored',
          atBottom: false,
          hasNewer: true as boolean | undefined,
        },
      },
    );

    // Away from bottom once, then back to normal mode (e.g. jumpToPresent
    // already fired once for a prior anchor) before a new anchor session
    // starts.
    rerender({ mode: 'normal', atBottom: true, hasNewer: undefined });
    rerender({ mode: 'anchored', atBottom: true, hasNewer: false });

    // Re-entering anchored mode with atBottom already true (stale default,
    // same race as initial mount) must not immediately re-fire.
    expect(jumpToPresent).not.toHaveBeenCalled();
  });

  it('does not call jumpToPresent when jumpToPresent is not provided', () => {
    const { rerender } = renderHook(
      (props: { atBottom: boolean; hasNewer?: boolean }) =>
        useAnchoredModeTransition({
          mode: 'anchored',
          isLoadingNewer: false,
          ...props,
        }),
      { initialProps: { atBottom: false, hasNewer: true } },
    );
    // Should not throw when jumpToPresent is undefined.
    expect(() => rerender({ atBottom: true, hasNewer: false })).not.toThrow();
  });
});
