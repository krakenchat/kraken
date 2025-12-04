# NotificationBadge

> **Location:** `frontend/src/components/Notifications/NotificationBadge.tsx`
> **Type:** UI Component
> **Category:** notifications

## Overview

Icon button with badge showing unread notification count. Displays in the NavBar and opens NotificationCenter when clicked.

## Props

| Prop | Type | Description |
|------|------|-------------|
| `onClick` | `() => void` | Handler to open NotificationCenter drawer |

## Usage

```tsx
import { NotificationBadge } from '@/components/Notifications/NotificationBadge';

function NavBar() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <NotificationBadge onClick={() => setDrawerOpen(true)} />
      <NotificationCenter open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
```

## State

Uses `selectUnreadCount` from notificationsSlice for badge count.

## Related

- [NotificationCenter](./NotificationCenter.md)
- [useNotifications Hook](../../hooks/useNotifications.md)
