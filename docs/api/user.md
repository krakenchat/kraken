# User API

> **Base URL:** `/api/users`  
> **Controller:** `backend/src/user/user.controller.ts`  
> **Service:** `backend/src/user/user.service.ts`

## Overview

User management API for user registration, profile retrieval, and user search functionality. Handles user creation during registration (public endpoint) and provides authenticated access to user data and search capabilities with RBAC permissions.

## Authentication

- **Mixed:** Registration endpoint is public, all others require authentication  
- **Token Type:** JWT Bearer token
- **Headers:** `Authorization: Bearer <jwt_token>` (except registration)

## Endpoints Summary

| Method | Endpoint | Description | RBAC Permission |
|--------|----------|-------------|-----------------|
| POST | `/` | Register new user (public) | None |
| GET | `/profile` | Get current user profile | None (own profile) |
| PATCH | `/profile` | Update current user profile | None (own profile) |
| GET | `/username/:name` | Get user by username | None |
| GET | `/search` | Search users with query | `READ_USER` |
| GET | `/:id` | Get user by ID | None |
| GET | `/` | List all users (paginated) | `READ_USER` |

---

## POST `/api/users`

**Description:** Registers a new user account. This is a public endpoint that does not require authentication. Uses an invitation code system for registration.

### Request

**Body (JSON):**
```json
{
  "code": "string",           // Required: Invitation code for registration
  "username": "string",       // Required: Unique username
  "password": "string",       // Required: User password (will be hashed)
  "email": "string"           // Optional: User email address
}
```

**Validation Rules:**
- `code` - Required string, must be valid invitation code
- `username` - Required string, must be unique, case-insensitive matching
- `password` - Required string, will be bcrypt hashed before storage
- `email` - Optional string, email format validation

**Example:**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "code": "INVITE_CODE_123",
    "username": "john_doe",
    "password": "securePassword123",
    "email": "john@example.com"
  }' \
  "http://localhost:3001/api/users"
```

### Response

**Success (201):**
```json
{
  "id": "64f7b1234567890abcdef123",
  "username": "john_doe",
  "role": "USER",
  "avatarUrl": null,
  "lastSeen": null,
  "displayName": null
}
```

**Note:** Sensitive fields like `email`, `hashedPassword`, `verified`, and `createdAt` are excluded from response via `@Exclude()` decorator.

**Error Responses:**
- `400 Bad Request` - Invalid invitation code or validation errors
- `409 Conflict` - Username already exists
- `500 Internal Server Error` - Server error

---

## GET `/api/users/profile`

**Description:** Retrieves the current authenticated user's profile information.

### Request

**Headers:**
- `Authorization: Bearer <jwt_token>` (Required)

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/users/profile"
```

### Response

**Success (200):**
```json
{
  "id": "64f7b1234567890abcdef123",
  "username": "john_doe",
  "role": "USER",
  "avatarUrl": "file-id-avatar-123",
  "bannerUrl": "file-id-banner-456",
  "lastSeen": "2024-01-01T12:00:00.000Z",
  "displayName": "John Doe"
}
```

**Note:** `avatarUrl` and `bannerUrl` are file IDs, not direct URLs. Use `/api/file/:fileId` to fetch the actual image with authentication.

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `404 Not Found` - User not found (should not happen with valid token)
- `500 Internal Server Error` - Server error

---

## PATCH `/api/users/profile`

**Description:** Updates the current authenticated user's profile information. Allows updating display name, avatar, and banner. File IDs should be obtained by uploading files first via the file upload endpoint.

### Request

**Headers:**
- `Authorization: Bearer <jwt_token>` (Required)
- `Content-Type: application/json`

**Body (JSON):**
```json
{
  "displayName": "string",  // Optional: User's display name (1-32 chars)
  "avatar": "string",       // Optional: File ID for avatar image
  "banner": "string"        // Optional: File ID for banner image
}
```

**Validation Rules:**
- `displayName` - Optional string, min 1 char, max 32 chars, trimmed
- `avatar` - Optional string, must be valid file ID
- `banner` - Optional string, must be valid file ID
- All fields are optional - send only fields you want to update

**Example:**
```bash
curl -X PATCH \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "John D.",
    "avatar": "64f7b1234567890abcdef789",
    "banner": "64f7b1234567890abcdef012"
  }' \
  "http://localhost:3001/api/users/profile"
```

**Partial Update Example (Display Name Only):**
```bash
curl -X PATCH \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "New Display Name"
  }' \
  "http://localhost:3001/api/users/profile"
```

### Response

**Success (200):**
```json
{
  "id": "64f7b1234567890abcdef123",
  "username": "john_doe",
  "role": "USER",
  "avatarUrl": "64f7b1234567890abcdef789",
  "bannerUrl": "64f7b1234567890abcdef012",
  "lastSeen": "2024-01-01T12:00:00.000Z",
  "displayName": "John D."
}
```

**Error Responses:**
- `400 Bad Request` - Validation errors (displayName too long, etc.)
- `401 Unauthorized` - Invalid or missing token
- `404 Not Found` - User not found
- `500 Internal Server Error` - Server error

**Usage Flow:**
1. User uploads avatar/banner via `POST /api/file-upload` with `resourceType: "USER_AVATAR"` or `"USER_BANNER"`
2. Upload response contains file ID
3. User updates profile with `PATCH /api/users/profile` including the file ID(s)
4. Frontend fetches avatar/banner images via `/api/file/:fileId` with authentication

**Frontend Integration:**
```typescript
// 1. Upload avatar
const avatarFile = await uploadFile(file, {
  resourceType: "USER_AVATAR",
  resourceId: userId,
});

// 2. Update profile
const updatedUser = await updateProfile({
  displayName: "New Name",
  avatar: avatarFile.id,
});

// 3. Display avatar using authenticated image hook
const { blobUrl } = useAuthenticatedImage(updatedUser.avatarUrl);
```

---

## GET `/api/users/username/:name`

**Description:** Retrieves user information by username. Case-sensitive lookup.

### Request

**Path Parameters:**
- `name` (string, required) - Username to look up

**Headers:**
- `Authorization: Bearer <jwt_token>` (Required)

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/users/username/john_doe"
```

### Response

**Success (200):**
```json
{
  "id": "64f7b1234567890abcdef123",
  "username": "john_doe",
  "role": "USER",
  "avatarUrl": "file-id-avatar-123",
  "bannerUrl": "file-id-banner-456",
  "lastSeen": "2024-01-01T12:00:00.000Z",
  "displayName": "John Doe"
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `404 Not Found` - User not found
- `500 Internal Server Error` - Server error

---

## GET `/api/users/search`

**Description:** Searches users by query string with optional community filtering. Supports pagination through limit parameter.

### Request

**Query Parameters:**
```typescript
{
  q: string;                    // Required: Search query string
  communityId?: string;         // Optional: Filter to specific community
  limit?: number;               // Optional: Max results (parsed as int)
}
```

**Headers:**
- `Authorization: Bearer <jwt_token>` (Required)

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/users/search?q=john&communityId=64f7b1234567890abcdef456&limit=10"
```

### Response

**Success (200):**
```json
[
  {
    "id": "64f7b1234567890abcdef123",
    "username": "john_doe",
    "role": "USER",
    "avatarUrl": "file-id-avatar-123",
  "bannerUrl": "file-id-banner-456",
    "lastSeen": "2024-01-01T12:00:00.000Z",
    "displayName": "John Doe"
  },
  {
    "id": "64f7b1234567890abcdef789",
    "username": "john_smith",
    "role": "USER",
    "avatarUrl": null,
    "lastSeen": "2024-01-01T10:30:00.000Z",
    "displayName": "John Smith"
  }
]
```

**Error Responses:**
- `400 Bad Request` - Invalid limit parameter
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `READ_USER`)
- `500 Internal Server Error` - Server error

---

## GET `/api/users/:id`

**Description:** Retrieves user information by user ID.

### Request

**Path Parameters:**
- `id` (string, required) - User ID (MongoDB ObjectId)

**Headers:**
- `Authorization: Bearer <jwt_token>` (Required)

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/users/64f7b1234567890abcdef123"
```

### Response

**Success (200):**
```json
{
  "id": "64f7b1234567890abcdef123",
  "username": "john_doe",
  "role": "USER",
  "avatarUrl": "file-id-avatar-123",
  "bannerUrl": "file-id-banner-456",
  "lastSeen": "2024-01-01T12:00:00.000Z",
  "displayName": "John Doe"
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `404 Not Found` - User not found
- `500 Internal Server Error` - Server error

---

## GET `/api/users`

**Description:** Lists all users with pagination support using continuation tokens.

### Request

**Query Parameters:**
```typescript
{
  limit?: number;               // Optional: Max users per page (parsed as int)
  continuationToken?: string;   // Optional: Token for next page
}
```

**Headers:**
- `Authorization: Bearer <jwt_token>` (Required)

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/users?limit=20"
```

**Next page:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/users?limit=20&continuationToken=eyJpZCI6IjY0ZjdiMTIzNDU2Nzg5MGFiY2RlZjEyMyJ9"
```

### Response

**Success (200):**
```json
{
  "users": [
    {
      "id": "64f7b1234567890abcdef123",
      "username": "john_doe",
      "role": "USER",
      "avatarUrl": "file-id-avatar-123",
  "bannerUrl": "file-id-banner-456",
      "lastSeen": "2024-01-01T12:00:00.000Z",
      "displayName": "John Doe"
    },
    {
      "id": "64f7b1234567890abcdef456",
      "username": "jane_smith",
      "role": "MODERATOR",
      "avatarUrl": null,
      "lastSeen": "2024-01-01T11:30:00.000Z",
      "displayName": "Jane Smith"
    }
  ],
  "continuationToken": "eyJpZCI6IjY0ZjdiMTIzNDU2Nzg5MGFiY2RlZjQ1NiJ9"
}
```

**Last page (no continuation token):**
```json
{
  "users": [
    {
      "id": "64f7b1234567890abcdef789",
      "username": "last_user",
      "role": "USER",
      "avatarUrl": null,
      "lastSeen": "2024-01-01T09:00:00.000Z",
      "displayName": null
    }
  ]
}
```

**Error Responses:**
- `400 Bad Request` - Invalid limit parameter
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `READ_USER`)
- `500 Internal Server Error` - Server error

---

## RBAC Permissions

This API uses Role-Based Access Control. Required permissions:

| Action | Permission | Description |
|--------|------------|-------------|
| Search Users | `READ_USER` | Required for user search functionality |
| List All Users | `READ_USER` | Required for listing all users |
| View Profile/Individual User | None | Users can view individual profiles without special permissions |
| Register | None | Public endpoint for user registration |

### Resource Context

For user search and listing operations:

```typescript
@RbacResource({
  type: RbacResourceType.INSTANCE,
})
```

**Resource Types Used:**
- `INSTANCE` - Instance-level permission check for user operations

## User Entity Structure

### Response Fields (Public)
```typescript
interface UserEntity {
  id: string;                    // MongoDB ObjectId as string
  username: string;              // Unique username
  role: InstanceRole;            // "OWNER" | "USER"
  avatarUrl: string | null;      // Profile picture URL
  lastSeen: Date | null;         // Last activity timestamp
  displayName: string | null;    // Display name (different from username)
}
```

### Excluded Fields (Private)
```typescript
interface UserPrivateFields {
  email: string | null;          // User email (hidden)
  verified: boolean;             // Email verification status (hidden)
  hashedPassword: string;        // bcrypt password hash (hidden)
  createdAt: Date;              // Account creation date (hidden)
}
```

## Error Handling

### Common Error Formats

**Validation Error (400):**
```json
{
  "statusCode": 400,
  "message": [
    "code should not be empty",
    "username should not be empty"
  ],
  "error": "Bad Request"
}
```

**User Not Found (404):**
```json
{
  "statusCode": 404,
  "message": "User not found",
  "error": "Not Found"
}
```

**Permission Denied (403):**
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions. Required: READ_USER",
  "error": "Forbidden"
}
```

**Username Conflict (409):**
```json
{
  "statusCode": 409,
  "message": "Username already exists",
  "error": "Conflict"
}
```

## Usage Examples

### Frontend Integration (RTK Query)

```typescript
// Redux user slice usage
import { useGetProfileQuery, useSearchUsersQuery } from '@/features/user/api/userApi';

function UserProfile() {
  const { data: profile, isLoading } = useGetProfileQuery();
  
  return (
    <div>
      <h1>{profile?.displayName || profile?.username}</h1>
      <p>Role: {profile?.role}</p>
    </div>
  );
}

function UserSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: users } = useSearchUsersQuery({
    q: searchQuery,
    limit: 10
  }, { skip: !searchQuery });
  
  return (
    <div>
      <input 
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search users..."
      />
      {users?.map(user => (
        <div key={user.id}>{user.displayName || user.username}</div>
      ))}
    </div>
  );
}
```

### Registration Flow

```typescript
// User registration
const registerUser = async (userData: CreateUserData) => {
  try {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: userData.inviteCode,
        username: userData.username,
        password: userData.password,
        email: userData.email
      }),
    });
    
    if (response.ok) {
      const newUser = await response.json();
      // Redirect to login or auto-login
      return newUser;
    } else {
      const error = await response.json();
      throw new Error(error.message);
    }
  } catch (error) {
    console.error('Registration failed:', error);
    throw error;
  }
};
```

## Testing

### Endpoint Tests
- **Location:** `backend/src/user/__tests__/user.controller.spec.ts`
- **Coverage:** Registration, profile retrieval, search, RBAC permissions

### Test Examples

```typescript
// Example integration test
describe('User (e2e)', () => {
  it('should register user with valid invite code', () => {
    return request(app.getHttpServer())
      .post('/api/users')
      .send({
        code: validInviteCode,
        username: 'testuser',
        password: 'testpassword',
        email: 'test@example.com'
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBeDefined();
        expect(res.body.username).toBe('testuser');
        expect(res.body.email).toBeUndefined(); // Should be excluded
      });
  });

  it('should search users with READ_USER permission', () => {
    return request(app.getHttpServer())
      .get('/api/users/search?q=test')
      .set('Authorization', `Bearer ${userWithReadPermission}`)
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });
});
```

## Related Documentation

- [Auth API](auth.md)
- [Community API](community.md) 
- [RBAC System](../features/auth-rbac.md)
- [Database Schema](../architecture/database.md#user)
- [Invitation System](../features/instance-invites.md)