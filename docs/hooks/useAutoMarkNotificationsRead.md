# useAutoMarkNotificationsRead

> **Location:** `frontend/src/hooks/useAutoMarkNotificationsRead.ts`
> **Type:** Effect Hook
> **Category:** notifications

## Overview

Automatically marks notifications as read when they become visible to the user. Uses intersection observer to detect when notification elements enter the viewport.

## Usage

```tsx
import { useAutoMarkNotificationsRead } from '@/hooks/useAutoMarkNotificationsRead';

function NotificationList() {
  useAutoMarkNotificationsRead();

  return <div>{/* notifications render here */}</div>;
}
```

## Related

- [useNotifications](./useNotifications.md)
- [useMessageVisibility](./useMessageVisibility.md)
