# useDirectMessageWebSocket Hook

## Overview

`useDirectMessageWebSocket` is a specialized React hook that manages WebSocket connections and real-time events for direct messages. It handles message sending, real-time event listening, room management, and Redux state updates for DM contexts.

## Hook Details

**Location**: `frontend/src/hooks/useDirectMessageWebSocket.ts`

**Type**: Custom React Hook with WebSocket and Redux integration

**Purpose**: Manage DM-specific WebSocket events and provide message sending capabilities

## Hook Signature

```typescript
export function useDirectMessageWebSocket() {
  // ... implementation

  return {
    joinDmGroup: (dmGroupId: string) => void;
    leaveDmGroup: (dmGroupId: string) => void;
  };
}
```

### Return Value

```typescript
interface UseDirectMessageWebSocketReturn {
  joinDmGroup: (dmGroupId: string) => void;      // Join DM WebSocket room
  leaveDmGroup: (dmGroupId: string) => void;     // Leave DM WebSocket room
}
```

**Note**: Message sending is now handled by the unified `useSendMessage` hook. This hook focuses solely on WebSocket event listening and room management.

## Core Functionality

### WebSocket Event Handling

The hook listens to multiple real-time events and updates Redux state accordingly:

```typescript
useEffect(() => {
  if (!socket) return;

  // Event handlers for different message operations
  const handleNewDM = ({ message }: { message: Message }) => { /* ... */ };
  const handleUpdateMessage = ({ message }: { message: Message }) => { /* ... */ };
  const handleDeleteMessage = ({ messageId, directMessageGroupId }) => { /* ... */ };
  const handleReactionAdded = ({ messageId, reaction }) => { /* ... */ };
  const handleReactionRemoved = ({ messageId, emoji, reactions }) => { /* ... */ };

  // Register event listeners
  socket.on(ServerEvents.NEW_DM, handleNewDM);
  socket.on(ServerEvents.UPDATE_MESSAGE, handleUpdateMessage);
  socket.on(ServerEvents.DELETE_MESSAGE, handleDeleteMessage);
  socket.on(ServerEvents.REACTION_ADDED, handleReactionAdded);
  socket.on(ServerEvents.REACTION_REMOVED, handleReactionRemoved);
  
  // Cleanup on unmount
  return () => {
    socket.off(ServerEvents.NEW_DM, handleNewDM);
    // ... other cleanup
  };
}, [socket, dispatch, messagesByChannelId]);
```

### Event Handler Implementations

#### New Direct Message Handler

```typescript
const handleNewDM = ({ message }: { message: Message }) => {
  console.log("[useDirectMessageWebSocket] Received NEW_DM event:", message);
  const targetDmGroupId = message.directMessageGroupId;
  if (targetDmGroupId) {
    console.log("[useDirectMessageWebSocket] Adding message to DM group:", targetDmGroupId);
    dispatch(prependMessage({ channelId: targetDmGroupId, message }));
  } else {
    console.warn("[useDirectMessageWebSocket] No directMessageGroupId in message:", message);
  }
};
```

**Features:**
- **Validation**: Checks for valid `directMessageGroupId`
- **Redux Update**: Prepends message to appropriate DM group
- **Debug Logging**: Comprehensive logging for troubleshooting
- **Error Handling**: Warns when message lacks required fields

#### Message Update Handler

```typescript
const handleUpdateMessage = ({ message }: { message: Message }) => {
  const targetDmGroupId = message.directMessageGroupId;
  if (targetDmGroupId) {
    dispatch(updateMessage({ channelId: targetDmGroupId, message }));
  }
};
```

**Features:**
- **Context Validation**: Only updates messages in DM context
- **Redux Integration**: Updates existing message in state
- **Efficient Updates**: Only modified messages trigger re-renders

#### Message Deletion Handler

```typescript
const handleDeleteMessage = ({
  messageId,
  directMessageGroupId,
}: {
  messageId: string;
  channelId?: string | null;
  directMessageGroupId?: string | null;
}) => {
  if (directMessageGroupId) {
    dispatch(deleteMessage({ channelId: directMessageGroupId, id: messageId }));
  }
};
```

**Features:**
- **Context-Aware**: Only processes DM deletions
- **Immediate Removal**: Message disappears from UI instantly
- **State Consistency**: Maintains Redux state integrity

#### Reaction Handlers

```typescript
const handleReactionAdded = ({
  messageId,
  reaction,
}: {
  messageId: string;
  reaction: any;
}) => {
  // Find the message in all DM groups and update it
  Object.keys(messagesByChannelId).forEach((dmGroupId) => {
    const messages = messagesByChannelId[dmGroupId]?.messages || [];
    const messageToUpdate = messages.find(msg => msg.id === messageId);
    if (messageToUpdate && messageToUpdate.directMessageGroupId) {
      const updatedReactions = [...messageToUpdate.reactions];
      const existingIndex = updatedReactions.findIndex(r => r.emoji === reaction.emoji);
      
      if (existingIndex >= 0) {
        updatedReactions[existingIndex] = reaction;
      } else {
        updatedReactions.push(reaction);
      }
      
      dispatch(updateMessage({
        channelId: dmGroupId,
        message: { ...messageToUpdate, reactions: updatedReactions }
      }));
    }
  });
};
```

**Features:**
- **Global Search**: Searches all DM groups to find target message
- **Reaction Management**: Adds/updates reactions in message state
- **Immutable Updates**: Creates new arrays to trigger React updates
- **Context Filtering**: Only updates DM messages

## Room Management

### Join DM Group

```typescript
const joinDmGroup = (dmGroupId: string) => {
  socket?.emit(ClientEvents.JOIN_DM_ROOM, dmGroupId);
};
```

**Purpose:**
- **Room Subscription**: Subscribe to DM group events
- **Real-time Updates**: Receive messages, reactions, etc.
- **Server Notification**: Inform server of user's interest in DM group

### Leave DM Group

```typescript
const leaveDmGroup = (dmGroupId: string) => {
  socket?.emit(ClientEvents.LEAVE_ROOM, dmGroupId);
};
```

**Purpose:**
- **Resource Cleanup**: Stop receiving events for DM group
- **Server Optimization**: Reduce server load by unsubscribing
- **Memory Management**: Clean up client-side event handling

## Real-time Event Types

### Server Events (Received)

| Event | Handler | Description |
|-------|---------|-------------|
| `NEW_DM` | `handleNewDM` | New message in DM group |
| `UPDATE_MESSAGE` | `handleUpdateMessage` | Message edited |
| `DELETE_MESSAGE` | `handleDeleteMessage` | Message deleted |
| `REACTION_ADDED` | `handleReactionAdded` | Reaction added to message |
| `REACTION_REMOVED` | `handleReactionRemoved` | Reaction removed from message |

### Client Events (Sent)

| Event | Function | Description |
|-------|----------|-------------|
| `JOIN_DM_ROOM` | `joinDmGroup` | Join DM WebSocket room |
| `LEAVE_ROOM` | `leaveDmGroup` | Leave DM WebSocket room |

**Note**: `SEND_DM` event is now sent by the `useSendMessage` hook.

## Redux Integration

### State Updates

```typescript
import {
  prependMessage,    // Add new message to beginning of list
  updateMessage,     // Update existing message
  deleteMessage,     // Remove message from state
} from "../features/messages/messagesSlice";
```

**State Operations:**
- **Prepend**: New messages added to start of message list
- **Update**: In-place updates for edits, reactions, etc.
- **Delete**: Message removed from Redux state

### State Structure

```typescript
// Messages stored using DM group ID as key (same as channelId pattern)
const messagesByChannelId = useAppSelector((state) => state.messages.byChannelId);

// Example state structure:
{
  "dm-group-123": {
    messages: [/* message array */],
    continuationToken: "...",
    hasMore: true
  },
  "dm-group-456": {
    messages: [/* message array */],
    continuationToken: "...",
    hasMore: true  
  }
}
```

## Performance Optimizations

### Efficient Message Searching

```typescript
// For reaction updates, search across all DM groups efficiently
Object.keys(messagesByChannelId).forEach((dmGroupId) => {
  const messages = messagesByChannelId[dmGroupId]?.messages || [];
  const messageToUpdate = messages.find(msg => msg.id === messageId);
  // Only update if message found and is DM message
});
```

**Optimizations:**
- **Short-Circuit Search**: Stops searching once message is found
- **Context Filtering**: Only processes DM messages
- **Batch Updates**: Multiple updates can be batched by React

### Memory Management

```typescript
// Event listeners cleaned up on unmount
return () => {
  socket.off(ServerEvents.NEW_DM, handleNewDM);
  socket.off(ServerEvents.UPDATE_MESSAGE, handleUpdateMessage);
  // ... other cleanup
};
```

**Memory Benefits:**
- **Event Cleanup**: Prevents memory leaks from event listeners
- **Reference Cleanup**: Handler functions garbage collected
- **Socket Cleanup**: Prevents duplicate event handlers

## Usage Examples

### Basic Hook Usage

```typescript
import { useDirectMessageWebSocket } from '@/hooks/useDirectMessageWebSocket';
import { useSendMessage } from '@/hooks/useSendMessage';

function DirectMessageContainer({ dmGroupId }: { dmGroupId: string }) {
  const { joinDmGroup, leaveDmGroup } = useDirectMessageWebSocket();
  const sendMessage = useSendMessage('dm');

  useEffect(() => {
    joinDmGroup(dmGroupId);
    return () => leaveDmGroup(dmGroupId);
  }, [dmGroupId, joinDmGroup, leaveDmGroup]);

  const handleSendMessage = (messageContent: string, spans: any[]) => {
    sendMessage({
      directMessageGroupId: dmGroupId,
      spans,
      // ... other message fields
    });
  };

  return (
    <MessageInput onSendMessage={handleSendMessage} />
  );
}
```

### Multiple DM Groups

```typescript
function MultiDMManager({ dmGroupIds }: { dmGroupIds: string[] }) {
  const { joinDmGroup, leaveDmGroup } = useDirectMessageWebSocket();

  useEffect(() => {
    // Join all DM groups
    dmGroupIds.forEach(id => joinDmGroup(id));

    return () => {
      // Leave all DM groups
      dmGroupIds.forEach(id => leaveDmGroup(id));
    };
  }, [dmGroupIds, joinDmGroup, leaveDmGroup]);

  return (
    <div>
      {/* UI for multiple DM groups */}
      {/* Message sending handled by useSendMessage in child components */}
    </div>
  );
}
```

## Error Handling

### WebSocket Connection Errors

```typescript
// Connection status checked before sending
console.log("[useDirectMessageWebSocket] Socket connected:", !!socket?.connected);

if (!socket?.connected) {
  // Could implement retry logic or show offline indicator
  console.warn('WebSocket not connected, message may not be sent');
}
```

### Event Handler Errors

```typescript
const handleNewDM = ({ message }: { message: Message }) => {
  try {
    // Message processing logic
    if (!message.directMessageGroupId) {
      throw new Error('Message missing directMessageGroupId');
    }
    
    dispatch(prependMessage({ channelId: message.directMessageGroupId, message }));
  } catch (error) {
    console.error('Error handling new DM:', error);
    // Could implement error reporting or recovery
  }
};
```

## Testing

### Unit Testing

**Test File**: `useDirectMessageWebSocket.test.ts`

**Test Coverage:**
- Event handler registration and cleanup
- Message sending functionality
- Room join/leave operations
- Redux state updates from events
- Error handling scenarios

**Example Tests:**
```typescript
describe('useDirectMessageWebSocket', () => {
  let mockSocket: jest.Mocked<Socket>;
  let mockDispatch: jest.MockedFunction<any>;

  beforeEach(() => {
    mockSocket = {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      connected: true,
    };
    
    jest.mocked(useSocket).mockReturnValue(mockSocket);
    mockDispatch = jest.fn();
    jest.mocked(useAppDispatch).mockReturnValue(mockDispatch);
  });

  it('registers event listeners on mount', () => {
    renderHook(() => useDirectMessageWebSocket());

    expect(mockSocket.on).toHaveBeenCalledWith(ServerEvents.NEW_DM, expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith(ServerEvents.UPDATE_MESSAGE, expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith(ServerEvents.DELETE_MESSAGE, expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith(ServerEvents.REACTION_ADDED, expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith(ServerEvents.REACTION_REMOVED, expect.any(Function));
  });

  it('provides room management functions', () => {
    const { result } = renderHook(() => useDirectMessageWebSocket());

    expect(typeof result.current.joinDmGroup).toBe('function');
    expect(typeof result.current.leaveDmGroup).toBe('function');
  });

  it('handles new DM event correctly', () => {
    renderHook(() => useDirectMessageWebSocket());

    const newDMHandler = mockSocket.on.mock.calls.find(
      call => call[0] === ServerEvents.NEW_DM
    )[1];

    const mockMessage = {
      id: 'msg-1',
      directMessageGroupId: 'dm-group-1',
      content: 'Hello',
    };

    newDMHandler({ message: mockMessage });

    expect(mockDispatch).toHaveBeenCalledWith(
      prependMessage({ channelId: 'dm-group-1', message: mockMessage })
    );
  });

  it('joins and leaves DM groups correctly', () => {
    const { result } = renderHook(() => useDirectMessageWebSocket());

    result.current.joinDmGroup('dm-group-1');
    expect(mockSocket.emit).toHaveBeenCalledWith(ClientEvents.JOIN_DM_ROOM, 'dm-group-1');

    result.current.leaveDmGroup('dm-group-1');
    expect(mockSocket.emit).toHaveBeenCalledWith(ClientEvents.LEAVE_ROOM, 'dm-group-1');
  });

  it('cleans up event listeners on unmount', () => {
    const { unmount } = renderHook(() => useDirectMessageWebSocket());

    unmount();

    expect(mockSocket.off).toHaveBeenCalledWith(ServerEvents.NEW_DM, expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith(ServerEvents.UPDATE_MESSAGE, expect.any(Function));
    // ... other cleanup calls
  });
});
```

### Integration Testing

- **Real WebSocket Events**: Test with actual WebSocket server
- **Message Flow**: Test complete send/receive cycles
- **Multi-user Scenarios**: Test reactions and updates from multiple users
- **Connection Recovery**: Test reconnection and event replay

## Related Components

### Direct Dependencies

- **`useSocket`**: Base WebSocket connection management
- **`useAppDispatch`**: Redux dispatch function  
- **`useAppSelector`**: Redux state selection
- **Message Redux Actions**: `prependMessage`, `updateMessage`, `deleteMessage`

### Related Hooks

- **`useChannelWebSocket`**: Channel WebSocket equivalent
- **`useDirectMessages`**: Consumes this hook's functionality
- **`useSocket`**: Provides underlying WebSocket connection

### WebSocket Infrastructure

- **Socket.IO Client**: WebSocket library
- **Event Constants**: `ServerEvents`, `ClientEvents` enums
- **WebSocket Middleware**: Connection management and authentication

---

## Architecture Benefits

### Event-Driven Architecture

- **Real-time Updates**: Immediate UI updates from WebSocket events
- **Decoupled Components**: Hook manages WebSocket complexity
- **State Consistency**: Single source of truth in Redux

### Performance Optimization

- **Efficient Searching**: Smart message lookup for reactions
- **Batched Updates**: React batches multiple Redux updates
- **Memory Management**: Proper event listener cleanup

### Developer Experience

- **Comprehensive Logging**: Detailed debugging information
- **Error Boundaries**: Graceful error handling
- **Type Safety**: Full TypeScript coverage for events and payloads

This hook provides the real-time foundation for direct messaging in Kraken, enabling instant communication with reliable state management and excellent developer experience.