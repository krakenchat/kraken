# Voice Presence Service

**Path**: `backend/src/voice-presence/voice-presence.service.ts`
**Type**: NestJS Injectable Service
**Purpose**: Manages real-time voice channel presence tracking using Redis with production-safe SET architecture

---

## Overview

The Voice Presence Service tracks which users are currently in voice channels, including their voice states (muted, deafened, video enabled, screen sharing). It uses a **Redis SET-based architecture** for O(1) performance, making it production-safe for high-scale deployments.

### Key Features

- **SET-Based Architecture**: O(1) lookups instead of O(n) KEYS scans
- **Real-Time Updates**: WebSocket broadcasts for state changes
- **Automatic Cleanup**: TTL-based expiration with passive cleanup
- **State Tracking**: Mute, deafen, video, screen share states
- **User & Channel Queries**: Find users in channels or channels for users
- **Production-Safe**: No blocking Redis operations

---

## Critical Architectural Decision

### ❌ Old Architecture (KEYS-based) - REMOVED

```typescript
// NEVER DO THIS IN PRODUCTION
const keys = await redis.keys(`voice_presence:${channelId}:*`);
```

**Problem**: KEYS command is O(n) and **blocks Redis** during execution, causing performance degradation at scale.

### ✅ New Architecture (SET-based) - CURRENT

```typescript
// Production-safe O(1) operations
const userIds = await redis.smembers(channelMembersKey); // O(1)
```

**Solution**: Uses Redis SETs to track membership, enabling constant-time lookups without blocking.

---

## Redis Data Structure

### Key Patterns

```typescript
// User data (stores full VoicePresenceUser object)
voice_presence:user:{channelId}:{userId}
// Value: JSON string of VoicePresenceUser
// TTL: 300 seconds (5 minutes)

// Channel members SET (tracks all users in a channel)
voice_presence:channel:{channelId}:members
// Value: SET of userIds
// TTL: None (members are removed on leave)

// User channels SET (tracks all channels a user is in)
voice_presence:user_channels:{userId}
// Value: SET of channelIds
// TTL: None (channels are removed on leave)
```

### Performance Characteristics

| Operation | Old (KEYS) | New (SET) |
|-----------|------------|-----------|
| Find users in channel | O(n) - blocks | O(1) - non-blocking |
| Add user to channel | O(1) | O(1) |
| Remove user from channel | O(1) | O(1) |
| Get user voice state | O(1) | O(1) |
| Update user voice state | O(1) | O(1) |

---

## Data Types

### VoicePresenceUser Interface

```typescript
export interface VoicePresenceUser {
  id: string;                 // User ID
  username: string;           // Username
  displayName?: string;       // Display name (optional)
  avatarUrl?: string;         // Avatar URL (optional)
  joinedAt: Date;            // When user joined the voice channel
  isVideoEnabled: boolean;    // Camera on/off
  isScreenSharing: boolean;   // Screen share on/off
  isMuted: boolean;          // Microphone muted
  isDeafened: boolean;       // Audio output deafened
}
```

---

## Service Methods

### 1. `joinVoiceChannel(channelId, user)`

Adds a user to a voice channel with default states.

**Parameters**:
- `channelId: string` - Channel to join
- `user: UserEntity` - User joining

**Process**:
1. Verifies channel exists and user has access (via ChannelsService)
2. Creates `VoicePresenceUser` object with default states
3. Uses Redis pipeline for atomic operations:
   - Stores user data with TTL
   - Adds user to channel members SET
   - Adds channel to user's channels SET
4. Broadcasts `VOICE_CHANNEL_USER_JOINED` event to channel

**Default States**:
```typescript
{
  isVideoEnabled: false,
  isScreenSharing: false,
  isMuted: false,
  isDeafened: false,
}
```

**Redis Operations** (atomic pipeline):
```typescript
const pipeline = client.pipeline();
pipeline.set(userDataKey, JSON.stringify(voiceUser), 'EX', TTL);
pipeline.sadd(channelMembersKey, user.id);
pipeline.sadd(userChannelsKey, channelId);
await pipeline.exec();
```

**WebSocket Event**:
```typescript
VOICE_CHANNEL_USER_JOINED {
  channelId: string,
  user: VoicePresenceUser
}
```

**Errors**:
- Throws if channel not found
- Throws if user lacks access permission

---

### 2. `leaveVoiceChannel(channelId, userId)`

Removes a user from a voice channel and cleans up all references.

**Parameters**:
- `channelId: string` - Channel to leave
- `userId: string` - User leaving

**Process**:
1. Fetches user data before removal (for broadcast)
2. Uses Redis pipeline for atomic operations:
   - Deletes user data key
   - Removes user from channel members SET
   - Removes channel from user's channels SET
3. Broadcasts `VOICE_CHANNEL_USER_LEFT` event to channel

**Redis Operations** (atomic pipeline):
```typescript
const pipeline = client.pipeline();
pipeline.del(userDataKey);
pipeline.srem(channelMembersKey, userId);
pipeline.srem(userChannelsKey, channelId);
await pipeline.exec();
```

**WebSocket Event**:
```typescript
VOICE_CHANNEL_USER_LEFT {
  channelId: string,
  userId: string,
  user: VoicePresenceUser  // Full user data for client-side cleanup
}
```

**Warnings**:
- Logs warning if user not found (idempotent operation)

---

### 3. `getChannelPresence(channelId)`

Fetches all users currently in a voice channel with their states.

**Parameters**:
- `channelId: string` - Channel to query

**Returns**: `Promise<VoicePresenceUser[]>` - Array of users sorted by join time

**Process**:
1. Fetches user IDs from channel members SET (O(1))
2. Builds keys for all user data
3. Fetches all user data in one MGET operation (O(m))
4. Parses and validates each user's data
5. **Automatic Cleanup**: Removes stale SET members if data expired
6. Sorts users by `joinedAt` timestamp

**Automatic Cleanup**:
```typescript
if (!value) {
  // User data expired but still in SET - clean up
  await client.srem(channelMembersKey, userId);
}
```

**Performance**:
- O(1) for SET lookup
- O(m) for MGET where m = number of users
- Total: O(m), no blocking operations

**Sorting**: Users returned in order of join time (oldest first)

---

### 4. `updateVoiceState(channelId, userId, updates)`

Updates a user's voice state (mute, video, screen share, etc.).

**Parameters**:
- `channelId: string` - Channel where user is
- `userId: string` - User to update
- `updates: Partial<VoiceState>` - Fields to update

**Updatable Fields**:
```typescript
{
  isVideoEnabled?: boolean;
  isScreenSharing?: boolean;
  isMuted?: boolean;
  isDeafened?: boolean;
}
```

**Process**:
1. Fetches current user data
2. Merges updates with existing data
3. Stores updated data with fresh TTL (resets 5-minute expiration)
4. Broadcasts `VOICE_CHANNEL_USER_UPDATED` event to channel

**Redis Operation**:
```typescript
await redis.set(
  userDataKey,
  JSON.stringify(updatedData),
  'EX',
  TTL  // Fresh 5-minute TTL
);
```

**WebSocket Event**:
```typescript
VOICE_CHANNEL_USER_UPDATED {
  channelId: string,
  userId: string,
  user: VoicePresenceUser,      // Full updated state
  updates: Partial<VoiceState>  // Only changed fields
}
```

**TTL Refresh**: Each update resets the 5-minute TTL, keeping active users from expiring.

---

### 5. `refreshPresence(channelId, userId)`

Extends the TTL for a user's presence without changing state.

**Parameters**:
- `channelId: string` - Channel where user is
- `userId: string` - User to refresh

**Purpose**: Heartbeat mechanism to prevent active users from expiring.

**Usage**: Called periodically by frontend (e.g., every 2 minutes) while in voice.

**Redis Operation**:
```typescript
await redis.expire(userDataKey, TTL);  // Reset to 5 minutes
```

**Silent**: Does not broadcast WebSocket event.

---

### 6. `getUserVoiceChannels(userId)`

Gets all voice channels a user is currently in.

**Parameters**:
- `userId: string` - User to query

**Returns**: `Promise<string[]>` - Array of channel IDs

**Use Cases**:
- User profile showing current voice channels
- Disconnect from all channels on logout
- Voice status indicators

**Redis Operation**:
```typescript
const channelIds = await redis.smembers(userChannelsKey);  // O(1)
```

**Performance**: O(1) constant time lookup.

---

### 7. `cleanupExpiredPresence()`

Periodic cleanup task (now largely passive).

**Current Behavior**: No-op, logs debug message.

**Rationale**: Cleanup happens automatically:
1. User data keys expire via TTL (Redis automatic)
2. `getChannelPresence()` removes stale SET members when detected
3. Active cleanup no longer necessary with new architecture

**Kept for**: Future potential use (e.g., metrics, alerting).

**Cron Schedule**: Could be called periodically but not required.

---

## Configuration

### TTL (Time-To-Live)

```typescript
private readonly VOICE_PRESENCE_TTL = 300; // 5 minutes
```

**Rationale**:
- Long enough to survive brief network hiccups
- Short enough to cleanup disconnected users quickly
- Requires heartbeat (refreshPresence) every ~2 minutes

**Recommendation**: Keep at 300 seconds (5 minutes) for production.

### Redis Key Prefixes

```typescript
private readonly VOICE_PRESENCE_USER_DATA_PREFIX = 'voice_presence:user';
private readonly VOICE_PRESENCE_CHANNEL_MEMBERS_PREFIX = 'voice_presence:channel';
private readonly VOICE_PRESENCE_USER_CHANNELS_PREFIX = 'voice_presence:user_channels';
```

**Namespacing**: All keys prefixed to avoid collisions with other Redis data.

---

## WebSocket Integration

### Server Events

All voice presence changes broadcast to relevant channels:

| Event | Trigger | Payload |
|-------|---------|---------|
| `VOICE_CHANNEL_USER_JOINED` | User joins | `{ channelId, user }` |
| `VOICE_CHANNEL_USER_LEFT` | User leaves | `{ channelId, userId, user }` |
| `VOICE_CHANNEL_USER_UPDATED` | State change | `{ channelId, userId, user, updates }` |

### Broadcasting

```typescript
this.websocketService.sendToRoom(channelId, eventName, payload);
```

**Room**: Channel ID
**Recipients**: All users who have joined the channel room via WebSocket

---

## Dependencies

### Internal Services

- **RedisService** (`@/redis/redis.service`) - Redis client access
- **WebsocketService** (`@/websocket/websocket.service`) - Event broadcasting
- **ChannelsService** (`@/channels/channels.service`) - Channel validation

### External Libraries

- **@nestjs/common** - Injectable, Logger
- **ioredis** (via RedisService) - Redis operations

---

## Controller Integration

### VoicePresenceController

Exposes HTTP endpoints:

```typescript
// Join voice channel
POST /voice-presence/:channelId/join
@UseGuards(JwtAuthGuard)

// Leave voice channel
POST /voice-presence/:channelId/leave
@UseGuards(JwtAuthGuard)

// Get channel presence
GET /voice-presence/:channelId
@UseGuards(JwtAuthGuard)

// Update voice state
PATCH /voice-presence/:channelId/state
@UseGuards(JwtAuthGuard)
Body: { isVideoEnabled?, isScreenSharing?, isMuted?, isDeafened? }
```

**Authentication**: All endpoints require JWT authentication.

**Authorization**: Channel access checked via ChannelsService.

---

## Frontend Integration

### Joining Voice

```typescript
// 1. Generate LiveKit token
const token = await livekitApi.generateToken({ roomId, identity, name });

// 2. Connect to LiveKit
const room = new Room();
await room.connect(livekitUrl, token);

// 3. Join voice presence (notifies others)
await voicePresenceApi.joinVoiceChannel(channelId);

// 4. Emit WebSocket event (optional, for immediate sync)
socket.emit(ClientEvents.VOICE_CHANNEL_JOIN, { channelId });
```

### Updating State

```typescript
// Update local state
dispatch(setVideoEnabled(true));

// Update server state
await voicePresenceApi.updateVoiceState({
  channelId,
  updates: { isVideoEnabled: true }
});
```

### Heartbeat

```typescript
// Every 2 minutes while in voice
setInterval(() => {
  voicePresenceApi.refreshPresence(channelId);
}, 120000);
```

### Leaving Voice

```typescript
// 1. Disconnect from LiveKit
await room.disconnect();

// 2. Leave voice presence
await voicePresenceApi.leaveVoiceChannel(channelId);

// 3. Emit WebSocket event
socket.emit(ClientEvents.VOICE_CHANNEL_LEAVE, { channelId });
```

---

## Error Handling

### Channel Not Found

```typescript
// Throws from ChannelsService
throw new NotFoundException(`Channel ${channelId} not found`);
```

### User Not In Channel

```typescript
// Logs warning, returns early (idempotent)
this.logger.warn(`User ${userId} not found in voice channel ${channelId}`);
return;
```

### Redis Errors

```typescript
// Logs error, re-throws for upstream handling
this.logger.error('Failed to join voice channel', error);
throw error;
```

### Parse Errors

```typescript
// Logs warning, skips invalid data, continues
this.logger.warn('Failed to parse voice presence data', error);
```

---

## Testing

### Unit Tests

```typescript
describe('VoicePresenceService', () => {
  let service: VoicePresenceService;
  let redisService: jest.Mocked<RedisService>;
  let websocketService: jest.Mocked<WebsocketService>;
  let channelsService: jest.Mocked<ChannelsService>;

  beforeEach(async () => {
    // Mock dependencies
    const module = await Test.createTestingModule({
      providers: [
        VoicePresenceService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: WebsocketService, useValue: mockWebsocketService },
        { provide: ChannelsService, useValue: mockChannelsService },
      ],
    }).compile();

    service = module.get<VoicePresenceService>(VoicePresenceService);
  });

  it('should join voice channel', async () => {
    await service.joinVoiceChannel(channelId, user);

    expect(redisService.getClient().pipeline).toHaveBeenCalled();
    expect(websocketService.sendToRoom).toHaveBeenCalledWith(
      channelId,
      ServerEvents.VOICE_CHANNEL_USER_JOINED,
      expect.any(Object)
    );
  });
});
```

### Integration Tests

```bash
# Test with real Redis
docker-compose up redis -d
npm run test:e2e voice-presence
```

---

## Monitoring & Metrics

### Log Events

```typescript
// Info level
this.logger.log(`User ${userId} joined voice channel ${channelId}`);
this.logger.log(`Updated voice state for user ${userId}`);

// Warning level
this.logger.warn(`User ${userId} not found in voice channel ${channelId}`);
this.logger.warn('Failed to parse voice presence data', error);

// Debug level
this.logger.debug('Cleanup cron triggered');
this.logger.debug(`Cleaning up expired presence for user ${userId}`);

// Error level
this.logger.error(`Failed to join voice channel`, error);
```

### Key Metrics to Track

1. **Active Users**: Count of users in voice across all channels
2. **Channel Occupancy**: Users per channel
3. **State Update Rate**: Frequency of voice state changes
4. **TTL Expiration Rate**: How often users expire vs. leave cleanly
5. **Redis Operation Latency**: P50, P95, P99 for SET operations

### Redis Monitoring

```bash
# Check voice presence keys
redis-cli --scan --pattern "voice_presence:*" | wc -l

# Check SET sizes
redis-cli SCARD voice_presence:channel:{channelId}:members

# Check TTLs
redis-cli TTL voice_presence:user:{channelId}:{userId}
```

---

## Performance Considerations

### Scalability

- **SET operations**: O(1) - scales to thousands of channels/users
- **MGET batching**: O(m) where m = users per channel, typically < 50
- **No blocking**: All operations non-blocking, safe for production
- **Pipeline usage**: Atomic multi-key operations reduce round trips

### Memory Usage

- **Per User**: ~200-300 bytes (JSON serialized VoicePresenceUser)
- **1000 concurrent voice users**: ~300 KB
- **SET overhead**: Minimal, ~16 bytes per member

### Network Traffic

- **Join/Leave**: 1 WebSocket broadcast per channel
- **State Update**: 1 WebSocket broadcast per channel
- **Heartbeat**: Silent (no broadcasts)

### TTL Strategy

- **5-minute TTL**: Balances quick cleanup with connection stability
- **Heartbeat every 2 min**: Keeps active users from expiring
- **Automatic cleanup**: Passive cleanup on read reduces overhead

---

## Migration Notes

### Upgrading from KEYS-based Architecture

If upgrading from old KEYS-based code:

1. **No data migration needed**: Old keys expire naturally after 5 minutes
2. **Deploy new code**: New architecture starts fresh
3. **Users auto-rejoin**: Existing voice users remain in LiveKit, will re-sync on next state update
4. **No downtime**: Old and new coexist briefly during deployment

### Breaking Changes

None - the API surface remains identical, only internal implementation changed.

---

## Best Practices

### 1. Always Use Pipelines for Multi-Key Operations

```typescript
// ✅ Good - Atomic
const pipeline = client.pipeline();
pipeline.set(key1, value1);
pipeline.sadd(key2, value2);
await pipeline.exec();

// ❌ Bad - Non-atomic, multiple round trips
await client.set(key1, value1);
await client.sadd(key2, value2);
```

### 2. Refresh Presence Periodically

Frontend should call `refreshPresence()` every 2 minutes to prevent expiration.

### 3. Handle Stale Data Gracefully

```typescript
if (!userDataStr) {
  // User might have expired, don't throw - just skip
  this.logger.warn('User not found');
  return;
}
```

### 4. Always Broadcast State Changes

Even if state didn't change, broadcast helps keep clients in sync.

### 5. Use TTL Appropriately

- Too short: Users expire during brief network issues
- Too long: Disconnected users linger
- 5 minutes: Good default

---

## Troubleshooting

### Users Not Appearing in Voice Channel

1. Check Redis connection: `redis-cli PING`
2. Check if user data exists: `redis-cli GET voice_presence:user:{channelId}:{userId}`
3. Check channel members SET: `redis-cli SMEMBERS voice_presence:channel:{channelId}:members`
4. Check logs for join errors

### Users Not Leaving Voice Channel

1. Check if `leaveVoiceChannel()` was called
2. Verify WebSocket connection for leave event
3. Check if user data has TTL: `redis-cli TTL voice_presence:user:{channelId}:{userId}`
4. Wait 5 minutes for TTL expiration if leave failed

### State Updates Not Reflecting

1. Check WebSocket connection
2. Verify user is in channel room: Check room membership in Socket.IO
3. Check if state update was called with correct parameters
4. Verify Redis has updated data: `redis-cli GET voice_presence:user:{channelId}:{userId}`

---

## Related Documentation

- [LiveKit Integration](./livekit.md)
- [Voice State Management (Frontend)](../../state/voiceSlice.md)
- [Voice Thunks (Frontend)](../../state/voiceThunks.md)
- [WebSocket Service](../core/websocket.md)
- [Redis Service](../core/redis.md)
- [Voice Presence API (Frontend)](../../state/voicePresenceApiSlice.md)

---

## File Location

```
backend/src/voice-presence/voice-presence.service.ts
backend/src/voice-presence/voice-presence.controller.ts
backend/src/voice-presence/voice-presence.module.ts
```

**Last Updated**: After SET-based architecture refactoring (production-safe)
**Maintainer**: Backend team
**Status**: ✅ Production-ready, recently refactored for scalability
