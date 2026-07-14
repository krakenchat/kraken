/**
 * Maps a parsed `semaphore://` deep link (see `electron/deep-link-parser.ts`
 * and `types/electron-api.ts#DeepLinkRoute`) onto the app's actual
 * HashRouter paths (see App.tsx's route table) and decides whether a route
 * requires an authenticated session to reach.
 *
 * v1 note: deep links carry no server/host information — they always
 * resolve within whichever server is currently active (see
 * `utils/serverStorage.ts`). A link can't jump the user to a different
 * configured server; if that's ever needed, the URL shape will need a host
 * or query param carrying a server id.
 */

import type { DeepLinkRoute } from '../types/electron-api';

/**
 * Whether reaching this route requires an authenticated session. Used by
 * `useDeepLinks` to decide between navigating immediately and stashing the
 * route until AuthGate reports the user is signed in.
 *
 * `invite` is intentionally false — `/join/:inviteCode` is a public route
 * (see App.tsx), reachable while logged out.
 */
export function deepLinkRouteRequiresAuth(route: DeepLinkRoute): boolean {
  return route.type !== 'invite';
}

/**
 * Convert a parsed route into the app-relative path react-router should
 * navigate to (e.g. `/community/<id>`). Returns `null` for anything that
 * isn't a recognized route shape — callers should log and ignore rather
 * than navigate.
 */
export function mapDeepLinkRouteToPath(route: DeepLinkRoute): string | null {
  switch (route.type) {
    case 'community':
      return `/community/${route.communityId}`;
    case 'channel':
      return `/community/${route.communityId}/channel/${route.channelId}`;
    case 'dm-inbox':
      return '/direct-messages';
    case 'dm':
      return `/direct-messages/${route.dmGroupId}`;
    case 'invite':
      return `/join/${route.inviteCode}`;
    default:
      return null;
  }
}
