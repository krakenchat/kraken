# usePresenceEvents

> **Location:** `frontend/src/hooks/usePresenceEvents.ts`
> **Type:** WebSocket Hook
> **Category:** presence

## Overview

Listens for presence-related WebSocket events (user online/offline, voice presence changes). Updates local state in response to real-time events.

## Usage

```tsx
import { usePresenceEvents } from '@/hooks/usePresenceEvents';

function Layout() {
  // Call in a top-level component to enable presence tracking
  usePresenceEvents();

  return <div>{/* app content */}</div>;
}
```

## Events Handled

- `USER_ONLINE` - User came online
- `USER_OFFLINE` - User went offline
- `VOICE_USER_JOINED` - User joined voice channel
- `VOICE_USER_LEFT` - User left voice channel

## Related

- [usePresenceHeartbeat](./usePresenceHeartbeat.md)
- [Voice Presence API](../api/voice-presence.md)
