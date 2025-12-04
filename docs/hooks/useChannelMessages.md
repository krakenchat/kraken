# useChannelMessages

> **Location:** `frontend/src/hooks/useChannelMessages.ts`
> **Type:** API Hook
> **Category:** messages

## Overview

Fetches and manages messages for a specific channel. Wraps RTK Query with additional state management for message display.

## Usage

```tsx
import { useChannelMessages } from '@/hooks/useChannelMessages';

function ChannelMessages({ channelId }: { channelId: string }) {
  const { messages, isLoading, error } = useChannelMessages(channelId);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading messages</div>;

  return (
    <div>
      {messages.map(msg => <Message key={msg.id} message={msg} />)}
    </div>
  );
}
```

## Related

- [useChannelWebSocket](./useChannelWebSocket.md)
- [useSendMessage](./useSendMessage.md)
