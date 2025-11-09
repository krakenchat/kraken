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
      "joinedAt": "2024-01-01T12:00:00.000Z",
      "isDeafened": false
    },
    {
      "id": "64f7b1234567890abcdef789",
      "username": "jane_smith",
      "displayName": "Jane Smith",
      "avatarUrl": null,
      "joinedAt": "2024-01-01T12:05:00.000Z",
      "isDeafened": false
    },
    {
      "id": "64f7b1234567890abcdef012",
      "username": "presenter",
      "displayName": "Presentation User",
      "avatarUrl": "https://example.com/presenter.jpg",
      "joinedAt": "2024-01-01T12:10:00.000Z",
      "isDeafened": true
    }
  ]
}
```

> **Note:** Media states (camera, microphone, screen share) are NOT returned by this endpoint.
> Frontend should read these directly from LiveKit using `useParticipantTracks(userId)` hook.

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

**Description:** Updates the custom voice state of the current user in a voice channel. Currently only supports updating `isDeafened` state.

> **⚠️ Changed in 2025:** This endpoint now only manages `isDeafened`. Media states (camera, microphone, screen share) are managed by LiveKit and updated through LiveKit SDK directly.

### Request

**Path Parameters:**
- `channelId` (string, required) - Voice channel ID

**Body (JSON):**
```json
{
  "isDeafened": true    // Required: Whether user has deafened themselves
}
```

**Validation Rules:**
- `isDeafened` is a required boolean value
- When `isDeafened` is true, the frontend should also mute the microphone via LiveKit

**Example:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"isDeafened": true}' \
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
    "isDeafened": true
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
      "joinedAt": "2024-01-01T12:00:00.000Z",
      "isDeafened": false
    },
    {
      "channelId": "64f7b1234567890abcdef456",
      "channelName": "Meeting Room",
      "communityId": "64f7b1234567890abcdef012",
      "communityName": "Work Community",
      "joinedAt": "2024-01-01T11:30:00.000Z",
      "isDeafened": true
    }
  ]
}
```

> **Note:** Media states (camera, microphone, screen share) should be read from LiveKit after reconnecting to the room.

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `500 Internal Server Error` - Server error

---

## Voice State Management

> **⚠️ IMPORTANT CHANGE (2025): LiveKit is Now the Single Source of Truth**
>
> The voice presence system was refactored to eliminate state duplication:
> - **Backend** stores only user identity + `isDeafened` state
> - **LiveKit** manages all media states (camera, microphone, screen share)
> - **Frontend** reads media states directly from LiveKit using hooks

### Backend Voice State (Redis Storage)
```typescript
interface VoicePresenceUser {
  id: string;                   // User ID
  username: string;             // Username
  displayName?: string;         // Display name (optional)
  avatarUrl?: string;          // Avatar URL (optional)
  joinedAt: Date;              // When user joined the channel
  isDeafened: boolean;         // ⚠️ ONLY custom state stored in backend
}
```

### Frontend Media State (Read from LiveKit)
```typescript
// Read via useLocalMediaState() or useParticipantTracks() hooks
interface LiveKitMediaState {
  isCameraEnabled: boolean;       // Camera/video feed status (from LiveKit)
  isMicrophoneEnabled: boolean;   // Microphone mute status (from LiveKit)
  isScreenShareEnabled: boolean;  // Screen share status (from LiveKit)
  isSpeaking: boolean;            // Speaking indicator (from LiveKit audio levels)
}
```

### Why This Architecture?

**Previous Problem:**
- State was duplicated between backend Redis and LiveKit
- Sync issues caused UI bugs (e.g., screen share showing as inactive when active)
- Backend state updates required separate API calls

**Current Solution:**
- LiveKit is the **single source of truth** for media states
- Backend only stores what LiveKit doesn't manage (`isDeafened`)
- Frontend hooks (`useLocalMediaState`, `useParticipantTracks`) read directly from LiveKit
- No sync issues, simpler codebase, better performance

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
      "avatarUrl": "https://example.com/avatar.jpg",
      "joinedAt": "2024-01-01T12:00:00.000Z",
      "isDeafened": false
    }
  }
}
```

> **Note:** Media states (camera, microphone, screen share) are read from LiveKit, not from this event.

**Voice State Updated:**
```json
{
  "event": "voiceChannelUserUpdated",
  "data": {
    "userId": "64f7b1234567890abcdef456",
    "channelId": "64f7b1234567890abcdef123",
    "isDeafened": true
  }
}
```

> **Note:** This event only fires when `isDeafened` changes. Media state changes (camera, mic, screen share) are tracked via LiveKit events, not WebSocket.

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

### Frontend Integration (RTK Query + LiveKit Hooks)

```typescript
// Modern voice presence integration (2025)
import { useVoicePresenceApi } from '@/features/voice-presence/api/voicePresenceApi';
import { useVoiceConnection } from '@/hooks/useVoiceConnection';
import { useParticipantTracks } from '@/hooks/useParticipantTracks';

function VoiceChannelComponent({ channelId }: { channelId: string }) {
  const { data: presence } = useVoicePresenceApi.useGetChannelPresenceQuery(channelId);
  const { joinVoiceChannel, leaveVoiceChannel } = useVoiceConnection();
  const [updateVoiceState] = useVoicePresenceApi.useUpdateVoiceStateMutation();

  const handleJoinVoice = async () => {
    try {
      // joinVoiceChannel handles both presence join AND LiveKit connection
      await joinVoiceChannel(channelId);
    } catch (error) {
      console.error('Failed to join voice channel:', error);
    }
  };

  const handleToggleDeafen = async (isDeafened: boolean) => {
    // Only update isDeafened via API - media states are managed by LiveKit
    await updateVoiceState({
      channelId,
      isDeafened
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
  // Read media state from LiveKit, not from backend
  const { isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } =
    useParticipantTracks(user.id);

  return (
    <div>
      <img src={user.avatarUrl} alt={user.displayName} />
      {!isMicrophoneEnabled && <MuteIcon />}
      {isCameraEnabled && <VideoIcon />}
      {isScreenShareEnabled && <ScreenShareIcon />}
      {user.isDeafened && <DeafenIcon />}
    </div>
  );
}
```

### Voice Connection Management (2025 Architecture)

```typescript
// Modern voice channel connection flow using hooks
// Recommended: Use useVoiceConnection hook instead of manual management
import { useVoiceConnection } from '@/hooks/useVoiceConnection';
import { useLocalMediaState } from '@/hooks/useLocalMediaState';
import { Room } from 'livekit-client';

function VoiceManager() {
  const { joinVoiceChannel, leaveVoiceChannel, toggleMicrophone, toggleCamera } = useVoiceConnection();
  const { isCameraEnabled, isMicrophoneEnabled } = useLocalMediaState();

  // Join voice channel (handles both presence + LiveKit connection)
  const handleJoin = async (channelId: string) => {
    await joinVoiceChannel(channelId);
  };

  // Leave voice channel (handles both LiveKit disconnect + presence leave)
  const handleLeave = async () => {
    await leaveVoiceChannel();
  };

  // Toggle microphone (managed by LiveKit)
  const handleToggleMic = async () => {
    await toggleMicrophone();
    // State automatically updates via useLocalMediaState hook
  };

  // Toggle camera (managed by LiveKit)
  const handleToggleCamera = async () => {
    await toggleCamera();
    // State automatically updates via useLocalMediaState hook
  };

  // Deafen (managed by backend + local audio volume)
  const handleToggleDeafen = async (isDeafened: boolean) => {
    // Update backend state
    await updateVoiceStateApi({ isDeafened });
    // useDeafenEffect hook automatically handles audio volume
  };
}

// For manual implementation (if not using hooks):
class ManualVoiceChannelManager {
  private currentChannelId: string | null = null;
  private livekitRoom: Room | null = null;

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
      this.livekitRoom = await this.connectToLiveKit(channelId, livekitToken);
      this.currentChannelId = channelId;

      // 4. Start presence heartbeat
      this.startPresenceHeartbeat(channelId);

      // 5. Media state is now managed by LiveKit - read via room.localParticipant
      console.log('Mic enabled:', this.livekitRoom.localParticipant.isMicrophoneEnabled);

    } catch (error) {
      console.error('Failed to join voice channel:', error);
      throw error;
    }
  }

  async updateDeafenState(isDeafened: boolean) {
    if (!this.currentChannelId) return;

    // Only update isDeafened - media states are managed by LiveKit
    await fetch(`/api/channels/${this.currentChannelId}/voice-presence/state`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ isDeafened })
    });

    // Manually mute remote audio when deafened
    if (isDeafened && this.livekitRoom) {
      this.livekitRoom.remoteParticipants.forEach(participant => {
        participant.audioTrackPublications.forEach(pub => {
          pub.track?.setVolume(0);
        });
      });
    } else if (!isDeafened && this.livekitRoom) {
      this.livekitRoom.remoteParticipants.forEach(participant => {
        participant.audioTrackPublications.forEach(pub => {
          pub.track?.setVolume(1.0);
        });
      });
    }
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