import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '../../hooks/useDebounce';

describe('useDebounce', () => {
  it('returns initial value immediately', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDebounce('hello', 500));
    expect(result.current).toBe('hello');
    vi.useRealTimers();
  });

  it('returns updated value after delay', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'hello', delay: 500 } },
    );

    rerender({ value: 'world', delay: 500 });
    // Before delay, still old value
    expect(result.current).toBe('hello');

    // After delay
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe('world');
    vi.useRealTimers();
  });

  it('resets timer on rapid changes and only emits final value', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'a', delay: 500 } },
    );

    rerender({ value: 'b', delay: 500 });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    rerender({ value: 'c', delay: 500 });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Still hasn't fired for 'b' or 'c'
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Now 500ms since last change ('c')
    expect(result.current).toBe('c');
    vi.useRealTimers();
  });
});
