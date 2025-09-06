# Channel-Membership API

> **Base URL:** `/api/channel-membership`  
> **Controller:** `backend/src/channel-membership/channel-membership.controller.ts`  
> **Service:** `backend/src/channel-membership/channel-membership.service.ts`

## Overview

Channel membership management API for controlling access to private channels. Private channels require explicit membership through this API, unlike public channels which are accessible to all community members. Tracks who added users to private channels and when they joined.

## Authentication

- **Required:** ✅ All endpoints require authentication
- **Token Type:** JWT Bearer token
- **Headers:** `Authorization: Bearer <jwt_token>`

## Endpoints Summary

| Method | Endpoint | Description | RBAC Permission |
|--------|----------|-------------|-----------------|
| POST | `/` | Add user to private channel | `CREATE_MEMBER` |
| GET | `/channel/:channelId` | List channel members | `READ_MEMBER` |
| GET | `/user/:userId` | List user's channel memberships | `READ_MEMBER` |
| GET | `/my` | Get current user's channel memberships | `READ_MEMBER` |
| GET | `/channel/:channelId/user/:userId` | Get specific channel membership | `READ_MEMBER` |
| DELETE | `/channel/:channelId/user/:userId` | Remove user from channel | `DELETE_MEMBER` |
| DELETE | `/leave/:channelId` | Leave private channel (self) | None |

---

## POST `/api/channel-membership`

**Description:** Adds a user to a private channel, granting them access to view messages and participate. Only works with private channels; public channels don't require explicit membership.

### Request

**Body (JSON):**
```json
{
  "userId": "string",           // Required: User ID to add to channel
  "channelId": "string",        // Required: Private channel ID
  "addedBy": "string"          // Optional: Who added the user (defaults to current user)
}
```

**Validation Rules:**
- `userId` - Required string, must be valid user ID
- `channelId` - Required string, must be valid private channel ID
- `addedBy` - Optional string, defaults to authenticated user ID if not provided
- Channel must be private (`isPrivate: true`)

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "64f7b1234567890abcdef456",
    "channelId": "64f7b1234567890abcdef123"
  }' \
  "http://localhost:3001/api/channel-membership"
```

### Response

**Success (201):**
```json
{
  "id": "64f7b1234567890abcdef789",
  "userId": "64f7b1234567890abcdef456",
  "channelId": "64f7b1234567890abcdef123",
  "joinedAt": "2024-01-01T12:00:00.000Z",
  "addedBy": "64f7b1234567890abcdef012",
  "user": {
    "id": "64f7b1234567890abcdef456",
    "username": "john_doe",
    "role": "USER",
    "avatarUrl": "https://example.com/avatar.jpg",
    "lastSeen": "2024-01-01T11:30:00.000Z",
    "displayName": "John Doe"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Channel is not private or validation errors
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `CREATE_MEMBER`)
- `404 Not Found` - User or channel not found
- `409 Conflict` - User is already a member of this channel
- `500 Internal Server Error` - Server error

---

## GET `/api/channel-membership/channel/:channelId`

**Description:** Lists all members of a specific private channel with their user information and join details.

### Request

**Path Parameters:**
- `channelId` (string, required) - Private channel ID (MongoDB ObjectId)

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/channel-membership/channel/64f7b1234567890abcdef123"
```

### Response

**Success (200):**
```json
[
  {
    "id": "64f7b1234567890abcdef789",
    "userId": "64f7b1234567890abcdef456",
    "channelId": "64f7b1234567890abcdef123",
    "joinedAt": "2024-01-01T10:00:00.000Z",
    "addedBy": "64f7b1234567890abcdef012",
    "user": {
      "id": "64f7b1234567890abcdef456",
      "username": "john_doe",
      "role": "USER",
      "avatarUrl": "https://example.com/avatar.jpg",
      "lastSeen": "2024-01-01T11:30:00.000Z",
      "displayName": "John Doe"
    }
  },
  {
    "id": "64f7b1234567890abcdef345",
    "userId": "64f7b1234567890abcdef678",
    "channelId": "64f7b1234567890abcdef123",
    "joinedAt": "2024-01-01T09:30:00.000Z",
    "addedBy": "64f7b1234567890abcdef012",
    "user": {
      "id": "64f7b1234567890abcdef678",
      "username": "jane_smith",
      "role": "USER",
      "avatarUrl": null,
      "lastSeen": "2024-01-01T12:00:00.000Z",
      "displayName": "Jane Smith"
    }
  }
]
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `READ_MEMBER`)
- `404 Not Found` - Channel not found
- `500 Internal Server Error` - Server error

---

## GET `/api/channel-membership/user/:userId`

**Description:** Lists all private channels that a specific user is a member of. Users can only view their own memberships unless they have special permissions.

### Request

**Path Parameters:**
- `userId` (string, required) - User ID (MongoDB ObjectId)

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/channel-membership/user/64f7b1234567890abcdef456"
```

### Response

**Success (200):**
```json
[
  {
    "id": "64f7b1234567890abcdef789",
    "userId": "64f7b1234567890abcdef456",
    "channelId": "64f7b1234567890abcdef123",
    "joinedAt": "2024-01-01T10:00:00.000Z",
    "addedBy": "64f7b1234567890abcdef012"
  },
  {
    "id": "64f7b1234567890abcdef345",
    "userId": "64f7b1234567890abcdef456",
    "channelId": "64f7b1234567890abcdef678",
    "joinedAt": "2024-01-01T08:00:00.000Z",
    "addedBy": "64f7b1234567890abcdef901"
  }
]
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Cannot view other users' channel memberships (unless own user)
- `404 Not Found` - User not found
- `500 Internal Server Error` - Server error

---

## GET `/api/channel-membership/my`

**Description:** Lists all private channels that the current authenticated user is a member of. Convenient endpoint for getting user's own channel memberships.

### Request

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/channel-membership/my"
```

### Response

**Success (200):**
```json
[
  {
    "id": "64f7b1234567890abcdef789",
    "userId": "64f7b1234567890abcdef456",
    "channelId": "64f7b1234567890abcdef123",
    "joinedAt": "2024-01-01T10:00:00.000Z",
    "addedBy": "64f7b1234567890abcdef012"
  },
  {
    "id": "64f7b1234567890abcdef345",
    "userId": "64f7b1234567890abcdef456",
    "channelId": "64f7b1234567890abcdef678",
    "joinedAt": "2024-01-01T08:00:00.000Z",
    "addedBy": "64f7b1234567890abcdef901"
  }
]
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `READ_MEMBER`)
- `500 Internal Server Error` - Server error

---

## GET `/api/channel-membership/channel/:channelId/user/:userId`

**Description:** Retrieves a specific channel membership record for a user in a private channel, including who added them and when.

### Request

**Path Parameters:**
- `channelId` (string, required) - Private channel ID (MongoDB ObjectId)
- `userId` (string, required) - User ID (MongoDB ObjectId)

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/channel-membership/channel/64f7b1234567890abcdef123/user/64f7b1234567890abcdef456"
```

### Response

**Success (200):**
```json
{
  "id": "64f7b1234567890abcdef789",
  "userId": "64f7b1234567890abcdef456",
  "channelId": "64f7b1234567890abcdef123",
  "joinedAt": "2024-01-01T10:00:00.000Z",
  "addedBy": "64f7b1234567890abcdef012",
  "user": {
    "id": "64f7b1234567890abcdef456",
    "username": "john_doe",
    "role": "USER",
    "avatarUrl": "https://example.com/avatar.jpg",
    "lastSeen": "2024-01-01T11:30:00.000Z",
    "displayName": "John Doe"
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `READ_MEMBER`)
- `404 Not Found` - Channel membership, user, or channel not found
- `500 Internal Server Error` - Server error

---

## DELETE `/api/channel-membership/channel/:channelId/user/:userId`

**Description:** Removes a user from a private channel, revoking their access to view messages and participate. Only users with appropriate permissions can remove members.

### Request

**Path Parameters:**
- `channelId` (string, required) - Private channel ID
- `userId` (string, required) - User ID to remove

**Example:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/channel-membership/channel/64f7b1234567890abcdef123/user/64f7b1234567890abcdef456"
```

### Response

**Success (204):**
```
No Content
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `DELETE_MEMBER`)
- `404 Not Found` - Channel membership not found
- `500 Internal Server Error` - Server error

---

## DELETE `/api/channel-membership/leave/:channelId`

**Description:** Allows the current user to leave a private channel voluntarily. Users can always leave private channels they are members of without special permissions.

### Request

**Path Parameters:**
- `channelId` (string, required) - Private channel ID to leave

**Example:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/channel-membership/leave/64f7b1234567890abcdef123"
```

### Response

**Success (204):**
```
No Content
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `404 Not Found` - Channel membership not found (user is not a member)
- `500 Internal Server Error` - Server error

---

## Private Channel Access Control

### Channel Types
- **Public Channels:** `isPrivate: false` - Accessible to all community members
- **Private Channels:** `isPrivate: true` - Require explicit membership via this API

### Access Logic
```typescript
// Pseudocode for channel access determination
function canUserAccessChannel(user: User, channel: Channel): boolean {
  // Public channels - check community membership only
  if (!channel.isPrivate) {
    return isUserMemberOfCommunity(user.id, channel.communityId);
  }
  
  // Private channels - check explicit channel membership
  return hasChannelMembership(user.id, channel.id);
}
```

### Membership Management
- **Invitation-Based:** Users must be explicitly added to private channels
- **Audit Trail:** Track who added each user (`addedBy` field)
- **Self-Leave:** Users can always leave private channels voluntarily
- **Admin Control:** Users with permissions can add/remove members

## RBAC Permissions

This API uses Role-Based Access Control with channel-specific resource contexts:

| Action | Permission | Description |
|--------|------------|-------------|
| Create | `CREATE_MEMBER` | Add users to private channels |
| Read | `READ_MEMBER` | View channel membership information |
| Delete | `DELETE_MEMBER` | Remove users from private channels |
| Leave | None | Users can always leave private channels voluntarily |

### Resource Context

For channel-specific operations:

```typescript
@RbacResource({
  type: RbacResourceType.CHANNEL,
  idKey: 'channelId',
  source: ResourceIdSource.BODY // For creation
})

@RbacResource({
  type: RbacResourceType.CHANNEL,
  idKey: 'channelId',
  source: ResourceIdSource.PARAM // For queries/deletion
})
```

**Resource Types Used:**
- `CHANNEL` - Channel-specific permission check for all membership operations

### Special Permission Logic
- **Own Memberships:** Users can always view their own channel memberships
- **Other Users:** Viewing other users' memberships requires `READ_MEMBER` permission
- **Self-Leave:** Users can always leave private channels without special permissions

## Channel Membership Model

### Database Schema
```typescript
interface ChannelMembership {
  id: string;                   // MongoDB ObjectId
  userId: string;               // User being added to channel
  channelId: string;            // Private channel ID
  joinedAt: Date;              // When membership was created
  addedBy?: string;            // Who added the user (optional)
}
```

### Unique Constraints
- **Composite Key:** `(userId, channelId)` combination must be unique
- **No Duplicates:** Users cannot be members of the same channel multiple times

### Relationships
- **User:** Many-to-one relationship with User model
- **Channel:** Many-to-one relationship with Channel model
- **Many-to-Many:** Creates many-to-many relationship between Users and private Channels

## WebSocket Events

When channel memberships are modified, the following WebSocket events are emitted:

| Event | Trigger | Payload | Room |
|-------|---------|---------|------|
| `channel:member_added` | User added to private channel | `{userId, channelId, addedBy}` | `channel:${channelId}` |
| `channel:member_removed` | User removed from channel | `{userId, channelId, removedBy}` | `channel:${channelId}` |
| `channel:member_left` | User leaves channel voluntarily | `{userId, channelId}` | `channel:${channelId}` |

**Example Event Payload:**
```json
{
  "event": "channel:member_added",
  "data": {
    "userId": "64f7b1234567890abcdef456",
    "channelId": "64f7b1234567890abcdef123",
    "addedBy": "64f7b1234567890abcdef012",
    "user": {
      "id": "64f7b1234567890abcdef456",
      "username": "john_doe",
      "displayName": "John Doe"
    },
    "joinedAt": "2024-01-01T12:00:00.000Z"
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
    "userId should not be empty",
    "channelId must be a valid ObjectId"
  ],
  "error": "Bad Request"
}
```

**Channel Not Private (400):**
```json
{
  "statusCode": 400,
  "message": "Channel is not private. Public channels do not require explicit membership.",
  "error": "Bad Request"
}
```

**Channel Membership Not Found (404):**
```json
{
  "statusCode": 404,
  "message": "Channel membership not found for user 64f7b1234567890abcdef456 in channel 64f7b1234567890abcdef123",
  "error": "Not Found"
}
```

**Permission Denied (403):**
```json
{
  "statusCode": 403,
  "message": "Cannot view other users channel memberships",
  "error": "Forbidden"
}
```

**Duplicate Membership (409):**
```json
{
  "statusCode": 409,
  "message": "User is already a member of this private channel",
  "error": "Conflict"
}
```

## Usage Examples

### Frontend Integration (RTK Query)

```typescript
// Redux channel membership slice usage
import { useChannelMembershipApi } from '@/features/channel-membership/api/channelMembershipApi';

function PrivateChannelMemberList({ channelId }: { channelId: string }) {
  const { data: members, isLoading } = useChannelMembershipApi.useGetChannelMembersQuery(channelId);
  const [addMember] = useChannelMembershipApi.useAddChannelMemberMutation();
  const [removeMember] = useChannelMembershipApi.useRemoveChannelMemberMutation();
  
  const handleAddMember = async (userId: string) => {
    try {
      await addMember({ userId, channelId }).unwrap();
    } catch (error) {
      console.error('Failed to add member to private channel:', error);
    }
  };
  
  const handleRemoveMember = async (userId: string) => {
    try {
      await removeMember({ channelId, userId }).unwrap();
    } catch (error) {
      console.error('Failed to remove member from private channel:', error);
    }
  };
}

function UserPrivateChannels() {
  const { data: memberships } = useChannelMembershipApi.useGetMyChannelMembershipsQuery();
  const [leaveChannel] = useChannelMembershipApi.useLeaveChannelMutation();
  
  const handleLeaveChannel = async (channelId: string) => {
    try {
      await leaveChannel(channelId).unwrap();
    } catch (error) {
      console.error('Failed to leave private channel:', error);
    }
  };
  
  return (
    <div>
      <h3>My Private Channels</h3>
      {memberships?.map(membership => (
        <div key={membership.id}>
          <span>Channel: {membership.channelId}</span>
          <span>Joined: {new Date(membership.joinedAt).toLocaleDateString()}</span>
          <button onClick={() => handleLeaveChannel(membership.channelId)}>
            Leave Channel
          </button>
        </div>
      ))}
    </div>
  );
}
```

### Direct API Calls

```typescript
// Add user to private channel
const addUserToPrivateChannel = async (userId: string, channelId: string) => {
  const response = await fetch('/api/channel-membership', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId, channelId }),
  });
  
  return await response.json();
};

// Check if user can access private channel
const canUserAccessChannel = async (channelId: string) => {
  try {
    const response = await fetch(`/api/channel-membership/my`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    const memberships = await response.json();
    return memberships.some(m => m.channelId === channelId);
  } catch (error) {
    return false; // Assume no access if error
  }
};

// Get private channel members
const getPrivateChannelMembers = async (channelId: string) => {
  const response = await fetch(`/api/channel-membership/channel/${channelId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  return await response.json();
};
```

## Testing

### Endpoint Tests
- **Location:** `backend/src/channel-membership/__tests__/channel-membership.controller.spec.ts`
- **Coverage:** CRUD operations, RBAC permissions, private channel logic

### Test Examples

```typescript
// Example integration test
describe('Channel Membership (e2e)', () => {
  it('should add user to private channel', () => {
    return request(app.getHttpServer())
      .post('/api/channel-membership')
      .set('Authorization', `Bearer ${tokenWithCreateMemberPermission}`)
      .send({
        userId: validUserId,
        channelId: privateChannelId
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBeDefined();
        expect(res.body.userId).toBe(validUserId);
        expect(res.body.channelId).toBe(privateChannelId);
      });
  });

  it('should reject membership for public channels', () => {
    return request(app.getHttpServer())
      .post('/api/channel-membership')
      .set('Authorization', `Bearer ${tokenWithCreateMemberPermission}`)
      .send({
        userId: validUserId,
        channelId: publicChannelId // Should fail
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toContain('not private');
      });
  });

  it('should allow users to leave private channels', () => {
    return request(app.getHttpServer())
      .delete(`/api/channel-membership/leave/${privateChannelId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(204);
  });
});
```

## Related Documentation

- [Channels API](channels.md) - Channel creation and management
- [Messages API](messages.md) - Private channel messaging
- [Membership API](membership.md) - Community membership
- [RBAC System](../features/auth-rbac.md)
- [Database Schema](../architecture/database.md#channelmembership)
- [WebSocket Events](websocket-events.md)