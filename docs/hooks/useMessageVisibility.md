# useMessageVisibility

> **Location:** `frontend/src/hooks/useMessageVisibility.ts`
> **Type:** Effect Hook
> **Category:** messages

## Overview

Tracks which messages are visible in the viewport using Intersection Observer. Used for read receipts and auto-marking messages as read.

## Usage

```tsx
import { useMessageVisibility } from '@/hooks/useMessageVisibility';

function MessageList({ channelId }: { channelId: string }) {
  const { visibleMessageIds, observe } = useMessageVisibility(channelId);

  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id} ref={observe}>
          <Message message={msg} />
        </div>
      ))}
    </div>
  );
}
```

## Related

- [useAutoMarkNotificationsRead](./useAutoMarkNotificationsRead.md)
- Read Receipts feature
