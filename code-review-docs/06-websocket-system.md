# 06 — Real-Time Communication

> Socket.IO with Redis adapter. Shared typed events from `@kraken/shared`.
> 7 backend gateways, centralized frontend SocketHub, three cache update patterns.

---

## Table of Contents

- [Shared Event System](#shared-event-system)
- [Backend Architecture](#backend-architecture)
- [Frontend Architecture](#frontend-architecture)
- [Cache Update Patterns](#cache-update-patterns)
- [Event Flow Diagrams](#event-flow-diagrams)
- [Reconnection & Recovery](#reconnection--recovery)
- [Multi-Instance Scaling](#multi-instance-scaling)

---

## Shared Event System

All events are defined in `shared/src/` and consumed by both backend and frontend.

### Client Events (Client → Server)

```typescript
enum ClientEvents {
  SUBSCRIBE_ALL         // Auto-subscribe to all rooms on connect
  PRESENCE_ONLINE       // Heartbeat (30s interval)
  SEND_MESSAGE          // Send channel message
  SEND_DM               // Send DM message
  ADD_REACTION          // Add emoji reaction
  REMOVE_REACTION       // Remove reaction
  MARK_AS_READ          // Mark messages as read
  TYPING_START          // Typing indicator start
  TYPING_STOP           // Typing indicator stop
  VOICE_CHANNEL_JOIN    // Join voice channel
  VOICE_CHANNEL_LEAVE   // Leave voice channel
  VOICE_STATE_UPDATE    // Update voice state
  VOICE_PRESENCE_REFRESH // Heartbeat for voice TTL
  SEND_THREAD_REPLY     // Thread reply
}
```

### Server Events (Server → Client)

**Messaging:**
- `NEW_MESSAGE`, `NEW_DM`, `UPDATE_MESSAGE`, `DELETE_MESSAGE`
- `REACTION_ADDED`, `REACTION_REMOVED`
- `USER_TYPING`

**Threads:**
- `NEW_THREAD_REPLY`, `THREAD_REPLY_COUNT_UPDATED`

**Read Receipts:**
- `READ_RECEIPT_UPDATED`

**Presence:**
- `USER_ONLINE`, `USER_OFFLINE`

**Voice:**
- `VOICE_CHANNEL_USER_JOINED`, `VOICE_CHANNEL_USER_LEFT`, `VOICE_CHANNEL_USER_UPDATED`
- `DM_VOICE_CALL_STARTED`, `DM_VOICE_USER_JOINED`, `DM_VOICE_USER_LEFT`

**Notifications:**
- `NEW_NOTIFICATION`, `NOTIFICATION_READ`

**Replay:**
- `REPLAY_BUFFER_STOPPED`, `REPLAY_BUFFER_FAILED`

**Community/Channel Lifecycle:**
- `CHANNEL_CREATED`, `CHANNEL_UPDATED`, `CHANNEL_DELETED`
- `COMMUNITY_UPDATED`, `COMMUNITY_DELETED`
- `MEMBER_ADDED_TO_COMMUNITY`, `MEMBER_REMOVED_FROM_COMMUNITY`
- `MEMBER_ADDED_TO_CHANNEL`, `MEMBER_REMOVED_FROM_CHANNEL`

**Roles:**
- `ROLE_CREATED`, `ROLE_UPDATED`, `ROLE_DELETED`
- `ROLE_ASSIGNED`, `ROLE_REMOVED`

**User:**
- `USER_PROFILE_UPDATED`, `USER_INSTANCE_BANNED`

**Moderation:**
- `MESSAGE_PINNED`, `MESSAGE_UNPINNED`
- `USER_BANNED`, `USER_KICKED`, `USER_TIMED_OUT`

### Type Safety

All events are fully typed end-to-end:

```typescript
// Shared type maps
type ServerToClientEvents = {
  [ServerEvents.NEW_MESSAGE]: (data: NewMessagePayload) => void;
  ...
};

type ClientToServerEvents = {
  [ClientEvents.SEND_MESSAGE]: (
    data: { channelId: string; spans: Span[]; attachments: FileMetadata[] },
    callback?: (messageId: string) => void
  ) => void;
  ...
};
```

---

## Backend Architecture

### Gateways (7)

All gateways share namespace `/` and apply: `WsJwtAuthGuard`, `RbacGuard`, `WsThrottleGuard`, `wsValidationPipe`.

| Gateway | Handles | Emits |
|---------|---------|-------|
| **RoomsGateway** | `SUBSCRIBE_ALL` | Room management |
| **MessagesGateway** | `SEND_MESSAGE`, `SEND_DM`, `ADD_REACTION`, `REMOVE_REACTION`, `TYPING_*` | `NEW_MESSAGE`, `NEW_DM`, `UPDATE_MESSAGE`, `DELETE_MESSAGE`, `REACTION_*`, `USER_TYPING` |
| **PresenceGateway** | `PRESENCE_ONLINE` | `USER_ONLINE`, `USER_OFFLINE` |
| **VoicePresenceGateway** | `VOICE_PRESENCE_REFRESH` | (heartbeat only) |
| **NotificationsGateway** | (emission-only) | `NEW_NOTIFICATION`, `NOTIFICATION_READ` |
| **ThreadsGateway** | `SEND_THREAD_REPLY` | `NEW_THREAD_REPLY`, `THREAD_REPLY_COUNT_UPDATED` |
| **ReadReceiptsGateway** | `MARK_AS_READ` | `READ_RECEIPT_UPDATED` |

### WebSocket Service

Central broadcasting API used by all gateways:

```typescript
class WebsocketService {
  sendToRoom(room: string, event: string, payload: any)
  joinSocketsToRoom(sourceRoom: string, targetRooms: string[])
  removeSocketsFromRoom(sourceRoom: string, rooms: string[])
  sendToAll(event: string, payload: any)
}
```

### Room Naming Convention

```typescript
RoomName.user(userId)           → userId          // Raw UUID
RoomName.community(communityId) → community:{id}  // Prefixed
RoomName.channel(channelId)     → channelId       // Raw UUID
RoomName.dmGroup(groupId)       → groupId          // Raw UUID
RoomName.aliasGroup(aliasId)    → aliasId          // Raw UUID
```

> **Review Point:** Only `community:` uses a prefix. This means a channel ID and a DM group ID could theoretically collide if they're the same UUID. Since they're all UUIDv4, collision is astronomically unlikely, but the inconsistent naming is worth noting.

### Room Subscription Handler

`RoomSubscriptionHandler` listens to 25+ domain events via EventEmitter2 and manages room joins/leaves automatically:

```
Service emits domain event (e.g., membership.created)
    ↓
RoomSubscriptionHandler catches event
    ↓
Calls WebsocketService to join/leave rooms
    ↓
Emits server event to affected users
```

**Key event → room mappings:**

| Domain Event | Room Action | Server Emit |
|-------------|-------------|-------------|
| `membership.created` | Join community + all public channel rooms | `MEMBER_ADDED_TO_COMMUNITY` |
| `membership.removed` | Leave community + all channel rooms | `MEMBER_REMOVED_FROM_COMMUNITY` |
| `channel.created` | Join all community sockets to new channel (if public) | `CHANNEL_CREATED` |
| `channel.deleted` | Leave all sockets from channel room | `CHANNEL_DELETED` |
| `channel-membership.created` | Join user to private channel room | `MEMBER_ADDED_TO_CHANNEL` |
| `dm.created` | Join all members to DM room | — |
| `role.updated` | — | `ROLE_UPDATED` |
| `user.banned` | Leave all community rooms | `USER_BANNED` |

### Connection Lifecycle

```
1. Client connects with JWT in handshake auth
2. RoomsGateway validates JWT, attaches user to socket
3. Client emits SUBSCRIBE_ALL
4. RoomsService.joinAllUserRooms() joins socket to:
   - user:{userId} room
   - community:{id} rooms (for all memberships)
   - channel rooms (public + private with access)
   - DM group rooms
   - alias group rooms
5. Presence heartbeat starts (30s interval)
```

---

## Frontend Architecture

### Socket Singleton (`utils/socketSingleton.ts`)

```typescript
io(getWebSocketUrl(), {
  transports: ['websocket'],
  auth: (cb) => cb({ token: `Bearer ${getAccessToken()}` }),  // Dynamic token
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 30000,
  randomizationFactor: 0.5,
});
```

Key: Token callback fetches latest token on each reconnection attempt.

### SocketHub Architecture

```
SocketHubProvider (mounted once in Layout)
    │
    ├─ Creates EventBus (typed event emitter)
    │
    ├─ useSocketHub(eventBus) — central hub
    │   │
    │   ├─ On connect:
    │   │   ├─ emit SUBSCRIBE_ALL
    │   │   ├─ emit PRESENCE_ONLINE
    │   │   └─ On reconnect: invalidate stale caches
    │   │
    │   ├─ Presence heartbeat: every 30s → PRESENCE_ONLINE
    │   │
    │   └─ For EVERY ServerEvent:
    │       │
    │       ├─ 1. Run handler(s) from handlerRegistry
    │       │      └─ Cache update: setQueryData or invalidateQueries
    │       │
    │       └─ 2. Re-emit on EventBus
    │              └─ For UI side effects (sounds, typing, scroll)
    │
    └─ SocketHubContext.Provider(eventBus)
        └─ useServerEvent(event, handler) — UI side effect subscription
```

### Handler Registry

Maps each ServerEvent to cache handler function(s):

```typescript
handlerRegistry = {
  [ServerEvents.NEW_MESSAGE]:      [messageHandlers.handleNewMessage],
  [ServerEvents.NEW_DM]:           [messageHandlers.handleNewMessage],
  [ServerEvents.UPDATE_MESSAGE]:   [messageHandlers.handleUpdateMessage],
  [ServerEvents.DELETE_MESSAGE]:   [messageHandlers.handleDeleteMessage],
  [ServerEvents.REACTION_ADDED]:   [messageHandlers.handleReactionAdded],
  [ServerEvents.REACTION_REMOVED]: [messageHandlers.handleReactionRemoved],
  [ServerEvents.READ_RECEIPT_UPDATED]: [messageHandlers.handleReadReceiptUpdated],
  [ServerEvents.USER_ONLINE]:      [presenceHandlers.handleUserOnline],
  [ServerEvents.USER_OFFLINE]:     [presenceHandlers.handleUserOffline],
  [ServerEvents.VOICE_CHANNEL_USER_JOINED]: [voiceHandlers.handleVoiceUserJoined],
  [ServerEvents.VOICE_CHANNEL_USER_LEFT]:   [voiceHandlers.handleVoiceUserLeft],
  // ... 20+ more
};
```

Events **not** in the registry are still re-emitted on the event bus for UI-only side effects.

### useServerEvent Hook

Components subscribe to ephemeral events:

```typescript
function MyComponent() {
  useServerEvent(ServerEvents.USER_TYPING, (payload) => {
    // Show typing animation, play sound, etc.
  });
}
```

Uses callback ref pattern to avoid re-render churn — the handler is captured via ref so component re-renders don't re-subscribe.

---

## Cache Update Patterns

### Pattern 1: Direct Cache Update (`setQueryData`)

**When:** High-frequency events with full payload. Instant UX needed.

```typescript
// Example: New message arrives
handleNewMessage(payload, queryClient) {
  queryClient.setQueryData(messageQueryKey, (old) =>
    prependMessageToInfinite(old, payload.message)
  );
}
```

**Used for:** Messages, reactions, read receipts, presence, voice presence

### Pattern 2: Cache Invalidation (`invalidateQueries`)

**When:** Low-frequency structural changes. Complex cache relationships.

```typescript
// Example: Channel created
handleChannelCreated(payload, queryClient) {
  queryClient.invalidateQueries({
    queryKey: channelsControllerFindAllQueryKey({ path: { communityId } }),
  });
}
```

**Used for:** Channels, roles, communities, memberships, moderation

### Pattern 3: Ephemeral UI State (EventBus only)

**When:** Transient events, no persistence needed.

```typescript
// Typing indicators — show animation, auto-clear
useServerEvent(ServerEvents.USER_TYPING, (payload) => {
  setTypingUsers(prev => [...prev, payload.user]);
  setTimeout(() => clearTypingUser(payload.userId), 8000);
});
```

**Used for:** Typing indicators, sounds (join/leave), incoming calls

### Decision Guide

```
Event fires multiple times/second? ─── Yes ──→ Direct cache update
    │ No
    ▼
Event changes data structure? ─── Yes ──→ Cache invalidation
    │ No
    ▼
Transient, no persistence? ─── Yes ──→ Ephemeral (event bus only)
```

---

## Event Flow Diagrams

### Send Message

```
Client A                    Backend                    Client B
  │                           │                           │
  │ SEND_MESSAGE ────────────►│                           │
  │ {channelId, spans[]}      │                           │
  │                           │ 1. Validate + RBAC        │
  │                           │ 2. Check slowmode          │
  │                           │ 3. Insert message + spans  │
  │                           │ 4. Process mentions         │
  │                           │ 5. Create notifications     │
  │                           │ 6. Auto mark as read        │
  │                           │                            │
  │ NEW_MESSAGE ◄─────────────│────────────► NEW_MESSAGE   │
  │ callback(messageId)       │                            │
  │                           │                            │
  │ setQueryData(             │          setQueryData(     │
  │   messages, prepend)      │            messages,       │
  │                           │            prepend)        │
  │                           │                            │
  │ if DM: invalidate         │          increment         │
  │   DM groups list          │          unread count      │
```

### Join Voice Channel

```
Client                     Backend                    LiveKit
  │                           │                           │
  │ POST /livekit/token ─────►│                           │
  │                           │ 1. RBAC check              │
  │                           │ 2. Generate LiveKit token   │
  │ ◄─── {token, url} ───────│                            │
  │                           │                            │
  │ Connect to LiveKit ──────────────────────────────────►│
  │                           │                            │
  │                           │ ◄── webhook: participant_joined
  │                           │                            │
  │                           │ 3. Update Redis presence    │
  │                           │ 4. Emit VOICE_CHANNEL_USER_JOINED
  │                           │                            │
  │ ◄── VOICE_USER_JOINED ───│──────► (all channel room)  │
  │                           │                            │
  │ setQueryData(             │                            │
  │   voicePresence,          │                            │
  │   addUser)                │                            │
```

### Typing Indicator

```
Client A                    Backend                    Client B
  │                           │                           │
  │ TYPING_START ────────────►│                           │
  │ {channelId}               │                           │
  │                           │ Forward to room            │
  │                           │ (exclude sender)           │
  │                           │                            │
  │                           │──────► USER_TYPING ───────►│
  │                           │  {userId, username}        │
  │                           │                            │
  │                           │        useServerEvent:     │
  │                           │        show typing UI      │
  │                           │        (8s auto-clear)     │
```

---

## Reconnection & Recovery

### Client Reconnection

```
Disconnect detected
    │
    ├─ Socket.IO auto-reconnect (exponential backoff)
    │   └─ 1s → 2s → 4s → ... → 30s max
    │   └─ Infinite attempts
    │   └─ Token callback provides fresh JWT each attempt
    │
    ├─ SocketProvider handling
    │   ├─ Server-initiated disconnect → exponential backoff (1s→2s→4s→10s cap)
    │   ├─ Auth failure → attempt token refresh → reconnect
    │   └─ Circuit breaker: logout after 3 consecutive server disconnects
    │
    └─ On successful reconnect
        ├─ emit SUBSCRIBE_ALL (re-join all rooms)
        ├─ emit PRESENCE_ONLINE
        └─ handleReconnect() → invalidate stale caches:
            ├─ Messages (all channels + DMs)
            ├─ Read receipts
            ├─ Notifications (list + count)
            └─ Voice presence
```

> **Review Point:** On reconnect, all message queries are invalidated (refetched). For users in many channels, this could cause a burst of API requests. Consider invalidating only the active channel's messages and lazy-invalidating others on navigation.

### Voice Connection Recovery

Separate from WebSocket recovery — uses localStorage:

```
Page refresh
    ├─ useVoiceRecovery checks localStorage for saved state
    │   └─ Key: kraken_voice_connection
    │   └─ Expires after 5 minutes
    │
    └─ If valid → auto-rejoin channel/DM voice
```

---

## Multi-Instance Scaling

### Redis Socket.IO Adapter

```typescript
// backend/src/adapters/redis-io.adapter.ts
class RedisIoAdapter extends IoAdapter {
  connectToRedis() {
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }
}
```

All `sendToRoom()` calls go through Redis pub/sub:

```
Backend Pod A                Redis Pub/Sub           Backend Pod B
    │                           │                       │
    │ sendToRoom('ch:123')─────►│──────────────────────►│
    │                           │                       │
    │ Clients on A receive      │     Clients on B receive
```

### Room Operations

- Room joins/leaves are synchronized across pods via Redis
- Presence data stored in Redis (not in-memory) for distributed access
- Voice presence uses Redis SETs with TTLs

---

## Configuration

### Backend Socket.IO Config

```typescript
@WebSocketGateway({
  cors: { origin: [...], credentials: true },
  transports: ['websocket'],     // No HTTP polling fallback
  pingTimeout: 60000,            // 60s
  pingInterval: 25000,           // 25s heartbeat
})
```

### Frontend Socket.IO Config

```typescript
{
  transports: ['websocket'],
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 30000,
  randomizationFactor: 0.5,
}
```

---

## Cross-References

- Gateway handlers → [02-backend-modules.md](./02-backend-modules.md)
- Auth guards for WS → [03-auth-and-rbac.md](./03-auth-and-rbac.md)
- Voice presence → [07-voice-and-media.md](./07-voice-and-media.md)
- Frontend hooks → [08-frontend-hooks-and-state.md](./08-frontend-hooks-and-state.md)
- Redis adapter in Docker → [09-infrastructure.md](./09-infrastructure.md)
