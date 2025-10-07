# useSendMessage

> **Location:** `frontend/src/hooks/useSendMessage.ts`
> **Type:** Custom Logic Hook / WebSocket Hook
> **Category:** messages

## Overview

`useSendMessage` is a unified message sending hook that works for both channel and direct messages. It provides a consistent interface for sending messages via WebSocket with optional acknowledgment callbacks for file upload handling. This hook replaces the previous separate implementations (`useSendMessageSocket` for channels and `sendDirectMessage` from `useDirectMessageWebSocket`).

## Hook Signature

```typescript
function useSendMessage(
  contextType: MessageContext,
  callback?: (messageId: string) => void
): (payload: NewMessagePayload) => void
```

### Parameters

```typescript
type MessageContext = "channel" | "dm";

interface UseSendMessageParams {
  contextType: MessageContext;          // Required: 'channel' or 'dm' context
  callback?: (messageId: string) => void; // Optional: Called when server acknowledges with message ID
}
```

**Parameter Details:**
- **`contextType`** - Determines which WebSocket event to emit (`SEND_MESSAGE` for channels, `SEND_DM` for direct messages)
- **`callback`** - Optional function invoked when server creates the message and returns its ID. Typically used for file uploads that need the messageId.

### Return Value

```typescript
type SendMessageFunction = (payload: NewMessagePayload) => void;

// Where NewMessagePayload is:
type NewMessagePayload = Omit<Message, "id">;
```

**Returns:** A function that sends messages via WebSocket with the provided payload.

## Usage Examples

### Basic Usage - Channel Message

```typescript
import { useSendMessage } from '@/hooks/useSendMessage';

function ChannelInput({ channelId, authorId }: { channelId: string; authorId: string }) {
  const sendMessage = useSendMessage('channel');
  const [text, setText] = useState('');

  const handleSend = () => {
    if (!text.trim()) return;

    sendMessage({
      channelId,
      authorId,
      spans: [{ type: 'PLAINTEXT', text: text }],
      attachments: [],
      reactions: [],
      sentAt: new Date().toISOString(),
    });

    setText('');
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
      <input value={text} onChange={(e) => setText(e.target.value)} />
      <button type="submit">Send</button>
    </form>
  );
}
```

### Basic Usage - Direct Message

```typescript
import { useSendMessage } from '@/hooks/useSendMessage';

function DMInput({ dmGroupId, authorId }: { dmGroupId: string; authorId: string }) {
  const sendMessage = useSendMessage('dm');
  const [text, setText] = useState('');

  const handleSend = () => {
    if (!text.trim()) return;

    sendMessage({
      directMessageGroupId: dmGroupId, // Note: Different ID field for DMs
      authorId,
      spans: [{ type: 'PLAINTEXT', text: text }],
      attachments: [],
      reactions: [],
      sentAt: new Date().toISOString(),
    });

    setText('');
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
      <input value={text} onChange={(e) => setText(e.target.value)} />
      <button type="submit">Send to DM</button>
    </form>
  );
}
```

### Advanced Usage - With File Upload Callback

```typescript
import { useSendMessage } from '@/hooks/useSendMessage';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useAddAttachmentMutation } from '@/features/messages/messagesApiSlice';

function MessageInputWithFiles({ channelId, authorId }: MessageInputProps) {
  const { uploadFile } = useFileUpload();
  const [addAttachment] = useAddAttachmentMutation();
  const pendingFilesRef = useRef<File[] | null>(null);

  // Callback fires when server creates message and returns ID
  const sendMessage = useSendMessage('channel', async (messageId: string) => {
    const files = pendingFilesRef.current;
    if (!files || files.length === 0) return;

    try {
      // Upload all files in parallel
      const uploadPromises = files.map(file =>
        uploadFile(file, {
          resourceType: "MESSAGE_ATTACHMENT",
          resourceId: messageId,
        })
      );

      const uploadedFiles = await Promise.all(uploadPromises);

      // Attach each uploaded file to the message
      for (const uploadedFile of uploadedFiles) {
        await addAttachment({
          messageId,
          fileId: uploadedFile.id,
        });
      }
    } catch (error) {
      console.error("File upload failed:", error);
      // Handle failed uploads (decrement pendingAttachments counter)
      for (let i = 0; i < files.length; i++) {
        await addAttachment({ messageId }); // No fileId = just decrement
      }
    } finally {
      pendingFilesRef.current = null;
    }
  });

  const handleSend = (text: string, files?: File[]) => {
    // Store files for callback
    pendingFilesRef.current = files || null;

    // Send message with pending attachments count
    sendMessage({
      channelId,
      authorId,
      spans: [{ type: 'PLAINTEXT', text: text }],
      attachments: [],
      pendingAttachments: files?.length || 0, // Track how many files are uploading
      reactions: [],
      sentAt: new Date().toISOString(),
    });
  };

  return (
    <MessageInputComponent onSend={handleSend} />
  );
}
```

## Implementation Details

### Internal State

The hook does not manage any internal state. It wraps the socket context and creates a stable send function.

```typescript
const socket = useContext(SocketContext);
```

### Dependencies

#### Internal Hooks
- `useContext` - Accesses the SocketContext to get the Socket.IO client

#### External Dependencies
- `SocketContext` - React context providing the Socket.IO client instance
- `socket.io-client` - WebSocket library for event emission

## WebSocket Integration

### Event Routing by Context Type

```typescript
function sendMessage(payload: NewMessagePayload) {
  if (!socket) {
    console.error("Socket not initialized");
    return;
  }

  // Determine which event to emit based on context
  const event = contextType === "channel"
    ? ClientEvents.SEND_MESSAGE     // 'sendMessage' for channels
    : ClientEvents.SEND_DM;          // 'sendDirectMessage' for DMs

  // Emit with acknowledgment callback
  socket.emit(event, payload, (messageId: string) => {
    if (callback) {
      callback(messageId);
    }
  });
}
```

### WebSocket Events

| Context Type | Event Emitted | Server Handler |
|--------------|---------------|----------------|
| `channel` | `SEND_MESSAGE` | `MessagesGateway.handleMessage` |
| `dm` | `SEND_DM` | `MessagesGateway.handleDirectMessageWithRBAC` |

### Acknowledgment Pattern

Socket.IO's acknowledgment feature allows the server to respond with the created message ID:

```typescript
// Client sends message
socket.emit('SEND_MESSAGE', messagePayload, (messageId: string) => {
  console.log('Message created with ID:', messageId);
  // Now we can upload files and associate them with this message
});

// Server creates message and responds with ID
return message.id; // This becomes the callback parameter
```

## Unified Pattern Benefits

### Before (Separate Implementations)

**Channels:**
```typescript
const sendMessage = useSendMessageSocket(callback);
sendMessage({ channelId, ... });
```

**Direct Messages:**
```typescript
const { sendDirectMessage } = useDirectMessageWebSocket();
sendDirectMessage(dmGroupId, spans); // Different interface!
```

### After (Unified Implementation)

**Channels:**
```typescript
const sendMessage = useSendMessage('channel', callback);
sendMessage({ channelId, ... });
```

**Direct Messages:**
```typescript
const sendMessage = useSendMessage('dm', callback);
sendMessage({ directMessageGroupId, ... }); // Same interface!
```

### Advantages

1. **Consistent Interface**: Same function signature for both contexts
2. **Code Reuse**: Message sending logic identical between channels and DMs
3. **File Upload Parity**: DMs get file upload support automatically
4. **Maintainability**: One implementation to maintain instead of two
5. **Type Safety**: Shared types ensure payload consistency

## Performance Considerations

### Optimization Notes

- **No Re-renders:** Hook doesn't manage state, so it doesn't cause component re-renders
- **Function Stability:** The returned sendMessage function is stable across re-renders
- **Memory Efficient:** Minimal memory footprint with no internal state management
- **Context-based Routing:** Event determination happens in O(1) time

### Callback Stability

For optimal performance, wrap callbacks in `useCallback`:

```typescript
// Good: Stable callback that won't change
const handleUpload = useCallback(async (messageId) => {
  // Upload logic
}, [/* stable dependencies */]);

const sendMessage = useSendMessage('channel', handleUpload);

// Avoid: Inline callback that creates new function each render
const sendMessage = useSendMessage('channel', (messageId) => {
  uploadFiles(messageId, someValue); // someValue makes this unstable
});
```

## Error Handling

### Socket Availability Check

```typescript
function sendMessage(payload: NewMessagePayload) {
  if (!socket) {
    console.error("Socket not initialized");
    return; // Gracefully handle missing socket
  }
  // Proceed with emission
}
```

### Error Handling Patterns

```tsx
function MessageSenderWithErrorHandling() {
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useSendMessage('channel', (messageId) => {
    setError(null); // Clear error on successful send
    console.log('Message sent:', messageId);
  });

  const handleSend = (content: string) => {
    try {
      sendMessage({
        channelId: 'channel-123',
        authorId: 'user-456',
        spans: [{ type: 'PLAINTEXT', text: content }],
        attachments: [],
        reactions: [],
        sentAt: new Date().toISOString(),
      });
      setError(null);
    } catch (err) {
      setError('Failed to send message');
      console.error('Send error:', err);
    }
  };

  return (
    <div>
      {error && <div className="error">{error}</div>}
      <MessageInput onSend={handleSend} />
    </div>
  );
}
```

## Testing

### Test Examples

```typescript
import { renderHook } from '@testing-library/react-hooks';
import { useSendMessage } from '../useSendMessage';
import { SocketContext } from '../../utils/SocketContext';

describe('useSendMessage', () => {
  let mockSocket;

  beforeEach(() => {
    mockSocket = {
      emit: jest.fn(),
    };
  });

  const wrapper = ({ children }) => (
    <SocketContext.Provider value={mockSocket}>
      {children}
    </SocketContext.Provider>
  );

  it('should return sendMessage function', () => {
    const { result } = renderHook(() => useSendMessage('channel'), { wrapper });

    expect(typeof result.current).toBe('function');
  });

  it('should emit SEND_MESSAGE event for channel context', () => {
    const { result } = renderHook(() => useSendMessage('channel'), { wrapper });
    const sendMessage = result.current;

    const messagePayload = {
      channelId: 'channel-123',
      authorId: 'user-456',
      spans: [{ type: 'PLAINTEXT', text: 'Test message' }],
      attachments: [],
      reactions: [],
      sentAt: new Date().toISOString(),
    };

    sendMessage(messagePayload);

    expect(mockSocket.emit).toHaveBeenCalledWith(
      'sendMessage',
      messagePayload,
      expect.any(Function)
    );
  });

  it('should emit SEND_DM event for dm context', () => {
    const { result } = renderHook(() => useSendMessage('dm'), { wrapper });
    const sendMessage = result.current;

    const messagePayload = {
      directMessageGroupId: 'dm-123',
      authorId: 'user-456',
      spans: [{ type: 'PLAINTEXT', text: 'DM test' }],
      attachments: [],
      reactions: [],
      sentAt: new Date().toISOString(),
    };

    sendMessage(messagePayload);

    expect(mockSocket.emit).toHaveBeenCalledWith(
      'sendDirectMessage',
      messagePayload,
      expect.any(Function)
    );
  });

  it('should invoke callback when provided', () => {
    const mockCallback = jest.fn();
    const { result } = renderHook(() => useSendMessage('channel', mockCallback), { wrapper });

    const sendMessage = result.current;
    sendMessage({
      channelId: 'channel-123',
      authorId: 'user-456',
      spans: [{ type: 'PLAINTEXT', text: 'Test' }],
      attachments: [],
      reactions: [],
      sentAt: new Date().toISOString(),
    });

    // Simulate server acknowledgment
    const [, , ackCallback] = mockSocket.emit.mock.calls[0];
    ackCallback('message-id-123');

    expect(mockCallback).toHaveBeenCalledWith('message-id-123');
  });

  it('should handle missing socket gracefully', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const { result } = renderHook(() => useSendMessage('channel'), {
      wrapper: ({ children }) => (
        <SocketContext.Provider value={null}>
          {children}
        </SocketContext.Provider>
      ),
    });

    const sendMessage = result.current;
    sendMessage({} as any);

    expect(consoleSpy).toHaveBeenCalledWith("Socket not initialized");
    consoleSpy.mockRestore();
  });
});
```

## Common Patterns

### Pattern 1: Simple Text Message

```tsx
function SimpleTextMessage({ contextType, contextId, authorId }) {
  const sendMessage = useSendMessage(contextType);
  const [text, setText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    const payload = {
      [contextType === 'channel' ? 'channelId' : 'directMessageGroupId']: contextId,
      authorId,
      spans: [{ type: 'PLAINTEXT', text: text }],
      attachments: [],
      reactions: [],
      sentAt: new Date().toISOString(),
    };

    sendMessage(payload);
    setText('');
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={text} onChange={(e) => setText(e.target.value)} />
      <button type="submit">Send</button>
    </form>
  );
}
```

### Pattern 2: Loading State Management

```tsx
function MessageInputWithLoading({ channelId, authorId }) {
  const [loading, setLoading] = useState(false);

  const sendMessage = useSendMessage('channel', () => {
    setLoading(false); // Clear loading on successful send
  });

  const handleSend = (content: string) => {
    setLoading(true);
    sendMessage({
      channelId,
      authorId,
      spans: [{ type: 'PLAINTEXT', text: content }],
      attachments: [],
      reactions: [],
      sentAt: new Date().toISOString(),
    });
  };

  return (
    <MessageInput
      onSend={handleSend}
      disabled={loading}
      placeholder={loading ? 'Sending...' : 'Type a message...'}
    />
  );
}
```

## Related Hooks

- **useSocket** - Provides the underlying Socket.IO instance this hook uses
- **useDirectMessageWebSocket** - Listens to DM WebSocket events (now separate from sending)
- **useChannelWebSocket** - Listens to channel WebSocket events
- **useFileUpload** - Often used in callback to upload files after message creation
- **useAddAttachmentMutation** - Associates uploaded files with messages

## Troubleshooting

### Common Issues

1. **Messages not sending**
   - **Symptoms:** sendMessage function doesn't send anything
   - **Cause:** Socket not initialized or not connected
   - **Solution:** Ensure SocketProvider is properly set up and socket is connected

   ```tsx
   // Check socket availability
   const socket = useSocket();
   const sendMessage = useSendMessage('channel');

   if (!socket) {
     return <div>Connecting to server...</div>;
   }
   ```

2. **Callback not triggered**
   - **Symptoms:** Acknowledgment callback never executes
   - **Cause:** Server not sending acknowledgment or connection issues
   - **Solution:** Verify server-side acknowledgment implementation

3. **Wrong event being sent**
   - **Symptoms:** Messages not appearing or server errors
   - **Cause:** Incorrect contextType parameter
   - **Solution:** Ensure contextType matches the message destination

   ```tsx
   // Channel messages
   useSendMessage('channel') // ✅ Correct

   // Direct messages
   useSendMessage('dm') // ✅ Correct
   useSendMessage('channel') // ❌ Wrong - DMs won't work
   ```

4. **TypeScript errors with payload**
   - **Symptoms:** Type errors when calling sendMessage
   - **Cause:** Incorrect message payload structure
   - **Solution:** Ensure payload includes required fields for context type

   ```typescript
   // Channel payload
   { channelId, authorId, spans, ... } // ✅ channelId required

   // DM payload
   { directMessageGroupId, authorId, spans, ... } // ✅ directMessageGroupId required
   ```

### Best Practices

- **Validate input:** Always validate message content before sending
- **Handle loading states:** Provide user feedback during message sending
- **Use callback for file uploads:** Take advantage of messageId callback for file associations
- **Error boundaries:** Wrap components using this hook in error boundaries
- **Callback stability:** Use useCallback for callback functions to prevent unnecessary re-creations

## Version History

- **1.0.0:** 2025-01-06 - Initial implementation unifying channel and DM message sending
- **Replaces:** `useSendMessageSocket` and `sendDirectMessage` from `useDirectMessageWebSocket`

## Related Documentation

- [useSocket Hook](./useSocket.md)
- [useDirectMessageWebSocket Hook](./useDirectMessageWebSocket.md)
- [useChannelWebSocket Hook](./useChannelWebSocket.md)
- [useFileUpload Hook](./useFileUpload.md)
- [Message Types](../../types/message.type.md)
- [WebSocket Events](../../api/websocket-events.md)
- [DirectMessageContainer Component](../components/direct-messages/DirectMessageContainer.md)
- [ChannelMessageContainer Component](../components/channel/ChannelMessageContainer.md)
