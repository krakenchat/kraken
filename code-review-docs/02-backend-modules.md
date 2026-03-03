# 02 — Backend Module Inventory

> NestJS backend at `backend/src/`. **29 feature modules, 35+ controllers, 7 WebSocket gateways, 150+ API endpoints.**

---

## Table of Contents

- [Global Configuration](#global-configuration)
- [Module Dependency Graph](#module-dependency-graph)
- [Core Infrastructure](#core-infrastructure)
- [Authentication & Authorization](#authentication--authorization)
- [Community & Channel Management](#community--channel-management)
- [Messaging](#messaging)
- [Real-Time](#real-time)
- [Voice & Media](#voice--media)
- [Social](#social)
- [Notifications](#notifications)
- [Admin & Settings](#admin--settings)
- [Files & Storage](#files--storage)
- [Endpoint Summary](#endpoint-summary)

---

## Global Configuration

### Global Guards (`app.module.ts`)
| Guard | Scope | Behavior |
|-------|-------|----------|
| `JwtAuthGuard` | All HTTP routes | Requires JWT; skip with `@Public()` |
| `ThrottlerGuard` | All HTTP routes | Rate limiting; disabled in test mode |

### Global Pipes (`main.ts`)
| Pipe | Config |
|------|--------|
| `ValidationPipe` | `transform: true`, `whitelist: true` |
| `wsValidationPipe` | WebSocket variant with error handling |

### Global Interceptors (`main.ts`)
| Interceptor | Purpose |
|-------------|---------|
| `TimingInterceptor` | Request timing/monitoring |
| `ClassSerializerInterceptor` | Applies `@Exclude()` decorators for DTO serialization |

### Middleware (`main.ts`)
- Cookie parser
- Helmet (CSP disabled, COEP disabled)
- CORS (configurable origins)
- API prefix: `/api`
- Swagger/OpenAPI (unless `ENABLE_SWAGGER=false`)

---

## Module Dependency Graph

```
AppModule (42 imports)
│
├── Infrastructure ──────────────────────────────
│   ├── DatabaseModule (no deps) → exports DatabaseService
│   ├── RedisModule (no deps) → exports REDIS_CLIENT
│   ├── WebsocketModule (no deps) → exports WebsocketService
│   ├── StorageModule → exports StorageService
│   ├── ConfigModule (global)
│   ├── ScheduleModule (cron jobs)
│   └── EventEmitterModule (domain events)
│
├── Auth Layer ──────────────────────────────────
│   ├── AuthModule → User, Roles, Database, Redis, JWT, Passport
│   └── RolesModule → Database
│
├── Core Domain ─────────────────────────────────
│   ├── CommunityModule → Auth, Roles, Database, Channels
│   ├── ChannelsModule → Roles, Database, Websocket
│   ├── MembershipModule → Database, Community, Roles
│   ├── ChannelMembershipModule → Database, Roles
│   └── UserModule → Database, Invite, Channels, Roles
│
├── Messaging ───────────────────────────────────
│   ├── MessagesModule → Database, User, Roles, Websocket, Rooms,
│   │                     Auth, File, Notifications, Moderation, ReadReceipts
│   ├── ThreadsModule → Database, Roles, Websocket, Auth, Notifications, User
│   ├── DirectMessagesModule → Database, Messages, Roles
│   └── ReadReceiptsModule → Database, Websocket, Auth, User, Notifications
│
├── Real-Time ───────────────────────────────────
│   ├── RoomsModule → Auth, User, Websocket, Database, Roles
│   ├── PresenceModule → Redis, Auth, Roles, User, Websocket
│   └── VoicePresenceModule → Redis, Websocket, Auth, User, Roles,
│                              Database, LiveKit (forwardRef)
│
├── Voice & Media ───────────────────────────────
│   ├── LivekitModule → Auth, Database, Storage, Websocket, Messages,
│   │                    User, Roles, VoicePresence (forwardRef)
│   ├── FileUploadModule → Multer, Config, Database, Storage, StorageQuota, LiveKit
│   └── FileModule → Database, Storage, Membership, ChannelMembership
│
├── Social ──────────────────────────────────────
│   ├── FriendsModule → Database
│   └── AliasGroupsModule → Database, Roles
│
├── Notifications ───────────────────────────────
│   ├── NotificationsModule → Database, Websocket, Auth, User, PushNotifications
│   └── PushNotificationsModule → Config, Database
│
├── Admin & Settings ────────────────────────────
│   ├── InstanceModule → Database, Roles
│   ├── OnboardingModule → Database, Redis, Roles
│   ├── InviteModule → Database, Roles
│   ├── AppearanceSettingsModule → Database
│   ├── StorageQuotaModule → Database, Roles
│   ├── ModerationModule → Database, Roles, Membership, Websocket
│   └── HealthModule → Redis
```

> **Review Point:** `MessagesModule` has the most dependencies (10 imports). `LivekitModule` and `VoicePresenceModule` have a circular dependency resolved via `forwardRef`. This is a common NestJS pattern but worth monitoring for future decoupling.

---

## Core Infrastructure

### DatabaseModule (`database/`)
- **Service:** `DatabaseService` — Prisma client wrapper with transaction support
- Exported globally; used by every feature module

### RedisModule (`redis/`)
- **Provider:** `REDIS_CLIENT` — ioredis instance
- Config: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`

### WebsocketModule (`websocket/`)
- **Service:** `WebsocketService`
  - `sendToRoom(room, event, data)` — broadcast to all clients in a room
  - `joinSocketsToRoom(sourceRoom, targetRooms)` — move sockets between rooms
  - `removeSocketsFromRoom(sourceRoom, rooms)` — leave rooms
  - `sendToAll(event, data)` — broadcast to all connected clients

### StorageModule (`storage/`)
- **Service:** `StorageService` — file system abstraction
- Supports LOCAL filesystem (S3 and Azure prepared but not yet implemented)
- Segment-specific methods for replay buffer

### HealthModule (`health/`)
- **Controller:** `GET /health` — readiness check

---

## Authentication & Authorization

### AuthModule (`auth/`)
See [03-auth-and-rbac.md](./03-auth-and-rbac.md) for full details.

| Component | Type | Purpose |
|-----------|------|---------|
| `AuthController` | Controller | `/auth` — login, refresh, logout, sessions |
| `AuthService` | Service | Token generation, rotation, session management |
| `TokenBlacklistService` | Service | Redis-backed access token revocation |
| `LocalStrategy` | Passport | Username/password validation |
| `JwtStrategy` | Passport | JWT extraction and validation |
| `JwtAuthGuard` | Guard | HTTP auth (global) |
| `WsJwtAuthGuard` | Guard | WebSocket auth |
| `RbacGuard` | Guard | Role-based access control |
| `OptionalJwtAuthGuard` | Guard | Permissive auth (allows null user) |
| `MessageOwnershipGuard` | Guard | Message author verification |
| `WsThrottleGuard` | Guard | WebSocket rate limiting |

**Endpoints (6):**
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/auth/login` | Public | Returns JWT + refresh token |
| POST | `/auth/refresh` | Public | Token rotation with reuse detection |
| POST | `/auth/logout` | JWT | Blacklists access token |
| GET | `/auth/sessions` | JWT | List active sessions |
| DELETE | `/auth/sessions/:id` | JWT | Revoke specific session |
| DELETE | `/auth/sessions` | JWT | Revoke all other sessions |

### RolesModule (`roles/`)

| Method | Path | RBAC |
|--------|------|------|
| GET | `/roles/my/community/:communityId` | — |
| GET | `/roles/my/channel/:channelId` | — |
| GET | `/roles/my/instance` | — |
| GET | `/roles/community/:communityId` | READ_ROLE |
| POST | `/roles/community/:communityId` | CREATE_ROLE |
| PUT | `/roles/community/:communityId/:roleId` | UPDATE_ROLE |
| DELETE | `/roles/community/:communityId/:roleId` | DELETE_ROLE |
| POST | `/roles/community/:id/:roleId/users/:userId` | UPDATE_MEMBER |
| DELETE | `/roles/community/:id/:roleId/users/:userId` | UPDATE_MEMBER |
| POST | `/roles/instance/:userId` | Admin only |

---

## Community & Channel Management

### CommunityModule (`community/`)

| Method | Path | RBAC |
|--------|------|------|
| POST | `/community` | CREATE_COMMUNITY (instance) |
| GET | `/community` | READ_ALL_COMMUNITIES (admin) |
| GET | `/community/mine` | — |
| GET | `/community/:id` | READ_COMMUNITY |
| PATCH | `/community/:id` | UPDATE_COMMUNITY |
| DELETE | `/community/:id` | DELETE_COMMUNITY |
| GET | `/community/admin/list` | Admin |
| DELETE | `/community/admin/:id` | Admin bypass |

### ChannelsModule (`channels/`)

| Method | Path | RBAC |
|--------|------|------|
| POST | `/channels` | CREATE_CHANNEL |
| GET | `/channels/community/:communityId` | READ_CHANNEL |
| GET | `/channels/community/:id/mentionable` | — |
| GET | `/channels/:id` | READ_CHANNEL |
| PATCH | `/channels/:id` | UPDATE_CHANNEL |
| DELETE | `/channels/:id` | DELETE_CHANNEL |
| POST | `/channels/:id/move-up` | UPDATE_CHANNEL |
| POST | `/channels/:id/move-down` | UPDATE_CHANNEL |

### MembershipModule (`membership/`)

| Method | Path | RBAC |
|--------|------|------|
| POST | `/membership` | CREATE_MEMBER |
| GET | `/membership/community/:communityId` | READ_MEMBER |
| GET | `/membership/community/:id/search` | READ_MEMBER |
| PATCH | `/membership/:id` | UPDATE_MEMBER |
| DELETE | `/membership/:id` | DELETE_MEMBER |

### ChannelMembershipModule (`channel-membership/`)

| Method | Path | RBAC |
|--------|------|------|
| POST | `/channel-membership` | UPDATE_CHANNEL |
| GET | `/channel-membership/channel/:channelId` | READ_CHANNEL |
| DELETE | `/channel-membership/:id` | UPDATE_CHANNEL |

---

## Messaging

### MessagesModule (`messages/`)

**Controller Endpoints:**
| Method | Path | RBAC |
|--------|------|------|
| POST | `/messages` | CREATE_MESSAGE |
| GET | `/messages/channel/:channelId` | READ_MESSAGE |
| GET | `/messages/group/:groupId` | READ_MESSAGE |
| GET | `/messages/search/channel/:channelId` | READ_MESSAGE |
| GET | `/messages/search/group/:groupId` | READ_MESSAGE |
| GET | `/messages/search/community/:communityId` | READ_MESSAGE |
| POST | `/messages/reactions` | CREATE_REACTION |
| DELETE | `/messages/reactions` | DELETE_REACTION |
| GET | `/messages/:id` | READ_MESSAGE |
| PATCH | `/messages/:id` | MessageOwnershipGuard |
| DELETE | `/messages/:id` | MessageOwnershipGuard |
| POST | `/messages/:id/attachments` | CREATE_MESSAGE |

**Gateway Events:**
| Client Event | Handler | Server Emit |
|-------------|---------|-------------|
| `SEND_MESSAGE` | Create + broadcast | `NEW_MESSAGE` |
| `SEND_DM` | Create + broadcast | `NEW_DM` |
| `ADD_REACTION` | Add + broadcast | `REACTION_ADDED` |
| `REMOVE_REACTION` | Remove + broadcast | `REACTION_REMOVED` |
| `TYPING_START/STOP` | Forward to room | `USER_TYPING` |

### ThreadsModule (`threads/`)

| Method | Path | RBAC |
|--------|------|------|
| POST | `/threads/:parentId/replies` | CREATE_MESSAGE |
| GET | `/threads/:parentId/replies` | READ_MESSAGE |
| GET | `/threads/:parentId/metadata` | READ_MESSAGE |
| DELETE | `/threads/:parentId/replies/:replyId` | MessageOwnership |

**Gateway:** `SEND_THREAD_REPLY` → `NEW_THREAD_REPLY` + `THREAD_REPLY_COUNT_UPDATED`

### DirectMessagesModule (`direct-messages/`)

| Method | Path | Auth |
|--------|------|------|
| GET | `/direct-messages` | JWT |
| POST | `/direct-messages` | JWT |
| GET | `/direct-messages/:id` | JWT |
| GET | `/direct-messages/:id/messages` | JWT |
| POST | `/direct-messages/:id/members` | JWT |
| DELETE | `/direct-messages/:id/members/me` | JWT |

### ReadReceiptsModule (`read-receipts/`)

**Controller:** `GET /messages/:id/read-receipts`
**Gateway:** `MARK_AS_READ` → `READ_RECEIPT_UPDATED`

---

## Real-Time

### RoomsModule (`rooms/`)

**Gateway:** Manages room subscriptions and WebSocket server lifecycle.
| Client Event | Handler |
|-------------|---------|
| `SUBSCRIBE_ALL` | Join all user's rooms (community, channels, DMs) |

**RoomSubscriptionHandler:** Listens to 25+ domain events via EventEmitter2. Translates events into room join/leave operations. See [06-websocket-system.md](./06-websocket-system.md).

### PresenceModule (`presence/`)

**Controller:**
| Method | Path |
|--------|------|
| GET | `/presence/user/:userId` |
| GET | `/presence/users/bulk` |
| GET | `/presence/users/:userIds` |

**Gateway:** `PRESENCE_ONLINE` → Redis TTL refresh → `USER_ONLINE`/`USER_OFFLINE`

---

## Voice & Media

### VoicePresenceModule (`voice-presence/`)

Three controllers for different route prefixes:

**VoicePresenceController:** `/channels/:channelId/voice-presence`
| Method | Path |
|--------|------|
| GET | `/channels/:id/voice-presence` |
| POST | `/channels/:id/voice-presence/join` |
| POST | `/channels/:id/voice-presence/leave` |
| POST | `/channels/:id/voice-presence/refresh` |
| POST | `/channels/:id/voice-presence/deafen` |

**DmVoicePresenceController:** `/dm-groups/:dmGroupId/voice-presence`
| Method | Path |
|--------|------|
| GET | `/dm-groups/:id/voice-presence` |
| POST | `/dm-groups/:id/voice-presence/refresh` |

**UserVoicePresenceController:**
| Method | Path |
|--------|------|
| GET | `/voice-presence/me` |

### LivekitModule (`livekit/`)

**LivekitController:**
| Method | Path | Notes |
|--------|------|-------|
| POST | `/livekit/token` | Channel voice token |
| POST | `/livekit/dm-token` | DM voice token |
| POST | `/livekit/channels/:id/mute-participant` | Server mute |
| GET | `/livekit/connection-info` | LiveKit URL + config |
| GET | `/livekit/health` | Health check |
| POST | `/livekit/replay/start` | Start egress recording |
| POST | `/livekit/replay/stop` | Stop egress recording |
| GET | `/livekit/replay/stream` | Download replay video |
| GET | `/livekit/replay/session-info` | Active session info |
| GET | `/livekit/replay/preview/playlist.m3u8` | HLS preview |
| GET | `/livekit/replay/preview/segment/:file` | HLS segment |
| POST | `/livekit/replay/capture` | Capture clip (rate limited) |
| GET | `/livekit/clips` | User's clip library |
| GET | `/livekit/clips/user/:userId` | Public clips |
| PUT | `/livekit/clips/:clipId` | Update clip |
| DELETE | `/livekit/clips/:clipId` | Delete clip |
| POST | `/livekit/clips/:clipId/share` | Share to channel/DM |

**LivekitWebhookController:** `POST /livekit/webhook` (public) — handles LiveKit webhooks

**Services:** `LivekitService`, `LivekitReplayService`, `ClipLibraryService`, `FfmpegService`, `ThumbnailService`

**Cron Jobs (4):**
| Schedule | Job | Purpose |
|----------|-----|---------|
| Every 5 min | `cleanupOldSegments` | Delete segments > 2h old |
| Every 1 hr | `cleanupOrphanedSessions` | Clean inactive sessions |
| Every 1 min | `reconcileEgressStatus` | Query LiveKit for updates |
| Every 30 min | `cleanupRemuxCache` | Clean cached remuxed segments |

---

## Social

### FriendsModule (`friends/`)

| Method | Path |
|--------|------|
| GET | `/friends` |
| GET | `/friends/requests` |
| GET | `/friends/status/:userId` |
| POST | `/friends/request/:userId` |
| POST | `/friends/request/:userId/accept` |
| DELETE | `/friends/request/:userId` |
| DELETE | `/friends/:userId` |

### AliasGroupsModule (`alias-groups/`)

| Method | Path | RBAC |
|--------|------|------|
| GET | `/alias-groups/community/:id` | READ_ALIAS_GROUP |
| POST | `/alias-groups/community/:id` | CREATE_ALIAS_GROUP |
| GET | `/alias-groups/:id` | READ_ALIAS_GROUP |
| PUT | `/alias-groups/:id` | UPDATE_ALIAS_GROUP |
| DELETE | `/alias-groups/:id` | DELETE_ALIAS_GROUP |
| POST | `/alias-groups/:id/members` | CREATE_ALIAS_GROUP_MEMBER |
| PUT | `/alias-groups/:id/members` | UPDATE_ALIAS_GROUP_MEMBER |
| DELETE | `/alias-groups/:id/members/:userId` | DELETE_ALIAS_GROUP_MEMBER |

---

## Notifications

### NotificationsModule (`notifications/`)

| Method | Path |
|--------|------|
| GET | `/notifications` |
| GET | `/notifications/unread-count` |
| PUT | `/notifications/:id/read` |
| PUT | `/notifications/read-all` |
| DELETE | `/notifications/:id` |
| GET | `/notifications/settings` |
| PUT | `/notifications/settings` |
| PUT | `/notifications/channel-override/:channelId` |
| DELETE | `/notifications/channel-override/:channelId` |
| POST | `/notifications/debug/test` |
| GET | `/notifications/debug/subscriptions` |
| POST | `/notifications/debug/clear` |

**Gateway:** Emission-only — `NEW_NOTIFICATION`, `NOTIFICATION_READ`

### PushNotificationsModule (`push-notifications/`)

| Method | Path |
|--------|------|
| GET | `/push/vapid-public-key` |
| POST | `/push/subscribe` |
| DELETE | `/push/unsubscribe` |
| GET | `/push/status` |
| POST | `/push/debug/test` |

---

## Admin & Settings

### InstanceModule (`instance/`)

| Method | Path | RBAC |
|--------|------|------|
| GET | `/instance/settings/public` | Public |
| GET | `/instance/settings` | READ_INSTANCE_SETTINGS |
| PATCH | `/instance/settings` | UPDATE_INSTANCE_SETTINGS |
| GET | `/instance/stats` | READ_INSTANCE_STATS |

### OnboardingModule (`onboarding/`)

| Method | Path | Auth |
|--------|------|------|
| GET | `/onboarding/status` | Public |
| POST | `/onboarding/setup` | Public (throttled) |

### InviteModule (`invite/`)

| Method | Path | RBAC |
|--------|------|------|
| POST | `/invite` | CREATE_INSTANCE_INVITE |
| GET | `/invite` | READ_INSTANCE_INVITE |
| GET | `/invite/public/:code` | Public |
| GET | `/invite/:code` | JWT |
| DELETE | `/invite/:code` | DELETE_INSTANCE_INVITE |

### ModerationModule (`moderation/`)

| Method | Path | RBAC |
|--------|------|------|
| POST | `/moderation/ban/:communityId/:userId` | BAN_USER |
| DELETE | `/moderation/ban/:communityId/:userId` | UNBAN_USER |
| POST | `/moderation/timeout/:communityId/:userId` | TIMEOUT_USER |
| DELETE | `/moderation/timeout/:communityId/:userId` | TIMEOUT_USER |
| GET | `/moderation/timeout/:communityId/:userId/status` | — |
| POST | `/moderation/kick/:communityId/:userId` | KICK_USER |
| POST | `/moderation/messages/:messageId/delete` | DELETE_ANY_MESSAGE |
| POST | `/moderation/messages/:messageId/pin` | PIN_MESSAGE |
| DELETE | `/moderation/messages/:messageId/pin` | UNPIN_MESSAGE |
| GET | `/moderation/messages/:communityId/pinned` | READ_MESSAGE |
| GET | `/moderation/logs/:communityId` | VIEW_MODERATION_LOGS |

### StorageQuotaModule (`storage-quota/`)

| Method | Path | RBAC |
|--------|------|------|
| GET | `/storage/my-usage` | — |
| GET | `/storage/instance` | MANAGE_USER_STORAGE |
| GET | `/storage/users` | MANAGE_USER_STORAGE |
| POST | `/storage/users/:userId/quota` | MANAGE_USER_STORAGE |

### AppearanceSettingsModule (`appearance-settings/`)

| Method | Path |
|--------|------|
| GET | `/appearance-settings` |
| PATCH | `/appearance-settings` |

---

## Files & Storage

### FileUploadModule (`file-upload/`)

| Method | Path |
|--------|------|
| POST | `/file-upload` | Multer multipart, MIME validation |
| DELETE | `/file-upload/:id` | Soft delete + quota decrement |

**Validators:** MIME-type-aware size limits per resource type (avatar, banner, attachment, emoji).

### FileModule (`file/`)

| Method | Path | Auth |
|--------|------|------|
| GET | `/file/:id/signed-url` | JWT |
| GET | `/file/:id/metadata` | Optional JWT |
| GET | `/file/:id` | FileAuthGuard (JWT or signed URL) |

**Guards:** `FileAuthGuard` (signed URL verification), `FileAccessGuard` (resource-level access checks).

---

## Endpoint Summary

| Category | Controllers | Endpoints | Gateways |
|----------|------------|-----------|----------|
| Auth & Roles | 2 | ~16 | — |
| Community & Channels | 4 | ~20 | — |
| Messaging | 4 | ~20 | 3 |
| Real-Time | 1 | 3 | 2 |
| Voice & Media | 5 | ~25 | 1 |
| Social | 2 | ~15 | — |
| Notifications | 2 | ~17 | 1 |
| Admin & Settings | 5 | ~20 | — |
| Files & Storage | 2 | ~5 | — |
| Health | 1 | 1 | — |
| **Total** | **~28** | **~142** | **7** |

---

## Cross-References

- Auth guards & RBAC details → [03-auth-and-rbac.md](./03-auth-and-rbac.md)
- WebSocket event system → [06-websocket-system.md](./06-websocket-system.md)
- Voice & replay services → [07-voice-and-media.md](./07-voice-and-media.md)
- Database models → [01-database-schema.md](./01-database-schema.md)
