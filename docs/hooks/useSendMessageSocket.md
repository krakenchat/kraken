# useSendMessageSocket

> **Location:** `frontend/src/hooks/useSendMessageSocket.ts`
> **Type:** WebSocket Hook
> **Category:** messages

## Overview

Low-level hook for sending messages via WebSocket. Used internally by `useSendMessage`.

## Usage

```tsx
import { useSendMessageSocket } from '@/hooks/useSendMessageSocket';

function MessageInput() {
  const { sendMessage, isConnected } = useSendMessageSocket();

  const handleSubmit = (content: string) => {
    sendMessage({
      channelId,
      content,
      attachments: []
    });
  };

  return <input disabled={!isConnected} />;
}
```

## Events

Emits: `SEND_MESSAGE`
Receives: `NEW_MESSAGE`, `MESSAGE_SENT`

## Related

- [useSendMessage](./useSendMessage.md)
- [WebSocket Events](../api/websocket-events.md)
