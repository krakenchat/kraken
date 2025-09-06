# useSocket

> **Location:** `frontend/src/hooks/useSocket.ts`  
> **Type:** Context Hook  
> **Category:** websocket

## Overview

A simple context hook that provides access to the Socket.IO client instance throughout the application. This hook is fundamental to all real-time communication in Kraken and serves as the foundation for other WebSocket-related hooks.

## Hook Signature

```typescript
function useSocket(): Socket<ServerToClientEvents, ClientToServerEvents> | null {
  // Hook implementation
}
```

### Parameters

This hook takes no parameters.

### Return Value

```typescript
type UseSocketReturn = Socket<ServerToClientEvents, ClientToServerEvents> | null;
```

**Returns:** The Socket.IO client instance or `null` if the socket is not available in the current context.

## Usage Examples

### Basic Usage

```tsx
import { useSocket } from '@/hooks/useSocket';

function ExampleComponent() {
  const socket = useSocket();

  const handleSendMessage = () => {
    if (!socket) {
      console.warn('Socket not available');
      return;
    }
    
    socket.emit('SEND_MESSAGE', messageData);
  };

  if (!socket) {
    return <div>Connecting to server...</div>;
  }

  return (
    <div>
      <p>Connected to server</p>
      <button onClick={handleSendMessage}>
        Send Message
      </button>
    </div>
  );
}
```

### Advanced Usage with Event Listeners

```tsx
import { useSocket } from '@/hooks/useSocket';
import { useEffect } from 'react';

function RealTimeComponent() {
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data) => {
      console.log('New message received:', data);
    };

    socket.on('NEW_MESSAGE', handleNewMessage);

    return () => {
      socket.off('NEW_MESSAGE', handleNewMessage);
    };
  }, [socket]);

  return <div>Real-time component</div>;
}
```

## Implementation Details

### Internal State

This hook does not manage any internal state. It simply retrieves the socket instance from the React context.

```typescript
const socket = useContext(SocketContext);
```

### Dependencies

#### Internal Hooks
- `useContext` - Accesses the SocketContext to retrieve the socket instance

#### External Dependencies
- `SocketContext` - The React context that provides the Socket.IO client instance

## Socket Context Integration

### Context Provider

The socket is provided through `SocketProvider` in the application root:

```typescript
import { SocketProvider } from '@/utils/SocketProvider';

function App() {
  return (
    <SocketProvider>
      {/* Your app components */}
    </SocketProvider>
  );
}
```

### Typed Events

The socket is fully typed with TypeScript interfaces:

```typescript
export type ServerToClientEvents = {
  NEW_MESSAGE: (data: NewMessagePayload) => void;
  UPDATE_MESSAGE: (data: UpdateMessagePayload) => void;
  DELETE_MESSAGE: (data: DeleteMessagePayload) => void;
  VOICE_CHANNEL_USER_JOINED: (data: { channelId: string; user: VoicePresenceUser }) => void;
  // ... other server events
};

export type ClientToServerEvents = {
  JOIN_ALL: (communityId: string) => void;
  SEND_MESSAGE: (data: Omit<NewMessagePayload, "id">, callback?: (messageId: string) => void) => void;
  // ... other client events
};
```

## Error Handling

### Null Socket Handling

The hook returns `null` when the socket is not available:

```typescript
function ComponentWithSocketCheck() {
  const socket = useSocket();
  
  if (!socket) {
    // Handle the case where socket is not available
    return <div>No socket connection</div>;
  }
  
  // Safe to use socket here
  return <div>Socket connected</div>;
}
```

### Connection State

```typescript
function ConnectionAwareComponent() {
  const socket = useSocket();
  
  useEffect(() => {
    if (!socket) return;
    
    const handleConnect = () => console.log('Connected');
    const handleDisconnect = () => console.log('Disconnected');
    const handleConnectError = (error) => console.error('Connection error:', error);
    
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
    };
  }, [socket]);
  
  return <div>Connection aware component</div>;
}
```

## Performance Considerations

### Optimization Notes

- **No Re-renders:** This hook does not cause re-renders as it simply accesses a context value
- **Singleton Instance:** The socket instance is a singleton shared across the application
- **Memory Usage:** Minimal memory usage as it only returns a reference to the existing socket

## Testing

### Test Location
`frontend/src/hooks/__tests__/useSocket.test.ts`

### Test Examples

```typescript
import { renderHook } from '@testing-library/react-hooks';
import { useSocket } from '../useSocket';
import { SocketContext } from '../../utils/SocketContext';

describe('useSocket', () => {
  it('should return socket instance when context is provided', () => {
    const mockSocket = {} as any; // Mock socket instance
    
    const wrapper = ({ children }) => (
      <SocketContext.Provider value={mockSocket}>
        {children}
      </SocketContext.Provider>
    );
    
    const { result } = renderHook(() => useSocket(), { wrapper });
    
    expect(result.current).toBe(mockSocket);
  });

  it('should return null when no context is provided', () => {
    const { result } = renderHook(() => useSocket());
    
    expect(result.current).toBeNull();
  });
});
```

## Common Patterns

### Pattern 1: Conditional Socket Usage

```tsx
function ConditionalSocketComponent() {
  const socket = useSocket();
  
  const sendData = useCallback((data) => {
    if (!socket) return;
    socket.emit('SEND_DATA', data);
  }, [socket]);
  
  return (
    <button onClick={() => sendData({ message: 'Hello' })}>
      {socket ? 'Send Message' : 'Connecting...'}
    </button>
  );
}
```

### Pattern 2: Real-time Event Subscription

```tsx
function EventSubscriptionComponent() {
  const socket = useSocket();
  const [messages, setMessages] = useState([]);
  
  useEffect(() => {
    if (!socket) return;
    
    const handleMessage = (message) => {
      setMessages(prev => [...prev, message]);
    };
    
    socket.on('NEW_MESSAGE', handleMessage);
    
    return () => socket.off('NEW_MESSAGE', handleMessage);
  }, [socket]);
  
  return <MessageList messages={messages} />;
}
```

## Related Hooks

- **useChannelWebSocket** - Uses this hook for channel-specific WebSocket handling
- **useSendMessageSocket** - Uses this hook for message sending functionality
- **useVoiceConnection** - Uses this hook for voice-related WebSocket events
- **useCommunityJoin** - Uses this hook for community WebSocket room management

## Troubleshooting

### Common Issues

1. **Hook returns null**
   - **Symptoms:** Socket is always null, even when wrapped with SocketProvider
   - **Cause:** Component is rendered outside of SocketProvider context
   - **Solution:** Ensure the component is wrapped with SocketProvider

   ```tsx
   // Incorrect - Outside provider
   function App() {
     return (
       <div>
         <ComponentUsingSocket />
         <SocketProvider>
           {/* Other components */}
         </SocketProvider>
       </div>
     );
   }
   
   // Correct - Inside provider
   function App() {
     return (
       <SocketProvider>
         <div>
           <ComponentUsingSocket />
           {/* Other components */}
         </div>
       </SocketProvider>
     );
   }
   ```

2. **Socket events not working**
   - **Symptoms:** Event listeners don't trigger or emit events fail
   - **Cause:** Socket connection is not established or authentication issues
   - **Solution:** Check socket connection state and authentication

### Best Practices

- **Always check for null:** Always verify the socket exists before using it
- **Proper cleanup:** Always remove event listeners in useEffect cleanup functions
- **Type safety:** Use the typed socket interfaces for better development experience
- **Error handling:** Handle connection errors and disconnection events appropriately

## Version History

- **1.0.0:** Initial implementation - Basic context hook for Socket.IO access

## Related Documentation

- [SocketContext](../../utils/SocketContext.md)
- [SocketProvider](../../utils/SocketProvider.md)
- [WebSocket Events](../../api/websocket-events.md)
- [useChannelWebSocket Hook](./useChannelWebSocket.md)