# useChannelWebSocket

> **Location:** `frontend/src/hooks/useChannelWebSocket.ts`  
> **Type:** Effect Hook  
> **Category:** websocket

## Overview

A specialized WebSocket hook that manages real-time message events for channels within a community. It handles listening to message creation, updates, and deletions, automatically updating the Redux store with incoming real-time data. This hook is essential for live messaging functionality in chat channels.

## Hook Signature

```typescript
function useChannelWebSocket(communityId: string | undefined): {
  sendMessage: (msg: Omit<Message, "id">) => void;
}
```

### Parameters

```typescript
interface UseChannelWebSocketParams {
  communityId: string | undefined;  // The community ID to listen for message events
}
```

### Return Value

```typescript
interface UseChannelWebSocketReturn {
  sendMessage: (msg: Omit<Message, "id">) => void; // Function to send a new message via WebSocket
}
```

## Usage Examples

### Basic Usage

```tsx
import { useChannelWebSocket } from '@/hooks/useChannelWebSocket';
import { useParams } from 'react-router-dom';

function ChannelMessageContainer() {
  const { communityId } = useParams<{ communityId: string }>();
  const { sendMessage } = useChannelWebSocket(communityId);

  const handleSendMessage = () => {
    sendMessage({
      content: 'Hello, world!',
      channelId: 'channel-123',
      authorId: 'user-456',
      spans: [{ type: 'TEXT', content: 'Hello, world!' }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div>
      <button onClick={handleSendMessage}>
        Send Message
      </button>
    </div>
  );
}
```

### Advanced Integration with Message Components

```tsx
import { useChannelWebSocket } from '@/hooks/useChannelWebSocket';
import { useSelector } from 'react-redux';
import { makeSelectMessagesByChannel } from '@/features/messages/messagesSlice';

function AdvancedChannelContainer({ channelId }: { channelId: string }) {
  const { communityId } = useParams<{ communityId: string }>();
  const { sendMessage } = useChannelWebSocket(communityId);
  
  // Messages are automatically updated via the hook's Redux dispatch calls
  const selectMessagesByChannel = React.useMemo(makeSelectMessagesByChannel, []);
  const messages = useSelector((state: RootState) => 
    selectMessagesByChannel(state, channelId)
  );

  const handleMessageSend = (content: string, authorId: string) => {
    sendMessage({
      content,
      channelId,
      authorId,
      spans: [{ type: 'TEXT', content }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reactions: [],
      attachments: [],
    });
  };

  return (
    <div>
      {messages.map(message => (
        <MessageComponent key={message.id} message={message} />
      ))}
      <MessageInput onSend={handleMessageSend} />
    </div>
  );
}
```

## Implementation Details

### Internal State

The hook does not manage internal state but uses Redux dispatch to update global message state:

```typescript
const dispatch = useAppDispatch();
const socket = useSocket();
```

### Dependencies

#### Internal Hooks
- `useSocket` - Accesses the Socket.IO client instance
- `useEffect` - Sets up and tears down WebSocket event listeners
- `useAppDispatch` - Dispatches Redux actions for state updates

#### External Hooks
- `useParams` (in components) - Gets community ID from route parameters

#### External Dependencies
- `react-redux` - For dispatching Redux actions
- `socket.io-client` - For WebSocket communication

## WebSocket Event Handling

### Event Listeners

The hook listens to three main server events:

```typescript
// New message received
socket.on(ServerEvents.NEW_MESSAGE, ({ message }: { message: Message }) => {
  const targetChannelId = message.channelId || message.directMessageGroupId;
  if (targetChannelId) {
    dispatch(prependMessage({ channelId: targetChannelId, message }));
  }
});

// Message updated
socket.on(ServerEvents.UPDATE_MESSAGE, ({ message }: { message: Message }) => {
  const targetChannelId = message.channelId || message.directMessageGroupId;
  if (targetChannelId) {
    dispatch(updateMessage({ channelId: targetChannelId, message }));
  }
});

// Message deleted
socket.on(ServerEvents.DELETE_MESSAGE, ({ messageId, channelId, directMessageGroupId }) => {
  const targetChannelId = channelId || directMessageGroupId;
  if (targetChannelId) {
    dispatch(deleteMessage({ channelId: targetChannelId, id: messageId }));
  }
});
```

### Event Emission

```typescript
const sendMessage = (msg: Omit<Message, "id">) => {
  // @ts-expect-error: id will be assigned by the server
  socket.emit(ClientEvents.SEND_MESSAGE, msg);
};
```

## Redux Integration

### State Updates

The hook automatically updates the Redux store through these action dispatches:

```typescript
import {
  prependMessage,
  updateMessage,
  deleteMessage,
} from '../features/messages/messagesSlice';

// Add new message to the beginning of the channel's message list
dispatch(prependMessage({ channelId: targetChannelId, message }));

// Update existing message in place
dispatch(updateMessage({ channelId: targetChannelId, message }));

// Remove message from the channel's message list
dispatch(deleteMessage({ channelId: targetChannelId, id: messageId }));
```

### Channel ID Resolution

The hook supports both regular channels and direct message groups:

```typescript
const targetChannelId = message.channelId || message.directMessageGroupId;
```

## Side Effects

### Effect Dependencies

```typescript
useEffect(() => {
  if (!socket || !communityId) return;
  
  // Set up event listeners
  socket.on(ServerEvents.NEW_MESSAGE, handleNewMessage);
  socket.on(ServerEvents.UPDATE_MESSAGE, handleUpdateMessage);
  socket.on(ServerEvents.DELETE_MESSAGE, handleDeleteMessage);
  
  return () => {
    // Cleanup event listeners
    socket.off(ServerEvents.NEW_MESSAGE, handleNewMessage);
    socket.off(ServerEvents.UPDATE_MESSAGE, handleUpdateMessage);
    socket.off(ServerEvents.DELETE_MESSAGE, handleDeleteMessage);
  };
}, [socket, communityId, dispatch]); // Re-run when socket, communityId, or dispatch changes
```

### Cleanup

The hook properly cleans up all event listeners when:
- The component unmounts
- The socket instance changes
- The communityId changes

## Performance Considerations

### Optimization Notes

- **Selective Updates:** Only updates messages for the relevant channel/DM group
- **Memoized Handlers:** Event handlers are stable and don't cause unnecessary re-renders
- **Efficient Redux Updates:** Uses targeted Redux actions instead of bulk state replacement

### Message Handling Strategy

- **Prepend Strategy:** New messages are added to the beginning of the list for better performance
- **Targeted Updates:** Only updates specific messages rather than refetching entire message lists
- **Channel Filtering:** Filters messages by channel ID to prevent cross-channel pollution

## Error Handling

### Null Checks

```typescript
useEffect(() => {
  if (!socket || !communityId) return; // Guard against null values
  
  // Setup event listeners only when both socket and communityId are available
}, [socket, communityId, dispatch]);
```

### Message Validation

```typescript
const handleNewMessage = ({ message }: { message: Message }) => {
  const targetChannelId = message.channelId || message.directMessageGroupId;
  if (targetChannelId) { // Only process messages with valid channel IDs
    dispatch(prependMessage({ channelId: targetChannelId, message }));
  }
};
```

## Testing

### Test Examples

```typescript
import { renderHook } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { useChannelWebSocket } from '../useChannelWebSocket';
import { store } from '../../app/store';

describe('useChannelWebSocket', () => {
  const wrapper = ({ children }) => (
    <Provider store={store}>
      <MockSocketProvider>
        {children}
      </MockSocketProvider>
    </Provider>
  );

  it('should set up message event listeners when communityId is provided', () => {
    const mockSocket = {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    };
    
    const { result } = renderHook(
      () => useChannelWebSocket('community-123'),
      { wrapper }
    );
    
    expect(mockSocket.on).toHaveBeenCalledWith('NEW_MESSAGE', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('UPDATE_MESSAGE', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('DELETE_MESSAGE', expect.any(Function));
  });

  it('should return sendMessage function', () => {
    const { result } = renderHook(
      () => useChannelWebSocket('community-123'),
      { wrapper }
    );
    
    expect(typeof result.current.sendMessage).toBe('function');
  });
});
```

## Common Patterns

### Pattern 1: Channel Message Container Integration

```tsx
function ChannelMessageContainer({ channelId }: { channelId: string }) {
  const { communityId } = useParams<{ communityId: string }>();
  const { sendMessage } = useChannelWebSocket(communityId);
  
  // Hook automatically handles real-time message updates
  // Components just need to read from Redux store
  const messages = useSelector(selectMessagesByChannel(channelId));
  
  return (
    <div>
      <MessageList messages={messages} />
      <MessageInput onSend={(content, authorId) => 
        sendMessage({
          content,
          channelId,
          authorId,
          spans: [{ type: 'TEXT', content }],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      } />
    </div>
  );
}
```

### Pattern 2: Conditional Hook Usage

```tsx
function ConditionalChannelComponent() {
  const { communityId } = useParams<{ communityId?: string }>();
  
  // Hook gracefully handles undefined communityId
  const { sendMessage } = useChannelWebSocket(communityId);
  
  if (!communityId) {
    return <div>Please select a community</div>;
  }
  
  return <ChannelInterface onSendMessage={sendMessage} />;
}
```

## Related Hooks

- **useSocket** - Provides the underlying Socket.IO instance
- **useSendMessageSocket** - Alternative message sending hook with callback support
- **useCommunityJoin** - Handles joining/leaving community WebSocket rooms
- **useVoiceEvents** - Handles voice-related WebSocket events

## Troubleshooting

### Common Issues

1. **Messages not appearing in real-time**
   - **Symptoms:** New messages don't show up until page refresh
   - **Cause:** Community WebSocket room not joined or incorrect communityId
   - **Solution:** Ensure useCommunityJoin is called and communityId is correct

2. **Duplicate messages**
   - **Symptoms:** Same message appears multiple times
   - **Cause:** Multiple instances of the hook or improper cleanup
   - **Solution:** Ensure hook is used only once per community context

3. **Messages appearing in wrong channels**
   - **Symptoms:** Messages from one channel appear in another
   - **Cause:** Incorrect channel ID handling or state pollution
   - **Solution:** Verify channelId logic and Redux state structure

### Best Practices

- **Single instance per community:** Use this hook once per community context
- **Combine with useCommunityJoin:** Always pair with useCommunityJoin for proper room management
- **Handle undefined communityId:** Gracefully handle cases where communityId might be undefined
- **Use with message selectors:** Combine with Redux selectors for efficient message retrieval

## Version History

- **1.0.0:** Initial implementation with basic message event handling
- **1.1.0:** Added support for direct message groups
- **1.2.0:** Improved channel ID resolution and error handling

## Related Documentation

- [useSocket Hook](./useSocket.md)
- [useSendMessageSocket Hook](./useSendMessageSocket.md)
- [Messages API Slice](../../api/messages.md)
- [WebSocket Events](../../api/websocket-events.md)