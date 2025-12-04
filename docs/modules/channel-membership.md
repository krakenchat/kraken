# channel-membership

> **Location:** `backend/src/channel-membership/`
> **Type:** NestJS Module
> **Category:** Access Control

## Overview

Manages explicit membership for private channels. Public channels use automatic community membership - this module only handles private channel access.

## Key Exports

- `ChannelMembershipService` - Add/remove users from private channels
- `ChannelMembershipController` - REST endpoints for membership management
- `CreateChannelMembershipDto` - DTO for adding members
- `ChannelMembershipResponseDto` - Response DTO with user/channel info

## Usage

```typescript
// Add user to private channel
await channelMembershipService.create({
  userId: 'user-id',
  channelId: 'private-channel-id'
}, addedById);

// Check if user can access private channel
const isMember = await channelMembershipService.isMember(userId, channelId);

// Remove user from private channel
await channelMembershipService.remove(userId, channelId);
```

## Related

- [Channels Module](../api/channels.md)
- [RBAC System](../features/rbac.md)
