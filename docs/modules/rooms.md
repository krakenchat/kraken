# rooms

> **Location:** `backend/src/rooms/`
> **Type:** NestJS Module
> **Category:** WebSocket

## Overview

Manages Socket.IO room membership. Handles joining/leaving channel rooms, private channel rooms, and DM group rooms when users connect or switch communities.

## Key Exports

- `RoomsService` - Join/leave room operations
- `RoomsModule` - Module export

## Usage

```typescript
// Join all rooms for a community (called on connection/community switch)
await roomsService.joinAll(socket, communityId);
// Joins: user's own room, all public channels, private channels user has access to, all DMs, alias groups

// Join a specific room
await roomsService.join(socket, channelId);

// Leave a specific room
await roomsService.leave(socket, channelId);

// Leave all community rooms (called when switching communities)
await roomsService.leaveAll(socket, communityId);
```

## Room Types

- **User room** - User's own ID for direct notifications
- **Public channel rooms** - Auto-joined for community members
- **Private channel rooms** - Joined only if user has ChannelMembership
- **DM group rooms** - All DM conversations user is part of
- **Alias group rooms** - Group alias memberships

## Related

- [WebSocket Events](../api/websocket-events.md)
- [Channel Membership](./channel-membership.md)
