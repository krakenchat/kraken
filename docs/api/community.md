# Community API

> **Base URL:** `/api/community`  
> **Controller:** `backend/src/community/community.controller.ts`  
> **Service:** `backend/src/community/community.service.ts`

## Overview

Community management API for creating, reading, updating, and deleting Discord-like servers/communities. Communities contain channels, members, and support role-based permissions. All endpoints require authentication and appropriate RBAC permissions.

## Authentication

- **Required:** ✅ All endpoints require authentication
- **Token Type:** JWT Bearer token
- **Headers:** `Authorization: Bearer <jwt_token>`

## Endpoints Summary

| Method | Endpoint | Description | RBAC Permission |
|--------|----------|-------------|-----------------|
| POST | `/` | Create new community | `CREATE_COMMUNITY` |
| GET | `/` | List all communities (admin) | `READ_ALL_COMMUNITIES` |
| GET | `/mine` | List user's communities | `READ_COMMUNITY` |
| GET | `/:id` | Get community by ID | `READ_COMMUNITY` |
| PATCH | `/:id` | Update community | `UPDATE_COMMUNITY` |
| DELETE | `/:id` | Delete community | `DELETE_COMMUNITY` |

---

## POST `/api/community`

**Description:** Creates a new community (Discord-like server) with the authenticated user as owner. Community names must be unique across the instance.

### Request

**Body (JSON):**
```json
{
  "name": "string",             // Required: Community name (unique)
  "description": "string",      // Optional: Community description
  "avatar": "string",          // Optional: Avatar image URL
  "banner": "string"           // Optional: Banner image URL
}
```

**Validation Rules:**
- `name` - Required string, must be unique across all communities
- `description` - Optional string, community description
- `avatar` - Optional string, URL to community avatar image
- `banner` - Optional string, URL to community banner image

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Gaming Community",
    "description": "A place for gamers to chat and play together",
    "avatar": "https://example.com/avatar.jpg"
  }' \
  "http://localhost:3001/api/community"
```

### Response

**Success (201):**
```json
{
  "id": "64f7b1234567890abcdef123",
  "name": "Gaming Community",
  "description": "A place for gamers to chat and play together",
  "avatar": "https://example.com/avatar.jpg",
  "banner": null,
  "createdAt": "2024-01-01T12:00:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request` - Validation errors (missing name)
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `CREATE_COMMUNITY`)
- `409 Conflict` - Community name already exists
- `500 Internal Server Error` - Server error

---

## GET `/api/community`

**Description:** Lists all communities in the instance. Admin-only endpoint for instance management.

### Request

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/community"
```

### Response

**Success (200):**
```json
[
  {
    "id": "64f7b1234567890abcdef123",
    "name": "Gaming Community",
    "description": "A place for gamers to chat",
    "avatar": "https://example.com/avatar.jpg",
    "banner": null,
    "createdAt": "2024-01-01T12:00:00.000Z"
  },
  {
    "id": "64f7b1234567890abcdef456",
    "name": "Developer Hub",
    "description": "Development discussions",
    "avatar": null,
    "banner": "https://example.com/banner.jpg",
    "createdAt": "2024-01-01T10:00:00.000Z"
  }
]
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `READ_ALL_COMMUNITIES`)
- `500 Internal Server Error` - Server error

---

## GET `/api/community/mine`

**Description:** Lists all communities where the authenticated user is a member. Returns communities the user has joined or owns.

### Request

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/community/mine"
```

### Response

**Success (200):**
```json
[
  {
    "id": "64f7b1234567890abcdef123",
    "name": "Gaming Community",
    "description": "A place for gamers to chat",
    "avatar": "https://example.com/avatar.jpg",
    "banner": null,
    "createdAt": "2024-01-01T12:00:00.000Z"
  },
  {
    "id": "64f7b1234567890abcdef789",
    "name": "Book Club",
    "description": "Monthly book discussions",
    "avatar": null,
    "banner": null,
    "createdAt": "2024-01-01T08:00:00.000Z"
  }
]
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `READ_COMMUNITY`)
- `500 Internal Server Error` - Server error

---

## GET `/api/community/:id`

**Description:** Retrieves detailed information about a specific community by ID. User must be a member or have appropriate permissions.

### Request

**Path Parameters:**
- `id` (string, required) - Community ID (MongoDB ObjectId)

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/community/64f7b1234567890abcdef123"
```

### Response

**Success (200):**
```json
{
  "id": "64f7b1234567890abcdef123",
  "name": "Gaming Community",
  "description": "A place for gamers to chat and play together",
  "avatar": "https://example.com/avatar.jpg",
  "banner": "https://example.com/banner.jpg",
  "createdAt": "2024-01-01T12:00:00.000Z",
  "channels": [
    {
      "id": "64f7b1234567890abcdef456",
      "name": "general",
      "type": "TEXT"
    },
    {
      "id": "64f7b1234567890abcdef789",
      "name": "voice-chat",
      "type": "VOICE"
    }
  ],
  "memberships": [
    {
      "userId": "64f7b1234567890abcdef012",
      "username": "community_owner",
      "role": "OWNER"
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions or not a member
- `404 Not Found` - Community not found
- `500 Internal Server Error` - Server error

---

## PATCH `/api/community/:id`

**Description:** Updates community information. Only community owners or users with `UPDATE_COMMUNITY` permission can modify communities.

### Request

**Path Parameters:**
- `id` (string, required) - Community ID to update

**Body (JSON):**
```json
{
  "name": "string",             // Optional: New community name
  "description": "string",      // Optional: New description
  "avatar": "string",          // Optional: New avatar URL
  "banner": "string"           // Optional: New banner URL
}
```

**Example:**
```bash
curl -X PATCH \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated community description",
    "banner": "https://example.com/new-banner.jpg"
  }' \
  "http://localhost:3001/api/community/64f7b1234567890abcdef123"
```

### Response

**Success (200):**
```json
{
  "id": "64f7b1234567890abcdef123",
  "name": "Gaming Community",
  "description": "Updated community description",
  "avatar": "https://example.com/avatar.jpg",
  "banner": "https://example.com/new-banner.jpg",
  "createdAt": "2024-01-01T12:00:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request` - Validation errors
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `UPDATE_COMMUNITY`)
- `404 Not Found` - Community not found
- `409 Conflict` - Community name already exists (if changing name)
- `500 Internal Server Error` - Server error

---

## DELETE `/api/community/:id`

**Description:** Permanently deletes a community and all associated data (channels, messages, memberships). This action cannot be undone.

### Request

**Path Parameters:**
- `id` (string, required) - Community ID to delete

**Example:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/community/64f7b1234567890abcdef123"
```

### Response

**Success (204):**
```
No Content
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `DELETE_COMMUNITY`)
- `404 Not Found` - Community not found
- `409 Conflict` - Cannot delete due to existing references
- `500 Internal Server Error` - Server error

---

## RBAC Permissions

This API uses Role-Based Access Control with community-specific resource context:

| Action | Permission | Description |
|--------|------------|-------------|
| Create | `CREATE_COMMUNITY` | Create new communities |
| Read All | `READ_ALL_COMMUNITIES` | View all communities (admin) |
| Read Own | `READ_COMMUNITY` | View communities user is member of |
| Read Specific | `READ_COMMUNITY` | View specific community details |
| Update | `UPDATE_COMMUNITY` | Modify community information |
| Delete | `DELETE_COMMUNITY` | Delete communities |

### Resource Context

For community-specific operations (GET, PATCH, DELETE by ID):

```typescript
@RbacResource({
  type: RbacResourceType.COMMUNITY,
  idKey: 'id',
  source: ResourceIdSource.PARAMS
})
```

**Resource Types Used:**
- `COMMUNITY` - Community-specific permission check using community ID from URL parameters

## WebSocket Events

When communities are modified, the following WebSocket events are emitted:

| Event | Trigger | Payload | Room |
|-------|---------|---------|------|
| `community:created` | Community creation | `CommunityData` | `instance` |
| `community:updated` | Community update | `CommunityData` | `community:${communityId}` |
| `community:deleted` | Community deletion | `{id, name}` | `community:${communityId}` |

**Example Event Payload:**
```json
{
  "event": "community:created",
  "data": {
    "id": "64f7b1234567890abcdef123",
    "name": "Gaming Community",
    "description": "A place for gamers",
    "avatar": "https://example.com/avatar.jpg",
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
    "name must be a string"
  ],
  "error": "Bad Request"
}
```

**Community Not Found (404):**
```json
{
  "statusCode": 404,
  "message": "Community with ID 64f7b1234567890abcdef123 not found",
  "error": "Not Found"
}
```

**Permission Denied (403):**
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions. Required: CREATE_COMMUNITY",
  "error": "Forbidden"
}
```

**Name Conflict (409):**
```json
{
  "statusCode": 409,
  "message": "Community name 'Gaming Community' already exists",
  "error": "Conflict"
}
```

## Usage Examples

### Frontend Integration (RTK Query)

```typescript
// Redux community slice usage
import { useCommunityApi } from '@/features/community/api/communityApi';

function CommunityList() {
  const { data: communities, isLoading } = useCommunityApi.useGetMineQuery();
  const [createCommunity] = useCommunityApi.useCreateCommunityMutation();
  
  const handleCreate = async (communityData: CreateCommunityData) => {
    try {
      await createCommunity(communityData).unwrap();
    } catch (error) {
      console.error('Failed to create community:', error);
    }
  };
}

function CommunitySettings({ communityId }: { communityId: string }) {
  const { data: community } = useCommunityApi.useGetCommunityQuery(communityId);
  const [updateCommunity] = useCommunityApi.useUpdateCommunityMutation();
  
  const handleUpdate = async (updates: UpdateCommunityData) => {
    try {
      await updateCommunity({ id: communityId, ...updates }).unwrap();
    } catch (error) {
      console.error('Failed to update community:', error);
    }
  };
}
```

### Direct HTTP Calls

```typescript
// Create community
const createCommunity = async (communityData: CreateCommunityData) => {
  const response = await fetch('/api/community', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(communityData),
  });
  
  return await response.json();
};

// Get user's communities
const getUserCommunities = async () => {
  const response = await fetch('/api/community/mine', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  return await response.json();
};
```

## Testing

### Endpoint Tests
- **Location:** `backend/src/community/__tests__/community.controller.spec.ts`
- **Coverage:** CRUD operations, RBAC permissions, WebSocket events

### Test Examples

```typescript
// Example integration test
describe('Community (e2e)', () => {
  it('should create community with valid data', () => {
    return request(app.getHttpServer())
      .post('/api/community')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        name: 'Test Community',
        description: 'Test description'
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBeDefined();
        expect(res.body.name).toBe('Test Community');
      });
  });

  it('should require CREATE_COMMUNITY permission', () => {
    return request(app.getHttpServer())
      .post('/api/community')
      .set('Authorization', `Bearer ${tokenWithoutPermission}`)
      .send({
        name: 'Test Community'
      })
      .expect(403);
  });
});
```

## Related Documentation

- [Channels API](channels.md)
- [Membership API](membership.md)
- [Messages API](messages.md)
- [RBAC System](../features/auth-rbac.md)
- [Database Schema](../architecture/database.md#community)
- [WebSocket Events](websocket-events.md)