# useNotificationPermission

> **Location:** `frontend/src/hooks/useNotificationPermission.ts`
> **Type:** State Hook
> **Category:** notifications

## Overview

Manages browser notification permission state. Handles requesting permission and tracking the current permission status.

## Usage

```tsx
import { useNotificationPermission } from '@/hooks/useNotificationPermission';

function NotificationSettings() {
  const { permission, requestPermission, isSupported } = useNotificationPermission();

  if (!isSupported) return <div>Notifications not supported</div>;

  return (
    <div>
      <p>Status: {permission}</p>
      {permission === 'default' && (
        <button onClick={requestPermission}>Enable Notifications</button>
      )}
    </div>
  );
}
```

## Related

- [useNotifications](./useNotifications.md)
- Settings components
