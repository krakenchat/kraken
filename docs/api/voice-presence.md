# Voice-Presence API

> **Base URL:** `/api/channels/:channelId/voice-presence` and `/api/voice-presence`  
> **Controller:** `backend/src/voice-presence/voice-presence.controller.ts`  
> **Service:** `backend/src/voice-presence/voice-presence.service.ts`

## Overview

Voice presence management API for tracking user participation in voice channels, managing voice states (mute, video, screen sharing), and providing real-time presence information. Integrates with LiveKit for actual voice/video communication while maintaining presence state independently for persistence across navigation.

## Authentication

- **Required:** ✅ All endpoints require authentication
- **Token Type:** JWT Bearer token
- **Headers:** `Authorization: Bearer <jwt_token>`

## Endpoints Summary

### Channel-Specific Voice Presence (`/channels/:channelId/voice-presence`)

| Method | Endpoint | Description | RBAC Permission |
|--------|----------|-------------|-----------------|
| GET | `/` | Get channel voice presence | `READ_CHANNEL` |
| POST | `/join` | Join voice channel | `JOIN_CHANNEL` |
| DELETE | `/leave` | Leave voice channel | `JOIN_CHANNEL` |
| PUT | `/state` | Update voice state | `JOIN_CHANNEL` |
| POST | `/refresh` | Refresh presence | `JOIN_CHANNEL` |

### User Voice Presence (`/voice-presence`)

| Method | Endpoint | Description | RBAC Permission |
|--------|----------|-------------|-----------------|
| GET | `/me` | Get user's voice channels | None |

---

## GET `/api/channels/:channelId/voice-presence`

**Description:** Retrieves the current voice presence information for a specific voice channel, including all users currently connected and their voice states.

### Request

**Path Parameters:**
- `channelId` (string, required) - Voice channel ID (MongoDB ObjectId)

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/channels/64f7b1234567890abcdef123/voice-presence"
```

### Response

**Success (200):**
```json
{
  "channelId": "64f7b1234567890abcdef123",
  "count": 3,
  "users": [
    {
      "id": "64f7b1234567890abcdef456",
      "username": "john_doe",
      "displayName": "John Doe",
      "avatarUrl": "https://example.com/avatar.jpg",
      "voiceState": {
        "isVideoEnabled": true,
        "isScreenSharing": false,
        "isMuted": false,
        "isDeafened": false,
        "joinedAt": "2024-01-01T12:00:00.000Z"
      }
    },
    {
      "id": "64f7b1234567890abcdef789",
      "username": "jane_smith",
      "displayName": "Jane Smith",
      "avatarUrl": null,
      "voiceState": {
        "isVideoEnabled": false,
        "isScreenSharing": false,
        "isMuted": true,
        "isDeafened": false,
        "joinedAt": "2024-01-01T12:05:00.000Z"
      }
    },
    {
      "id": "64f7b1234567890abcdef012",
      "username": "presenter",
      "displayName": "Presentation User",
      "avatarUrl": "https://example.com/presenter.jpg",
      "voiceState": {
        "isVideoEnabled": false,
        "isScreenSharing": true,
        "isMuted": false,
        "isDeafened": false,
        "joinedAt": "2024-01-01T12:10:00.000Z"
      }
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `READ_CHANNEL`)
- `404 Not Found` - Channel not found or not a voice channel
- `500 Internal Server Error` - Server error

---

## POST `/api/channels/:channelId/voice-presence/join`

**Description:** Joins a voice channel, adding the user to the presence list and preparing for LiveKit connection. This should be called before initiating the actual WebRTC connection.

### Request

**Path Parameters:**
- `channelId` (string, required) - Voice channel ID to join

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/channels/64f7b1234567890abcdef123/voice-presence/join"
```

### Response

**Success (200):**
```json
{
  "success": true,
  "message": "Successfully joined voice channel",
  "channelId": "64f7b1234567890abcdef123"
}
```

**Error Responses:**
- `400 Bad Request` - Channel is not a voice channel
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `JOIN_CHANNEL`)
- `404 Not Found` - Channel not found
- `409 Conflict` - User is already in this voice channel
- `500 Internal Server Error` - Server error

---

## DELETE `/api/channels/:channelId/voice-presence/leave`

**Description:** Leaves a voice channel, removing the user from the presence list and cleaning up voice state. Should be called when disconnecting from LiveKit.

### Request

**Path Parameters:**
- `channelId` (string, required) - Voice channel ID to leave

**Example:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/channels/64f7b1234567890abcdef123/voice-presence/leave"
```

### Response

**Success (200):**
```json
{
  "success": true,
  "message": "Successfully left voice channel",
  "channelId": "64f7b1234567890abcdef123"
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `JOIN_CHANNEL`)
- `404 Not Found` - Channel not found or user not in channel
- `500 Internal Server Error` - Server error

---

## PUT `/api/channels/:channelId/voice-presence/state`

**Description:** Updates the voice state of the current user in a voice channel (mute status, video, screen sharing). Used to sync UI state with the presence system.

### Request

**Path Parameters:**
- `channelId` (string, required) - Voice channel ID

**Body (JSON):**
```json
{
  "isVideoEnabled": true,       // Optional: Video camera status
  "isScreenSharing": false,     // Optional: Screen sharing status
  "isMuted": false,            // Optional: Microphone mute status
  "isDeafened": false          // Optional: Audio output mute status
}
```

**Validation Rules:**
- All fields are optional boolean values
- At least one field should be provided for a meaningful update

**Example:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "isVideoEnabled": true,
    "isMuted": false,
    "isScreenSharing": false
  }' \
  "http://localhost:3001/api/channels/64f7b1234567890abcdef123/voice-presence/state"
```

### Response

**Success (200):**
```json
{
  "success": true,
  "message": "Voice state updated successfully",
  "channelId": "64f7b1234567890abcdef123",
  "updates": {
    "isVideoEnabled": true,
    "isMuted": false,
    "isScreenSharing": false
  }
}
```

**Error Responses:**
- `400 Bad Request` - Validation errors or invalid state combination
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `JOIN_CHANNEL`)
- `404 Not Found` - Channel not found or user not in channel
- `500 Internal Server Error` - Server error

---

## POST `/api/channels/:channelId/voice-presence/refresh`

**Description:** Refreshes the user's presence in a voice channel, updating the last-seen timestamp and preventing automatic cleanup due to inactivity.

### Request

**Path Parameters:**
- `channelId` (string, required) - Voice channel ID

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/channels/64f7b1234567890abcdef123/voice-presence/refresh"
```

### Response

**Success (200):**
```json
{
  "success": true,
  "message": "Presence refreshed successfully",
  "channelId": "64f7b1234567890abcdef123"
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `JOIN_CHANNEL`)
- `404 Not Found` - Channel not found or user not in channel
- `500 Internal Server Error` - Server error

---

## GET `/api/voice-presence/me`

**Description:** Retrieves all voice channels the current user is currently present in, useful for resuming voice connections across browser sessions.

### Request

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/voice-presence/me"
```

### Response

**Success (200):**
```json
{
  "userId": "64f7b1234567890abcdef456",
  "voiceChannels": [
    {
      "channelId": "64f7b1234567890abcdef123",
      "channelName": "General Voice",
      "communityId": "64f7b1234567890abcdef789",
      "communityName": "Gaming Community",
      "voiceState": {
        "isVideoEnabled": false,
        "isScreenSharing": false,
        "isMuted": true,
        "isDeafened": false,
        "joinedAt": "2024-01-01T12:00:00.000Z"
      }
    },
    {
      "channelId": "64f7b1234567890abcdef456",
      "channelName": "Meeting Room",
      "communityId": "64f7b1234567890abcdef012",
      "communityName": "Work Community",
      "voiceState": {
        "isVideoEnabled": true,
        "isScreenSharing": true,
        "isMuted": false,
        "isDeafened": false,
        "joinedAt": "2024-01-01T11:30:00.000Z"
      }
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `500 Internal Server Error` - Server error

---

## Voice State Management

### Voice State Properties
```typescript
interface VoiceState {
  isVideoEnabled: boolean;      // Camera/video feed status
  isScreenSharing: boolean;     // Screen share status
  isMuted: boolean;            // Microphone mute status
  isDeafened: boolean;         // Speaker/headphone mute status
  joinedAt: Date;              // When user joined the channel
}
```

### State Combinations
- **Audio Only:** `isVideoEnabled: false, isScreenSharing: false`
- **Video Call:** `isVideoEnabled: true, isScreenSharing: false`
- **Screen Share:** `isVideoEnabled: false, isScreenSharing: true`
- **Video + Screen:** `isVideoEnabled: true, isScreenSharing: true`
- **Muted:** `isMuted: true` (can still have video/screen sharing)
- **Deafened:** `isDeafened: true` (usually implies `isMuted: true`)

### Persistence Features
- **Cross-Navigation:** Voice presence persists across page reloads and navigation
- **Session Recovery:** Users can rejoin their previous voice channels on login
- **State Synchronization:** Voice state is kept in sync with actual LiveKit connection

## RBAC Permissions

This API uses Role-Based Access Control with channel-specific resource contexts:

| Action | Permission | Description |
|--------|------------|-------------|
| Read Presence | `READ_CHANNEL` | View voice channel presence |
| Join/Leave | `JOIN_CHANNEL` | Join or leave voice channels |
| Update State | `JOIN_CHANNEL` | Update voice state (requires being in channel) |
| Refresh | `JOIN_CHANNEL` | Refresh presence heartbeat |

### Resource Context

For channel-specific operations:

```typescript
@RbacResource({
  type: RbacResourceType.CHANNEL,
  idKey: 'channelId',
  source: ResourceIdSource.PARAM
})
```

**Resource Types Used:**
- `CHANNEL` - Channel-specific permission check for all voice presence operations

## WebSocket Events

Voice presence operations trigger real-time WebSocket events:

| Event | Trigger | Payload | Room |
|-------|---------|---------|------|
| `voiceChannelUserJoined` | User joins voice channel | `{userId, channelId, user, voiceState}` | `channel:${channelId}` |
| `voiceChannelUserLeft` | User leaves voice channel | `{userId, channelId}` | `channel:${channelId}` |
| `voiceChannelUserUpdated` | Voice state change | `{userId, channelId, voiceState}` | `channel:${channelId}` |

### WebSocket Event Examples

**User Joined Voice Channel:**
```json
{
  "event": "voiceChannelUserJoined",
  "data": {
    "userId": "64f7b1234567890abcdef456",
    "channelId": "64f7b1234567890abcdef123",
    "user": {
      "id": "64f7b1234567890abcdef456",
      "username": "john_doe",
      "displayName": "John Doe",
      "avatarUrl": "https://example.com/avatar.jpg"
    },
    "voiceState": {
      "isVideoEnabled": false,
      "isScreenSharing": false,
      "isMuted": false,
      "isDeafened": false,
      "joinedAt": "2024-01-01T12:00:00.000Z"
    }
  }
}
```

**Voice State Updated:**
```json
{
  "event": "voiceChannelUserUpdated",
  "data": {
    "userId": "64f7b1234567890abcdef456",
    "channelId": "64f7b1234567890abcdef123",
    "voiceState": {
      "isVideoEnabled": true,
      "isScreenSharing": false,
      "isMuted": false,
      "isDeafened": false
    }
  }
}
```

## Integration with LiveKit

### Connection Flow
1. **Join Presence:** Call `/join` endpoint to register presence
2. **Get LiveKit Token:** Use LiveKit API to get room access token
3. **Connect to Room:** Connect to LiveKit room using channel ID as room ID
4. **Sync State:** Update voice state via `/state` endpoint as needed
5. **Leave Presence:** Call `/leave` endpoint when disconnecting

### Room ID Mapping
- **LiveKit Room ID:** Uses channel ID directly as the LiveKit room identifier
- **Consistent Naming:** Ensures presence system and LiveKit room are linked
- **Multi-Instance Support:** Room IDs are unique across the application

## Error Handling

### Common Error Formats

**Validation Error (400):**
```json
{
  "statusCode": 400,
  "message": [
    "isVideoEnabled must be a boolean value"
  ],
  "error": "Bad Request"
}
```

**Channel Access Denied (403):**
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions. Required: JOIN_CHANNEL",
  "error": "Forbidden"
}
```

**Not in Voice Channel (404):**
```json
{
  "statusCode": 404,
  "message": "User is not currently in voice channel 64f7b1234567890abcdef123",
  "error": "Not Found"
}
```

**Already in Channel (409):**
```json
{
  "statusCode": 409,
  "message": "User is already in this voice channel",
  "error": "Conflict"
}
```

## Usage Examples

### Frontend Integration (RTK Query)

```typescript
// Redux voice presence slice usage
import { useVoicePresenceApi } from '@/features/voice-presence/api/voicePresenceApi';

function VoiceChannelComponent({ channelId }: { channelId: string }) {
  const { data: presence } = useVoicePresenceApi.useGetChannelPresenceQuery(channelId);
  const [joinChannel] = useVoicePresenceApi.useJoinVoiceChannelMutation();
  const [leaveChannel] = useVoicePresenceApi.useLeaveVoiceChannelMutation();
  const [updateVoiceState] = useVoicePresenceApi.useUpdateVoiceStateMutation();
  
  const handleJoinVoice = async () => {
    try {
      // Join presence first
      await joinChannel(channelId).unwrap();
      
      // Then connect to LiveKit
      await connectToLiveKitRoom(channelId);
    } catch (error) {
      console.error('Failed to join voice channel:', error);
    }
  };
  
  const handleToggleMute = async (isMuted: boolean) => {
    await updateVoiceState({
      channelId,
      isMuted
    }).unwrap();
  };
}

function VoiceChannelIndicator({ channelId }: { channelId: string }) {
  const { data: presence } = useVoicePresenceApi.useGetChannelPresenceQuery(channelId);
  
  return (
    <div>
      <span>{presence?.count || 0} users in voice</span>
      {presence?.users.map(user => (
        <UserVoiceIndicator key={user.id} user={user} />
      ))}
    </div>
  );
}

function UserVoiceIndicator({ user }: { user: VoiceUser }) {
  return (
    <div>
      <img src={user.avatarUrl} alt={user.displayName} />
      {user.voiceState.isMuted && <MuteIcon />}
      {user.voiceState.isVideoEnabled && <VideoIcon />}
      {user.voiceState.isScreenSharing && <ScreenShareIcon />}
    </div>
  );
}
```

### Voice Connection Management

```typescript
// Complete voice channel connection flow
class VoiceChannelManager {
  private currentChannelId: string | null = null;
  
  async joinVoiceChannel(channelId: string) {
    try {
      // 1. Register presence
      await fetch(`/api/channels/${channelId}/voice-presence/join`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      // 2. Get LiveKit token
      const tokenResponse = await fetch(`/api/livekit/token`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: channelId })
      });
      const { token: livekitToken } = await tokenResponse.json();
      
      // 3. Connect to LiveKit room
      await this.connectToLiveKit(channelId, livekitToken);
      
      this.currentChannelId = channelId;
      
      // 4. Start presence heartbeat
      this.startPresenceHeartbeat(channelId);
      
    } catch (error) {
      console.error('Failed to join voice channel:', error);
      throw error;
    }
  }
  
  async leaveVoiceChannel() {
    if (!this.currentChannelId) return;
    
    try {
      // 1. Disconnect from LiveKit
      await this.disconnectFromLiveKit();
      
      // 2. Leave presence
      await fetch(`/api/channels/${this.currentChannelId}/voice-presence/leave`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      // 3. Stop heartbeat
      this.stopPresenceHeartbeat();
      
      this.currentChannelId = null;
      
    } catch (error) {
      console.error('Failed to leave voice channel:', error);
    }
  }
  
  async updateVoiceState(updates: Partial<VoiceState>) {
    if (!this.currentChannelId) return;
    
    await fetch(`/api/channels/${this.currentChannelId}/voice-presence/state`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });
  }
  
  private startPresenceHeartbeat(channelId: string) {
    this.presenceInterval = setInterval(async () => {
      await fetch(`/api/channels/${channelId}/voice-presence/refresh`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }, 30000); // Refresh every 30 seconds
  }
}
```

## Testing

### Endpoint Tests
- **Location:** `backend/src/voice-presence/__tests__/voice-presence.controller.spec.ts`
- **Coverage:** Join/leave flow, state management, WebSocket events, permissions

### Test Examples

```typescript
// Example integration test
describe('Voice Presence (e2e)', () => {
  it('should join voice channel and emit WebSocket event', async () => {
    const wsListener = jest.fn();
    websocketService.sendToRoom = wsListener;
    
    await request(app.getHttpServer())
      .post(`/api/channels/${voiceChannelId}/voice-presence/join`)
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200);
    
    expect(wsListener).toHaveBeenCalledWith(
      voiceChannelId,
      'voiceChannelUserJoined',
      expect.objectContaining({
        userId: expect.any(String),
        channelId: voiceChannelId
      })
    );
  });

  it('should update voice state correctly', () => {
    return request(app.getHttpServer())
      .put(`/api/channels/${voiceChannelId}/voice-presence/state`)
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        isVideoEnabled: true,
        isMuted: false
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.updates.isVideoEnabled).toBe(true);
      });
  });
});
```

## Related Documentation

- [LiveKit API](livekit.md) - WebRTC token management
- [Channels API](channels.md) - Voice channel creation
- [WebSocket Events](websocket-events.md) - Real-time presence updates
- [Voice Persistence](../features/voice-persistence.md) - Cross-navigation persistence
- [RBAC System](../features/auth-rbac.md)
- [Database Schema](../architecture/database.md#voice-presence)