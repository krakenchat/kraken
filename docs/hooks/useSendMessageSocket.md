# useSendMessageSocket

> **Location:** `frontend/src/hooks/useSendMessageSocket.ts`  
> **Type:** Custom Logic Hook  
> **Category:** websocket

## Overview

A focused WebSocket hook that provides a simplified interface for sending messages through Socket.IO with optional callback handling. Unlike `useChannelWebSocket`, this hook only handles message sending and provides acknowledgment callbacks, making it ideal for components that only need to send messages without managing real-time message reception.

## Hook Signature

```typescript
function useSendMessageSocket(callback?: (messageId: string) => void): (payload: NewMessagePayload) => void
```

### Parameters

```typescript
interface UseSendMessageSocketParams {
  callback?: (messageId: string) => void; // Optional callback invoked when server acknowledges message with generated ID
}
```

### Return Value

```typescript
type SendMessageFunction = (payload: NewMessagePayload) => void;

// Where NewMessagePayload is:
type NewMessagePayload = Omit<Message, "id">;
```

**Returns:** A function that sends messages via WebSocket with the provided payload.

## Usage Examples

### Basic Usage

```tsx
import { useSendMessageSocket } from '@/hooks/useSendMessageSocket';

function MessageInput({ channelId, authorId }: { channelId: string; authorId: string }) {
  const sendMessage = useSendMessageSocket();
  const [text, setText] = useState('');

  const handleSend = () => {
    if (!text.trim()) return;

    sendMessage({
      content: text,
      channelId,
      authorId,
      spans: [{ type: 'TEXT', content: text }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reactions: [],
      attachments: [],
    });

    setText(''); // Clear input after sending
  };

  return (
    <div>
      <input 
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
      />
      <button onClick={handleSend}>Send</button>
    </div>
  );
}
```

### Usage with Callback

```tsx
import { useSendMessageSocket } from '@/hooks/useSendMessageSocket';

function MessageInputWithFeedback({ channelId, authorId }: MessageInputProps) {
  const [sending, setSending] = useState(false);
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);

  // Callback receives the server-generated message ID
  const sendMessage = useSendMessageSocket((messageId: string) => {
    setSending(false);
    setLastMessageId(messageId);
    console.log('Message sent with ID:', messageId);
  });

  const handleSend = async () => {
    setSending(true);
    
    sendMessage({
      content: 'Hello with callback',
      channelId,
      authorId,
      spans: [{ type: 'TEXT', content: 'Hello with callback' }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div>
      <button onClick={handleSend} disabled={sending}>
        {sending ? 'Sending...' : 'Send Message'}
      </button>
      {lastMessageId && <p>Last message ID: {lastMessageId}</p>}
    </div>
  );
}
```

### Advanced Usage with Rich Messages

```tsx
function RichMessageSender({ channelId, authorId }: MessageSenderProps) {
  const sendMessage = useSendMessageSocket();

  const sendMentionMessage = (text: string, mentionedUsers: string[]) => {
    const spans = parseMentions(text, mentionedUsers); // Custom mention parsing
    
    sendMessage({
      content: text,
      channelId,
      authorId,
      spans,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reactions: [],
      attachments: [],
    });
  };

  const sendFileMessage = (file: File, description?: string) => {
    sendMessage({
      content: description || `Uploaded file: ${file.name}`,
      channelId,
      authorId,
      spans: [{ 
        type: 'TEXT', 
        content: description || `Uploaded file: ${file.name}` 
      }],
      attachments: [{
        id: generateTempId(),
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        url: URL.createObjectURL(file), // Temporary URL for preview
      }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div>
      <button onClick={() => sendMentionMessage('Hello @john!', ['john'])}>
        Send Mention
      </button>
      <input 
        type="file" 
        onChange={(e) => e.target.files?.[0] && sendFileMessage(e.target.files[0])}
      />
    </div>
  );
}
```

## Implementation Details

### Internal State

The hook does not manage any internal state, it simply wraps the socket context:

```typescript
const socket = useContext(SocketContext);
```

### Dependencies

#### Internal Hooks
- `useContext` - Accesses the SocketContext to get the socket instance

#### External Dependencies
- `SocketContext` - React context providing the Socket.IO client
- `socket.io-client` - For WebSocket event emission

## Socket Integration

### Message Emission

```typescript
function sendMessage(payload: NewMessagePayload) {
  if (!socket) {
    console.error("Socket not initialized");
    return;
  }
  
  socket.emit(ClientEvents.SEND_MESSAGE, payload, (messageId: string) =>
    callback ? callback(messageId) : undefined
  );
}
```

### Callback Acknowledgment

The hook uses Socket.IO's acknowledgment feature to receive the server-generated message ID:

```typescript
// Server response includes the generated message ID
socket.emit('SEND_MESSAGE', payload, (messageId: string) => {
  if (callback) {
    callback(messageId); // Invoke user-provided callback
  }
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
  
  const sendMessage = useSendMessageSocket((messageId) => {
    setError(null); // Clear error on successful send
    console.log('Message sent:', messageId);
  });

  const handleSend = () => {
    try {
      sendMessage(messagePayload);
      setError(null);
    } catch (err) {
      setError('Failed to send message');
      console.error('Send error:', err);
    }
  };

  return (
    <div>
      {error && <div className="error">{error}</div>}
      <button onClick={handleSend}>Send</button>
    </div>
  );
}
```

## Performance Considerations

### Optimization Notes

- **No Re-renders:** Hook doesn't manage state, so it doesn't cause component re-renders
- **Function Stability:** The returned sendMessage function is stable across re-renders
- **Memory Efficient:** Minimal memory footprint with no internal state management

### Callback Considerations

```typescript
// Good: Stable callback that won't change
const sendMessage = useSendMessageSocket(useCallback((messageId) => {
  console.log('Sent:', messageId);
}, []));

// Avoid: Callback that changes on every render
const sendMessage = useSendMessageSocket((messageId) => {
  console.log('Sent:', messageId, someValue); // someValue makes this unstable
});
```

## Testing

### Test Examples

```typescript
import { renderHook } from '@testing-library/react-hooks';
import { useSendMessageSocket } from '../useSendMessageSocket';
import { SocketContext } from '../../utils/SocketContext';

describe('useSendMessageSocket', () => {
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
    const { result } = renderHook(() => useSendMessageSocket(), { wrapper });
    
    expect(typeof result.current).toBe('function');
  });

  it('should emit SEND_MESSAGE event when sendMessage is called', () => {
    const { result } = renderHook(() => useSendMessageSocket(), { wrapper });
    const sendMessage = result.current;
    
    const messagePayload = {
      content: 'Test message',
      channelId: 'channel-123',
      authorId: 'user-456',
      spans: [{ type: 'TEXT', content: 'Test message' }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    sendMessage(messagePayload);
    
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'SEND_MESSAGE', 
      messagePayload, 
      expect.any(Function)
    );
  });

  it('should invoke callback when provided', () => {
    const mockCallback = jest.fn();
    const { result } = renderHook(() => useSendMessageSocket(mockCallback), { wrapper });
    
    const sendMessage = result.current;
    sendMessage(testPayload);
    
    // Simulate server acknowledgment
    const [, , ackCallback] = mockSocket.emit.mock.calls[0];
    ackCallback('message-id-123');
    
    expect(mockCallback).toHaveBeenCalledWith('message-id-123');
  });
});
```

## Common Patterns

### Pattern 1: Simple Message Input

```tsx
function SimpleMessageInput({ channelId, authorId }) {
  const sendMessage = useSendMessageSocket();
  const [text, setText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    sendMessage({
      content: text,
      channelId,
      authorId,
      spans: [{ type: 'TEXT', content: text }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    
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
  
  const sendMessage = useSendMessageSocket(() => {
    setLoading(false); // Clear loading on successful send
  });

  const handleSend = (content: string) => {
    setLoading(true);
    sendMessage({
      content,
      channelId,
      authorId,
      spans: [{ type: 'TEXT', content }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
- **useChannelWebSocket** - More comprehensive hook that also handles message reception
- **useCommunityJoin** - Ensures proper WebSocket room membership for message delivery

## Troubleshooting

### Common Issues

1. **Messages not sending**
   - **Symptoms:** sendMessage function doesn't send anything
   - **Cause:** Socket not initialized or not connected
   - **Solution:** Ensure SocketProvider is properly set up and socket is connected

   ```tsx
   // Check socket availability
   const socket = useSocket();
   const sendMessage = useSendMessageSocket();
   
   if (!socket) {
     return <div>Connecting to server...</div>;
   }
   ```

2. **Callback not triggered**
   - **Symptoms:** Acknowledgment callback never executes
   - **Cause:** Server not sending acknowledgment or connection issues
   - **Solution:** Verify server-side acknowledgment implementation and connection stability

3. **TypeScript errors with payload**
   - **Symptoms:** Type errors when calling sendMessage
   - **Cause:** Incorrect message payload structure
   - **Solution:** Ensure payload matches NewMessagePayload type

### Best Practices

- **Validate input:** Always validate message content before sending
- **Handle loading states:** Provide user feedback during message sending
- **Error boundaries:** Wrap components using this hook in error boundaries
- **Callback stability:** Use useCallback for callback functions when necessary

## Version History

- **1.0.0:** Initial implementation with basic message sending
- **1.1.0:** Added optional callback support for message acknowledgments
- **1.2.0:** Improved error handling and TypeScript types

## Related Documentation

- [useSocket Hook](./useSocket.md)
- [useChannelWebSocket Hook](./useChannelWebSocket.md)
- [Message Types](../../types/message.type.md)
- [WebSocket Events](../../api/websocket-events.md)