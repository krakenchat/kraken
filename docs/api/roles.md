# Roles API

> **Base URL:** `/api/roles`  
> **Controller:** `backend/src/roles/roles.controller.ts`  
> **Service:** `backend/src/roles/roles.service.ts`

## Overview

Role-Based Access Control (RBAC) query API for retrieving user roles and permissions across different resource contexts (instance, community, channel). Provides read-only access to role information for permission checking and UI display. Role management and assignment are handled through administrative interfaces.

## Authentication

- **Required:** ✅ All endpoints require authentication
- **Token Type:** JWT Bearer token
- **Headers:** `Authorization: Bearer <jwt_token>`

## Endpoints Summary

### User's Own Roles

| Method | Endpoint | Description | RBAC Permission |
|--------|----------|-------------|-----------------|
| GET | `/my/instance` | Get current user's instance roles | None |
| GET | `/my/community/:communityId` | Get current user's community roles | None |
| GET | `/my/channel/:channelId` | Get current user's channel roles | None |

### Other Users' Roles (Admin)

| Method | Endpoint | Description | RBAC Permission |
|--------|----------|-------------|-----------------|
| GET | `/user/:userId/instance` | Get user's instance roles | `READ_USER` |
| GET | `/user/:userId/community/:communityId` | Get user's community roles | `READ_MEMBER` |
| GET | `/user/:userId/channel/:channelId` | Get user's channel roles | `READ_MEMBER` |

---

## GET `/api/roles/my/instance`

**Description:** Retrieves the current authenticated user's instance-level roles and permissions. Instance roles control access to global features like user management, community creation, and system administration.

### Request

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/roles/my/instance"
```

### Response

**Success (200):**
```json
{
  "userId": "64f7b1234567890abcdef456",
  "resourceId": null,
  "resourceType": "INSTANCE",
  "roles": [
    {
      "id": "64f7b1234567890abcdef123",
      "name": "ADMIN",
      "actions": [
        "CREATE_USER",
        "DELETE_USER",
        "CREATE_COMMUNITY",
        "DELETE_COMMUNITY",
        "READ_ALL_COMMUNITIES",
        "CREATE_INSTANCE_INVITE",
        "DELETE_INSTANCE_INVITE",
        "READ_INSTANCE_INVITE"
      ],
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Regular User Response:**
```json
{
  "userId": "64f7b1234567890abcdef456",
  "resourceId": null,
  "resourceType": "INSTANCE",
  "roles": [
    {
      "id": "64f7b1234567890abcdef789",
      "name": "USER",
      "actions": [
        "CREATE_COMMUNITY",
        "READ_USER"
      ],
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `500 Internal Server Error` - Server error

---

## GET `/api/roles/my/community/:communityId`

**Description:** Retrieves the current user's roles within a specific community. Community roles control access to community-specific features like channel management, member moderation, and community settings.

### Request

**Path Parameters:**
- `communityId` (string, required) - Community ID (MongoDB ObjectId)

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/roles/my/community/64f7b1234567890abcdef123"
```

### Response

**Success (200):**
```json
{
  "userId": "64f7b1234567890abcdef456",
  "resourceId": "64f7b1234567890abcdef123",
  "resourceType": "COMMUNITY",
  "roles": [
    {
      "id": "64f7b1234567890abcdef789",
      "name": "Community Admin",
      "actions": [
        "UPDATE_COMMUNITY",
        "DELETE_COMMUNITY",
        "CREATE_CHANNEL",
        "UPDATE_CHANNEL",
        "DELETE_CHANNEL",
        "CREATE_MEMBER",
        "DELETE_MEMBER",
        "CREATE_MESSAGE",
        "DELETE_MESSAGE",
        "CREATE_ROLE",
        "UPDATE_ROLE",
        "DELETE_ROLE"
      ],
      "createdAt": "2024-01-01T08:00:00.000Z"
    }
  ]
}
```

**Member Response:**
```json
{
  "userId": "64f7b1234567890abcdef456",
  "resourceId": "64f7b1234567890abcdef123",
  "resourceType": "COMMUNITY",
  "roles": [
    {
      "id": "64f7b1234567890abcdef012",
      "name": "Member",
      "actions": [
        "READ_COMMUNITY",
        "READ_CHANNEL",
        "READ_MEMBER",
        "READ_MESSAGE",
        "CREATE_MESSAGE",
        "DELETE_MESSAGE",
        "CREATE_REACTION",
        "DELETE_REACTION"
      ],
      "createdAt": "2024-01-01T08:00:00.000Z"
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `404 Not Found` - Community not found or user not a member
- `500 Internal Server Error` - Server error

---

## GET `/api/roles/my/channel/:channelId`

**Description:** Retrieves the current user's roles for a specific channel. Channel roles are inherited from community roles but can be overridden for specific channel permissions.

### Request

**Path Parameters:**
- `channelId` (string, required) - Channel ID (MongoDB ObjectId)

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/roles/my/channel/64f7b1234567890abcdef789"
```

### Response

**Success (200):**
```json
{
  "userId": "64f7b1234567890abcdef456",
  "resourceId": "64f7b1234567890abcdef789",
  "resourceType": "CHANNEL",
  "roles": [
    {
      "id": "64f7b1234567890abcdef012",
      "name": "Channel Moderator",
      "actions": [
        "READ_CHANNEL",
        "READ_MESSAGE",
        "CREATE_MESSAGE",
        "UPDATE_MESSAGE",
        "DELETE_MESSAGE",
        "CREATE_MEMBER",
        "DELETE_MEMBER",
        "JOIN_CHANNEL"
      ],
      "createdAt": "2024-01-01T09:00:00.000Z"
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `404 Not Found` - Channel not found or user has no access
- `500 Internal Server Error` - Server error

---

## GET `/api/roles/user/:userId/instance`

**Description:** Retrieves a specific user's instance-level roles. Requires `READ_USER` permission for administrative purposes.

### Request

**Path Parameters:**
- `userId` (string, required) - User ID (MongoDB ObjectId)

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/roles/user/64f7b1234567890abcdef456/instance"
```

### Response

**Success (200):**
```json
{
  "userId": "64f7b1234567890abcdef456",
  "resourceId": null,
  "resourceType": "INSTANCE",
  "roles": [
    {
      "id": "64f7b1234567890abcdef789",
      "name": "USER",
      "actions": [
        "CREATE_COMMUNITY",
        "READ_USER"
      ],
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `READ_USER`)
- `404 Not Found` - User not found
- `500 Internal Server Error` - Server error

---

## GET `/api/roles/user/:userId/community/:communityId`

**Description:** Retrieves a specific user's roles within a community. Requires `READ_MEMBER` permission and community context.

### Request

**Path Parameters:**
- `userId` (string, required) - User ID (MongoDB ObjectId)
- `communityId` (string, required) - Community ID (MongoDB ObjectId)

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/roles/user/64f7b1234567890abcdef456/community/64f7b1234567890abcdef123"
```

### Response

**Success (200):**
```json
{
  "userId": "64f7b1234567890abcdef456",
  "resourceId": "64f7b1234567890abcdef123",
  "resourceType": "COMMUNITY",
  "roles": [
    {
      "id": "64f7b1234567890abcdef012",
      "name": "Moderator",
      "actions": [
        "READ_COMMUNITY",
        "READ_CHANNEL",
        "READ_MEMBER",
        "READ_MESSAGE",
        "CREATE_MESSAGE",
        "DELETE_MESSAGE",
        "CREATE_CHANNEL",
        "UPDATE_CHANNEL",
        "CREATE_MEMBER",
        "DELETE_MEMBER"
      ],
      "createdAt": "2024-01-01T08:00:00.000Z"
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `READ_MEMBER`)
- `404 Not Found` - User, community, or membership not found
- `500 Internal Server Error` - Server error

---

## GET `/api/roles/user/:userId/channel/:channelId`

**Description:** Retrieves a specific user's roles for a channel. Requires `READ_MEMBER` permission and channel context.

---

# ROLE MANAGEMENT ENDPOINTS (NEW)

## GET `/api/roles/community/:communityId`

**Description:** Retrieves all roles (default and custom) for a specific community. Used by role management dashboard to display available roles.

### Request

**Path Parameters:**
- `communityId` (string, required) - Community ID (MongoDB ObjectId)

**RBAC Requirements:**
- Permission: `READ_ROLE`
- Resource: `COMMUNITY`

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/roles/community/64f7b1234567890abcdef123"
```

### Response

**Success (200):**
```json
{
  "communityId": "64f7b1234567890abcdef123",
  "roles": [
    {
      "id": "64f7b1234567890abcdef789",
      "name": "Community Admin",
      "actions": [
        "UPDATE_COMMUNITY",
        "DELETE_COMMUNITY", 
        "CREATE_CHANNEL",
        "UPDATE_CHANNEL",
        "DELETE_CHANNEL",
        "CREATE_MEMBER",
        "DELETE_MEMBER",
        "CREATE_ROLE",
        "UPDATE_ROLE",
        "DELETE_ROLE"
      ],
      "createdAt": "2024-01-01T08:00:00.000Z"
    },
    {
      "id": "64f7b1234567890abcdef012",
      "name": "Custom Moderator",
      "actions": [
        "READ_COMMUNITY",
        "READ_CHANNEL", 
        "CREATE_MESSAGE",
        "DELETE_MESSAGE",
        "CREATE_MEMBER"
      ],
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `READ_ROLE`)
- `404 Not Found` - Community not found
- `500 Internal Server Error` - Server error

---

## POST `/api/roles/community/:communityId`

**Description:** Creates a new custom role within a community. Role names must be unique per community.

### Request

**Path Parameters:**
- `communityId` (string, required) - Community ID (MongoDB ObjectId)

**RBAC Requirements:**
- Permission: `CREATE_ROLE`
- Resource: `COMMUNITY`

**Body Parameters:**
```typescript
{
  name: string;        // Role name (max 50 characters)
  actions: string[];   // Array of RbacActions (min 1 required)
}
```

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Content Moderator",
    "actions": [
      "READ_COMMUNITY",
      "READ_CHANNEL",
      "READ_MESSAGE", 
      "CREATE_MESSAGE",
      "DELETE_MESSAGE",
      "CREATE_REACTION",
      "DELETE_REACTION"
    ]
  }' \
  "http://localhost:3001/api/roles/community/64f7b1234567890abcdef123"
```

### Response

**Success (201):**
```json
{
  "id": "64f7b1234567890abcdef456",
  "name": "Content Moderator",
  "actions": [
    "READ_COMMUNITY",
    "READ_CHANNEL", 
    "READ_MESSAGE",
    "CREATE_MESSAGE",
    "DELETE_MESSAGE",
    "CREATE_REACTION",
    "DELETE_REACTION"
  ],
  "createdAt": "2024-01-20T14:15:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid request body or role name already exists
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions
- `500 Internal Server Error` - Server error

---

## PUT `/api/roles/:roleId`

**Description:** Updates an existing custom role's name and/or permissions. Cannot update default system roles.

### Request

**Path Parameters:**
- `roleId` (string, required) - Role ID (MongoDB ObjectId)

**RBAC Requirements:**
- Permission: `UPDATE_ROLE`

**Body Parameters:**
```typescript
{
  name?: string;        // Optional: New role name
  actions?: string[];   // Optional: New permissions array
}
```

**Example:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Senior Moderator",
    "actions": [
      "READ_COMMUNITY",
      "READ_CHANNEL",
      "READ_MESSAGE",
      "CREATE_MESSAGE", 
      "DELETE_MESSAGE",
      "CREATE_MEMBER",
      "UPDATE_MEMBER"
    ]
  }' \
  "http://localhost:3001/api/roles/64f7b1234567890abcdef456"
```

### Response

**Success (200):**
```json
{
  "id": "64f7b1234567890abcdef456",
  "name": "Senior Moderator", 
  "actions": [
    "READ_COMMUNITY",
    "READ_CHANNEL",
    "READ_MESSAGE",
    "CREATE_MESSAGE",
    "DELETE_MESSAGE", 
    "CREATE_MEMBER",
    "UPDATE_MEMBER"
  ],
  "createdAt": "2024-01-20T14:15:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request` - Cannot update default roles or name conflicts
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Role not found
- `500 Internal Server Error` - Server error

---

## DELETE `/api/roles/:roleId`

**Description:** Deletes a custom role. Cannot delete default system roles or roles with active user assignments.

### Request

**Path Parameters:**
- `roleId` (string, required) - Role ID (MongoDB ObjectId)

**RBAC Requirements:**
- Permission: `DELETE_ROLE`

**Example:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/roles/64f7b1234567890abcdef456"
```

### Response

**Success (204):** No content

**Error Responses:**
- `400 Bad Request` - Cannot delete default roles or roles with active users
- `401 Unauthorized` - Invalid or missing token  
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Role not found
- `500 Internal Server Error` - Server error

---

# USER-ROLE ASSIGNMENT ENDPOINTS (NEW)

## POST `/api/roles/community/:communityId/assign`

**Description:** Assigns a role to a user within a community context.

### Request

**Path Parameters:**
- `communityId` (string, required) - Community ID (MongoDB ObjectId)

**RBAC Requirements:**
- Permission: `UPDATE_MEMBER`
- Resource: `COMMUNITY`

**Body Parameters:**
```typescript
{
  userId: string;   // User ID (MongoDB ObjectId)
  roleId: string;   // Role ID (MongoDB ObjectId)
}
```

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "64f7b1234567890abcdef111",
    "roleId": "64f7b1234567890abcdef456"
  }' \
  "http://localhost:3001/api/roles/community/64f7b1234567890abcdef123/assign"
```

### Response

**Success (201):** No content

**Error Responses:**
- `400 Bad Request` - Invalid user or role IDs
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - User, role, or community not found
- `500 Internal Server Error` - Server error

---

## DELETE `/api/roles/community/:communityId/users/:userId/roles/:roleId`

**Description:** Removes a specific role from a user within a community.

### Request

**Path Parameters:**
- `communityId` (string, required) - Community ID (MongoDB ObjectId)
- `userId` (string, required) - User ID (MongoDB ObjectId)  
- `roleId` (string, required) - Role ID (MongoDB ObjectId)

**RBAC Requirements:**
- Permission: `UPDATE_MEMBER`
- Resource: `COMMUNITY`

**Example:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/roles/community/64f7b1234567890abcdef123/users/64f7b1234567890abcdef111/roles/64f7b1234567890abcdef456"
```

### Response

**Success (204):** No content

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions  
- `404 Not Found` - User role assignment not found
- `500 Internal Server Error` - Server error

---

## GET `/api/roles/:roleId/users`

**Description:** Retrieves all users assigned to a specific role. Supports both community and instance-level roles.

### Request

**Path Parameters:**
- `roleId` (string, required) - Role ID (MongoDB ObjectId)

**Query Parameters:**
- `communityId` (string, optional) - Community ID for community-scoped roles

**RBAC Requirements:**
- Permission: `READ_ROLE`

**Example:**
```bash
# Get users for community role
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/roles/64f7b1234567890abcdef456/users?communityId=64f7b1234567890abcdef123"

# Get users for instance role  
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/roles/64f7b1234567890abcdef456/users"
```

### Response

**Success (200):**
```json
[
  {
    "userId": "64f7b1234567890abcdef111",
    "username": "moderator_user",
    "displayName": "John Moderator"
  },
  {
    "userId": "64f7b1234567890abcdef222", 
    "username": "admin_user",
    "displayName": "Jane Admin"
  }
]
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Role not found
- `500 Internal Server Error` - Server error

---

## GET `/api/roles/user/:userId/channel/:channelId`

**Description:** Retrieves a specific user's roles for a channel. Requires `READ_MEMBER` permission and channel context.

### Request

**Path Parameters:**
- `userId` (string, required) - User ID (MongoDB ObjectId)
- `channelId` (string, required) - Channel ID (MongoDB ObjectId)

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/roles/user/64f7b1234567890abcdef456/channel/64f7b1234567890abcdef789"
```

### Response

**Success (200):**
```json
{
  "userId": "64f7b1234567890abcdef456",
  "resourceId": "64f7b1234567890abcdef789",
  "resourceType": "CHANNEL",
  "roles": [
    {
      "id": "64f7b1234567890abcdef012",
      "name": "Member",
      "actions": [
        "READ_CHANNEL",
        "READ_MESSAGE",
        "CREATE_MESSAGE",
        "CREATE_REACTION",
        "DELETE_REACTION",
        "JOIN_CHANNEL"
      ],
      "createdAt": "2024-01-01T09:00:00.000Z"
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `READ_MEMBER`)
- `404 Not Found` - User, channel, or access not found
- `500 Internal Server Error` - Server error

---

## RBAC System Overview

### Resource Hierarchy
```
INSTANCE (Global)
├── COMMUNITY (Per-community)
└── CHANNEL (Per-channel, inherits from community)
```

### Permission Inheritance
- **Channel Roles:** Inherit from community roles unless specifically overridden
- **Community Roles:** Independent of instance roles
- **Instance Roles:** Global permissions across all resources

### Default Roles

#### Instance Level
- **ADMIN:** Full system administration access
- **USER:** Basic instance access, can create communities

#### Community Level
- **Community Admin:** Full community management
- **Moderator:** Channel and member management
- **Member:** Basic participation rights

#### Channel Level
- **Channel Moderator:** Channel-specific moderation
- **Member:** Basic channel access (inherited from community)

## RBAC Actions

### Complete Actions List
Based on the schema, the system supports 57 granular permissions:

```typescript
enum RbacActions {
  // Deletion Actions
  DELETE_MESSAGE, DELETE_CHANNEL, DELETE_COMMUNITY, DELETE_INVITE,
  DELETE_USER, DELETE_ROLE, DELETE_ALIAS_GROUP, DELETE_ALIAS_GROUP_MEMBER,
  DELETE_INSTANCE_INVITE, DELETE_MEMBER, DELETE_REACTION, DELETE_ATTACHMENT,
  
  // Creation Actions
  CREATE_MESSAGE, CREATE_CHANNEL, CREATE_COMMUNITY, CREATE_INVITE,
  CREATE_USER, CREATE_ROLE, CREATE_ALIAS_GROUP, CREATE_ALIAS_GROUP_MEMBER,
  CREATE_INSTANCE_INVITE, CREATE_MEMBER, CREATE_REACTION, CREATE_ATTACHMENT,
  
  // Join Actions
  JOIN_CHANNEL,
  
  // Read Actions
  READ_MESSAGE, READ_CHANNEL, READ_COMMUNITY, READ_ALL_COMMUNITIES,
  READ_USER, READ_ROLE, READ_ALIAS_GROUP, READ_ALIAS_GROUP_MEMBER,
  READ_INSTANCE_INVITE, READ_MEMBER,
  
  // Update Actions
  UPDATE_COMMUNITY, UPDATE_CHANNEL, UPDATE_USER, UPDATE_ROLE,
  UPDATE_ALIAS_GROUP, UPDATE_ALIAS_GROUP_MEMBER,
  UPDATE_INSTANCE_INVITE, UPDATE_MEMBER
}
```

## RBAC Permissions

This API uses Role-Based Access Control with context-specific resource permissions:

| Action | Permission | Description |
|--------|------------|-------------|
| View Own Roles | None | Users can always view their own roles |
| View Other Users' Instance Roles | `READ_USER` | Admin access to user roles |
| View Other Users' Community Roles | `READ_MEMBER` | Community admin access |
| View Other Users' Channel Roles | `READ_MEMBER` | Channel admin access |

### Resource Context

For community-specific queries:
```typescript
@RbacResource({
  type: RbacResourceType.COMMUNITY,
  idKey: 'communityId',
  source: ResourceIdSource.PARAM
})
```

For channel-specific queries:
```typescript
@RbacResource({
  type: RbacResourceType.CHANNEL,
  idKey: 'channelId',
  source: ResourceIdSource.PARAM
})
```

## Error Handling

### Common Error Formats

**Permission Denied (403):**
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions. Required: READ_USER",
  "error": "Forbidden"
}
```

**Resource Not Found (404):**
```json
{
  "statusCode": 404,
  "message": "Community with ID 64f7b1234567890abcdef123 not found",
  "error": "Not Found"
}
```

**User Not Member (404):**
```json
{
  "statusCode": 404,
  "message": "User is not a member of this community",
  "error": "Not Found"
}
```

## Usage Examples

### Frontend Integration (RTK Query)

```typescript
// Redux roles slice usage
import { useRolesApi } from '@/features/roles/api/rolesApi';

function UserPermissions() {
  const { data: instanceRoles } = useRolesApi.useGetMyInstanceRolesQuery();
  
  const hasInstancePermission = (action: RbacActions): boolean => {
    return instanceRoles?.roles.some(role => 
      role.actions.includes(action)
    ) || false;
  };
  
  const canCreateCommunity = hasInstancePermission('CREATE_COMMUNITY');
  const isInstanceAdmin = hasInstancePermission('DELETE_USER');
  
  return (
    <div>
      {canCreateCommunity && <CreateCommunityButton />}
      {isInstanceAdmin && <AdminPanel />}
    </div>
  );
}

function CommunityPermissions({ communityId }: { communityId: string }) {
  const { data: communityRoles } = useRolesApi.useGetMyCommunityRolesQuery(communityId);
  
  const hasCommunityPermission = (action: RbacActions): boolean => {
    return communityRoles?.roles.some(role => 
      role.actions.includes(action)
    ) || false;
  };
  
  return (
    <div>
      {hasCommunityPermission('CREATE_CHANNEL') && <CreateChannelButton />}
      {hasCommunityPermission('DELETE_MEMBER') && <MemberManagement />}
    </div>
  );
}

function PermissionChecker({ userId, communityId }: { userId: string; communityId: string }) {
  const { data: userRoles } = useRolesApi.useGetUserCommunityRolesQuery({
    userId,
    communityId
  });
  
  return (
    <div>
      <h3>User Permissions</h3>
      <ul>
        {userRoles?.roles.flatMap(role => role.actions).map(action => (
          <li key={action}>{action}</li>
        ))}
      </ul>
    </div>
  );
}
```

### Permission Checking Utility

```typescript
// Permission checking utility
class PermissionChecker {
  private roles: Map<string, RoleDto[]> = new Map();
  
  async loadUserRoles(userId: string, communityId?: string, channelId?: string) {
    const endpoints = [
      `/api/roles/user/${userId}/instance`,
      communityId && `/api/roles/user/${userId}/community/${communityId}`,
      channelId && `/api/roles/user/${userId}/channel/${channelId}`
    ].filter(Boolean);
    
    const responses = await Promise.all(
      endpoints.map(endpoint => 
        fetch(endpoint, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json())
      )
    );
    
    const allRoles = responses.flatMap(response => response.roles);
    this.roles.set(`${userId}-${communityId || 'instance'}-${channelId || ''}`, allRoles);
  }
  
  hasPermission(
    userId: string, 
    action: RbacActions, 
    communityId?: string, 
    channelId?: string
  ): boolean {
    const key = `${userId}-${communityId || 'instance'}-${channelId || ''}`;
    const userRoles = this.roles.get(key) || [];
    
    return userRoles.some(role => role.actions.includes(action));
  }
  
  getUserActions(userId: string, communityId?: string, channelId?: string): RbacActions[] {
    const key = `${userId}-${communityId || 'instance'}-${channelId || ''}`;
    const userRoles = this.roles.get(key) || [];
    
    return [...new Set(userRoles.flatMap(role => role.actions))];
  }
}
```

## Testing

### Endpoint Tests
- **Location:** `backend/src/roles/__tests__/roles.controller.spec.ts`
- **Coverage:** Role retrieval, permission inheritance, RBAC enforcement

### Test Examples

```typescript
// Example integration test
describe('Roles (e2e)', () => {
  it('should return user instance roles', () => {
    return request(app.getHttpServer())
      .get('/api/roles/my/instance')
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.userId).toBeDefined();
        expect(res.body.resourceType).toBe('INSTANCE');
        expect(Array.isArray(res.body.roles)).toBe(true);
      });
  });

  it('should enforce READ_USER permission for other users', () => {
    return request(app.getHttpServer())
      .get(`/api/roles/user/${otherUserId}/instance`)
      .set('Authorization', `Bearer ${tokenWithoutReadUserPermission}`)
      .expect(403);
  });

  it('should return community-specific roles', () => {
    return request(app.getHttpServer())
      .get(`/api/roles/my/community/${communityId}`)
      .set('Authorization', `Bearer ${communityMemberToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.resourceType).toBe('COMMUNITY');
        expect(res.body.resourceId).toBe(communityId);
      });
  });
});
```

## Related Documentation

### Core System Integration
- **[RBAC System](../features/auth-rbac.md)** - Complete RBAC implementation guide
- **[Roles Backend Module](../modules/auth/roles.md)** - Backend service implementation and business logic

### Frontend Integration
- **[Roles State Management](../state/rolesApi.md)** - RTK Query API slice for role management
- **[RoleEditor Component](../components/community/RoleEditor.md)** - Role creation and editing interface
- **[RoleAssignmentDialog Component](../components/community/RoleAssignmentDialog.md)** - User-role assignment dialog
- **[RoleManagement Component](../components/community/RoleManagement.md)** - Complete role management dashboard

### Related APIs
- **[Auth API](auth.md)** - Authentication system integration
- **[User API](user.md)** - User management endpoints
- **[Community API](community.md)** - Community management with role integration
- **[Channels API](channels.md)** - Channel permissions and access control

### System Documentation
- **[Database Schema](../architecture/database.md#roles)** - Role system data models
- **[RBAC Actions Constants](../constants/rbacActions.md)** - Permission definitions and labels