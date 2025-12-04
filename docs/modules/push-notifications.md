# Push Notifications Module

> **Location:** `backend/src/push-notifications/`
> **Type:** Feature Module
> **Domain:** notifications

## Overview

Web Push API integration for delivering notifications when users are offline (no active WebSocket connection). Uses VAPID keys for authentication with push services. Designed for self-hosted instances where each deployment generates its own keys.

## Module Structure

```
push-notifications/
├── push-notifications.module.ts      # Module definition
├── push-notifications.service.ts     # Core push logic
├── push-notifications.controller.ts  # REST endpoints
├── push-notifications.service.spec.ts # Tests
└── dto/
    └── subscribe.dto.ts              # Subscription DTOs
```

## Services

### PushNotificationsService

**Purpose:** Manages VAPID configuration, subscription storage, and sending push notifications via the Web Push protocol.

#### Key Methods

```typescript
class PushNotificationsService {
  // Check if push is configured
  isEnabled(): boolean;

  // Get VAPID public key for frontend subscription
  getVapidPublicKey(): string | null;

  // Store a push subscription
  async subscribe(userId: string, dto: SubscribePushDto): Promise<PushSubscription>;

  // Remove a push subscription
  async unsubscribe(userId: string, endpoint: string): Promise<void>;

  // Get all subscriptions for a user
  async getUserSubscriptions(userId: string): Promise<PushSubscription[]>;

  // Send notification to all user's devices
  async sendToUser(userId: string, payload: PushNotificationPayload): Promise<{sent: number; failed: number}>;

  // Clean up old subscriptions (called by cron)
  async cleanupExpiredSubscriptions(): Promise<number>;
}
```

#### Notification Payload

```typescript
interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;  // Prevents duplicate notifications
  data?: {
    notificationId?: string;
    channelId?: string | null;
    communityId?: string | null;
    directMessageGroupId?: string | null;
    type?: string;
  };
}
```

## Controllers

### PushNotificationsController

**Base Route:** `/api/push`

#### Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/vapid-public-key` | Get VAPID public key for subscription | Yes |
| GET | `/status` | Get user's push subscription status | Yes |
| POST | `/subscribe` | Register a push subscription | Yes |
| DELETE | `/unsubscribe` | Remove a push subscription | Yes |

## DTOs

### SubscribePushDto

```typescript
export class SubscribePushDto {
  @IsString()
  @IsNotEmpty()
  endpoint: string;  // Push service URL

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;  // { p256dh, auth }

  @IsOptional()
  @IsString()
  userAgent?: string;
}
```

## Database Schema

### PushSubscription Model

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
}
```

## Configuration

### Environment Variables

```env
# Required for push notifications to work
VAPID_PUBLIC_KEY=BNxF...   # Base64-encoded public key
VAPID_PRIVATE_KEY=...      # Base64-encoded private key
VAPID_SUBJECT=mailto:admin@your-instance.com  # Optional, defaults to mailto:admin@localhost
```

### Generating Keys

```bash
npx web-push generate-vapid-keys
```

Each self-hosted instance must generate its own unique VAPID keys. These should be treated like JWT secrets.

## Integration with Notifications

The `NotificationsService` automatically sends push notifications when:
1. A notification is created
2. Push notifications are enabled (VAPID keys configured)
3. The user is offline (no active WebSocket connections)

```typescript
// In notifications.service.ts - called after creating notification
this.sendPushIfOffline(dto.userId, notification).catch((error) => {
  this.logger.error(`Failed to send push: ${error}`);
});
```

Push sending is fire-and-forget to avoid blocking message creation.

## Error Handling

### Expired Subscriptions

When a push service returns 410 (Gone) or 404 (Not Found), the subscription is automatically removed from the database.

### Graceful Degradation

If VAPID keys are not configured, push features are disabled but the application continues to function normally. The frontend hides push-related UI elements.

## Testing

### Test Location
`backend/src/push-notifications/push-notifications.service.spec.ts`

### Key Test Cases
- VAPID configuration on module init
- Subscription upsert and deletion
- Sending to multiple subscriptions
- Expired subscription cleanup (410/404 responses)

## Related Documentation

- [Notifications Module](./notifications.md)
- [usePushNotifications Hook](../hooks/usePushNotifications.md)
- [Service Worker](../features/pwa-push.md)
