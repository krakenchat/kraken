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

  const options: NotificationOptions = {
    body: data.body,
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    tag: data.tag,
    data: data.data,
    vibrate: [200, 100, 200],
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Handle notification click
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const notificationData = event.notification.data as PushNotificationData['data'];

  // Determine the URL to navigate to
  let url = '/';
  if (notificationData?.communityId && notificationData?.channelId) {
    url = `/community/${notificationData.communityId}/channel/${notificationData.channelId}`;
  } else if (notificationData?.directMessageGroupId) {
    url = `/direct-messages?group=${notificationData.directMessageGroupId}`;
  }

  // Focus existing window or open new one
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there's already a window/tab open
      for (const client of windowClients) {
        if ('focus' in client) {
          return client.focus().then((focusedClient) => {
            // Navigate the focused client to the notification target
            if ('navigate' in focusedClient) {
              return (focusedClient as WindowClient).navigate(url);
            }
            return focusedClient;
          });
        }
      }
      // If no existing window, open a new one
      return self.clients.openWindow(url);
    })
  );
});

// Note: pushsubscriptionchange handler intentionally omitted.
// When a subscription expires, the user will need to re-subscribe via the UI.
// Automatic re-subscription from the SW would require storing auth tokens
// in the SW which is a security concern for a self-hosted app.
