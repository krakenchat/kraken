# presence

> **Location:** `backend/src/presence/`
> **Type:** NestJS Module
> **Category:** Real-time

## Overview

Tracks user online/offline status using Redis. Supports multiple concurrent connections per user with automatic TTL expiration and cleanup.

## Key Exports

- `PresenceService` - Connection tracking and online status
- `PresenceGateway` - WebSocket presence events
- `PresenceModule` - Module export

## Usage

```typescript
// Register new connection (returns true if user went online)
const wentOnline = await presenceService.addConnection(userId, connectionId, ttlSeconds);

// Remove connection (returns true if user went offline)
const wentOffline = await presenceService.removeConnection(userId, connectionId);

// Refresh presence TTL (called by heartbeat)
await presenceService.refreshPresence(userId);

// Check if user is online
const online = await presenceService.isOnline(userId);

// Get all online users
const onlineUsers = await presenceService.getOnlineUsers();
```

## Redis Keys

- `presence:online-users` - Set of online user IDs
- `presence:user:{userId}` - User presence marker with TTL
- `presence:connections:{userId}` - Set of active connection IDs

## Cleanup

Cron job runs every minute to remove users from online set if their TTL expired.

## Related

- [usePresenceHeartbeat Hook](../hooks/usePresenceHeartbeat.md)
- [Voice Presence](./voice-presence.md) - Separate module for voice channel presence
