# useNotifications

> **Location:** `frontend/src/hooks/useNotifications.ts`
> **Type:** API Hook
> **Category:** notifications

## Overview

Fetches and manages user notifications. Provides unread count, notification list, and actions for marking as read.

## Usage

```tsx
import { useNotifications } from '@/hooks/useNotifications';

function NotificationCenter() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    isLoading
  } = useNotifications();

  return (
    <div>
      <h3>Notifications ({unreadCount})</h3>
      <button onClick={markAllAsRead}>Mark all read</button>
      {notifications.map(n => (
        <div key={n.id} onClick={() => markAsRead(n.id)}>
          {n.message}
        </div>
      ))}
    </div>
  );
}
```

## Related

- [NotificationCenter Component](../components/Notifications/NotificationCenter.md)
- [useNotificationPermission](./useNotificationPermission.md)
