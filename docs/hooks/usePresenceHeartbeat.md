# usePresenceHeartbeat

> **Location:** `frontend/src/hooks/usePresenceHeartbeat.ts`
> **Type:** Effect Hook
> **Category:** presence

## Overview

Sends periodic heartbeat to server to maintain online presence status. Keeps the user's "online" status active.

## Usage

```tsx
import { usePresenceHeartbeat } from '@/hooks/usePresenceHeartbeat';

function Layout() {
  // Call in a top-level component to enable heartbeat
  usePresenceHeartbeat();

  return <div>{/* app content */}</div>;
}
```

## Implementation

Sends heartbeat every 30 seconds via WebSocket while the user is active.

## Related

- [usePresenceEvents](./usePresenceEvents.md)
- Presence backend module
