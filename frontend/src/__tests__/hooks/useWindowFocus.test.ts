import { renderHook, act } from '@testing-library/react';
import { useWindowFocus } from '../../hooks/useWindowFocus';

describe('useWindowFocus', () => {
  let originalHasFocus: () => boolean;

  beforeEach(() => {
    originalHasFocus = document.hasFocus;
  });

  afterEach(() => {
    document.hasFocus = originalHasFocus;
  });

  it('should return true when document has focus', () => {
    document.hasFocus = () => true;
    const { result } = renderHook(() => useWindowFocus());
    expect(result.current).toBe(true);
  });

  it('should return false when document does not have focus', () => {
    document.hasFocus = () => false;
    const { result } = renderHook(() => useWindowFocus());
    expect(result.current).toBe(false);
  });

  it('should update to true on window focus event', () => {
    document.hasFocus = () => false;
    const { result } = renderHook(() => useWindowFocus());
    expect(result.current).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(result.current).toBe(true);
  });

  it('should update to false on window blur event', () => {
    document.hasFocus = () => true;
    const { result } = renderHook(() => useWindowFocus());
    expect(result.current).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(result.current).toBe(false);
  });

  it('should clean up event listeners on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useWindowFocus());

    expect(addSpy).toHaveBeenCalledWith('focus', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('blur', expect.any(Function));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('focus', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('blur', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
