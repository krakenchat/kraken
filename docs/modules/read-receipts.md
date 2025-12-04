# read-receipts

> **Location:** `backend/src/read-receipts/`
> **Type:** NestJS Module
> **Category:** Messages

## Overview

Tracks which messages users have read in channels and DMs. Stores last-read message ID per user per channel/DM group.

## Key Exports

- `ReadReceiptsService` - Mark as read, get unread counts
- `ReadReceiptsController` - REST endpoints
- `MarkAsReadDto` - DTO with lastReadMessageId and channel/DM identifiers

## Usage

```typescript
// Mark messages as read up to specific message
await readReceiptsService.markAsRead(userId, {
  lastReadMessageId: 'message-id',
  channelId: 'channel-id' // or directMessageGroupId
});

// Get unread count for a channel
const { unreadCount } = await readReceiptsService.getUnreadCount(
  userId,
  channelId
);

// Get all unread counts for user (batch optimized)
const allUnread = await readReceiptsService.getUnreadCounts(userId);
// Returns: [{ channelId, unreadCount, lastReadMessageId }, ...]
```

## Related

- [Messages API](../api/messages.md)
- [useChannelMessages Hook](../hooks/useChannelMessages.md)
