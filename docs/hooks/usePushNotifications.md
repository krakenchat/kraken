# usePushNotifications

> **Location:** `frontend/src/hooks/usePushNotifications.ts`
> **Type:** API Hook
> **Category:** notifications

## Overview

Manages Web Push API subscription state for PWA background notifications. Only relevant for web browsers - Electron uses native notifications instead. Handles subscription lifecycle including permission requests, subscription creation, and backend synchronization.

## Hook Signature

```typescript
function usePushNotifications(): UsePushNotificationsResult
```

### Return Value

```typescript
interface UsePushNotificationsResult {
  // State
  isSupported: boolean;      // Browser supports Push API
  isServerEnabled: boolean;  // Server has VAPID keys configured
  isSubscribed: boolean;     // User has active push subscription
  hasPermission: boolean;    // Notification permission granted
  isLoading: boolean;        // Operation in progress
  error: string | null;      // Error message if any

  // Actions
  subscribe: () => Promise<boolean>;   // Subscribe to push
  unsubscribe: () => Promise<boolean>; // Unsubscribe from push
  toggle: () => Promise<boolean>;      // Toggle subscription state
}
```

## Usage Examples

### Basic Usage

```tsx
import { usePushNotifications } from '@/hooks/usePushNotifications';

function NotificationSettings() {
  const {
    isSupported,
    isServerEnabled,
    isSubscribed,
    isLoading,
    error,
    toggle
  } = usePushNotifications();

  // Don't show for Electron or unsupported browsers
  if (!isSupported || !isServerEnabled) {
    return null;
  }

  return (
    <FormControlLabel
      control={
        <Switch
          checked={isSubscribed}
          onChange={toggle}
          disabled={isLoading}
        />
      }
      label="Background Notifications"
    />
  );
}
```

### With Error Display

```tsx
function PushSettings() {
  const { isSubscribed, error, toggle, isLoading } = usePushNotifications();

  return (
    <div>
      <button onClick={toggle} disabled={isLoading}>
        {isSubscribed ? 'Disable' : 'Enable'} Push Notifications
      </button>
      {error && <Alert severity="error">{error}</Alert>}
    </div>
  );
}
```

## Implementation Details

### Subscription Flow

1. Check browser support (`isPushSupported()`)
2. Fetch VAPID public key from backend
3. Request notification permission if needed
4. Subscribe via browser Push API
5. Send subscription to backend for storage
6. If backend fails, clean up local subscription

### State Synchronization

The hook checks local browser subscription state on mount:

```typescript
useEffect(() => {
  if (!isSupported) return;
  getCurrentPushSubscription().then((subscription) => {
    setIsSubscribed(subscription !== null);
  });
}, [isSupported]);
```

### API Integration

```typescript
// RTK Query hooks used
const { data: vapidData } = useGetVapidPublicKeyQuery();
const { data: pushStatus } = useGetPushStatusQuery();
const [subscribePushMutation] = useSubscribePushMutation();
const [unsubscribePushMutation] = useUnsubscribePushMutation();
```

## Error Handling

### Error Types

| Error | Cause | User Action |
|-------|-------|-------------|
| "Push notifications are not supported" | Browser doesn't support Push API | None (feature hidden) |
| "Push notifications are not configured" | Server missing VAPID keys | Admin must configure |
| "Notification permission was denied" | User blocked notifications | Enable in browser settings |
| "Failed to subscribe" | Network or server error | Retry |

### Cleanup on Failure

If the browser subscription succeeds but the backend mutation fails, the hook automatically unsubscribes locally to prevent orphaned subscriptions:

```typescript
try {
  subscription = await subscribeToPush(vapidPublicKey);
  await subscribePushMutation(subscriptionData).unwrap();
} catch (err) {
  if (subscription) {
    await subscription.unsubscribe();  // Cleanup
  }
  throw err;
}
```

## Platform Considerations

### Web (PWA)

- Full support when installed as PWA
- Notifications delivered even when app is closed
- Requires HTTPS in production

### Electron

- Hook returns `isSupported: false`
- Use native Electron notifications instead
- The `isElectron()` check prevents push UI from showing

### Browser Requirements

- Service Worker support
- Push API support
- Notification API support
- HTTPS (except localhost)

## Related Utilities

### pushSubscription.ts

```typescript
// Utility functions used by the hook
isPushSupported(): boolean
hasNotificationPermission(): boolean
requestNotificationPermission(): Promise<NotificationPermission>
getCurrentPushSubscription(): Promise<PushSubscription | null>
subscribeToPush(vapidPublicKey: string): Promise<PushSubscription>
unsubscribeFromPush(): Promise<boolean>
extractSubscriptionData(subscription: PushSubscription): SubscribeDto
```

## Service Worker Integration

Push notifications are handled by the custom service worker at `frontend/src/sw-custom.ts`:

```typescript
self.addEventListener('push', (event) => {
  const data = event.data?.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      data: data.data,  // Navigation data
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  // Navigate to channel/DM when clicked
});
```

## Related Documentation

- [Push Notifications Module](../modules/push-notifications.md)
- [Notifications Module](../modules/notifications.md)
- [useNotifications Hook](./useNotifications.md)
- [Platform Utilities](../utils/platform.md)
