import { useCallback, useRef } from 'react';

/**
 * WAI-ARIA menu-button pattern for context menus opened via right-click or
 * long-press (`anchorPosition`-based MUI `Menu`/`Popover`s).
 *
 * Unlike anchorEl-based menus, MUI does not automatically know which
 * element "invoked" an anchorPosition menu (there is no anchor element to
 * return focus to), so focus is silently dropped when the menu closes.
 * This hook lets the opener capture the triggering element and restore
 * focus to it once the menu has finished closing.
 *
 * Usage:
 *   const { captureTrigger, restoreFocus } = useContextMenuFocusRestore();
 *   const handleContextMenu = (e) => {
 *     e.preventDefault();
 *     captureTrigger(e.currentTarget);
 *     setPosition({ top: e.clientY, left: e.clientX });
 *   };
 *   const handleClose = () => {
 *     setPosition(null);
 *     restoreFocus();
 *   };
 *
 * The triggering element must be focusable (a natively focusable element,
 * or a plain element with `tabIndex={-1}`) for `restoreFocus` to have any
 * effect.
 */
export function useContextMenuFocusRestore() {
  const triggerRef = useRef<HTMLElement | null>(null);

  const captureTrigger = useCallback((target: HTMLElement | null) => {
    triggerRef.current = target;
  }, []);

  const restoreFocus = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    // Deferred a frame: the menu's exit transition / focus-trap teardown
    // needs to finish first, otherwise MUI's Modal can steal focus back
    // (or focus a mid-transition node that's about to unmount).
    requestAnimationFrame(() => {
      el.focus();
    });
  }, []);

  return { captureTrigger, restoreFocus };
}
