# PWA Implementation Plan for Kraken

**Status**: Planning Phase
**Priority**: High
**Target Features**: Installability, Push Notifications, Offline Message Viewing
**Estimated Effort**: ~3-5 days

---

## Table of Contents

1. [Overview](#overview)
2. [Technical Architecture](#technical-architecture)
3. [Phase 1: Core PWA Infrastructure](#phase-1-core-pwa-infrastructure)
4. [Phase 2: Offline Message Caching](#phase-2-offline-message-caching)
5. [Phase 3: Backend Push Notifications](#phase-3-backend-push-notifications)
6. [Phase 4: Frontend Push Integration](#phase-4-frontend-push-integration)
7. [Phase 5: UX Polish & Testing](#phase-5-ux-polish--testing)
8. [Configuration Reference](#configuration-reference)
9. [Testing Checklist](#testing-checklist)
10. [Future Enhancements](#future-enhancements)

---

## Overview

This plan outlines the transformation of Kraken into a full Progressive Web App (PWA) with three core capabilities:

1. **Installability** - Users can install Kraken as a standalone app on mobile and desktop
2. **Push Notifications** - Real-time browser notifications for new messages
3. **Offline Support** - View recent messages (last 24 hours) when offline

### Key Design Decisions

- **Service Worker Strategy**: Use `vite-plugin-pwa` with `generateSW` strategy (Workbox-powered)
- **Caching Policy**: Network-first for API calls, cache-first for static assets
- **Message Cache**: IndexedDB with 24-hour TTL, conservative storage usage
- **Push Backend**: Web Push API with VAPID authentication
- **Electron Compatibility**: Disable PWA features when running in Electron environment

---

## Technical Architecture

### Frontend Stack

```
┌─────────────────────────────────────────┐
│         Vite + React Application        │
├─────────────────────────────────────────┤
│  vite-plugin-pwa (Service Worker Gen)  │
├─────────────────────────────────────────┤
│     Service Worker (Workbox)            │
│  ┌───────────┐      ┌────────────────┐ │
│  │  Precache │      │ Push Listener  │ │
│  └───────────┘      └────────────────┘ │
├─────────────────────────────────────────┤
│          IndexedDB Message Cache        │
└─────────────────────────────────────────┘
```

### Backend Stack

```
┌─────────────────────────────────────────┐
│      PushNotifications Module           │
├─────────────────────────────────────────┤
│  - VAPID Key Management                 │
│  - Subscription Storage (MongoDB)       │
│  - web-push Integration                 │
│  - Notification Triggers                │
└─────────────────────────────────────────┘
          │
          ↓
┌─────────────────────────────────────────┐
│   Messages Module Integration           │
│   (Trigger on new message events)       │
└─────────────────────────────────────────┘
```

---

## Phase 1: Core PWA Infrastructure

### 1.1 Install Dependencies

**Frontend:**
```bash
docker compose run frontend npm install vite-plugin-pwa workbox-window --save
docker compose run frontend npm install @types/serviceworker --save-dev
```

**Backend:**
```bash
docker compose run backend npm install web-push --save
```

### 1.2 Create Web App Manifest

**File**: `frontend/public/manifest.json`

```json
{
  "name": "Kraken Chat",
  "short_name": "Kraken",
  "description": "Open-source Discord-like chat platform with voice, video, and communities",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#121212",
  "theme_color": "#1976d2",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-maskable-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/icons/icon-maskable-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "categories": ["social", "communication"],
  "shortcuts": [
    {
      "name": "Direct Messages",
      "short_name": "DMs",
      "description": "Open direct messages",
      "url": "/direct-messages",
      "icons": [{ "src": "/icons/dm-shortcut.png", "sizes": "96x96" }]
    }
  ]
}
```

### 1.3 Generate PWA Icons

You'll need to create icons in the following sizes:
- 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512 (standard)
- 192x192, 512x512 (maskable variants with safe zone padding)

**Tools to use:**
- [PWA Asset Generator](https://github.com/elegantapp/pwa-asset-generator)
- [RealFaviconGenerator](https://realfavicongenerator.net/)
- Or create manually from source logo using image editing software

**Place in**: `frontend/public/icons/`

### 1.4 Configure Vite PWA Plugin

**File**: `frontend/vite.config.ts`

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["vite.svg", "icons/*.png"],
      manifest: {
        name: "Kraken Chat",
        short_name: "Kraken",
        description: "Open-source Discord-like chat platform",
        theme_color: "#1976d2",
        background_color: "#121212",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/icon-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.(png|jpg|jpeg|svg|gif|webp)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://backend:3000",
        changeOrigin: true,
        secure: false,
      },
      "/socket.io": {
        target: "ws://localhost:3000",
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
```

### 1.5 Update index.html

**File**: `frontend/index.html`

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="initial-scale=1, width=device-width" />

    <!-- PWA Meta Tags -->
    <meta name="theme-color" content="#1976d2" />
    <meta name="description" content="Open-source Discord-like chat platform with voice, video, and communities" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />

    <title>Kraken Chat</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 1.6 Register Service Worker in App

**File**: `frontend/src/main.tsx`

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Provider } from 'react-redux';
import { store } from './app/store';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';

// Register service worker
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('New content available. Reload?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
```

---

## Phase 2: Offline Message Caching

### 2.1 Create IndexedDB Wrapper

**File**: `frontend/src/db/messageCache.ts`

```typescript
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface MessageCacheDB extends DBSchema {
  messages: {
    key: string; // messageId
    value: {
      id: string;
      channelId: string;
      content: string;
      authorId: string;
      createdAt: string;
      spans?: any[];
      reactions?: any[];
      cachedAt: number; // timestamp when cached
    };
    indexes: {
      'by-channel': string;
      'by-cached-at': number;
    };
  };
}

const DB_NAME = 'kraken-message-cache';
const DB_VERSION = 1;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

let dbPromise: Promise<IDBPDatabase<MessageCacheDB>>;

async function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<MessageCacheDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const messageStore = db.createObjectStore('messages', {
          keyPath: 'id',
        });
        messageStore.createIndex('by-channel', 'channelId');
        messageStore.createIndex('by-cached-at', 'cachedAt');
      },
    });
  }
  return dbPromise;
}

export async function cacheMessages(channelId: string, messages: any[]) {
  const db = await getDB();
  const tx = db.transaction('messages', 'readwrite');
  const now = Date.now();

  await Promise.all(
    messages.map((msg) =>
      tx.store.put({
        ...msg,
        channelId,
        cachedAt: now,
      })
    )
  );

  await tx.done;
}

export async function getCachedMessages(channelId: string) {
  const db = await getDB();
  const now = Date.now();
  const cutoff = now - CACHE_TTL;

  const allMessages = await db.getAllFromIndex(
    'messages',
    'by-channel',
    channelId
  );

  // Filter out expired messages
  return allMessages.filter((msg) => msg.cachedAt > cutoff);
}

export async function clearExpiredCache() {
  const db = await getDB();
  const now = Date.now();
  const cutoff = now - CACHE_TTL;

  const tx = db.transaction('messages', 'readwrite');
  const index = tx.store.index('by-cached-at');

  let cursor = await index.openCursor();
  while (cursor) {
    if (cursor.value.cachedAt < cutoff) {
      await cursor.delete();
    }
    cursor = await cursor.continue();
  }

  await tx.done;
}

export async function clearAllCache() {
  const db = await getDB();
  await db.clear('messages');
}
```

**Install idb:**
```bash
docker compose run frontend npm install idb --save
```

### 2.2 Integrate Cache with Messages API

**File**: `frontend/src/features/messages/messagesApiSlice.ts` (modify)

Add cache hydration logic:

```typescript
import { cacheMessages, getCachedMessages } from '@/db/messageCache';

// In your getMessages endpoint:
getMessages: builder.query({
  query: ({ channelId, limit = 50 }) => ({
    url: `/messages/${channelId}`,
    params: { limit },
  }),
  async onQueryStarted(arg, { queryFulfilled }) {
    try {
      const { data } = await queryFulfilled;
      // Cache messages for offline access
      await cacheMessages(arg.channelId, data);
    } catch (err) {
      console.error('Failed to cache messages:', err);
    }
  },
  // ... rest of endpoint
}),
```

### 2.3 Create Offline Indicator Component

**File**: `frontend/src/components/common/OfflineIndicator.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { Box, Typography, Alert } from '@mui/material';
import CloudOffIcon from '@mui/icons-material/CloudOff';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <Alert
      severity="warning"
      icon={<CloudOffIcon />}
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        borderRadius: 0,
      }}
    >
      <Typography variant="body2">
        You're offline. Viewing cached messages from the last 24 hours.
      </Typography>
    </Alert>
  );
};
```

### 2.4 Add Offline Fallback in Message List

Modify your message list component to fall back to cached messages when the API fails:

```typescript
const { data: messages, error } = useGetMessagesQuery({ channelId });
const [cachedMessages, setCachedMessages] = useState([]);

useEffect(() => {
  if (error && !navigator.onLine) {
    // Load from cache when offline
    getCachedMessages(channelId).then(setCachedMessages);
  }
}, [error, channelId]);

const displayMessages = messages || cachedMessages;
```

---

## Phase 3: Backend Push Notifications

### 3.1 Create Prisma Schema for Push Subscriptions

**File**: `backend/prisma/schema.prisma` (add model)

```prisma
model PushSubscription {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  userId    String   @db.ObjectId
  endpoint  String   @unique
  keys      Json     // { p256dh, auth }
  userAgent String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("push_subscriptions")
}
```

Add to User model:
```prisma
model User {
  // ... existing fields
  pushSubscriptions PushSubscription[]
}
```

Run:
```bash
docker compose run backend npm run prisma:generate
docker compose run backend npm run prisma:push
```

### 3.2 Generate VAPID Keys

Create a script to generate VAPID keys:

**File**: `backend/scripts/generate-vapid-keys.ts`

```typescript
import * as webpush from 'web-push';

const vapidKeys = webpush.generateVAPIDKeys();

console.log('Add these to your .env file:\n');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:admin@yourdomain.com`);
```

Run:
```bash
docker compose run backend npx ts-node scripts/generate-vapid-keys.ts
```

Update `backend/.env`:
```env
VAPID_PUBLIC_KEY=your_generated_public_key
VAPID_PRIVATE_KEY=your_generated_private_key
VAPID_SUBJECT=mailto:admin@yourdomain.com
```

### 3.3 Create Push Notifications Module

**File**: `backend/src/push-notifications/push-notifications.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { PushNotificationsService } from './push-notifications.service';
import { PushNotificationsController } from './push-notifications.controller';
import { DatabaseModule } from '@/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [PushNotificationsController],
  providers: [PushNotificationsService],
  exports: [PushNotificationsService],
})
export class PushNotificationsModule {}
```

### 3.4 Create Push Notifications Service

**File**: `backend/src/push-notifications/push-notifications.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import * as webpush from 'web-push';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    // Configure web-push with VAPID keys
    webpush.setVapidDetails(
      this.configService.get('VAPID_SUBJECT'),
      this.configService.get('VAPID_PUBLIC_KEY'),
      this.configService.get('VAPID_PRIVATE_KEY'),
    );
  }

  async subscribe(userId: string, subscription: any, userAgent?: string) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        keys: subscription.keys,
        userAgent,
        updatedAt: new Date(),
      },
      create: {
        userId,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        userAgent,
      },
    });
  }

  async unsubscribe(userId: string, endpoint: string) {
    return this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
  }

  async getUserSubscriptions(userId: string) {
    return this.prisma.pushSubscription.findMany({
      where: { userId },
    });
  }

  async sendNotification(userId: string, payload: any) {
    const subscriptions = await this.getUserSubscriptions(userId);

    const notifications = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys as any,
          },
          JSON.stringify(payload),
        );
        return { success: true, endpoint: sub.endpoint };
      } catch (error) {
        this.logger.error(
          `Failed to send notification to ${sub.endpoint}:`,
          error,
        );

        // Remove invalid subscriptions (410 Gone or 404 Not Found)
        if (error.statusCode === 410 || error.statusCode === 404) {
          await this.prisma.pushSubscription.delete({
            where: { id: sub.id },
          });
        }

        return { success: false, endpoint: sub.endpoint, error };
      }
    });

    return Promise.all(notifications);
  }

  async sendMessageNotification(
    userId: string,
    message: {
      id: string;
      content: string;
      authorName: string;
      channelName: string;
      communityName?: string;
    },
  ) {
    const payload = {
      title: message.communityName
        ? `${message.authorName} in #${message.channelName}`
        : message.authorName,
      body: message.content.substring(0, 100),
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: `message-${message.id}`,
      data: {
        messageId: message.id,
        url: message.communityName
          ? `/community/${message.communityName}/channel/${message.channelName}`
          : `/direct-messages`,
      },
    };

    return this.sendNotification(userId, payload);
  }
}
```

### 3.5 Create Push Notifications Controller

**File**: `backend/src/push-notifications/push-notifications.controller.ts`

```typescript
import {
  Controller,
  Post,
  Delete,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { PushNotificationsService } from './push-notifications.service';

@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushNotificationsController {
  constructor(private pushService: PushNotificationsService) {}

  @Post('subscribe')
  @HttpCode(HttpStatus.CREATED)
  async subscribe(@Request() req, @Body() body: any) {
    const { subscription } = body;
    const userAgent = req.headers['user-agent'];

    await this.pushService.subscribe(req.user.userId, subscription, userAgent);

    return { message: 'Subscribed successfully' };
  }

  @Delete('unsubscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsubscribe(@Request() req, @Body() body: any) {
    const { endpoint } = body;
    await this.pushService.unsubscribe(req.user.userId, endpoint);
  }

  @Post('vapid-public-key')
  @HttpCode(HttpStatus.OK)
  getVapidPublicKey() {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY,
    };
  }
}
```

### 3.6 Integrate with Messages Module

**File**: `backend/src/messages/messages.service.ts` (modify)

Add push notification trigger when creating messages:

```typescript
import { PushNotificationsService } from '@/push-notifications/push-notifications.service';

@Injectable()
export class MessagesService {
  constructor(
    // ... existing dependencies
    private pushService: PushNotificationsService,
  ) {}

  async createMessage(createMessageDto: CreateMessageDto, authorId: string) {
    // ... existing message creation logic

    // Send push notifications to channel members (excluding author)
    await this.notifyChannelMembers(createdMessage, authorId);

    return createdMessage;
  }

  private async notifyChannelMembers(message: any, authorId: string) {
    // Get channel members (exclude author)
    const members = await this.getChannelMembers(message.channelId);
    const recipientIds = members
      .filter((m) => m.userId !== authorId)
      .map((m) => m.userId);

    // TODO: Add user notification preferences check here

    // Send notifications
    for (const userId of recipientIds) {
      await this.pushService.sendMessageNotification(userId, {
        id: message.id,
        content: message.content,
        authorName: message.author.username,
        channelName: message.channel.name,
        communityName: message.channel.community?.name,
      });
    }
  }
}
```

### 3.7 Register Module in App

**File**: `backend/src/app.module.ts` (modify)

```typescript
import { PushNotificationsModule } from './push-notifications/push-notifications.module';

@Module({
  imports: [
    // ... existing modules
    PushNotificationsModule,
  ],
  // ...
})
export class AppModule {}
```

---

## Phase 4: Frontend Push Integration

### 4.1 Create Push Notification Utility

**File**: `frontend/src/utils/pushNotifications.ts`

```typescript
const VAPID_PUBLIC_KEY_ENDPOINT = '/api/push/vapid-public-key';
const SUBSCRIBE_ENDPOINT = '/api/push/subscribe';
const UNSUBSCRIBE_ENDPOINT = '/api/push/unsubscribe';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return 'denied';
  }

  return Notification.requestPermission();
}

export async function subscribeToPushNotifications(
  accessToken: string,
): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications not supported');
    return null;
  }

  try {
    // Get VAPID public key from backend
    const response = await fetch(VAPID_PUBLIC_KEY_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const { publicKey } = await response.json();

    // Register service worker
    const registration = await navigator.serviceWorker.ready;

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    // Send subscription to backend
    await fetch(SUBSCRIBE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ subscription }),
    });

    return subscription;
  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error);
    return null;
  }
}

export async function unsubscribeFromPushNotifications(
  accessToken: string,
): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();

      // Notify backend
      await fetch(UNSUBSCRIBE_ENDPOINT, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
    }

    return true;
  } catch (error) {
    console.error('Failed to unsubscribe:', error);
    return false;
  }
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch {
    return false;
  }
}
```

### 4.2 Handle Push Events in Service Worker

**File**: `frontend/public/sw.js` (custom service worker - optional)

If you need custom push handling, create a custom service worker:

```javascript
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/icon-72x72.png',
    tag: data.tag,
    data: data.data,
    requireInteraction: false,
    actions: [
      { action: 'open', title: 'Open', icon: '/icons/open.png' },
      { action: 'close', title: 'Dismiss', icon: '/icons/close.png' },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
```

If using `generateSW` strategy, update `vite.config.ts` to inject this:

```typescript
VitePWA({
  // ... other config
  injectManifest: {
    swSrc: 'public/sw.js',
    swDest: 'dist/sw.js',
  },
})
```

### 4.3 Create Push Notification Settings Component

**File**: `frontend/src/components/Settings/NotificationSettings.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Button,
  Alert,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import {
  requestNotificationPermission,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  isPushSubscribed,
} from '@/utils/pushNotifications';

export const NotificationSettings: React.FC = () => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(false);

  const accessToken = localStorage.getItem('accessToken') || '';

  useEffect(() => {
    checkSubscriptionStatus();
  }, []);

  const checkSubscriptionStatus = async () => {
    setPermission(Notification.permission);
    const subscribed = await isPushSubscribed();
    setIsSubscribed(subscribed);
  };

  const handleToggle = async () => {
    setLoading(true);

    try {
      if (!isSubscribed) {
        // Subscribe
        const perm = await requestNotificationPermission();
        setPermission(perm);

        if (perm === 'granted') {
          await subscribeToPushNotifications(accessToken);
          setIsSubscribed(true);
        }
      } else {
        // Unsubscribe
        await unsubscribeFromPushNotifications(accessToken);
        setIsSubscribed(false);
      }
    } catch (error) {
      console.error('Failed to toggle notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  if (permission === 'denied') {
    return (
      <Alert severity="warning" icon={<NotificationsIcon />}>
        <Typography variant="body2">
          Notifications are blocked. Please enable them in your browser settings.
        </Typography>
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Push Notifications
      </Typography>

      <FormControlLabel
        control={
          <Switch
            checked={isSubscribed}
            onChange={handleToggle}
            disabled={loading}
          />
        }
        label="Enable push notifications for new messages"
      />

      {permission === 'default' && (
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            You'll be asked for permission when enabling notifications.
          </Typography>
        </Alert>
      )}
    </Box>
  );
};
```

### 4.4 Integrate Subscription on Login

**File**: `frontend/src/pages/LoginPage.tsx` (modify)

Add auto-subscription after successful login:

```typescript
import { subscribeToPushNotifications } from '@/utils/pushNotifications';

// After successful login:
const handleLogin = async (credentials) => {
  try {
    const result = await login(credentials);

    // Auto-subscribe to push notifications if permission already granted
    if (Notification.permission === 'granted') {
      subscribeToPushNotifications(result.accessToken);
    }

    navigate('/');
  } catch (error) {
    // handle error
  }
};
```

---

## Phase 5: UX Polish & Testing

### 5.1 Create Install Prompt Component

**File**: `frontend/src/components/common/InstallPrompt.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { Box, Button, Card, CardContent, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import GetAppIcon from '@mui/icons-material/GetApp';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Check if user has dismissed before
      const dismissed = localStorage.getItem('installPromptDismissed');
      if (!dismissed) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted install prompt');
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('installPromptDismissed', 'true');
  };

  if (!showPrompt || !deferredPrompt) return null;

  return (
    <Card
      sx={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        right: 16,
        zIndex: 1300,
        maxWidth: 400,
        mx: 'auto',
      }}
    >
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box flex={1}>
            <Typography variant="h6" gutterBottom>
              Install Kraken
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Install Kraken for a better experience with offline support and notifications.
            </Typography>
            <Button
              variant="contained"
              startIcon={<GetAppIcon />}
              onClick={handleInstall}
              fullWidth
            >
              Install App
            </Button>
          </Box>
          <IconButton size="small" onClick={handleDismiss}>
            <CloseIcon />
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );
};
```

### 5.2 Add Standalone Mode Detection

**File**: `frontend/src/utils/pwa.ts`

```typescript
export function isStandalonePWA(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

export function isRunningInElectron(): boolean {
  return !!(window as any).electron;
}

export function shouldEnablePWAFeatures(): boolean {
  // Disable PWA features in Electron
  if (isRunningInElectron()) {
    return false;
  }
  return true;
}
```

### 5.3 Update Layout with PWA Components

**File**: `frontend/src/Layout.tsx` (modify)

```typescript
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { InstallPrompt } from './components/common/InstallPrompt';
import { shouldEnablePWAFeatures } from './utils/pwa';

function Layout() {
  const enablePWA = shouldEnablePWAFeatures();

  return (
    <>
      {enablePWA && <OfflineIndicator />}
      {/* ... existing layout ... */}
      {enablePWA && <InstallPrompt />}
    </>
  );
}
```

### 5.4 Add PWA Status to User Menu

Add an indicator showing PWA installation status in the user menu or settings:

```typescript
import { isStandalonePWA } from '@/utils/pwa';

// In your user menu component:
const isPWA = isStandalonePWA();

{isPWA && (
  <MenuItem disabled>
    <PhoneAndroidIcon sx={{ mr: 1 }} />
    <Typography variant="body2">Installed as App</Typography>
  </MenuItem>
)}
```

---

## Configuration Reference

### Environment Variables

**Backend (.env):**
```env
# Push Notifications (VAPID)
VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here
VAPID_SUBJECT=mailto:admin@yourdomain.com
```

### Vite PWA Configuration

Full configuration options at: https://vite-pwa-org.netlify.app/

Key options used:
- `registerType: 'autoUpdate'` - Automatically update service worker
- `includeAssets` - Additional assets to precache
- `workbox.globPatterns` - File patterns to include in precache
- `workbox.runtimeCaching` - Dynamic caching strategies
- `devOptions.enabled: true` - Enable PWA in development

---

## Testing Checklist

### Installation Testing

- [ ] Test "Add to Home Screen" on Android Chrome
- [ ] Test "Add to Home Screen" on iOS Safari
- [ ] Test desktop installation (Chrome, Edge, Firefox)
- [ ] Verify app launches in standalone mode
- [ ] Check app icon displays correctly
- [ ] Verify splash screen on mobile

### Offline Testing

- [ ] Load app while online, then go offline
- [ ] Verify cached messages are accessible offline
- [ ] Check offline indicator appears
- [ ] Test navigation works offline
- [ ] Verify 24-hour cache expiration
- [ ] Test cache clears on logout
- [ ] Reconnect and verify sync works

### Push Notification Testing

- [ ] Request notification permission
- [ ] Subscribe to push notifications
- [ ] Send test notification from backend
- [ ] Verify notification displays correctly
- [ ] Click notification and verify navigation
- [ ] Test notification on locked screen (mobile)
- [ ] Unsubscribe and verify notifications stop
- [ ] Test multi-device subscriptions
- [ ] Verify expired subscriptions are cleaned up

### Service Worker Testing

- [ ] Verify service worker registers successfully
- [ ] Check precache manifest includes all assets
- [ ] Test service worker updates
- [ ] Verify runtime caching works
- [ ] Check cache storage limits
- [ ] Test service worker in incognito mode

### Cross-Platform Testing

- [ ] Chrome (desktop)
- [ ] Firefox (desktop)
- [ ] Edge (desktop)
- [ ] Safari (desktop)
- [ ] Chrome (Android)
- [ ] Safari (iOS)
- [ ] Samsung Internet (Android)

### Electron Compatibility

- [ ] Verify PWA features disabled in Electron
- [ ] Check no service worker conflicts
- [ ] Test app works normally in Electron

---

## Future Enhancements

### Short Term (v2)
- [ ] Background sync for offline message sending
- [ ] Richer notification content (images, actions)
- [ ] Notification preferences per channel/community
- [ ] Push notification sound customization
- [ ] Unread badge on app icon

### Medium Term (v3)
- [ ] Periodic background sync for message updates
- [ ] Share target API (share to Kraken from other apps)
- [ ] Web share API (share from Kraken to other apps)
- [ ] File handling API (open files with Kraken)
- [ ] Voice message recording offline

### Long Term (v4)
- [ ] Full offline-first architecture with conflict resolution
- [ ] P2P message sync between devices
- [ ] Advanced caching strategies (LRU, size-based eviction)
- [ ] Push notification analytics
- [ ] Progressive image loading

---

## Resources

### Documentation
- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/)
- [Web Push Protocol](https://web.dev/push-notifications-overview/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Workbox](https://developers.google.com/web/tools/workbox)
- [Web App Manifest](https://web.dev/add-manifest/)

### Tools
- [PWA Builder](https://www.pwabuilder.com/)
- [Lighthouse PWA Audit](https://developers.google.com/web/tools/lighthouse)
- [web-push npm](https://github.com/web-push-libs/web-push)

### Testing
- Chrome DevTools > Application > Service Workers
- Chrome DevTools > Application > Manifest
- Chrome DevTools > Application > Storage
- about:debugging (Firefox)

---

## Notes

- **iOS Limitations**: iOS Safari has limited PWA support (no push notifications in non-standalone mode, storage limits)
- **Storage Quotas**: Monitor IndexedDB usage; browser limits vary (typically 50-100MB+)
- **HTTPS Required**: PWA features require HTTPS in production
- **Service Worker Scope**: Service worker must be at root to control all pages
- **VAPID Keys**: Keep private key secure; rotate periodically

---

**Last Updated**: October 2025
**Status**: Ready for Implementation
**Owner**: Development Team
