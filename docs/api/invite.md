# Invite API

> **Base URL:** `/api/invite`  
> **Controller:** `backend/src/invite/invite.controller.ts`  
> **Service:** `backend/src/invite/invite.service.ts`

## Overview

Instance invitation management API for creating, viewing, and managing invitation codes. Invites allow users to register new accounts and automatically join specified communities. Supports usage limits, expiration dates, and invite tracking for administrative purposes.

## Authentication

- **Required:** ✅ All endpoints require authentication
- **Token Type:** JWT Bearer token
- **Headers:** `Authorization: Bearer <jwt_token>`

## Endpoints Summary

| Method | Endpoint | Description | RBAC Permission |
|--------|----------|-------------|-----------------|
| POST | `/` | Create new invite | `CREATE_INSTANCE_INVITE` |
| GET | `/` | List user's invites | `READ_INSTANCE_INVITE` |
| GET | `/:code` | Get invite by code | `READ_INSTANCE_INVITE` |
| DELETE | `/:code` | Delete invite | `DELETE_INSTANCE_INVITE` |

---

## POST `/api/invite`

**Description:** Creates a new invitation code that can be used for user registration. The invite can specify default communities the user will join, usage limits, and expiration dates.

### Request

**Body (JSON):**
```json
{
  "maxUses": 10,                        // Optional: Maximum number of uses (null for unlimited)
  "validUntil": "2024-12-31T23:59:59Z", // Optional: Expiration date (null for no expiration)
  "communityIds": [                     // Required: Array of community IDs user will auto-join
    "64f7b1234567890abcdef123",
    "64f7b1234567890abcdef456"
  ]
}
```

**Validation Rules:**
- `maxUses` - Optional integer, maximum number of times invite can be used
- `validUntil` - Optional datetime, after which invite becomes invalid  
- `communityIds` - Required array of community IDs that new users will automatically join

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "maxUses": 5,
    "validUntil": "2024-06-01T00:00:00Z",
    "communityIds": ["64f7b1234567890abcdef123"]
  }' \
  "http://localhost:3001/api/invite"
```

**Unlimited Invite Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "communityIds": ["64f7b1234567890abcdef123", "64f7b1234567890abcdef456"]
  }' \
  "http://localhost:3001/api/invite"
```

### Response

**Success (201):**
```json
{
  "id": "64f7b1234567890abcdef789",
  "code": "INVITE_ABC123XYZ",
  "createdById": "64f7b1234567890abcdef012",
  "defaultCommunityId": [
    "64f7b1234567890abcdef123"
  ],
  "maxUses": 5,
  "uses": 0,
  "validUntil": "2024-06-01T00:00:00.000Z",
  "createdAt": "2024-01-01T12:00:00.000Z",
  "usedByIds": [],
  "disabled": false
}
```

**Error Responses:**
- `400 Bad Request` - Validation errors (invalid community IDs)
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `CREATE_INSTANCE_INVITE`)
- `404 Not Found` - One or more communities not found
- `500 Internal Server Error` - Server error

---

## GET `/api/invite`

**Description:** Lists all invitation codes created by the authenticated user, including usage statistics and status information.

### Request

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/invite"
```

### Response

**Success (200):**
```json
[
  {
    "id": "64f7b1234567890abcdef789",
    "code": "INVITE_ABC123XYZ",
    "createdById": "64f7b1234567890abcdef012",
    "defaultCommunityId": [
      "64f7b1234567890abcdef123"
    ],
    "maxUses": 5,
    "uses": 2,
    "validUntil": "2024-06-01T00:00:00.000Z",
    "createdAt": "2024-01-01T12:00:00.000Z",
    "usedByIds": [
      "64f7b1234567890abcdef345",
      "64f7b1234567890abcdef678"
    ],
    "disabled": false
  },
  {
    "id": "64f7b1234567890abcdef012",
    "code": "INVITE_XYZ789ABC",
    "createdById": "64f7b1234567890abcdef012",
    "defaultCommunityId": [
      "64f7b1234567890abcdef123",
      "64f7b1234567890abcdef456"
    ],
    "maxUses": null,
    "uses": 15,
    "validUntil": null,
    "createdAt": "2024-01-01T10:00:00.000Z",
    "usedByIds": [
      "64f7b1234567890abcdef901",
      "64f7b1234567890abcdef902"
      // ... additional user IDs truncated for display
    ],
    "disabled": false
  }
]
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `READ_INSTANCE_INVITE`)
- `500 Internal Server Error` - Server error

---

## GET `/api/invite/:code`

**Description:** Retrieves detailed information about a specific invitation code, including usage history and validity status.

### Request

**Path Parameters:**
- `code` (string, required) - Invitation code to look up

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/invite/INVITE_ABC123XYZ"
```

### Response

**Success (200):**
```json
{
  "id": "64f7b1234567890abcdef789",
  "code": "INVITE_ABC123XYZ",
  "createdById": "64f7b1234567890abcdef012",
  "createdBy": {
    "id": "64f7b1234567890abcdef012",
    "username": "admin_user",
    "displayName": "Admin User"
  },
  "defaultCommunityId": [
    "64f7b1234567890abcdef123"
  ],
  "maxUses": 5,
  "uses": 2,
  "validUntil": "2024-06-01T00:00:00.000Z",
  "createdAt": "2024-01-01T12:00:00.000Z",
  "usedByIds": [
    "64f7b1234567890abcdef345",
    "64f7b1234567890abcdef678"
  ],
  "disabled": false
}
```

**Invite Not Found (null response):**
```json
null
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `READ_INSTANCE_INVITE`)
- `500 Internal Server Error` - Server error

---

## DELETE `/api/invite/:code`

**Description:** Deletes (disables) an invitation code, preventing it from being used for new registrations. Only the creator of the invite can delete it.

### Request

**Path Parameters:**
- `code` (string, required) - Invitation code to delete

**Example:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/invite/INVITE_ABC123XYZ"
```

### Response

**Success (200):**
```
No content (void response)
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions or not invite creator
- `404 Not Found` - Invite code not found
- `500 Internal Server Error` - Server error

---

## Invite Code System

### Code Generation
- **Format:** Alphanumeric codes (e.g., `INVITE_ABC123XYZ`)
- **Uniqueness:** Each code is globally unique across the instance
- **Security:** Codes are randomly generated to prevent guessing

### Usage Tracking
- **Uses Counter:** Tracks how many times the invite has been used
- **Used By:** Array of user IDs who registered with this invite
- **Max Uses:** Optional limit on total usage (null for unlimited)

### Validity Checks
- **Expiration:** `validUntil` date check (null for no expiration)
- **Usage Limit:** Check against `maxUses` if specified
- **Disabled Status:** Manual disable flag for administrative control

## Registration Integration

### User Registration Flow
1. **User Registration:** New users provide invite code during registration
2. **Invite Validation:** System validates code is active and within limits
3. **Account Creation:** User account is created if invite is valid
4. **Auto-Join Communities:** User automatically joins specified communities
5. **Usage Update:** Invite usage counter is incremented

### Community Auto-Join
- **Default Communities:** Users automatically become members of `defaultCommunityId` communities
- **Membership Creation:** Automatic membership records created for specified communities
- **Role Assignment:** Users receive default role permissions in auto-joined communities

## RBAC Permissions

This API uses Role-Based Access Control with instance-level permissions:

| Action | Permission | Description |
|--------|------------|-------------|
| Create | `CREATE_INSTANCE_INVITE` | Create new invitation codes |
| Read | `READ_INSTANCE_INVITE` | View invitation information |
| Delete | `DELETE_INSTANCE_INVITE` | Delete/disable invitations |

### Resource Context
All invite operations are instance-level (no specific resource context required):

```typescript
// No @RbacResource decorator needed - instance-level permissions
@RequiredActions(RbacActions.CREATE_INSTANCE_INVITE)
```

### Ownership Rules
- **Creation:** Any user with `CREATE_INSTANCE_INVITE` permission can create invites
- **Viewing:** Users can view invites they created (filtered by `createdById`)
- **Deletion:** Only invite creators can delete their own invites

## Error Handling

### Common Error Formats

**Validation Error (400):**
```json
{
  "statusCode": 400,
  "message": [
    "communityIds should not be empty",
    "maxUses must be a positive integer"
  ],
  "error": "Bad Request"
}
```

**Invite Not Found (404):**
```json
{
  "statusCode": 404,
  "message": "Invite with code INVITE_ABC123XYZ not found",
  "error": "Not Found"
}
```

**Permission Denied (403):**
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions. Required: CREATE_INSTANCE_INVITE",
  "error": "Forbidden"
}
```

**Expired/Invalid Invite (400):**
```json
{
  "statusCode": 400,
  "message": "Invite code is expired or has reached maximum usage",
  "error": "Bad Request"
}
```

## Usage Examples

### Frontend Integration (RTK Query)

```typescript
// Redux invite slice usage
import { useInviteApi } from '@/features/invite/api/inviteApi';

function InviteManagement() {
  const { data: invites, isLoading } = useInviteApi.useGetInvitesQuery();
  const [createInvite] = useInviteApi.useCreateInviteMutation();
  const [deleteInvite] = useInviteApi.useDeleteInviteMutation();
  
  const handleCreateInvite = async (inviteData: CreateInviteData) => {
    try {
      const newInvite = await createInvite(inviteData).unwrap();
      console.log('Invite created:', newInvite.code);
    } catch (error) {
      console.error('Failed to create invite:', error);
    }
  };
  
  const handleDeleteInvite = async (code: string) => {
    try {
      await deleteInvite(code).unwrap();
    } catch (error) {
      console.error('Failed to delete invite:', error);
    }
  };
}

function InviteValidation({ code }: { code: string }) {
  const { data: invite } = useInviteApi.useGetInviteQuery(code);
  
  const isValid = invite && 
    (!invite.validUntil || new Date(invite.validUntil) > new Date()) &&
    (!invite.maxUses || invite.uses < invite.maxUses) &&
    !invite.disabled;
  
  return (
    <div>
      {isValid ? 'Valid invite code' : 'Invalid or expired invite code'}
    </div>
  );
}
```

### Direct API Calls

```typescript
// Create invite with community auto-join
const createInvite = async (communityIds: string[], maxUses?: number, validUntil?: string) => {
  const response = await fetch('/api/invite', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      communityIds,
      maxUses,
      validUntil
    }),
  });
  
  const invite = await response.json();
  return invite.code; // Return the generated code
};

// Validate invite during registration
const validateInviteCode = async (code: string) => {
  const response = await fetch(`/api/invite/${code}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  const invite = await response.json();
  
  if (!invite) {
    throw new Error('Invalid invite code');
  }
  
  // Check validity
  if (invite.validUntil && new Date(invite.validUntil) < new Date()) {
    throw new Error('Invite code has expired');
  }
  
  if (invite.maxUses && invite.uses >= invite.maxUses) {
    throw new Error('Invite code has reached maximum usage');
  }
  
  if (invite.disabled) {
    throw new Error('Invite code has been disabled');
  }
  
  return invite;
};
```

## Testing

### Endpoint Tests
- **Location:** `backend/src/invite/__tests__/invite.controller.spec.ts`
- **Coverage:** CRUD operations, validation, expiration logic, usage tracking

### Test Examples

```typescript
// Example integration test
describe('Invite (e2e)', () => {
  it('should create invite with community auto-join', () => {
    return request(app.getHttpServer())
      .post('/api/invite')
      .set('Authorization', `Bearer ${tokenWithCreatePermission}`)
      .send({
        maxUses: 3,
        communityIds: [validCommunityId]
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.code).toBeDefined();
        expect(res.body.maxUses).toBe(3);
        expect(res.body.defaultCommunityId).toContain(validCommunityId);
      });
  });

  it('should validate invite usage limits', async () => {
    // Create invite with maxUses: 1
    const invite = await createTestInvite({ maxUses: 1 });
    
    // Use invite once
    await useInviteForRegistration(invite.code);
    
    // Attempt to use again should fail
    await expect(useInviteForRegistration(invite.code))
      .rejects.toThrow('maximum usage');
  });
});
```

## Related Documentation

- [User API](user.md) - User registration with invites
- [Community API](community.md) - Auto-join communities
- [Membership API](membership.md) - Auto-membership creation
- [RBAC System](../features/auth-rbac.md)
- [Instance Invites](../features/instance-invites.md)
- [Database Schema](../architecture/database.md#instanceinvite)