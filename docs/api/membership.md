# Membership API

> **Base URL:** `/api/membership`  
> **Controller:** `backend/src/membership/membership.controller.ts`  
> **Service:** `backend/src/membership/membership.service.ts`

## Overview

Community membership management API for adding users to communities, viewing membership lists, and managing member relationships. Handles the many-to-many relationship between users and communities, tracking join dates and providing member discovery functionality.

## Authentication

- **Required:** ✅ All endpoints require authentication
- **Token Type:** JWT Bearer token
- **Headers:** `Authorization: Bearer <jwt_token>`

## Endpoints Summary

| Method | Endpoint | Description | RBAC Permission |
|--------|----------|-------------|-----------------|
| POST | `/` | Add user to community | `CREATE_MEMBER` |
| GET | `/community/:communityId` | List community members | `READ_MEMBER` |
| GET | `/user/:userId` | List user's memberships | `READ_MEMBER` |
| GET | `/my` | Get current user's memberships | `READ_MEMBER` |
| GET | `/community/:communityId/user/:userId` | Get specific membership | `READ_MEMBER` |
| DELETE | `/community/:communityId/user/:userId` | Remove member from community | `DELETE_MEMBER` |
| DELETE | `/leave/:communityId` | Leave community (self) | None |

---

## POST `/api/membership`

**Description:** Adds a user to a community, creating a membership relationship. Only users with appropriate permissions can add members to communities.

### Request

**Body (JSON):**
```json
{
  "userId": "string",           // Required: User ID to add to community
  "communityId": "string"       // Required: Community ID to add user to
}
```

**Validation Rules:**
- `userId` - Required string, must be valid MongoDB ObjectId
- `communityId` - Required string, must be valid MongoDB ObjectId
- Combination of `userId` and `communityId` must be unique (no duplicate memberships)

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "64f7b1234567890abcdef456",
    "communityId": "64f7b1234567890abcdef123"
  }' \
  "http://localhost:3001/api/membership"
```

### Response

**Success (201):**
```json
{
  "id": "64f7b1234567890abcdef789",
  "userId": "64f7b1234567890abcdef456",
  "communityId": "64f7b1234567890abcdef123",
  "joinedAt": "2024-01-01T12:00:00.000Z",
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
- `400 Bad Request` - Validation errors (invalid ObjectIds)
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `CREATE_MEMBER`)
- `404 Not Found` - User or community not found
- `409 Conflict` - User is already a member of this community
- `500 Internal Server Error` - Server error

---

## GET `/api/membership/community/:communityId`

**Description:** Lists all members of a specific community with their user information and join dates.

### Request

**Path Parameters:**
- `communityId` (string, required) - Community ID (MongoDB ObjectId)

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/membership/community/64f7b1234567890abcdef123"
```

### Response

**Success (200):**
```json
[
  {
    "id": "64f7b1234567890abcdef789",
    "userId": "64f7b1234567890abcdef456",
    "communityId": "64f7b1234567890abcdef123",
    "joinedAt": "2024-01-01T10:00:00.000Z",
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
    "id": "64f7b1234567890abcdef012",
    "userId": "64f7b1234567890abcdef345",
    "communityId": "64f7b1234567890abcdef123",
    "joinedAt": "2024-01-01T08:00:00.000Z",
    "user": {
      "id": "64f7b1234567890abcdef345",
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
- `404 Not Found` - Community not found
- `500 Internal Server Error` - Server error

---

## GET `/api/membership/user/:userId`

**Description:** Lists all communities that a specific user is a member of. Users can only view their own memberships unless they have special permissions.

### Request

**Path Parameters:**
- `userId` (string, required) - User ID (MongoDB ObjectId)

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/membership/user/64f7b1234567890abcdef456"
```

### Response

**Success (200):**
```json
[
  {
    "id": "64f7b1234567890abcdef789",
    "userId": "64f7b1234567890abcdef456",
    "communityId": "64f7b1234567890abcdef123",
    "joinedAt": "2024-01-01T10:00:00.000Z"
  },
  {
    "id": "64f7b1234567890abcdef012",
    "userId": "64f7b1234567890abcdef456",
    "communityId": "64f7b1234567890abcdef678",
    "joinedAt": "2024-01-01T09:00:00.000Z"
  }
]
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Cannot view other users' memberships (unless own user or has permissions)
- `404 Not Found` - User not found
- `500 Internal Server Error` - Server error

---

## GET `/api/membership/my`

**Description:** Lists all communities that the current authenticated user is a member of. Convenient endpoint for getting user's own memberships.

### Request

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/membership/my"
```

### Response

**Success (200):**
```json
[
  {
    "id": "64f7b1234567890abcdef789",
    "userId": "64f7b1234567890abcdef456",
    "communityId": "64f7b1234567890abcdef123",
    "joinedAt": "2024-01-01T10:00:00.000Z"
  },
  {
    "id": "64f7b1234567890abcdef012",
    "userId": "64f7b1234567890abcdef456",
    "communityId": "64f7b1234567890abcdef678",
    "joinedAt": "2024-01-01T09:00:00.000Z"
  }
]
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `READ_MEMBER`)
- `500 Internal Server Error` - Server error

---

## GET `/api/membership/community/:communityId/user/:userId`

**Description:** Retrieves a specific membership record for a user in a community, including join date and user information.

### Request

**Path Parameters:**
- `communityId` (string, required) - Community ID (MongoDB ObjectId)
- `userId` (string, required) - User ID (MongoDB ObjectId)

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/membership/community/64f7b1234567890abcdef123/user/64f7b1234567890abcdef456"
```

### Response

**Success (200):**
```json
{
  "id": "64f7b1234567890abcdef789",
  "userId": "64f7b1234567890abcdef456",
  "communityId": "64f7b1234567890abcdef123",
  "joinedAt": "2024-01-01T10:00:00.000Z",
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
- `404 Not Found` - Membership, user, or community not found
- `500 Internal Server Error` - Server error

---

## DELETE `/api/membership/community/:communityId/user/:userId`

**Description:** Removes a user from a community (kicks/bans). Only users with appropriate permissions can remove members from communities.

### Request

**Path Parameters:**
- `communityId` (string, required) - Community ID
- `userId` (string, required) - User ID to remove

**Example:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/membership/community/64f7b1234567890abcdef123/user/64f7b1234567890abcdef456"
```

### Response

**Success (204):**
```
No Content
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `DELETE_MEMBER`)
- `404 Not Found` - Membership not found
- `500 Internal Server Error` - Server error

---

## DELETE `/api/membership/leave/:communityId`

**Description:** Allows the current user to leave a community voluntarily. Users can always leave communities they are members of without special permissions.

### Request

**Path Parameters:**
- `communityId` (string, required) - Community ID to leave

**Example:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/membership/leave/64f7b1234567890abcdef123"
```

### Response

**Success (204):**
```
No Content
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `404 Not Found` - Membership not found (user is not a member)
- `500 Internal Server Error` - Server error

---

## RBAC Permissions

This API uses Role-Based Access Control with community-specific resource contexts:

| Action | Permission | Description |
|--------|------------|-------------|
| Create | `CREATE_MEMBER` | Add users to communities |
| Read | `READ_MEMBER` | View membership information |
| Delete | `DELETE_MEMBER` | Remove users from communities |
| Leave | None | Users can always leave communities voluntarily |

### Resource Context

For community-specific operations:

```typescript
@RbacResource({
  type: RbacResourceType.COMMUNITY,
  idKey: 'communityId',
  source: ResourceIdSource.BODY // For creation
})

@RbacResource({
  type: RbacResourceType.COMMUNITY,
  idKey: 'communityId',
  source: ResourceIdSource.PARAM // For queries/deletion
})
```

**Resource Types Used:**
- `COMMUNITY` - Community-specific permission check for all membership operations

### Special Permission Logic

- **Own Memberships:** Users can always view their own memberships
- **Other Users:** Viewing other users' memberships requires `READ_MEMBER` permission
- **Self-Leave:** Users can always leave communities without special permissions

## Membership Model

### Database Schema
```typescript
interface Membership {
  id: string;                   // MongoDB ObjectId
  userId: string;               // User being added to community
  communityId: string;          // Community receiving the member
  joinedAt: Date;              // When membership was created
}
```

### Unique Constraints
- **Composite Key:** `(userId, communityId)` combination must be unique
- **No Duplicates:** Users cannot be members of the same community multiple times

### Relationships
- **User:** Many-to-one relationship with User model
- **Community:** Many-to-one relationship with Community model
- **Many-to-Many:** Memberships create the many-to-many relationship between Users and Communities

## WebSocket Events

When memberships are modified, the following WebSocket events are emitted:

| Event | Trigger | Payload | Room |
|-------|---------|---------|------|
| `member:joined` | User joins community | `{userId, communityId, joinedAt}` | `community:${communityId}` |
| `member:left` | User leaves community | `{userId, communityId}` | `community:${communityId}` |
| `member:removed` | User removed from community | `{userId, communityId, removedBy}` | `community:${communityId}` |

**Example Event Payload:**
```json
{
  "event": "member:joined",
  "data": {
    "userId": "64f7b1234567890abcdef456",
    "communityId": "64f7b1234567890abcdef123",
    "joinedAt": "2024-01-01T12:00:00.000Z",
    "user": {
      "id": "64f7b1234567890abcdef456",
      "username": "john_doe",
      "displayName": "John Doe"
    }
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
    "communityId must be a valid ObjectId"
  ],
  "error": "Bad Request"
}
```

**Membership Not Found (404):**
```json
{
  "statusCode": 404,
  "message": "Membership not found for user 64f7b1234567890abcdef456 in community 64f7b1234567890abcdef123",
  "error": "Not Found"
}
```

**Permission Denied (403):**
```json
{
  "statusCode": 403,
  "message": "Cannot view other users memberships",
  "error": "Forbidden"
}
```

**Duplicate Membership (409):**
```json
{
  "statusCode": 409,
  "message": "User is already a member of this community",
  "error": "Conflict"
}
```

## Usage Examples

### Frontend Integration (RTK Query)

```typescript
// Redux membership slice usage
import { useMembershipApi } from '@/features/membership/api/membershipApi';

function CommunityMemberList({ communityId }: { communityId: string }) {
  const { data: members, isLoading } = useMembershipApi.useGetCommunityMembersQuery(communityId);
  const [addMember] = useMembershipApi.useAddMemberMutation();
  const [removeMember] = useMembershipApi.useRemoveMemberMutation();
  
  const handleAddMember = async (userId: string) => {
    try {
      await addMember({ userId, communityId }).unwrap();
    } catch (error) {
      console.error('Failed to add member:', error);
    }
  };
  
  const handleRemoveMember = async (userId: string) => {
    try {
      await removeMember({ communityId, userId }).unwrap();
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  };
}

function UserCommunities() {
  const { data: memberships } = useMembershipApi.useGetMyMembershipsQuery();
  const [leaveCommunity] = useMembershipApi.useLeaveCommunityMutation();
  
  const handleLeaveCommunity = async (communityId: string) => {
    try {
      await leaveCommunity(communityId).unwrap();
    } catch (error) {
      console.error('Failed to leave community:', error);
    }
  };
}
```

### Direct API Calls

```typescript
// Add user to community
const addMemberToCommunity = async (userId: string, communityId: string) => {
  const response = await fetch('/api/membership', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId, communityId }),
  });
  
  return await response.json();
};

// Get community members
const getCommunityMembers = async (communityId: string) => {
  const response = await fetch(`/api/membership/community/${communityId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  return await response.json();
};

// Leave community
const leaveCommunity = async (communityId: string) => {
  await fetch(`/api/membership/leave/${communityId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
};
```

## Testing

### Endpoint Tests
- **Location:** `backend/src/membership/__tests__/membership.controller.spec.ts`
- **Coverage:** CRUD operations, RBAC permissions, self-leave functionality

### Test Examples

```typescript
// Example integration test
describe('Membership (e2e)', () => {
  it('should add user to community', () => {
    return request(app.getHttpServer())
      .post('/api/membership')
      .set('Authorization', `Bearer ${tokenWithCreateMemberPermission}`)
      .send({
        userId: validUserId,
        communityId: validCommunityId
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBeDefined();
        expect(res.body.userId).toBe(validUserId);
        expect(res.body.communityId).toBe(validCommunityId);
      });
  });

  it('should prevent duplicate memberships', () => {
    return request(app.getHttpServer())
      .post('/api/membership')
      .set('Authorization', `Bearer ${tokenWithCreateMemberPermission}`)
      .send({
        userId: existingMemberUserId,
        communityId: validCommunityId
      })
      .expect(409);
  });

  it('should allow users to leave communities', () => {
    return request(app.getHttpServer())
      .delete(`/api/membership/leave/${communityId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(204);
  });
});
```

## Related Documentation

- [Community API](community.md) - Community management
- [User API](user.md) - User management
- [Channel-Membership API](channel-membership.md) - Private channel access
- [RBAC System](../features/auth-rbac.md)
- [Database Schema](../architecture/database.md#membership)
- [WebSocket Events](websocket-events.md)