/**
 * Determines whether a given channel/DM context is the one the user is
 * currently looking at, AND the tab is focused/visible.
 *
 * Used to suppress transient unread-badge increments for messages arriving
 * in the conversation the user is already actively viewing — those get
 * cleared moments later by visible-range markAsRead anyway, so incrementing
 * first just causes a one-frame badge flash.
 *
 * Mirrors the "is the user viewing this context" precedent in
 * useNotificationSideEffects.ts (used there to suppress sound/desktop
 * notifications), but reads the route directly via `window.location` since
 * this runs outside React (socket-hub handlers have no access to router
 * context).
 */

import { getActiveDmGroupId } from './activeDmTracking';

export function isContextViewedAndFocused(
  channelId?: string | null,
  dmGroupId?: string | null,
): boolean {
  const focused = document.hasFocus() && document.visibilityState === 'visible';
  if (!focused) return false;

  if (channelId) {
    // Boundary-safe match — a bare includes() would let one id prefix-match
    // another (e.g. `ch-1` vs `/channel/ch-10`).
    const segment = `/channel/${channelId}`;
    const path = window.location.pathname;
    if (path.endsWith(segment) || path.includes(`${segment}/`)) {
      return true;
    }
  }

  if (dmGroupId && getActiveDmGroupId() === dmGroupId) {
    return true;
  }

  return false;
}
