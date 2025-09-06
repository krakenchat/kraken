# Auth API

> **Base URL:** `/api/auth`  
> **Controller:** `backend/src/auth/auth.controller.ts`  
> **Service:** `backend/src/auth/auth.service.ts`

## Overview

Authentication API managing user login, logout, and token refresh functionality. Uses JWT access tokens with HTTP-only refresh token cookies for secure session management. Implements rate limiting to prevent brute force attacks.

## Authentication

- **Required:** ❌ Login endpoint does not require authentication (by design)
- **Token Type:** JWT Bearer token (generated after successful login)  
- **Headers:** `Authorization: Bearer <jwt_token>` (for protected endpoints)

## Endpoints Summary

| Method | Endpoint | Description | RBAC Permission | Rate Limit |
|--------|----------|-------------|-----------------|------------|
| POST | `/login` | Authenticate user with username/password | None | 4/sec, 10/min |
| POST | `/refresh` | Refresh access token using refresh cookie | None | 4/sec, 10/min |
| POST | `/logout` | Logout and invalidate refresh token | None | 2/sec, 5/min |

---

## POST `/api/auth/login`

**Description:** Authenticates a user with username/password credentials and returns JWT access token. Sets HTTP-only refresh token cookie for token renewal.

### Request

**Body (JSON):**
```json
{
  "username": "string",     // Required: Username (case-insensitive)
  "password": "string"      // Required: User password
}
```

**Validation Rules:**
- `username` - Required string, converted to lowercase
- `password` - Required string, validated against bcrypt hash

**Example:**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "password": "securePassword123"
  }' \
  "http://localhost:3001/api/auth/login"
```

### Response

**Success (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response Headers:**
```
Set-Cookie: refresh_token=<refresh_jwt>; HttpOnly; Path=/; Max-Age=2592000; SameSite=true
```

**Error Responses:**
- `401 Unauthorized` - Invalid username/password combination
- `429 Too Many Requests` - Rate limit exceeded (4 requests per second, 10 per minute)
- `500 Internal Server Error` - Server error

---

## POST `/api/auth/refresh`

**Description:** Generates new access token using the refresh token from HTTP-only cookie. Implements token rotation by invalidating the old refresh token and issuing a new one.

### Request

**Cookies:**
- `refresh_token` (Required) - HTTP-only refresh token cookie

**Example:**
```bash
curl -X POST \
  -H "Cookie: refresh_token=<refresh_jwt_token>" \
  "http://localhost:3001/api/auth/refresh"
```

### Response

**Success (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response Headers:**
```
Set-Cookie: refresh_token=<new_refresh_jwt>; HttpOnly; Path=/; Max-Age=2592000; SameSite=true
```

**Error Responses:**
- `401 Unauthorized` - Missing, invalid, or expired refresh token
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

---

## POST `/api/auth/logout`

**Description:** Logs out the user by invalidating the refresh token in the database and clearing the refresh token cookie.

### Request

**Cookies:**
- `refresh_token` (Optional) - HTTP-only refresh token cookie

**Example:**
```bash
curl -X POST \
  -H "Cookie: refresh_token=<refresh_jwt_token>" \
  "http://localhost:3001/api/auth/logout"
```

### Response

**Success (200):**
```json
{
  "message": "Logged out successfully"
}
```

**Response Headers:**
```
Set-Cookie: refresh_token=; HttpOnly; Path=/; Max-Age=0
```

**Error Responses:**
- `429 Too Many Requests` - Rate limit exceeded (2 requests per second, 5 per minute)
- `500 Internal Server Error` - Server error

---

## JWT Token Structure

### Access Token Payload
```typescript
{
  "username": "string",     // User's username
  "sub": "string",          // User ID (subject)
  "role": "InstanceRole",   // User's instance role (ADMIN, MODERATOR, USER)
  "iat": number,            // Issued at timestamp
  "exp": number             // Expiration timestamp
}
```

### Refresh Token
- **Storage:** HTTP-only cookie named `refresh_token`
- **Lifetime:** 30 days (2,592,000 seconds)
- **Security:** Secure flag in production, SameSite protection
- **Rotation:** New refresh token issued on each refresh request

## Rate Limiting

### Login Endpoint
- **Short Burst:** 4 requests per second
- **Long Window:** 10 requests per minute
- **Headers:** Rate limit info in response headers

### Refresh Endpoint  
- **Short Burst:** 4 requests per second
- **Long Window:** 10 requests per minute

### Logout Endpoint
- **Short Burst:** 2 requests per second  
- **Long Window:** 5 requests per minute

## Security Features

### Password Security
- **Hashing:** bcrypt with salt rounds
- **Validation:** Constant-time comparison to prevent timing attacks

### Token Security
- **Access Token:** Short-lived JWT (configurable expiration)
- **Refresh Token:** Long-lived, stored in database with JTI for revocation
- **Cookie Security:** HTTP-only, SameSite, Secure in production

### Refresh Token Management
- **Database Storage:** Tokens stored with JTI for validation and revocation
- **Transaction Safety:** Token operations wrapped in database transactions
- **Automatic Cleanup:** Expired tokens cleaned up via scheduled tasks

## Error Handling

### Common Error Formats

**Authentication Failure (401):**
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

**Rate Limit Exceeded (429):**
```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests"
}
```

**Missing Refresh Token (401):**
```json
{
  "statusCode": 401,
  "message": "No refresh token provided",
  "error": "Unauthorized"
}
```

## Usage Examples

### Frontend Integration (RTK Query)

```typescript
// Redux auth slice usage
import { useLoginMutation, useRefreshMutation } from '@/features/auth/api/authApi';

function LoginComponent() {
  const [login, { isLoading, error }] = useLoginMutation();
  
  const handleLogin = async (credentials: LoginCredentials) => {
    try {
      const { accessToken } = await login(credentials).unwrap();
      // Store access token in memory or secure storage
      localStorage.setItem('accessToken', accessToken);
    } catch (error) {
      // Handle authentication error
      console.error('Login failed:', error);
    }
  };
}

// Automatic token refresh
function useTokenRefresh() {
  const [refresh] = useRefreshMutation();
  
  const refreshToken = async () => {
    try {
      const { accessToken } = await refresh().unwrap();
      return accessToken;
    } catch (error) {
      // Redirect to login
      window.location.href = '/login';
    }
  };
}
```

### Direct HTTP Calls

```typescript
// Login request
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    username: 'john_doe',
    password: 'securePassword123'
  }),
});

const { accessToken } = await loginResponse.json();

// Refresh token request  
const refreshResponse = await fetch('/api/auth/refresh', {
  method: 'POST',
  credentials: 'include', // Include cookies
});

// Logout request
const logoutResponse = await fetch('/api/auth/logout', {
  method: 'POST',
  credentials: 'include',
});
```

## Testing

### Endpoint Tests
- **Location:** `backend/src/auth/__tests__/auth.controller.spec.ts`
- **Coverage:** Authentication flows, token validation, rate limiting

### Test Examples

```typescript
// Example integration test
describe('Auth (e2e)', () => {
  it('should login with valid credentials', () => {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: 'testuser',
        password: 'testpassword'
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.accessToken).toBeDefined();
        expect(res.headers['set-cookie']).toMatch(/refresh_token=/);
      });
  });

  it('should refresh access token', () => {
    return request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', `refresh_token=${validRefreshToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.accessToken).toBeDefined();
      });
  });
});
```

## Related Documentation

- [User Management API](user.md)
- [RBAC System](../features/auth-rbac.md)
- [Database Schema](../architecture/database.md#user)
- [JWT Strategy](../architecture/backend.md#authentication)