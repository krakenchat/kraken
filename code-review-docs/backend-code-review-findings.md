# Backend Code Review Findings

## Summary

All 9 phases reviewed. **Total findings: ~130** across 9 phases.

| Phase | CRITICAL | IMPORTANT | MINOR |
|-------|----------|-----------|-------|
| 1. Core Infrastructure | 3 | 6 | 7 |
| 2. Auth & Security | 3 | 6 | 5 |
| 3. RBAC & Roles | 4 | 7 | 3 |
| 4. User & Community | 5 | 9 | 7 |
| 5. Channels & Messaging | 4 | 13 | 10 |
| 6. Real-time & WebSockets | 3 | 7 | 5 |
| 7. Media & File System | 4 | 7 | 6 |
| 8. Notifications & Moderation | 3 | 9 | 10 |
| 9. Shared & Cross-cutting | 6 | 10 | 5 |
| **Total** | **35** | **74** | **58** |

### Top 10 Most Urgent Findings

1. **Phase 3 C2**: No privilege escalation prevention in RBAC — users with `CREATE_ROLE` can grant themselves any permission
2. **Phase 3 C3**: Cross-community role assignment — `assignUserToCommunityRole` doesn't validate role belongs to community
3. **Phase 7 C2**: LiveKit token identity spoofing — client can impersonate any user in voice channels
4. **Phase 7 C3**: No authorization on replay capture/share destination — can post to any channel/DM
5. **Phase 2 C2/C3**: WsJwtAuthGuard skips token blacklist and banned user checks
6. **Phase 6 C1**: Room name mismatch breaks auto-read-receipts, notifications, and cross-session sync
7. **Phase 9 C1-C4**: Missing `onDelete` cascades on Membership, RefreshToken, File, InstanceInvite — blocks user deletion
8. **Phase 9 C5-C6**: Missing unique constraints on ReadReceipt and UserRoles — data corruption
9. **Phase 4 C1-C2**: Route ordering bug shadows admin and blocked-user endpoints
10. **Phase 8 C1**: `deleteMessageAsMod` emits no WebSocket event — deleted messages stay visible

---

## Phase 1: Core Infrastructure & Bootstrap

### CRITICAL

#### C1. `ValidationPipe` missing `forbidNonWhitelisted: true`
**File:** `backend/src/main.ts:71-76`
`whitelist: true` silently strips unknown properties but doesn't reject them. Adding `forbidNonWhitelisted: true` would return 400 on extra properties, catching probing attacks and client bugs.

#### C2. `validateSecrets()` doesn't check for *missing* JWT secrets
**File:** `backend/src/main.ts:19-38`
The validation only fires when both secrets are truthy. If either is `undefined`, the function silently passes — in production, the app starts without JWT secrets.

#### C3. Redis IO Adapter pub/sub clients never disconnected on shutdown
**File:** `backend/src/adapters/redis-io.adapter.ts`
Two Redis clients created in `connectToRedis()` are never stored as class members and never cleaned up. Also, `main.ts` never calls `app.enableShutdownHooks()`.

### IMPORTANT

#### I1. No `app.enableShutdownHooks()`
**File:** `backend/src/main.ts`
`onModuleDestroy` hooks (DatabaseService, RedisModule) won't fire on SIGTERM/SIGINT, leaking DB/Redis connections in Docker/K8s.

#### I2. Health check doesn't verify DB or Redis
**File:** `backend/src/health/health.service.ts`
Always returns `status: 'ok'` regardless of actual dependency health. Load balancers will route to broken instances.

#### I3. Two different Redis client libraries
`redis` (node-redis) in adapter, `ioredis` in RedisModule. Adapter doesn't honor `REDIS_DB`. This is somewhat by design (Socket.IO adapter requires `redis` package) but the `REDIS_DB` inconsistency could cause silent failures.

#### I4. Redis password with special URL chars breaks adapter
**File:** `backend/src/adapters/redis-io.adapter.ts:30`
Password isn't URL-encoded when building the connection URL. Special chars like `@`, `:`, `/` in the password will break the URL.

#### I5. ThrottlerGuard completely removed in test mode
**File:** `backend/src/app.module.ts:121-128`
Uses `process.env` at module evaluation time. If `NODE_ENV=test` leaks to prod, no rate limiting at all.

#### I6. DatabaseService has no retry logic
**File:** `backend/src/database/database.service.ts:9-11`
If DB isn't ready at startup (common in Docker Compose), the app crashes with no retry.

### MINOR

#### M1. `GET /api` returns "Hello World!"
**File:** `backend/src/app.controller.ts:9-13`
NestJS scaffolding leftover. Leaks framework info, serves no purpose. Decorated `@Public()`.

#### M2. `HealthResponseDto` missing `@ApiProperty()` decorators
**File:** `backend/src/health/dto/health-response.dto.ts`

#### M3. TimingInterceptor logs every request including health checks
**File:** `backend/src/timing/timing.interceptor.ts:15-28`
Health probes generate significant log noise.

#### M4. TimingInterceptor would crash on WebSocket context
**File:** `backend/src/timing/timing.interceptor.ts:16-18`
No context type guard — `context.switchToHttp().getRequest()` returns undefined for WS contexts.

#### M5. `CORS_ORIGIN` parsing doesn't trim whitespace
**File:** `backend/src/main.ts:68`
`"http://foo.com, http://bar.com"` results in `" http://bar.com"` which never matches.

#### M6. App version exposed in unauthenticated health endpoint
**File:** `backend/src/health/health.service.ts:4,56`

#### M7. `PORT` env var not validated
**File:** `backend/src/main.ts:94`

---

## Phase 2: Auth & Security

### CRITICAL

#### C1. DUMMY_HASH is not a valid bcrypt hash
**File:** `backend/src/auth/auth.service.ts:32-33`
The dummy hash used for timing-attack prevention is 56 chars instead of the required 60. `bcrypt.compare()` may throw, return immediately, or produce inconsistent timing — undermining the entire timing-attack mitigation for user enumeration.
**Fix:** Generate a real bcrypt hash: `bcrypt.hashSync('dummy-placeholder', 10)`.

#### C2. WsJwtAuthGuard does not check token blacklist
**File:** `backend/src/auth/ws-jwt-auth.guard.ts:41-43`
HTTP `JwtStrategy` checks blacklist, but `WsJwtAuthGuard` does not. A logged-out/revoked access token can still authenticate WebSocket connections.

#### C3. WsJwtAuthGuard does not check `user.banned` status
**File:** `backend/src/auth/ws-jwt-auth.guard.ts:43-45`
HTTP `JwtStrategy` checks `user.banned`, but WS guard does not. Banned users can establish and maintain WebSocket connections.

### IMPORTANT

#### I1. Refresh token body acceptance gatekept only by User-Agent spoofing
**File:** `backend/src/auth/auth.controller.ts:114-126`
The `/auth/refresh` endpoint accepts refresh tokens from request body when `User-Agent` contains "Electron". An attacker can spoof this header to bypass httpOnly cookie protection.

#### I2. `secure: false` for cookies in all non-production environments
**Files:** `backend/src/auth/cookie-helper.ts:10`, `backend/src/auth/auth.controller.ts:271`
Cookies only set `secure: true` when `NODE_ENV === 'production'`. Staging/other HTTPS environments send cookies over HTTP.

#### I3. Inconsistent `sameSite` between access and refresh token cookies
**Files:** `backend/src/auth/cookie-helper.ts:9` (access: `lax`), `backend/src/auth/auth.controller.ts:270` (refresh: `strict`)
Access token with `lax` is sent on cross-site top-level navigations. Could enable CSRF if any GET endpoints cause state changes.

#### I4. `x-forwarded-for` trusted without proxy verification
**File:** `backend/src/auth/auth.controller.ts:59-64`
No Express `trust proxy` config. IPs in session data can be completely fabricated.

#### I5. bcrypt salt rounds of 10 is low
**Files:** `backend/src/user/user.service.ts:60`, `backend/src/onboarding/onboarding.service.ts:116`
OWASP recommends minimum 12 for passwords. Cost factor 10 is significantly weaker against modern hardware.

#### I6. `JwtStrategy.validate()` returns raw Prisma User object
**File:** `backend/src/auth/jwt.strategy.ts:47-56`
Returns raw User (with `hashedPassword`, `email`, etc.) as `req.user`. Any accidental serialization leaks sensitive fields. Should wrap in `UserEntity` or use `PUBLIC_USER_SELECT`.

### MINOR

#### M1. Logout endpoint uses `@ApiCreatedResponse` instead of `@ApiOkResponse`
**File:** `backend/src/auth/auth.controller.ts:195`

#### M2. Logout endpoint has no explicit `@HttpCode`
**File:** `backend/src/auth/auth.controller.ts:193`
POST defaults to 201 Created; logout should be 200 OK (like login and refresh).

#### M3. `WsThrottleGuard` completely disabled in test mode
**File:** `backend/src/auth/ws-throttle.guard.ts:43-46`
Same pattern as Phase 1 I5 — if `NODE_ENV=test` in prod, no WS rate limiting.

#### M4. `clearCookie` for refresh token doesn't specify all original cookie options
**File:** `backend/src/auth/auth.controller.ts:226`
Missing `path`, `httpOnly`, `sameSite`, `secure` options — browser may not clear the cookie.

#### M5. Error message in `verifyRefreshToken` reveals user existence
**File:** `backend/src/auth/auth.service.ts:94`
Distinct messages "Could not verify refresh token" vs "Could not find user" — minor info leak (requires valid JWT).

### Positive Patterns Noted
- Refresh token family-based reuse detection properly implemented
- Transactional token rotation with `$transaction`
- Token blacklisting on logout with TTL-based Redis cleanup
- Global JwtAuthGuard with opt-in `@Public()` (correct security posture)
- Rate limiting on all auth endpoints with appropriate limits
- Separate JWT secrets for access and refresh tokens
- Refresh tokens stored as bcrypt hashes, not plaintext
- Cron-based expired token cleanup

---

## Phase 3: RBAC & Roles

### CRITICAL

#### C1. Missing unique constraint on UserRoles allows duplicate role assignments
**File:** `backend/prisma/schema.prisma:530`
`@@index([userId, communityId, roleId])` should be `@@unique`. The `assignUserToCommunityRole` method does a blind `create` without duplicate check (unlike `assignUserToInstanceRole` which does check).

#### C2. No privilege escalation prevention
**Files:** `backend/src/roles/roles.controller.ts:135-148,187-205`, `backend/src/roles/roles.service.ts:568-630,635-729`
When creating or updating roles, there's no check that granted actions are a subset of the requesting user's actions. A user with `CREATE_ROLE` but not `DELETE_COMMUNITY` could create a role with `DELETE_COMMUNITY`, assign it to themselves, and escalate.

#### C3. Cross-community role assignment
**File:** `backend/src/roles/roles.service.ts:379-411`
`assignUserToCommunityRole` doesn't validate that `roleId` belongs to `communityId`. A user with `UPDATE_MEMBER` on community A could assign a role from community B.

#### C4. Instance role update/delete doesn't verify role is instance-scoped
**File:** `backend/src/roles/roles.service.ts:976-1046,1051-1082`
`updateInstanceRole` and `deleteInstanceRole` look up by `roleId` alone without checking `role.communityId === null`. Could accidentally modify community roles via instance endpoints.

### IMPORTANT

#### I1. OWNER bypass is unconditional — bypasses private channel membership
**File:** `backend/src/auth/rbac.guard.ts:43-46`
OWNER skips all RBAC checks including private channel membership verification. Can access all private channel messages. May be intentional for self-hosted but should be documented.

#### I2. Missing `@IsEnum` validation on actions array in CreateRoleDto
**File:** `backend/src/roles/dto/create-role.dto.ts:11-14`
`actions` array lacks `@IsEnum(RbacActions, { each: true })`. Invalid values pass DTO validation and reach the service layer.

#### I3. Role name validation too permissive
**File:** `backend/src/roles/dto/create-role.dto.ts:7-9`
No `@IsNotEmpty()` or `@MinLength(1)` — empty string passes. No whitespace trimming.

#### I4. Instance role name conflict check not scoped to instance roles
**File:** `backend/src/roles/roles.service.ts:1014-1027`
Name uniqueness query checks all roles (including community roles) instead of filtering `communityId: null`.

#### I5. `updateInstanceRole` doesn't protect all default instance roles from renaming
**File:** `backend/src/roles/roles.service.ts:988-997`
Only "Instance Admin" is protected. Other defaults (Community Creator, User Manager, Invite Manager) can be renamed, breaking name-based lookups.

#### I6. Race condition in `ensureInstanceRoleExists` P2002 recovery
**File:** `backend/src/roles/roles.service.ts:1294-1301`
Non-null assertion `role!.id` could fail. Also, `Role` model has `@@index` not `@@unique`, so P2002 shouldn't trigger — dead code.

#### I7. `getMyRolesForCommunity` lacks membership verification
**File:** `backend/src/roles/roles.controller.ts:40-54`
Any authenticated user can query roles for any community. Leaks community existence info.

### MINOR

#### M1. `createDefaultCommunityRoles` uses possibly uninitialized `adminRoleId`
**File:** `backend/src/roles/roles.service.ts:355-373`
Non-null assertion on loop variable that's only set conditionally.

#### M2. DM Group RBAC check grants all permissions unconditionally
**File:** `backend/src/roles/roles.service.ts:175-197`
Any DM group member gets `return true` for all actions. Fine for current use but fragile if DM permissions ever need granularity.

#### M3. No controller tests for instance role endpoints
**File:** `backend/src/roles/roles.controller.spec.ts`
Only community role endpoints are tested. 8 instance role endpoints have no controller tests.

---

## Phase 4: User & Community Management

### CRITICAL

#### C1. Route ordering bug -- `GET /users/:id` shadows `GET /users/blocked` and similar
**File:** `backend/src/user/user.controller.ts:113`
`@Get(':id')` is declared before `@Get('admin/list')`, `@Get('admin/:id')`, `@Get('blocked')`, `@Get('blocked/:userId')`. Since `ParseUUIDPipe` is on `:id`, requests to `/users/blocked` get a 400 instead of reaching the intended handler.

#### C2. Same route ordering bug in Community controller
**File:** `backend/src/community/community.controller.ts:79`
`@Get(':id')` before `@Get('admin/list')` and `@Get('admin/:id')`.

#### C3. `findByUsername`/`findById` return raw Prisma User objects with sensitive fields
**File:** `backend/src/user/user.service.ts:33-43`
These internal methods return full `User` (including `hashedPassword`). Controllers wrap in `UserEntity` but any middleware/interceptor/error handler that serializes `req.user` or response objects early would leak sensitive data.

#### C4. Onboarding `completeSetup` returns raw Prisma User as `any`
**File:** `backend/src/onboarding/onboarding.service.ts:97-103`
`adminUser: any` return type suppresses type checking. Raw User with `hashedPassword` flows through until controller extracts just the ID.

#### C5. `findAllAdmin` fetches full User records (including `hashedPassword`) without `select`
**File:** `backend/src/user/user.service.ts:332-341`
Admin listing fetches ALL columns. Wrapped in `AdminUserEntity` but password hash is fetched from DB unnecessarily.

### IMPORTANT

#### I1. No username format validation
**File:** `backend/src/user/dto/create-user.dto.ts:13-15`
No regex validation — allows spaces, special chars, unicode, HTML. The alias-groups module uses `@Matches(/^[a-zA-Z0-9_-]+$/)` but user registration does not. Same issue in `SetupInstanceDto.adminUsername`.

#### I2. Onboarding status endpoint exposes setup token publicly
**File:** `backend/src/onboarding/onboarding.controller.ts:24-29`
`@Public()` endpoint generates and returns setup token. Any network attacker can race the legitimate admin during the 15-minute setup window.

#### I3. `CreateChannelMembershipDto` has unused `addedBy` field clients can submit
**File:** `backend/src/channel-membership/dto/create-channel-membership.dto.ts:14-17`
DTO accepts `addedBy` from client, but service ignores it and uses `req.user.id`. Should be removed to prevent future accidental use.

#### I4. Case-sensitive username conflict check
**File:** `backend/src/user/user.service.ts:166-189`
`checkForFieldConflicts` called BEFORE `toLowerCase()` at line 63. PostgreSQL default is case-sensitive, so `"Alice"` passes conflict check even if `"alice"` exists.

#### I5. Community cascade delete doesn't clean up orphaned avatar/banner files
**File:** `backend/src/community/community.service.ts:313-390`
File records for community avatar/banner remain orphaned after deletion.

#### I6. Membership creation race condition between ban check and create
**File:** `backend/src/membership/membership.service.ts:46-86`
Ban check and membership creation aren't in a transaction. Window exists where a user could join between unban and re-ban.

#### I7. Membership `findAllForCommunity` hard-limited to 1000 with no pagination
**File:** `backend/src/membership/membership.service.ts:172`
Communities with 1000+ members silently truncate. No pagination parameter available.

#### I8. `updateProfile` doesn't validate avatar/banner file ownership
**File:** `backend/src/user/user.service.ts:261-265`
User can pass any file ID (including another user's) — Prisma foreign key error surfaces as 500 instead of proper 400.

#### I9. `updateProfile` doesn't mark old avatar/banner files for deletion
**File:** `backend/src/user/user.service.ts:246-295`
Unlike community `update`, user profile doesn't soft-delete replaced files — creates orphaned files over time.

### MINOR

#### M1. Missing `@ApiProperty` decorators on many response DTOs
CommunityResponseDto, CommunityStatsResponseDto, MembershipResponseDto, ChannelMembershipResponseDto, SetupResponseDto, BlockedStatusResponseDto all lack `@ApiProperty`.

#### M2. `communityIds` in `CreateInviteDto` missing `@IsOptional()`
**File:** `backend/src/invite/dto/create-invite.dto.ts:22-24`

#### M3. `SetupInstanceDto.adminPassword` has no `@MaxLength` constraint
**File:** `backend/src/onboarding/dto/setup-instance.dto.ts:21`

#### M4. `searchUsers` query param `q` has no validation
**File:** `backend/src/user/user.controller.ts:106`

#### M5. `ParseIntPipe` without `DefaultValuePipe` on optional query params
**File:** `backend/src/user/user.controller.ts:108,137`
Missing `limit`/`offset` causes 400 when not provided.

#### M6. Invite `getPublicInvite` returns full invite details including usage list
**File:** `backend/src/invite/invite.controller.ts:57-65`
Unauthenticated callers can enumerate which users joined via a specific invite code.

#### M7. Missing `ClassSerializerInterceptor` on membership/channel-membership/invite controllers
Membership and channel-membership include `UserEntity` in responses but without the interceptor, `@Exclude()` decorators don't apply. Mitigated by `PUBLIC_USER_SELECT` but not defense-in-depth.

---

## Phase 5: Channels & Messaging

### CRITICAL

#### C1. No maximum limit on pagination — potential DoS
**Files:** `backend/src/messages/messages.controller.ts:87,107,128,161`, `backend/src/threads/threads.controller.ts:83`
`limit` parameter has no upper bound. Client can pass `limit=999999999` causing memory exhaustion.

#### C2. `pendingAttachments` can go negative
**File:** `backend/src/messages/messages.service.ts:287-293`
`addAttachment` unconditionally decrements without checking current value. Race conditions or retries create negative counts, corrupting message state.

#### C3. Channel deletion missing cascade for `MessageReaction` and `MessageAttachment`
**File:** `backend/src/channels/channels.service.ts:157-186`
`message.deleteMany` called without first deleting reactions/attachments. May fail on foreign key constraints (depends on schema CASCADE config).

#### C4. `UpdateChannelDto` allows changing `communityId` and `type`
**File:** `backend/src/channels/dto/update-channel.dto.ts:1-4`
Extends `PartialType(CreateChannelDto)` making all fields optional including `communityId` and `type`. User could move channel between communities or change TEXT to VOICE.

### IMPORTANT

#### I1. `findUserDmGroups` fetches ALL messages across ALL groups for last-message lookup
**File:** `backend/src/direct-messages/direct-messages.service.ts:59-70`
Fetches all messages, orders by date, then picks first per group. Severe N+1 performance issue for users with many DMs.

#### I2. No `@IsUUID` on `communityId` in `CreateChannelDto`
**File:** `backend/src/channels/dto/create-channel.dto.ts:24-25`

#### I3. No `@IsUUID` on `channelId`/`directMessageGroupId` in `CreateMessageDto`, no cross-field validation
**File:** `backend/src/messages/dto/create-message.dto.ts:22-28`
Both could be null (orphaned message) or both set simultaneously.

#### I4. Channel name lacks `@MaxLength` validation
**File:** `backend/src/channels/dto/create-channel.dto.ts:20-22`

#### I5. `findOne` message endpoint has incorrect RBAC resource type
**File:** `backend/src/messages/messages.controller.ts:282-287`
Uses `RbacResourceType.CHANNEL` with `idKey: 'id'` but `:id` is a message ID. RBAC resolves wrong resource — authorization bypass or broken endpoint.

#### I6. `leaveDmGroup` has no membership verification — P2025 surfaces as 500
**File:** `backend/src/direct-messages/direct-messages.service.ts:276-291`

#### I7. DM group has no member count limit
**File:** `backend/src/direct-messages/dto/create-dm-group.dto.ts`
No `@ArrayMaxSize()` on `userIds`. Could create group with thousands of members.

#### I8. No `ParseUUIDPipe` on `:id` in DM controller
**File:** `backend/src/direct-messages/direct-messages.controller.ts:57-122`

#### I9. Move channel endpoints don't verify channel belongs to the provided `communityId`
**File:** `backend/src/channels/channels.controller.ts:124-154`
RBAC checks community permission but channel could belong to different community — authorization bypass.

#### I10. Race condition in channel move operations — no row-level locking
**File:** `backend/src/channels/channels.service.ts:291-389`

#### I11. Thread reply and message span DTOs lack `@ValidateNested` and field-level validators
**Files:** `backend/src/threads/dto/create-thread-reply.dto.ts:7-14`, `backend/src/messages/dto/create-message.dto.ts:8-16`
Malformed spans pass through to database.

#### I12. `MessageDto` exposes `searchText` (internal indexing field)
**File:** `backend/src/messages/dto/message-response.dto.ts:49-70`

#### I13. `ReadReceiptsController` lacks RBAC guards — any user can query who read a message in any channel
**File:** `backend/src/read-receipts/read-receipts.controller.ts:27-28`

### MINOR

#### M1. Duplicate `formatMessage` logic across messages and threads services
#### M2. Duplicate span DTO definitions (3 identical classes)
#### M3. `ThreadRepliesResponseDto` has stale `fileMetadata` field
#### M4. `ThreadReplyDto` and `EnrichedThreadReplyDto` are identical
#### M5. `findAll` channels hardcoded `take: 500` with no pagination
#### M6. `addUserToGeneralChannel` uses fragile `name: 'general'` lookup
#### M7. `UpdateMessageDto` extends `PartialType(CreateMessageDto)` including excluded fields
#### M8. `createDmGroup` accepts `isGroup` override from client
#### M9. Emoji reaction field has no `@MaxLength` — abuse potential
#### M10. Missing `@ArrayMinLength(1)` on thread reply spans (allows empty replies)

---

## Phase 6: Real-time & WebSockets

### CRITICAL

#### C1. Room name mismatch breaks user-targeted events
**Files:** `backend/src/messages/messages.gateway.ts:140,208`, `backend/src/read-receipts/read-receipts.gateway.ts:102,110`, `backend/src/notifications/notifications.gateway.ts:80,104`
`RoomName.user(userId)` returns raw userId (e.g. `"abc-123"`), but gateways emit to `` `user:${userId}` `` (e.g. `"user:abc-123"`) — a room nobody is in. Auto-read-receipt acks, cross-session read receipt sync, and notification delivery are silently dropped. Same issue with DM rooms: `` `dm:${groupId}` `` vs `RoomName.dmGroup(groupId)`.

#### C2. Voice presence Redis sets have no TTL — stale entries accumulate forever
**File:** `backend/src/voice-presence/voice-presence.service.ts:444-460`
`channelMembersKey` and `userChannelsKey` SADD calls have no TTL. When `userDataKey` expires (user stops heartbeating), user remains in channel/user sets permanently. `cleanupExpiredPresence()` is a no-op with no `@Cron` decorator. `getUserVoiceChannels()` returns stale channels.

#### C3. Voice presence `user.findUnique()` fetches full User row without `PUBLIC_USER_SELECT`
**File:** `backend/src/voice-presence/voice-presence.service.ts:407-409,500-502`

### IMPORTANT

#### I1. Missing `WsThrottleGuard` on voice-presence and notifications gateways
**Files:** `backend/src/voice-presence/voice-presence.gateway.ts:44`, `backend/src/notifications/notifications.gateway.ts:30`
All other gateways include `WsThrottleGuard`. Voice presence handles heartbeat events a malicious client could spam.

#### I2. Presence race condition in `addConnection` between SADD and SCARD
**File:** `backend/src/presence/presence.service.ts:19-55`
Two simultaneous connections: both SADD, both SCARD returns 2, neither triggers `USER_ONLINE`. Use Lua script for atomic add+count.

#### I3. No heartbeat mechanism for general presence — TTL expires for active users
**File:** `backend/src/presence/presence.gateway.ts`
`PRESENCE_ONLINE` sets 60s TTL. No periodic heartbeat event. User silently goes offline after 60s despite being connected.

#### I4. Voice presence TOCTOU race in webhook handler
**File:** `backend/src/voice-presence/voice-presence.service.ts:374-404`
GET-then-SET between check and pipeline. Concurrent webhook + direct join causes duplicate `VOICE_CHANNEL_USER_JOINED` events. Use `SET ... NX` instead.

#### I5. Inconsistent WebSocket gateway CORS configuration
All gateways declare `@WebSocketGateway({...})` with different CORS defaults. `RoomsGateway` uses `true` (allow all), others default to `['http://localhost:5173']`. `VoicePresenceGateway` has no options at all.

#### I6. Unused `ClientEvents`: `VOICE_CHANNEL_JOIN`, `VOICE_CHANNEL_LEAVE`, `VOICE_STATE_UPDATE`
**File:** `shared/src/events/client-events.enum.ts:27-29`
Defined but no `@SubscribeMessage` handlers exist in any gateway. Dead code.

#### I7. `DmVoicePresenceController` missing membership validation
**File:** `backend/src/voice-presence/voice-presence.controller.ts:144-175`
Only `JwtAuthGuard`, no RbacGuard. Any authenticated user can see who's in any DM voice call or refresh presence in any DM group.

### MINOR

#### M1. `getMultipleUserPresence` makes sequential Redis calls instead of MGET
**File:** `backend/src/presence/presence.controller.ts:44-56`
No limit on number of user IDs either.

#### M2. Deprecated `setOnline()`/`setOffline()` still present in PresenceService
**File:** `backend/src/presence/presence.service.ts:109-132`

#### M3. `connectionAttempts` map in RoomsGateway only cleans up at size > 100
**File:** `backend/src/rooms/rooms.gateway.ts:73-79`

#### M4. `NotificationsGateway` uses `this.server.to()` directly instead of `WebsocketService`
#### M5. `WsLoggingExceptionFilter` logs full request data including message content
**File:** `backend/src/websocket/ws-exception.filter.ts:14-25`

---

## Phase 7: Media & File System

### CRITICAL

#### C1. `storagePath` and `thumbnailPath` leaked to clients in `FileUploadResponseDto`
**Files:** `backend/src/file-upload/dto/file-upload-response.dto.ts:27,29`, `backend/src/file-upload/file-upload.service.ts:99`
Exposes internal server filesystem paths (e.g., `/app/uploads/abc123.png`) to any authenticated user who uploads a file.

#### C2. LiveKit token identity spoofing
**File:** `backend/src/livekit/livekit.controller.ts:83-85,103-105`
Client-supplied `identity` field is used if provided, falling back to `req.user.id` only if empty. A user can impersonate anyone in voice channels by setting `identity` to another user's ID.

#### C3. No authorization check on replay capture/share destination
**Files:** `backend/src/livekit/livekit-replay.service.ts:1102-1168`, `backend/src/livekit/clip-library.service.ts:260-317`
When capturing replay with `destination: 'channel'` or `'dm'`, no check that user is a member of `targetChannelId` or `targetDirectMessageGroupId`. Bypasses all RBAC/membership checks.

#### C4. Storage quota not enforced for replay clips
**File:** `backend/src/livekit/livekit-replay.service.ts:1059-1078`
Replay clips bypass `canUploadFile()` and `incrementUserStorage()`. Users accumulate unlimited clips. `deleteClip()` also doesn't decrement quota.

### IMPORTANT

#### I1. MIME type validation relies on client-supplied Content-Type (magic numbers skipped)
**File:** `backend/src/file-upload/file-upload.controller.ts:39-42`
`skipMagicNumbersValidation: true` — any file type can be uploaded by spoofing Content-Type. `application/octet-stream` is also accepted.

#### I2. File serving uses `createReadStream` on `storagePath` without path containment check
**File:** `backend/src/file/file.controller.ts:93,154,170`
No verification that resolved path is within expected uploads directory. Defense-in-depth gap.

#### I3. FFmpeg concat file doesn't escape single quotes in paths
**File:** `backend/src/livekit/ffmpeg.service.ts:76-78`
Single quotes in segment paths could break out of quoting. Low practical risk since paths come from UUIDs but no explicit sanitization.

#### I4. `execSync` used for disk stats in StorageQuotaService
**File:** `backend/src/storage-quota/storage-quota.service.ts:267-268`
Blocks event loop. Should use async `execFile` or native `fs.statfs()`.

#### I5. Webhook signature verification falls back to `JSON.stringify(body)`
**File:** `backend/src/livekit/livekit-webhook.controller.ts:98`
If `rawBody` unavailable, re-serialization may produce different bytes. Should throw instead of fallback.

#### I6. No `ParseUUIDPipe` on StorageQuota controller `userId` params
**File:** `backend/src/storage-quota/storage-quota.controller.ts:86,99,113`

#### I7. No rate limiting on replay stream/preview endpoints
**File:** `backend/src/livekit/livekit.controller.ts:192,263-264,282-283`
`streamReplay` triggers CPU-intensive FFmpeg. No `@Throttle()` decorators.

### MINOR

#### M1. `image/svg+xml` allowed as message attachment — potential stored XSS
**File:** `backend/src/file-upload/validators/strategies/message-attachment-validation.strategy.ts:20`
SVGs with embedded JS served with `Content-Disposition: inline`.

#### M2. Multer hard limit is 1GB while largest per-type limit is 500MB
**File:** `backend/src/file-upload/file-upload.module.ts:21`

#### M3. Signed URL contains user ID in plaintext query string
**File:** `backend/src/file/signed-url.service.ts:51`

#### M4. `cleanupOldFiles` cron has no age threshold — soft-deleted files removed on next run
**File:** `backend/src/file/file.service.ts:38-41`

#### M5. `getUsersStorageList` fetches all users into memory for in-memory filtering
**File:** `backend/src/storage-quota/storage-quota.service.ts:447-463`

#### M6. `recalculateAllUsersStorage` cron is sequential per user — O(n) database load
**File:** `backend/src/storage-quota/storage-quota.service.ts:502-525`

---

## Phase 8: Notifications & Moderation

### CRITICAL

#### C1. `deleteMessageAsMod` does NOT emit WebSocket event
**File:** `backend/src/moderation/moderation.service.ts:780-825`
Soft-deletes a message and creates moderation log, but unlike all other moderation actions, emits no WebSocket event. Other users see deleted message until refresh.

#### C2. Hardcoded `ROLE_HIERARCHY` for moderation role checks
**File:** `backend/src/moderation/moderation.service.ts:26-32`
Role hierarchy is a static `Record` matching by name strings (`"Owner"`, `"Moderator"`, etc.). Renamed roles or custom roles silently fall through to `Member` priority. Duplicates RBAC concern with a weaker mechanism.

#### C3. `@channel` mention creates unbounded notifications
**File:** `backend/src/notifications/notifications.service.ts:127-135`
No batch limit or rate limiting. For communities with thousands of members, a single `@channel` mention creates thousands of DB records + WS events + push notifications in parallel via `Promise.all`.

### IMPORTANT

#### I1. `getUserSettings` has TOCTOU race condition
**File:** `backend/src/notifications/notifications.service.ts:631-645`
Find-then-create pattern. Concurrent requests for new user both see null, second `create` throws unique violation. Should use `upsert`.

#### I2. Notification pagination `total` returns page length, not actual total
**File:** `backend/src/notifications/notifications.controller.ts:55-72`
`total: notifications.length` is the current page size, not total count. Client pagination broken.

#### I3. No `@Max` on `NotificationQueryDto.limit`
**File:** `backend/src/notifications/dto/notification-query.dto.ts:12-14`

#### I4. `getBanList`/`getTimeoutList` auto-expire records with sequential N+1 queries
**File:** `backend/src/moderation/moderation.service.ts:273-311,551-590`
Loops through all records issuing individual update/delete for each expired entry.

#### I5. Push notification `subscribe` allows overwriting another user's endpoint
**File:** `backend/src/push-notifications/push-notifications.service.ts:153-179`
Upsert on `endpoint` alone overwrites `userId`. User B can steal User A's push subscription.

#### I6. Alias group controller params not validated with `ParseUUIDPipe`
**File:** `backend/src/alias-groups/alias-groups.controller.ts:49,66,84,101,118,133,154,170`

#### I7. `unbanUser` does not check role hierarchy
**File:** `backend/src/moderation/moderation.service.ts:218-249`
Lower-ranking moderator can unban users banned by higher-ranking admin.

#### I8. DND timezone handling uses server time
**File:** `backend/src/notifications/notifications.service.ts:268-292`

#### I9. Ban/kick WebSocket events have no error handling — ban committed but emit could fail
**File:** `backend/src/moderation/moderation.service.ts:148-216`

### MINOR

#### M1. `deleteMessageAsMod` — also missing from Phase 5 message gateway broadcast
#### M2. `ModerationUserDto` declares fields beyond `PUBLIC_USER_SELECT`
#### M3. `isUserBanned` method appears to be dead code
#### M4. `PinnedMessageDto` exposes irrelevant fields (`deletedAt`, `searchText`, etc.)
#### M5. Alias group delete is not transactional
#### M6. Moderation log `action` query param not validated as enum
#### M7. `cleanupExpiredSubscriptions` push notification method is never called by cron
#### M8. `SubscribePushDto.endpoint` uses `@IsString()` instead of `@IsUrl()`
#### M9. Notification `@channel`/`@here` doesn't differentiate notification type
#### M10. Missing `@ApiProperty` decorators on notification/push-notification response DTOs

---

## Phase 9: Shared Code & Cross-cutting

### CRITICAL

#### C1. Missing `onDelete` on `Membership` relations — blocks user/community deletion
**File:** `backend/prisma/schema.prisma:403-404`
No `onDelete` on user or community relations. Prisma defaults to `Restrict`, causing foreign key violations on delete.

#### C2. Missing `onDelete` on `RefreshToken.user` — blocks user deletion
**File:** `backend/prisma/schema.prisma:316`

#### C3. Missing `onDelete` on `File.uploadedBy` — blocks user deletion
**File:** `backend/prisma/schema.prisma:591`
Should be `onDelete: SetNull` since `uploadedById` is nullable.

#### C4. Missing `onDelete` on `InstanceInvite.createdBy` — blocks user deletion
**File:** `backend/prisma/schema.prisma:340`
Should be `onDelete: SetNull`.

#### C5. Missing unique constraint on `ReadReceipt(userId, channelId)` and `(userId, directMessageGroupId)`
**File:** `backend/prisma/schema.prisma:131-149`
Only `@@index`, not `@@unique`. Race conditions create duplicate read receipts.

#### C6. Missing unique constraint on `UserRoles(userId, communityId, roleId)`
**File:** `backend/prisma/schema.prisma:519-531`
Same as Phase 3 C1 — `@@index` instead of `@@unique`. Duplicate role assignments possible.

### IMPORTANT

#### I1. `FriendshipStatus.BLOCKED` enum value is dead code
**File:** `backend/prisma/schema.prisma:747`
Blocking uses `UserBlock` model. `BLOCKED` status exposed in OpenAPI but never used. `sendFriendRequest` doesn't handle it — falls through to unique constraint error.

#### I2. Friends controller lacks `ParseUUIDPipe` on all params
**File:** `backend/src/friends/friends.controller.ts:75,87,99,111,124,137`

#### I3. `AppearanceSettingsService.updateUserSettings` has TOCTOU race condition
**File:** `backend/src/appearance-settings/appearance-settings.service.ts:33-44`
Find-then-update. Should use `upsert`.

#### I4. `InstanceService.getSettings` has race condition for initial creation
**File:** `backend/src/instance/instance.service.ts:13-28`
Two concurrent requests can both create, resulting in two `InstanceSettings` rows.

#### I5. `RoomName` functions return raw UUIDs for most entity types
**File:** `backend/src/common/utils/room-name.util.ts:11-17`
Only `community` has a prefix. All others are raw UUIDs. Makes debugging room issues difficult and is architecturally inconsistent.

#### I6. `AppearanceSettingsResponseDto` lacks `@ApiProperty` decorators
**File:** `backend/src/appearance-settings/dto/appearance-settings-response.dto.ts:1-9`

#### I7. `SuccessResponseDto`/`SuccessMessageDto` lack `@ApiProperty` decorators
**File:** `backend/src/common/dto/common-response.dto.ts:1-8`

#### I8. `InstanceStatsResponseDto` lacks `@ApiProperty` decorators
**File:** `backend/src/instance/dto/instance-response.dto.ts:12-19`

#### I9. `Message.searchText` has no index — full-text search is sequential scan
**File:** `backend/prisma/schema.prisma:22`
No GIN index for full-text search despite `fullTextSearchPostgres` preview feature being enabled.

#### I10. `Friendship` bidirectional uniqueness not enforced at DB level
**File:** `backend/prisma/schema.prisma:567`
`@@unique([userAId, userBId])` doesn't prevent `(B, A)` duplicate. Service code handles it but DB doesn't enforce.

### MINOR

#### M1. `extractTokenFromHandshake` uses `split('Bearer ')` instead of `slice(7)`
**File:** `backend/src/common/utils/socket.utils.ts:100`

#### M2. Stale `accentColor` comment in Prisma schema (4 colors listed, 12 actually valid)
**File:** `backend/prisma/schema.prisma:196`

#### M3. Friends controller `acceptFriendRequest` uses `@ApiCreatedResponse` for an update
**File:** `backend/src/friends/friends.controller.ts:96`

#### M4. No `@ApiTags` on friends, appearance-settings, or instance controllers

#### M5. `intensity`/`themeMode`/`accentColor` use hardcoded `@IsIn` arrays — no shared constants
