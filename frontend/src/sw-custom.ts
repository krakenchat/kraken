/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare let self: ServiceWorkerGlobalScope;

// Use the precache manifest that Workbox will inject
precacheAndRoute(self.__WB_MANIFEST);

// Clean up old caches
cleanupOutdatedCaches();

// Take control immediately
self.skipWaiting();
clientsClaim();

// Cache images
registerRoute(
  /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
  new CacheFirst({
    cacheName: 'image-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
      }),
    ],
  })
);

// Cache fonts
registerRoute(
  /\.(?:woff|woff2|ttf|eot)$/i,
  new CacheFirst({
    cacheName: 'font-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
      }),
    ],
  })
);

// Push notification types
interface PushNotificationData {
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
  };
}

/**
 * Set or clear the app-icon badge flag (Badging API, Chromium-only).
 * Always resolves — feature-detected and error-swallowed so badge support
 * can never break notification delivery or click handling.
 */
function setBadgeFlag(on: boolean): Promise<void> {
  const nav = self.navigator as Navigator & {
    setAppBadge?: () => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  const fn = on ? nav.setAppBadge : nav.clearAppBadge;
  if (typeof fn !== 'function') {
    return Promise.resolve();
  }
  return fn.call(nav).catch(() => {});
}

// Handle push notifications
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) {
    console.log('[SW] Push event with no data');
    return;
  }

  let data: PushNotificationData;
  try {
    data = event.data.json() as PushNotificationData;
  } catch {
    console.error('[SW] Failed to parse push data');
    return;
  }

  // `vibrate` is a non-standard (but widely supported) notification option
  // missing from the TS lib's NotificationOptions.
  const options: NotificationOptions & { vibrate: number[] } = {
    body: data.body,
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    tag: data.tag,
    data: data.data,
    vibrate: [200, 100, 200],
    requireInteraction: false,
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, options),
      // Flag the app icon (Badging API, Chromium-only). Count-less form: the
      // SW doesn't know the total unread count; the app sets the exact count
      // via useAppBadge whenever it's running.
      setBadgeFlag(true),
    ]),
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const data = event.notification.data as PushNotificationData['data'];

  // Determine the path to navigate to (app uses HashRouter, so paths must be under /#/)
  let hash = '#/';
  if (data?.communityId && data?.channelId) {
    hash = `#/community/${data.communityId}/channel/${data.channelId}`;
  } else if (data?.directMessageGroupId) {
    hash = `#/direct-messages?group=${data.directMessageGroupId}`;
  }

  const targetUrl = new URL(`/${hash}`, self.location.origin).href;

  // Clear the SW-set badge flag, then focus an existing same-origin window
  // or open a new one; once the app opens, useAppBadge takes over with the
  // exact unread count.
  event.waitUntil(
    setBadgeFlag(false).then(() =>
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }),
    ).then(async (clients) => {
      const existing = clients.find(
        (c) => new URL(c.url).origin === self.location.origin,
      );
      if (existing) {
        try {
          await existing.focus();
          if (existing.url !== targetUrl) {
            await (existing as WindowClient).navigate(targetUrl);
          }
          return;
        } catch {
          // navigate() fails on some mobile browsers — fall through to openWindow
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});

// Note: pushsubscriptionchange handler intentionally omitted.
// When a subscription expires, the user will need to re-subscribe via the UI.
// Automatic re-subscription from the SW would require storing auth tokens
// in the SW which is a security concern for a self-hosted app.
