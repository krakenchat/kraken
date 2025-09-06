# WebSocket Module

> **Location:** `backend/src/websocket/websocket.module.ts`  
> **Type:** Core Module  
> **Domain:** real-time communication

## Overview

The WebSocket Module provides the core real-time communication infrastructure for the Kraken application. It manages Socket.IO server instances, room management, and provides a centralized service for broadcasting events to connected clients. This module is essential for real-time messaging, presence updates, and voice channel coordination.

## Module Structure

```
websocket/
├── websocket.module.ts          # Module definition
├── websocket.service.ts         # Socket.IO broadcasting service
├── websocket.service.spec.ts    # Unit tests
├── ws-exception.filter.ts       # WebSocket error handling
└── events.enum/                 # Event type definitions
    ├── client-events.enum.ts    # Events sent by clients
    └── server-events.enum.ts    # Events sent by server
```

## Services

### WebsocketService

**Purpose:** Provides a centralized service for broadcasting Socket.IO events to rooms and all connected clients.

#### Key Methods

```typescript
class WebsocketService {
  private server: Server;

  // Server management
  setServer(server: Server): void {
    // Stores the Socket.IO server instance for use by the service
    this.server = server;
  }

  // Room-based broadcasting
  sendToRoom(room: string, event: string, payload: any): void {
    // Broadcasts an event to all clients in a specific room
    this.server.to(room).emit(event, payload);
  }

  // Global broadcasting
  sendToAll(event: string, payload: any): void {
    // Broadcasts an event to all connected clients
    return this.server.emit(event, payload);
  }
}
```

## Event System

### Server Events (Outgoing)

Events emitted by the server and handled by clients:

```typescript
export enum ServerEvents {
  // Messaging: Channels
  NEW_MESSAGE = 'newMessage',
  UPDATE_MESSAGE = 'updateMessage', 
  DELETE_MESSAGE = 'deleteMessage',

  // Messaging: Direct Messages
  NEW_DM = 'newDirectMessage',

  // Mentions & Notifications
  NEW_MENTION = 'newMention',
  NOTIFICATION = 'notification',

  // Presence & Typing
  USER_ONLINE = 'userOnline',
  USER_OFFLINE = 'userOffline', 
  USER_TYPING = 'userTyping',

  // Voice Channels
  VOICE_CHANNEL_USER_JOINED = 'voiceChannelUserJoined',
  VOICE_CHANNEL_USER_LEFT = 'voiceChannelUserLeft',
  VOICE_CHANNEL_USER_UPDATED = 'voiceChannelUserUpdated',

  // Acknowledgments & Errors
  ACK = 'ack',
  ERROR = 'error',
}
```

### Client Events (Incoming)

Events emitted by clients and handled by server gateways:

```typescript
export enum ClientEvents {
  // Connection & Room Management
  JOIN_ALL = 'joinAll',
  JOIN_ROOM = 'joinRoom',
  LEAVE_ROOM = 'leaveRoom',
  PRESENCE_ONLINE = 'presenceOnline',

  // Messaging: Channels
  SEND_MESSAGE = 'sendMessage',

  // Messaging: Direct Messages  
  SEND_DM = 'sendDirectMessage',

  // Presence & Typing
  TYPING_START = 'typingStart',
  TYPING_STOP = 'typingStop',

  // Voice Channels
  VOICE_CHANNEL_JOIN = 'voice_channel_join',
  VOICE_CHANNEL_LEAVE = 'voice_channel_leave',
  VOICE_STATE_UPDATE = 'voice_state_update',
  VOICE_PRESENCE_REFRESH = 'voice_presence_refresh',
}
```

## Room Management Strategy

### Room Naming Conventions
```typescript
// Channel-based rooms
`channel:${channelId}`        // Messages in specific channel
`community:${communityId}`    // Community-wide events

// User-based rooms
`user:${userId}`             // Direct messages and notifications
`presence:${userId}`         // User presence updates

// Voice-specific rooms
`voice:${channelId}`         // Voice channel participants
```

### Broadcasting Patterns

#### Pattern 1: Channel Messages
```typescript
@Injectable()
export class MessagesGateway {
  constructor(private readonly websocketService: WebsocketService) {}

  async broadcastNewMessage(channelId: string, message: any) {
    const room = `channel:${channelId}`;
    this.websocketService.sendToRoom(room, ServerEvents.NEW_MESSAGE, message);
  }
}
```

#### Pattern 2: User Presence
```typescript
@Injectable() 
export class PresenceService {
  constructor(private readonly websocketService: WebsocketService) {}

  async broadcastUserOnline(userId: string, presence: any) {
    // Send to user's personal room for cross-device sync
    this.websocketService.sendToRoom(`user:${userId}`, ServerEvents.USER_ONLINE, presence);
    
    // Send to all communities where user is a member
    const communities = await this.getUserCommunities(userId);
    communities.forEach(communityId => {
      this.websocketService.sendToRoom(`community:${communityId}`, ServerEvents.USER_ONLINE, presence);
    });
  }
}
```

#### Pattern 3: Voice Channel Updates
```typescript
async broadcastVoiceUpdate(channelId: string, update: VoiceUpdate) {
  const voiceRoom = `voice:${channelId}`;
  this.websocketService.sendToRoom(voiceRoom, ServerEvents.VOICE_CHANNEL_USER_UPDATED, update);
  
  // Also broadcast to channel room for non-voice users
  const channelRoom = `channel:${channelId}`;
  this.websocketService.sendToRoom(channelRoom, ServerEvents.VOICE_CHANNEL_USER_UPDATED, update);
}
```

## Error Handling

### WebSocket Exception Filter

```typescript
// ws-exception.filter.ts
@Catch()
export class WsExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const client = host.switchToWs().getClient();
    
    if (exception instanceof WsException) {
      client.emit(ServerEvents.ERROR, {
        message: exception.getError(),
        event: exception.getPattern?.() || 'unknown'
      });
    } else {
      client.emit(ServerEvents.ERROR, {
        message: 'Internal server error',
        event: 'unknown'
      });
    }
  }
}
```

### Common Error Scenarios
1. **Client Disconnection** - Handle graceful cleanup of rooms and presence
2. **Invalid Event Data** - Validate payloads and return meaningful errors
3. **Authentication Failures** - Prevent unauthorized access to rooms
4. **Rate Limiting** - Prevent spam and abuse of WebSocket events

## Dependencies

### Internal Dependencies
- **None** - This is a foundational service used by gateways

### External Dependencies
- `@nestjs/common` - NestJS dependency injection
- `socket.io` - WebSocket server implementation

## Integration with Gateways

### Gateway Registration Pattern
```typescript
@WebSocketGateway({
  cors: { origin: '*' },
  adapter: RedisAdapter, // For scaling across multiple instances
})
export class MessagesGateway implements OnGatewayInit {
  constructor(private readonly websocketService: WebsocketService) {}

  afterInit(server: Server) {
    // Register server instance with WebsocketService
    this.websocketService.setServer(server);
  }

  @SubscribeMessage(ClientEvents.SEND_MESSAGE)
  async handleMessage(@MessageBody() data: any) {
    // Process message and broadcast to room
    const result = await this.processMessage(data);
    this.websocketService.sendToRoom(
      `channel:${data.channelId}`,
      ServerEvents.NEW_MESSAGE,
      result
    );
  }
}
```

## Scaling Considerations

### Redis Adapter Integration
```typescript
// In gateway initialization
import { createAdapter } from '@socket.io/redis-adapter';

afterInit(server: Server) {
  // Configure Redis adapter for horizontal scaling
  const pubClient = this.redisService.getClient();
  const subClient = pubClient.duplicate();
  
  server.adapter(createAdapter(pubClient, subClient));
  this.websocketService.setServer(server);
}
```

### Performance Optimization
- **Room Cleanup:** Regularly clean up empty rooms
- **Event Batching:** Batch similar events to reduce network overhead
- **Compression:** Enable WebSocket compression for large payloads
- **Connection Limits:** Implement connection limits per IP/user

## Testing

### Service Tests
- **Location:** `backend/src/websocket/websocket.service.spec.ts`
- **Coverage:** Server registration, room broadcasting, global broadcasting

```typescript
describe('WebsocketService', () => {
  let service: WebsocketService;
  let mockServer: jest.Mocked<Server>;

  beforeEach(async () => {
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [WebsocketService],
    }).compile();

    service = module.get<WebsocketService>(WebsocketService);
    service.setServer(mockServer);
  });

  it('should send event to specific room', () => {
    service.sendToRoom('test-room', 'test-event', { data: 'test' });
    
    expect(mockServer.to).toHaveBeenCalledWith('test-room');
    expect(mockServer.emit).toHaveBeenCalledWith('test-event', { data: 'test' });
  });
});
```

## Common Usage Patterns

### Pattern 1: Service Integration
```typescript
@Injectable()
export class NotificationService {
  constructor(private readonly websocketService: WebsocketService) {}

  async sendUserNotification(userId: string, notification: any) {
    this.websocketService.sendToRoom(
      `user:${userId}`,
      ServerEvents.NOTIFICATION,
      notification
    );
  }
}
```

### Pattern 2: Bulk Broadcasting
```typescript
async notifyAllCommunityMembers(communityId: string, event: any) {
  // Single room broadcast is more efficient than individual user notifications
  this.websocketService.sendToRoom(
    `community:${communityId}`,
    ServerEvents.NOTIFICATION,
    event
  );
}
```

## Security Considerations

### Authentication Integration
```typescript
// Gateways should use authentication guards
@UseGuards(WsJwtAuthGuard)
@SubscribeMessage(ClientEvents.SEND_MESSAGE)
async handleMessage(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
  // Extract user from authenticated socket
  const user = client.data.user;
  // Process authenticated request
}
```

### Authorization Patterns
```typescript
// Verify user can access room before joining
async verifyRoomAccess(userId: string, roomId: string): Promise<boolean> {
  if (roomId.startsWith('channel:')) {
    const channelId = roomId.replace('channel:', '');
    return this.checkChannelAccess(userId, channelId);
  }
  return false;
}
```

## Related Modules

- **Messages Module** - Real-time message broadcasting
- **Presence Module** - User online/offline status
- **Voice Presence Module** - Voice channel state updates
- **Rooms Module** - Voice/video room management
- **Redis Module** - Scaling adapter backend

## Troubleshooting

### Common Issues
1. **Events Not Received**
   - **Symptoms:** Clients not receiving real-time updates
   - **Cause:** Client not joined to correct room, server not registered
   - **Solution:** Verify room joining logic and server registration

2. **Memory Leaks**
   - **Symptoms:** Increasing memory usage over time
   - **Cause:** Rooms not being cleaned up, event listeners not removed
   - **Solution:** Implement room cleanup on client disconnect

3. **Cross-Instance Issues**
   - **Symptoms:** Events not received across different server instances
   - **Cause:** Redis adapter not configured correctly
   - **Solution:** Verify Redis adapter setup and connection

## Related Documentation

- [Messages Gateway](../features/messages.md#websocket-integration)
- [Presence Gateway](../utilities/presence.md#real-time-events)
- [Voice Presence Gateway](../voice/voice-presence.md#websocket-events)
- [Redis Scaling](redis.md#integration-points)