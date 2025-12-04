# notifications

> **Location:** `backend/src/notifications/`
> **Type:** NestJS Module
> **Category:** Real-time

## Overview

Full notification system with user mentions, DM notifications, per-channel settings, Do Not Disturb mode, and real-time WebSocket delivery. Integrates with [Push Notifications](./push-notifications.md) for background delivery when users are offline.

## Key Exports

- `NotificationsService` - Create/query/dismiss notifications
- `NotificationsController` - REST endpoints for notification management
- `NotificationsGateway` - WebSocket event emitter
- `UpdateNotificationSettingsDto` - User preferences DTO
- `UpdateChannelOverrideDto` - Per-channel notification level

## Usage

```typescript
// Process message for mentions (called automatically on message send)
await notificationsService.processMessageForNotifications(message);

// Get user's notifications with pagination
const notifications = await notificationsService.getUserNotifications(userId, {
  unreadOnly: true,
  limit: 50
});

// Mark notification as read
await notificationsService.markAsRead(notificationId, userId);

// Update user notification settings
await notificationsService.updateUserSettings(userId, {
  desktopEnabled: true,
  doNotDisturb: false,
  dmNotifications: true
});

// Set per-channel override
await notificationsService.setChannelOverride(userId, channelId, {
  level: 'mentions' // 'all' | 'mentions' | 'none'
});
```

## Notification Types

- `USER_MENTION` - @username in message
- `CHANNEL_MESSAGE` - New message in subscribed channel
- `DIRECT_MESSAGE` - New DM

## Push Notifications

When a notification is created, the service checks if the user is offline (no active WebSocket connections). If so, and push is configured, a push notification is sent:

```typescript
// Automatic in createNotification() - fire and forget
this.sendPushIfOffline(userId, notification);
```

See [Push Notifications Module](./push-notifications.md) for VAPID configuration and subscription management.

## Related

- [Push Notifications Module](./push-notifications.md)
- [useNotifications Hook](../hooks/useNotifications.md)
- [usePushNotifications Hook](../hooks/usePushNotifications.md)
- [WebSocket Events](../api/websocket-events.md)
