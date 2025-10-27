# SocketContext

**Path**: `frontend/src/utils/SocketContext.ts`
**Type**: React Context
**Purpose**: Provides type-safe Socket.IO client for real-time WebSocket communication throughout the application

---

## Overview

The `SocketContext` is a React Context that provides access to a typed Socket.IO client instance. It defines the event interfaces for client-to-server and server-to-client communication, ensuring type safety across all real-time features.

### Key Features

- **Type-Safe Events**: Full TypeScript definitions for all WebSocket events
- **Global Access**: Single socket instance available throughout the app
- **Event Contracts**: Clear contracts between frontend and backend
- **Payload Types**: Strongly typed payloads for all events

---

## Context Definition

```typescript
export const SocketContext = createContext<Socket<
  ServerToClientEvents,
  ClientToServerEvents
> | null>(null);
```

The context provides a `Socket` instance typed with:
- `ServerToClientEvents`: Events the client can receive
- `ClientToServerEvents`: Events the client can send

---

## Event Interfaces

### ServerToClientEvents

Events that the **backend sends** to the **frontend**:

```typescript
export type ServerToClientEvents = {
  // Message events
  [ServerEvents.NEW_MESSAGE]: (data: NewMessagePayload) => void;
  [ServerEvents.UPDATE_MESSAGE]: (data: UpdateMessagePayload) => void;
  [ServerEvents.DELETE_MESSAGE]: (data: DeleteMessagePayload) => void;
  [ServerEvents.NEW_DM]: (data: { message: any }) => void;

  // Voice presence events
  [ServerEvents.VOICE_CHANNEL_USER_JOINED]: (data: {
    channelId: string;
    user: VoicePresenceUser
  }) => void;

  [ServerEvents.VOICE_CHANNEL_USER_LEFT]: (data: {
    channelId: string;
    userId: string;
    user: VoicePresenceUser
  }) => void;

  [ServerEvents.VOICE_CHANNEL_USER_UPDATED]: (data: {
    channelId: string;
    userId: string;
    user: VoicePresenceUser;
    updates: Record<string, unknown>;
  }) => void;

  // Response events
  [ServerEvents.ACK]: (data: AckPayload) => void;
  [ServerEvents.ERROR]: (data: ErrorPayload) => void;
};
```

### ClientToServerEvents

Events that the **frontend sends** to the **backend**:

```typescript
export type ClientToServerEvents = {
  // Room management
  [ClientEvents.JOIN_ALL]: (communityId: string) => void;
  [ClientEvents.JOIN_ROOM]: (channelId: string) => void;
  [ClientEvents.LEAVE_ROOM]: (channelId: string) => void;

  // Message events
  [ClientEvents.SEND_MESSAGE]: (
    data: Omit<NewMessagePayload, "id">,
    callback?: (messageId: string) => void
  ) => void;

  [ClientEvents.SEND_DM]: (
    data: {
      directMessageGroupId: string;
      spans: any[];
      attachments: any[];
    },
    callback?: (messageId: string) => void
  ) => void;

  // Voice channel events
  [ClientEvents.VOICE_CHANNEL_JOIN]: (data: { channelId: string }) => void;
  [ClientEvents.VOICE_CHANNEL_LEAVE]: (data: { channelId: string }) => void;

  [ClientEvents.VOICE_STATE_UPDATE]: (data: {
    channelId: string;
    isVideoEnabled?: boolean;
    isScreenSharing?: boolean;
    isMuted?: boolean;
    isDeafened?: boolean;
  }) => void;

  [ClientEvents.VOICE_PRESENCE_REFRESH]: (data: { channelId: string }) => void;
};
```

---

## Event Categories

### 1. Message Events

#### NEW_MESSAGE (Server → Client)
Broadcasts new messages to channel members.

**Payload**: `NewMessagePayload`
```typescript
{
  id: string;
  content: string;
  spans: Span[];
  attachments: Attachment[];
  author: User;
  channelId: string;
  createdAt: Date;
}
```

#### UPDATE_MESSAGE (Server → Client)
Notifies when a message is edited.

**Payload**: `UpdateMessagePayload`
```typescript
{
  id: string;
  content: string;
  channelId: string;
  editedAt: Date;
}
```

#### DELETE_MESSAGE (Server → Client)
Notifies when a message is deleted.

**Payload**: `DeleteMessagePayload`
```typescript
{
  id: string;
  channelId: string;
}
```

#### SEND_MESSAGE (Client → Server)
Sends a new message to a channel.

**Payload**: `Omit<NewMessagePayload, "id">`
**Callback**: `(messageId: string) => void` - Returns the created message ID

#### NEW_DM (Server → Client)
Notifies when a new direct message is received.

**Payload**: `{ message: any }`

#### SEND_DM (Client → Server)
Sends a direct message.

**Payload**:
```typescript
{
  directMessageGroupId: string;
  spans: any[];
  attachments: any[];
}
```
**Callback**: `(messageId: string) => void`

---

### 2. Room Management Events

#### JOIN_ALL (Client → Server)
Joins all rooms (channels) for a community.

**Payload**: `communityId: string`

**Backend Behavior**:
- Joins all public channels in the community
- Joins private channels user has membership to
- Joins all direct message groups
- Joins all alias groups

#### JOIN_ROOM (Client → Server)
Joins a specific channel room.

**Payload**: `channelId: string`

#### LEAVE_ROOM (Client → Server)
Leaves a specific channel room.

**Payload**: `channelId: string`

---

### 3. Voice Presence Events

#### VOICE_CHANNEL_USER_JOINED (Server → Client)
Notifies when a user joins a voice channel.

**Payload**:
```typescript
{
  channelId: string;
  user: VoicePresenceUser; // { id, username, displayName, avatarUrl, joinedAt, isMuted, isDeafened, isVideoEnabled, isScreenSharing }
}
```

#### VOICE_CHANNEL_USER_LEFT (Server → Client)
Notifies when a user leaves a voice channel.

**Payload**:
```typescript
{
  channelId: string;
  userId: string;
  user: VoicePresenceUser;
}
```

#### VOICE_CHANNEL_USER_UPDATED (Server → Client)
Notifies when a user's voice state changes (mute, video, screen share).

**Payload**:
```typescript
{
  channelId: string;
  userId: string;
  user: VoicePresenceUser;
  updates: Record<string, unknown>; // Changed fields
}
```

#### VOICE_CHANNEL_JOIN (Client → Server)
Notifies backend that user joined voice channel.

**Payload**: `{ channelId: string }`

**Note**: This is sent AFTER LiveKit connection is established, not instead of it.

#### VOICE_CHANNEL_LEAVE (Client → Server)
Notifies backend that user left voice channel.

**Payload**: `{ channelId: string }`

#### VOICE_STATE_UPDATE (Client → Server)
Updates user's voice state (mute, video, screen share).

**Payload**:
```typescript
{
  channelId: string;
  isVideoEnabled?: boolean;
  isScreenSharing?: boolean;
  isMuted?: boolean;
  isDeafened?: boolean;
}
```

**Backend Behavior**: Updates Redis voice presence and broadcasts to other users in channel.

#### VOICE_PRESENCE_REFRESH (Client → Server)
Requests a refresh of voice presence data for a channel.

**Payload**: `{ channelId: string }`

---

### 4. Response Events

#### ACK (Server → Client)
Acknowledges successful operations.

**Payload**: `AckPayload`
```typescript
{
  message: string;
  data?: any;
}
```

#### ERROR (Server → Client)
Reports errors from server operations.

**Payload**: `ErrorPayload`
```typescript
{
  message: string;
  code?: string;
  details?: any;
}
```

---

## Usage

### Accessing the Socket

Use the `useSocket` hook (recommended):

```typescript
import { useSocket } from '../hooks/useSocket';

function MyComponent() {
  const socket = useSocket();

  if (!socket) {
    return <div>Connecting...</div>;
  }

  // Use socket...
}
```

### Sending Events

```typescript
// Simple event
socket.emit(ClientEvents.JOIN_ROOM, channelId);

// Event with callback
socket.emit(
  ClientEvents.SEND_MESSAGE,
  {
    channelId,
    content: "Hello!",
    spans: [],
    attachments: []
  },
  (messageId) => {
    console.log('Message created with ID:', messageId);
  }
);
```

### Listening to Events

```typescript
useEffect(() => {
  if (!socket) return;

  const handleNewMessage = (data: NewMessagePayload) => {
    console.log('New message:', data);
    // Update UI...
  };

  socket.on(ServerEvents.NEW_MESSAGE, handleNewMessage);

  return () => {
    socket.off(ServerEvents.NEW_MESSAGE, handleNewMessage);
  };
}, [socket]);
```

---

## Provider Setup

The socket is provided at the app level:

```typescript
// App.tsx or similar
import { SocketContext } from './utils/SocketContext';
import { io } from 'socket.io-client';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const token = getAuthToken();
    const newSocket = io('http://localhost:3001', {
      auth: { token },
      transports: ['websocket']
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {/* App components */}
    </SocketContext.Provider>
  );
}
```

---

## Event Enums

### ServerEvents

Defined in `frontend/src/types/server-events.enum.ts`:

```typescript
export enum ServerEvents {
  NEW_MESSAGE = 'newMessage',
  UPDATE_MESSAGE = 'updateMessage',
  DELETE_MESSAGE = 'deleteMessage',
  NEW_DM = 'newDm',
  VOICE_CHANNEL_USER_JOINED = 'voiceChannelUserJoined',
  VOICE_CHANNEL_USER_LEFT = 'voiceChannelUserLeft',
  VOICE_CHANNEL_USER_UPDATED = 'voiceChannelUserUpdated',
  ACK = 'ack',
  ERROR = 'error',
}
```

### ClientEvents

Defined in `frontend/src/types/client-events.enum.ts`:

```typescript
export enum ClientEvents {
  JOIN_ALL = 'joinAll',
  JOIN_ROOM = 'joinRoom',
  LEAVE_ROOM = 'leaveRoom',
  SEND_MESSAGE = 'sendMessage',
  SEND_DM = 'sendDm',
  VOICE_CHANNEL_JOIN = 'voiceChannelJoin',
  VOICE_CHANNEL_LEAVE = 'voiceChannelLeave',
  VOICE_STATE_UPDATE = 'voiceStateUpdate',
  VOICE_PRESENCE_REFRESH = 'voicePresenceRefresh',
}
```

---

## Type Safety Benefits

### 1. Compile-Time Validation

```typescript
// ✅ Correct - TypeScript validates event name and payload
socket.emit(ClientEvents.SEND_MESSAGE, {
  channelId: '123',
  content: 'Hello',
  spans: [],
  attachments: []
});

// ❌ Error - Unknown event
socket.emit('unknownEvent', {});

// ❌ Error - Wrong payload type
socket.emit(ClientEvents.SEND_MESSAGE, {
  wrongField: true
});
```

### 2. IntelliSense Support

IDEs provide autocomplete for:
- Available events
- Payload structure
- Callback signatures

### 3. Refactoring Safety

Changing event names or payload structures causes compile errors, ensuring all usages are updated.

---

## Integration with Backend

### Backend Socket Types

Backend uses the same event definitions (imported from shared types or duplicated):

```typescript
// backend/src/websocket/types.ts
export interface ServerToClientEvents { /* same as frontend */ }
export interface ClientToServerEvents { /* same as frontend */ }

// Gateway decorator
@WebSocketGateway()
export class MessagesGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server<ClientToServerEvents, ServerToClientEvents>;
}
```

This ensures frontend and backend stay in sync.

---

## Common Patterns

### 1. Room-Based Broadcasting

```typescript
// Backend
this.server.to(channelId).emit(ServerEvents.NEW_MESSAGE, messageData);

// Frontend (automatic) - receives if in room
socket.on(ServerEvents.NEW_MESSAGE, handleNewMessage);
```

### 2. Acknowledgment Pattern

```typescript
// Frontend
socket.emit(ClientEvents.SEND_MESSAGE, messageData, (messageId) => {
  console.log('Message saved with ID:', messageId);
});

// Backend
@SubscribeMessage(ClientEvents.SEND_MESSAGE)
async handleMessage(@MessageBody() data, @ConnectedSocket() client) {
  const message = await this.saveMessage(data);
  return message.id; // Automatically sent to callback
}
```

### 3. Error Handling

```typescript
// Frontend
useEffect(() => {
  if (!socket) return;

  const handleError = (error: ErrorPayload) => {
    toast.error(error.message);
  };

  socket.on(ServerEvents.ERROR, handleError);
  return () => socket.off(ServerEvents.ERROR, handleError);
}, [socket]);
```

---

## Best Practices

### 1. Always Clean Up Listeners

```typescript
useEffect(() => {
  if (!socket) return;

  socket.on(ServerEvents.NEW_MESSAGE, handler);

  return () => {
    socket.off(ServerEvents.NEW_MESSAGE, handler); // IMPORTANT!
  };
}, [socket]);
```

### 2. Check Socket Existence

```typescript
if (!socket) {
  console.warn('Socket not connected');
  return;
}

socket.emit(event, data);
```

### 3. Use Typed Hooks

Create custom hooks for specific features:

```typescript
// hooks/useMessageSocket.ts
export function useMessageSocket(channelId: string) {
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.emit(ClientEvents.JOIN_ROOM, channelId);

    return () => {
      socket.emit(ClientEvents.LEAVE_ROOM, channelId);
    };
  }, [socket, channelId]);

  const sendMessage = useCallback((content: string) => {
    if (!socket) return;
    socket.emit(ClientEvents.SEND_MESSAGE, { channelId, content, spans: [], attachments: [] });
  }, [socket, channelId]);

  return { sendMessage };
}
```

---

## Debugging

### Enable Socket.IO Debug Logs

```typescript
localStorage.debug = 'socket.io-client:socket';
```

### Monitor Events

```typescript
// Log all incoming events
socket.onAny((event, ...args) => {
  console.log(`[Socket] ${event}`, args);
});

// Log all outgoing events
socket.onAnyOutgoing((event, ...args) => {
  console.log(`[Socket OUT] ${event}`, args);
});
```

---

## Related Documentation

- [WebSocket Service (Backend)](../modules/core/websocket.md)
- [Messages Gateway](../api/messages-gateway.md)
- [Presence Gateway](../api/presence-gateway.md)
- [Voice Presence API](../state/voicePresenceApi.md)
- [Real-time Messaging](../features/real-time-messaging.md)

---

## File Location

```
frontend/src/utils/SocketContext.ts
```

**Dependencies**:
- `socket.io-client`: Socket.IO client library
- `react`: createContext
- Event type definitions
- Payload type definitions

**Last Updated**: Based on current implementation analysis
**Maintainer**: Frontend team
**Status**: ✅ Production-ready, core infrastructure
