# Channels API

> **Base URL:** `/api/channels`  
> **Controller:** `backend/src/channels/channels.controller.ts`  
> **Service:** `backend/src/channels/channels.service.ts`

## Overview

Channel management API for creating and managing text and voice channels within communities. Channels support both public and private access modes, with private channels requiring explicit membership. Voice channels integrate with LiveKit for real-time audio/video communication.

## Authentication

- **Required:** ✅ All endpoints require authentication
- **Token Type:** JWT Bearer token
- **Headers:** `Authorization: Bearer <jwt_token>`

## Endpoints Summary

| Method | Endpoint | Description | RBAC Permission |
|--------|----------|-------------|-----------------|
| POST | `/` | Create new channel | `CREATE_CHANNEL` |
| GET | `/community/:communityId` | List channels in community | `READ_CHANNEL` |
| GET | `/:id` | Get channel by ID | `READ_CHANNEL` |
| PATCH | `/:id` | Update channel | `UPDATE_CHANNEL` |
| DELETE | `/:id` | Delete channel | `DELETE_CHANNEL` |

---

## POST `/api/channels`

**Description:** Creates a new text or voice channel within a community. Channels can be public (default) or private, requiring explicit membership for access.

### Request

**Body (JSON):**
```json
{
  "name": "string",             // Required: Channel name (unique within community)
  "communityId": "string",      // Required: Parent community ID
  "type": "TEXT|VOICE",         // Required: Channel type
  "isPrivate": boolean          // Required: Whether channel is private
}
```

**Validation Rules:**
- `name` - Required string, must be unique within the community
- `communityId` - Required string, must be valid community ID
- `type` - Required enum: `TEXT` for text channels, `VOICE` for voice/video channels
- `isPrivate` - Required boolean, determines access control (public vs private)

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "general-chat",
    "communityId": "64f7b1234567890abcdef123",
    "type": "TEXT",
    "isPrivate": false
  }' \
  "http://localhost:3001/api/channels"
```

**Voice Channel Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "voice-lounge",
    "communityId": "64f7b1234567890abcdef123",
    "type": "VOICE",
    "isPrivate": false
  }' \
  "http://localhost:3001/api/channels"
```

### Response

**Success (201):**
```json
{
  "id": "64f7b1234567890abcdef456",
  "name": "general-chat",
  "communityId": "64f7b1234567890abcdef123",
  "type": "TEXT",
  "isPrivate": false,
  "createdAt": "2024-01-01T12:00:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request` - Validation errors (missing fields, invalid type)
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `CREATE_CHANNEL`)
- `404 Not Found` - Community not found
- `409 Conflict` - Channel name already exists in community
- `500 Internal Server Error` - Server error

---

## GET `/api/channels/community/:communityId`

**Description:** Lists all channels within a specific community. Returns only channels the user has access to (public channels or private channels they're a member of).

### Request

**Path Parameters:**
- `communityId` (string, required) - Community ID (MongoDB ObjectId)

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/channels/community/64f7b1234567890abcdef123"
```

### Response

**Success (200):**
```json
[
  {
    "id": "64f7b1234567890abcdef456",
    "name": "general",
    "communityId": "64f7b1234567890abcdef123",
    "type": "TEXT",
    "isPrivate": false,
    "createdAt": "2024-01-01T12:00:00.000Z"
  },
  {
    "id": "64f7b1234567890abcdef789",
    "name": "voice-chat",
    "communityId": "64f7b1234567890abcdef123",
    "type": "VOICE",
    "isPrivate": false,
    "createdAt": "2024-01-01T12:30:00.000Z"
  },
  {
    "id": "64f7b1234567890abcdef012",
    "name": "admin-private",
    "communityId": "64f7b1234567890abcdef123",
    "type": "TEXT",
    "isPrivate": true,
    "createdAt": "2024-01-01T13:00:00.000Z"
  }
]
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `READ_CHANNEL`)
- `404 Not Found` - Community not found
- `500 Internal Server Error` - Server error

---

## GET `/api/channels/:id`

**Description:** Retrieves detailed information about a specific channel by ID. User must have access to the channel.

### Request

**Path Parameters:**
- `id` (string, required) - Channel ID (MongoDB ObjectId)

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/channels/64f7b1234567890abcdef456"
```

### Response

**Success (200):**
```json
{
  "id": "64f7b1234567890abcdef456",
  "name": "general",
  "communityId": "64f7b1234567890abcdef123",
  "type": "TEXT",
  "isPrivate": false,
  "createdAt": "2024-01-01T12:00:00.000Z",
  "community": {
    "id": "64f7b1234567890abcdef123",
    "name": "Gaming Community"
  },
  "memberCount": 15
}
```

**Voice Channel Response:**
```json
{
  "id": "64f7b1234567890abcdef789",
  "name": "voice-chat",
  "communityId": "64f7b1234567890abcdef123",
  "type": "VOICE",
  "isPrivate": false,
  "createdAt": "2024-01-01T12:30:00.000Z",
  "community": {
    "id": "64f7b1234567890abcdef123",
    "name": "Gaming Community"
  },
  "memberCount": 8,
  "activeUsers": [
    {
      "id": "64f7b1234567890abcdef012",
      "username": "user1",
      "displayName": "User One"
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions or no channel access
- `404 Not Found` - Channel not found
- `500 Internal Server Error` - Server error

---

## PATCH `/api/channels/:id`

**Description:** Updates channel information such as name, privacy status, or other properties. Only users with `UPDATE_CHANNEL` permission can modify channels.

### Request

**Path Parameters:**
- `id` (string, required) - Channel ID to update

**Body (JSON):**
```json
{
  "name": "string",             // Optional: New channel name
  "isPrivate": boolean          // Optional: Change privacy status
}
```

**Example:**
```bash
curl -X PATCH \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "updated-general",
    "isPrivate": true
  }' \
  "http://localhost:3001/api/channels/64f7b1234567890abcdef456"
```

### Response

**Success (200):**
```json
{
  "id": "64f7b1234567890abcdef456",
  "name": "updated-general",
  "communityId": "64f7b1234567890abcdef123",
  "type": "TEXT",
  "isPrivate": true,
  "createdAt": "2024-01-01T12:00:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request` - Validation errors
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `UPDATE_CHANNEL`)
- `404 Not Found` - Channel not found
- `409 Conflict` - Channel name already exists in community
- `500 Internal Server Error` - Server error

---

## DELETE `/api/channels/:id`

**Description:** Permanently deletes a channel and all associated messages and memberships. This action cannot be undone.

### Request

**Path Parameters:**
- `id` (string, required) - Channel ID to delete

**Example:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/channels/64f7b1234567890abcdef456"
```

### Response

**Success (204):**
```
No Content
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `DELETE_CHANNEL`)
- `404 Not Found` - Channel not found
- `500 Internal Server Error` - Server error

---

## Channel Types

### TEXT Channels
- **Purpose:** Text-based messaging with support for rich content
- **Features:** Messages, attachments, reactions, mentions, thread support
- **LiveKit Integration:** Not applicable

### VOICE Channels  
- **Purpose:** Audio and video communication
- **Features:** Voice chat, video calls, screen sharing, persistent connections
- **LiveKit Integration:** Channel ID is used as LiveKit room ID
- **Persistence:** Voice connections should persist across page navigation

## RBAC Permissions

This API uses Role-Based Access Control with channel and community-specific resource contexts:

| Action | Permission | Description |
|--------|------------|-------------|
| Create | `CREATE_CHANNEL` | Create new channels in communities |
| Read | `READ_CHANNEL` | View channel information and access channels |
| Update | `UPDATE_CHANNEL` | Modify channel properties |
| Delete | `DELETE_CHANNEL` | Delete channels |

### Resource Context

For channel creation:
```typescript
@RbacResource({
  type: RbacResourceType.COMMUNITY,
  idKey: 'id',
  source: ResourceIdSource.PAYLOAD
})
```

For channel-specific operations (GET, PATCH, DELETE by ID):
```typescript
@RbacResource({
  type: RbacResourceType.CHANNEL,
  idKey: 'id',
  source: ResourceIdSource.PARAMS
})
```

**Resource Types Used:**
- `COMMUNITY` - Community-level permission check for channel creation
- `CHANNEL` - Channel-specific permission check for direct channel operations

## Private Channel Access

### Access Control
- **Public Channels:** Accessible to all community members
- **Private Channels:** Require explicit membership via `ChannelMembership`
- **Permission Override:** Users with appropriate RBAC permissions can access regardless of membership

### Channel Membership
- **Model:** `ChannelMembership` tracks user access to private channels
- **Fields:** `userId`, `channelId`, `joinedAt`, `addedBy`
- **Management:** See [Channel-Membership API](channel-membership.md)

## WebSocket Events

When channels are modified, the following WebSocket events are emitted:

| Event | Trigger | Payload | Room |
|-------|---------|---------|------|
| `channel:created` | Channel creation | `ChannelData` | `community:${communityId}` |
| `channel:updated` | Channel update | `ChannelData` | `channel:${channelId}` |
| `channel:deleted` | Channel deletion | `{id, name, communityId}` | `community:${communityId}` |
| `channel:voice_user_joined` | User joins voice channel | `{userId, channelId}` | `channel:${channelId}` |
| `channel:voice_user_left` | User leaves voice channel | `{userId, channelId}` | `channel:${channelId}` |

**Example Event Payload:**
```json
{
  "event": "channel:created",
  "data": {
    "id": "64f7b1234567890abcdef456",
    "name": "general",
    "communityId": "64f7b1234567890abcdef123",
    "type": "TEXT",
    "isPrivate": false,
    "action": "created"
  }
}
```

## Error Handling

### Common Error Formats

**Validation Error (400):**
```json
{
  "statusCode": 400,
  "message": [
    "name should not be empty",
    "type must be a valid enum value"
  ],
  "error": "Bad Request"
}
```

**Channel Not Found (404):**
```json
{
  "statusCode": 404,
  "message": "Channel with ID 64f7b1234567890abcdef456 not found",
  "error": "Not Found"
}
```

**Channel Access Denied (403):**
```json
{
  "statusCode": 403,
  "message": "Access denied to private channel",
  "error": "Forbidden"
}
```

**Name Conflict (409):**
```json
{
  "statusCode": 409,
  "message": "Channel name 'general' already exists in this community",
  "error": "Conflict"
}
```

## Usage Examples

### Frontend Integration (RTK Query)

```typescript
// Redux channels slice usage
import { useChannelsApi } from '@/features/channels/api/channelsApi';

function ChannelList({ communityId }: { communityId: string }) {
  const { data: channels, isLoading } = useChannelsApi.useGetCommunityChannelsQuery(communityId);
  const [createChannel] = useChannelsApi.useCreateChannelMutation();
  
  const handleCreateChannel = async (channelData: CreateChannelData) => {
    try {
      await createChannel(channelData).unwrap();
    } catch (error) {
      console.error('Failed to create channel:', error);
    }
  };
}

function VoiceChannelComponent({ channelId }: { channelId: string }) {
  const { data: channel } = useChannelsApi.useGetChannelQuery(channelId);
  
  // Voice channel specific logic
  useEffect(() => {
    if (channel?.type === 'VOICE') {
      // Initialize LiveKit connection using channelId as room ID
      initializeVoiceConnection(channelId);
    }
  }, [channel, channelId]);
}
```

### Channel Creation Patterns

```typescript
// Create text channel
const createTextChannel = async (communityId: string, name: string, isPrivate = false) => {
  const response = await fetch('/api/channels', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      communityId,
      type: 'TEXT',
      isPrivate
    }),
  });
  
  return await response.json();
};

// Create voice channel for LiveKit integration
const createVoiceChannel = async (communityId: string, name: string) => {
  const response = await fetch('/api/channels', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      communityId,
      type: 'VOICE',
      isPrivate: false // Voice channels typically public
    }),
  });
  
  const channel = await response.json();
  
  // Channel ID becomes LiveKit room ID
  console.log('LiveKit Room ID:', channel.id);
  
  return channel;
};
```

## Testing

### Endpoint Tests
- **Location:** `backend/src/channels/__tests__/channels.controller.spec.ts`
- **Coverage:** CRUD operations, RBAC permissions, channel types, privacy modes

### Test Examples

```typescript
// Example integration test
describe('Channels (e2e)', () => {
  it('should create text channel with valid data', () => {
    return request(app.getHttpServer())
      .post('/api/channels')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        name: 'test-channel',
        communityId: validCommunityId,
        type: 'TEXT',
        isPrivate: false
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBeDefined();
        expect(res.body.name).toBe('test-channel');
        expect(res.body.type).toBe('TEXT');
      });
  });

  it('should enforce channel name uniqueness within community', () => {
    return request(app.getHttpServer())
      .post('/api/channels')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        name: 'duplicate-name',
        communityId: validCommunityId,
        type: 'TEXT',
        isPrivate: false
      })
      .expect(409);
  });
});
```

## Related Documentation

- [Messages API](messages.md) - Text channel messaging
- [Voice-Presence API](voice-presence.md) - Voice channel management  
- [Channel-Membership API](channel-membership.md) - Private channel access
- [LiveKit API](livekit.md) - Voice/video integration
- [Community API](community.md) - Parent community management
- [RBAC System](../features/auth-rbac.md)
- [Database Schema](../architecture/database.md#channel)
- [Voice Persistence](../features/voice-persistence.md)