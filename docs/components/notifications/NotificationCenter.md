# NotificationCenter

> **Location:** `frontend/src/components/Notifications/NotificationCenter.tsx`
> **Type:** UI Component
> **Category:** notifications

## Overview

Right-side drawer displaying user notifications with mark as read, mark all as read, and delete actions.

## Props

| Prop | Type | Description |
|------|------|-------------|
| `open` | `boolean` | Whether drawer is visible |
| `onClose` | `() => void` | Handler to close drawer |

## Usage

```tsx
import { NotificationCenter } from '@/components/Notifications/NotificationCenter';

<NotificationCenter
  open={isOpen}
  onClose={() => setIsOpen(false)}
/>
```

## Features

- Lists notifications with author avatar and message preview
- Unread notifications highlighted with background color
- "Mark All as Read" button when unread notifications exist
- Individual mark as read / delete buttons
- Time-ago formatting with date-fns
- Auto-refetches on drawer open

## API Integration

- `useGetNotificationsQuery` - Fetch notifications list
- `useMarkAsReadMutation` - Mark single notification read
- `useMarkAllAsReadMutation` - Mark all as read
- `useDeleteNotificationMutation` - Delete notification

## Related

- [NotificationBadge](./NotificationBadge.md)
- [Notifications Module](../../modules/notifications.md)
