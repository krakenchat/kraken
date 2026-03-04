import { useState, useEffect } from 'react';

/**
 * Returns whether the browser window/tab is currently focused.
 * Uses document.hasFocus() as initial value and listens to
 * focus/blur/visibilitychange events.
 */
export function useWindowFocus(): boolean {
  const [isFocused, setIsFocused] = useState(() =>
    typeof document !== 'undefined' ? document.hasFocus() : true,
  );

  useEffect(() => {
    const onFocus = () => setIsFocused(true);
    const onBlur = () => setIsFocused(false);
    const onVisibilityChange = () =>
      setIsFocused(document.visibilityState === 'visible' && document.hasFocus());

    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return isFocused;
}
