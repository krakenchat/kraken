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
 *     // Pass a fallback (e.g. the list's scroll container) for
 *     // presence-driven lists, where the triggering row can unmount
 *     // (e.g. a voice participant disconnects) while the menu is still
 *     // closing — see the `restoreFocus` fallback param below.
 *     restoreFocus(listContainerRef.current);
 *   };
 *
 * The triggering element must be focusable (a natively focusable element,
 * or a plain element with `tabIndex={-1}`) for `restoreFocus` to have any
 * effect. The same applies to the optional fallback element.
 */
export function useContextMenuFocusRestore() {
  const triggerRef = useRef<HTMLElement | null>(null);

  const captureTrigger = useCallback((target: HTMLElement | null) => {
    triggerRef.current = target;
  }, []);

  /**
   * Restores focus to the captured trigger, deferred a frame so the menu's
   * exit transition / focus-trap teardown finishes first (otherwise MUI's
   * Modal can steal focus back, or focus a mid-transition node that's about
   * to unmount).
   *
   * In presence-driven lists (e.g. voice participants, online members) the
   * triggering row can unmount *during* that deferred frame — for example a
   * participant disconnects while their row's context menu is closing.
   * Calling `.focus()` on an already-detached node is a silent no-op, and
   * focus would otherwise drop to `<body>`. If a `fallback` element is
   * given (e.g. the list's scroll container — something stable that
   * outlives any individual row), it receives focus instead whenever the
   * trigger is no longer connected to the document by the time the frame
   * runs. Without a fallback, this case is a documented no-op.
   */
  const restoreFocus = useCallback((fallback?: HTMLElement | null) => {
    const el = triggerRef.current;
    if (!el && !fallback) return;
    requestAnimationFrame(() => {
      const target = el?.isConnected ? el : fallback;
      target?.focus();
    });
  }, []);

  return { captureTrigger, restoreFocus };
}
