/**
 * Pure decision logic for the push notification / notificationclick handlers
 * in `sw-custom.ts`. Extracted so it's unit-testable under Vitest — this
 * module must stay import-safe from both the service worker (no DOM/window
 * globals, no workbox imports) and a plain Node/jsdom test runner.
 */

// Push notification types
export interface PushNotificationData {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    notificationId?: string;
    channelId?: string | null;
    communityId?: string | null;
    directMessageGroupId?: string | null;
    type?: string;
    markReadToken?: string;
  };
}

/**
 * Determine the in-app hash to navigate to when a notification body is
 * clicked (app uses HashRouter, so paths must be under /#/).
 */
export function getNavigationHash(data: PushNotificationData['data']): string {
  if (data?.communityId && data?.channelId) {
    return `#/community/${data.communityId}/channel/${data.channelId}`;
  } else if (data?.directMessageGroupId) {
    return `#/direct-messages/${data.directMessageGroupId}`;
  }
  return '#/';
}

/**
 * Feature-detect notification action button support (Chromium yes, iOS
 * Safari no). Takes the `Notification` constructor as a parameter so it's
 * testable without a DOM global — the SW passes the real global. Must not
 * throw when passed `undefined` (e.g. an environment with no `Notification`).
 */
export function supportsNotificationActions(notificationCtor: unknown): boolean {
  // The real `Notification` global is a constructor (typeof 'function');
  // accept plain objects too for test doubles.
  if (
    !notificationCtor ||
    (typeof notificationCtor !== 'function' &&
      typeof notificationCtor !== 'object')
  ) {
    return false;
  }
  const maxActions = (notificationCtor as { maxActions?: unknown }).maxActions;
  return typeof maxActions === 'number' && maxActions > 0;
}

/**
 * Build the options object passed to `registration.showNotification`. Adds
 * the "Mark as read" action only when the platform supports actions and the
 * payload carries a `markReadToken` (i.e. the backend authorized the action).
 */
export function buildNotificationOptions(
  data: PushNotificationData,
  supportsActions: boolean,
): NotificationOptions & {
  vibrate: number[];
  actions?: { action: string; title: string }[];
} {
  // `vibrate` and `actions` are non-standard (but widely supported)
  // notification options missing from the TS lib's NotificationOptions.
  const options: NotificationOptions & {
    vibrate: number[];
    actions?: { action: string; title: string }[];
  } = {
    body: data.body,
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    tag: data.tag,
    data: data.data,
    vibrate: [200, 100, 200],
    requireInteraction: false,
  };

  if (supportsActions && data.data?.markReadToken) {
    options.actions = [{ action: 'mark-read', title: 'Mark as read' }];
  }

  return options;
}

/**
 * Build the fetch request for the "Mark as read" notification action.
 * Returns `null` when the payload carries no `markReadToken` (nothing to
 * authorize the call with). Same-origin relative URL — the SW only ever
 * serves the web origin, where /api is proxied.
 */
export function getMarkReadRequest(
  data: PushNotificationData['data'],
): { url: string; init: RequestInit } | null {
  const token = data?.markReadToken;
  if (!token) {
    return null;
  }
  return {
    url: '/api/notifications/push/mark-read',
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    },
  };
}
