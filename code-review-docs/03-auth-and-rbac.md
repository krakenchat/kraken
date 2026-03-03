# 03 — Authentication & Authorization Deep Dive

> JWT auth with token family rotation, RBAC with 50 granular actions, WebSocket auth, rate limiting.

---

## Table of Contents

- [JWT Flow](#jwt-flow)
- [Token Refresh & Reuse Detection](#token-refresh--reuse-detection)
- [Guard Chain](#guard-chain)
- [RBAC System](#rbac-system)
- [Default Roles](#default-roles)
- [WebSocket Authentication](#websocket-authentication)
- [Rate Limiting](#rate-limiting)
- [File Access Authentication](#file-access-authentication)
- [Platform-Specific Auth](#platform-specific-auth)
- [Password Security](#password-security)
- [Session Management](#session-management)

---

## JWT Flow

### Login

```
POST /auth/login (username, password)
    │
    ├─ 1. LocalAuthGuard → LocalStrategy.validate()
    │      └─ Lowercase username
    │      └─ Find user by username
    │      └─ bcrypt.compare(password, hash)
    │      └─ Timing-safe: always runs compare even if user not found
    │
    ├─ 2. AuthService.login()
    │      └─ Generate access token (JWT, 1h TTL)
    │      └─ Payload: { username, sub: userId, role: InstanceRole, jti: uuid }
    │
    ├─ 3. AuthService.generateRefreshToken()
    │      └─ Generate refresh token (JWT, 30d TTL)
    │      └─ Hash with bcrypt, store in RefreshToken table
    │      └─ Record: familyId, deviceName, userAgent, ipAddress
    │
    └─ 4. Response
           ├─ Browser: { accessToken } + httpOnly cookies
           └─ Electron: { accessToken, refreshToken } in body
```

### Token Payload

```typescript
{
  username: string;
  sub: string;        // User ID
  role: InstanceRole;  // OWNER or USER
  jti: string;        // JWT ID (for revocation)
}
```

### Cookie Configuration

| Cookie | httpOnly | sameSite | secure | maxAge |
|--------|---------|----------|--------|--------|
| `access_token` | true | lax | prod only | 1h |
| `refresh_token` | true | strict | prod only | 30d |

### JWT Extraction Order (JwtStrategy)

1. `Authorization: Bearer <token>` header
2. `access_token` httpOnly cookie
3. WebSocket handshake query param or header

---

## Token Refresh & Reuse Detection

Implements RFC 9700 token rotation with family-based reuse detection.

```
POST /auth/refresh (refreshToken from cookie or body)
    │
    ├─ 1. Verify refresh token JWT signature
    │
    ├─ 2. Find token in DB by JTI
    │      └─ Validate not expired
    │      └─ bcrypt.compare(presented, stored hash)
    │
    ├─ 3. Check consumed flag
    │      ├─ NOT consumed → normal rotation
    │      │   └─ Mark old token consumed (consumed: true, consumedAt: now)
    │      │   └─ Issue new access + refresh token (same familyId)
    │      │
    │      └─ CONSUMED → SECURITY BREACH
    │          └─ Entire familyId invalidated (all tokens deleted)
    │          └─ Return 401 "Token reuse detected"
    │
    └─ 4. Token cleanup cron (daily 6 AM)
           └─ Delete expired tokens
           └─ Keep consumed tokens 7 days for detection window
```

> **Review Point:** Token family invalidation is the nuclear option — if a user has multiple tabs open and they all try to refresh simultaneously, one will succeed and the others will invalidate the family. The frontend should serialize refresh requests (the API client interceptor does this via a shared promise).

### Token Blacklist (Redis)

On logout, the access token's JTI is added to Redis with a TTL matching the token's remaining lifetime. `JwtStrategy.validate()` checks the blacklist before allowing requests.

```
Redis key: token:blacklist:{jti}
TTL: remaining token lifetime (auto-expires)
```

---

## Guard Chain

### HTTP Request Guard Order

```
Request arrives
    │
    ├─ 1. JwtAuthGuard (global)
    │      ├─ Check @Public() decorator → skip if present
    │      ├─ Extract JWT from header/cookie
    │      ├─ Validate signature and expiry
    │      ├─ Check Redis blacklist
    │      └─ Attach user to request (req.user)
    │
    ├─ 2. ThrottlerGuard (global)
    │      └─ Rate limit check (short/medium/long windows)
    │
    ├─ 3. RbacGuard (per-route, via @RequiredActions)
    │      ├─ No actions required → allow
    │      ├─ User is OWNER → automatically allow
    │      ├─ Resolve resource context from @RbacResource
    │      ├─ Load user's roles for resource
    │      └─ Check all required actions present → allow or 403
    │
    └─ 4. Optional: MessageOwnershipGuard, FileAuthGuard, FileAccessGuard
```

### All Guards

| Guard | File | Scope | Purpose |
|-------|------|-------|---------|
| `JwtAuthGuard` | `auth/jwt-auth.guard.ts` | Global HTTP | Validates JWT, skips `@Public()` |
| `WsJwtAuthGuard` | `auth/ws-jwt-auth.guard.ts` | WS handlers | Validates WS handshake JWT |
| `RbacGuard` | `auth/rbac.guard.ts` | Per-route | Checks role permissions |
| `OptionalJwtAuthGuard` | `auth/optional-jwt-auth.guard.ts` | Specific routes | Allows null user (no 401) |
| `MessageOwnershipGuard` | `auth/message-ownership.guard.ts` | Message edit/delete | Author check, mod fallback |
| `WsThrottleGuard` | `auth/ws-throttle.guard.ts` | WS handlers | 50 events/10s per connection |
| `ThrottlerGuard` | NestJS Throttler | Global HTTP | Multi-window rate limiting |
| `FileAuthGuard` | `file/file-auth.guard.ts` | File downloads | Signed URL or JWT |
| `FileAccessGuard` | `file/file-access.guard.ts` | File downloads | Resource-level access |

---

## RBAC System

### Decorator Usage Pattern

```typescript
@Controller('channels')
export class ChannelsController {

  @Post()
  @RequiredActions(RbacActions.CREATE_CHANNEL)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.BODY,
  })
  create(@Body() dto: CreateChannelDto) { ... }
}
```

### Resource Types

| Type | Resolved From | Permission Scope |
|------|--------------|------------------|
| `COMMUNITY` | Direct ID | Community roles |
| `CHANNEL` | Fetch channel → get communityId | Community roles + private check |
| `MESSAGE` | Fetch message → channel → community | Community roles |
| `INSTANCE` | — | Instance roles |
| `DM_GROUP` | Verify user membership | All actions granted if member |
| `ALIAS_GROUP` | Fetch group → community | Community roles |

### Resource ID Sources

| Source | Extraction |
|--------|-----------|
| `BODY` | `req.body[idKey]` |
| `PARAM` | `req.params[idKey]` |
| `QUERY` | `req.query[idKey]` |
| `PAYLOAD` | WS message payload (object) |
| `TEXT_PAYLOAD` | WS message payload (string) |

### RbacGuard Permission Check Flow

```
verifyActionsForUserAndResource(userId, resourceId, resourceType, actions[])
    │
    ├─ No actions required → allow
    │
    ├─ User.role === OWNER → allow (super-admin bypass)
    │
    ├─ INSTANCE resource
    │   └─ Load instance roles (isInstanceRole: true)
    │   └─ Check all actions present in role.actions[]
    │
    ├─ COMMUNITY resource
    │   └─ Resolve communityId from resource type
    │   │   ├─ COMMUNITY → direct
    │   │   ├─ CHANNEL → fetch channel.communityId
    │   │   ├─ MESSAGE → fetch message → channel.communityId
    │   │   ├─ DM_GROUP → verify membership → grant all
    │   │   └─ ALIAS_GROUP → fetch group.communityId
    │   │
    │   ├─ Private channel check
    │   │   └─ If channel isPrivate → verify ChannelMembership exists
    │   │
    │   └─ Load community roles (communityId, isInstanceRole: false)
    │       └─ Check all actions present in role.actions[]
    │
    └─ Fail → throw ForbiddenException
```

> **Review Point:** The OWNER bypass means the instance owner can do anything without role assignments. This is intentional for self-hosted setups where the admin needs full control, but it means there's no way to restrict the owner's access.

---

## Default Roles

### Instance Roles

| Role | Actions | Purpose |
|------|---------|---------|
| **Instance Admin** | 12 actions | Full instance control (settings, users, storage) |
| **Community Creator** | 45 actions | Create and fully manage communities |
| **User Manager** | 5 actions | Support staff (user CRUD, storage) |
| **Invite Manager** | 4 actions | Instance invite CRUD |

### Community Roles (Created per community)

| Role | Actions | Purpose |
|------|---------|---------|
| **Community Admin** | 37 actions | Full community management |
| **Moderator** | 26 actions | Moderation (no unban, no logs access) |
| **Member** | 12 actions | Basic read + message + voice |

### All 50 RBAC Actions

**CRUD Operations:**
```
CREATE_*:  MESSAGE, CHANNEL, COMMUNITY, INVITE, ROLE, ALIAS_GROUP,
           ALIAS_GROUP_MEMBER, INSTANCE_INVITE, MEMBER, REACTION

READ_*:    MESSAGE, CHANNEL, COMMUNITY, ALL_COMMUNITIES, USER, ROLE,
           ALIAS_GROUP, ALIAS_GROUP_MEMBER, INSTANCE_INVITE, MEMBER,
           INSTANCE_SETTINGS, INSTANCE_STATS

UPDATE_*:  COMMUNITY, CHANNEL, USER, ROLE, ALIAS_GROUP,
           ALIAS_GROUP_MEMBER, INSTANCE_INVITE, MEMBER, INSTANCE_SETTINGS

DELETE_*:  MESSAGE, CHANNEL, COMMUNITY, INVITE, USER, ROLE, ALIAS_GROUP,
           ALIAS_GROUP_MEMBER, INSTANCE_INVITE, MEMBER, REACTION
```

**Moderation:**
```
BAN_USER, KICK_USER, TIMEOUT_USER, UNBAN_USER
PIN_MESSAGE, UNPIN_MESSAGE, DELETE_ANY_MESSAGE
VIEW_BAN_LIST, VIEW_MODERATION_LOGS
MUTE_PARTICIPANT
```

**Misc:**
```
JOIN_CHANNEL, CAPTURE_REPLAY, MANAGE_USER_STORAGE
```

---

## WebSocket Authentication

### Connection Flow

```
Client connects
    │
    ├─ 1. Connection Rate Limiting (RoomsGateway middleware)
    │      └─ 10 connections per 60s per IP
    │
    ├─ 2. Auth Middleware (RoomsGateway)
    │      └─ Extract token from handshake (query ?token= or header)
    │      └─ Verify JWT
    │      └─ Attach user to socket.handshake.user
    │
    ├─ 3. WsJwtAuthGuard (per handler)
    │      └─ Re-validates token from handshake (backup check)
    │
    ├─ 4. RbacGuard (per handler, if @RequiredActions present)
    │      └─ Extracts user from handshake
    │      └─ Checks permissions against resource
    │
    └─ 5. WsThrottleGuard (per handler)
           └─ 50 events per 10 seconds per connection
```

### Token Refresh on WS

The Socket.IO client uses a callback-based auth that fetches the latest token on each reconnection:

```typescript
auth: (cb) => cb({ token: `Bearer ${getAccessToken()}` })
```

If the server emits `AUTH_FAILED`, the frontend SocketProvider attempts a token refresh and reconnects.

---

## Rate Limiting

### HTTP (ThrottlerGuard)

| Window | Limit | Period |
|--------|-------|--------|
| Short | 20 requests | 1 second |
| Medium | 100 requests | 10 seconds |
| Long | 500 requests | 60 seconds |

### WebSocket (WsThrottleGuard)

| Limit | Period |
|-------|--------|
| 50 events | 10 seconds |

Fixed sliding window per connection.

### Connection Rate Limiting

| Limit | Period | Scope |
|-------|--------|-------|
| 10 connections | 60 seconds | Per IP |

---

## File Access Authentication

`FileAuthGuard` accepts two auth methods:

1. **JWT** — Standard Bearer token or cookie
2. **Signed URL** — HMAC-signed query params: `?sig=<hmac>&exp=<timestamp>&uid=<userId>`

Signed URLs are generated by `SignedUrlService` and used for:
- Video streaming (where cookie auth may not work)
- Electron file access (cross-origin)

---

## Platform-Specific Auth

### Browser vs Electron

```typescript
// Login/refresh response
if (userAgent.includes('Electron')) {
  // Return refresh token in response body
  return { accessToken, refreshToken };
} else {
  // Browser: tokens in httpOnly cookies only
  return { accessToken };
}
```

### Electron Secure Storage

Electron uses the OS keychain for refresh token storage:
- macOS: Keychain
- Windows: DPAPI
- Linux: libsecret

```typescript
// Preload API
window.electronAPI.storeRefreshToken(token);
window.electronAPI.getRefreshToken();
window.electronAPI.deleteRefreshToken();
```

---

## Password Security

| Aspect | Implementation |
|--------|---------------|
| **Hash algorithm** | bcrypt, cost factor 10 |
| **Timing attack prevention** | Always runs `bcrypt.compare()` even if user not found |
| **Dummy hash** | `$2b$10$dummyhashfortimingattackprevention000000000000000` |
| **User enumeration** | Same response for invalid username and invalid password |

---

## Session Management

### Session Tracking

Each refresh token records:
- `deviceName` — e.g., "Chrome on Windows", "Kraken Desktop (macOS)"
- `userAgent` — Full user-agent string
- `ipAddress` — Client IP
- `lastUsedAt` — Updated on each token refresh

### Session APIs

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/auth/sessions` | List active sessions (all devices) |
| DELETE | `/auth/sessions/:id` | Revoke specific session |
| DELETE | `/auth/sessions` | Revoke all except current |

### Cleanup

- **Daily cron (6 AM):** Deletes expired tokens and consumed tokens older than 7 days

---

## Cross-References

- RBAC actions enum in schema → [01-database-schema.md](./01-database-schema.md)
- Guard usage in controllers → [02-backend-modules.md](./02-backend-modules.md)
- WebSocket auth flow → [06-websocket-system.md](./06-websocket-system.md)
- Electron auth flow → [04-frontend-architecture.md](./04-frontend-architecture.md)
