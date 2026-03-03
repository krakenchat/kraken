# 01 — Database Models & Relationships

> PostgreSQL 17 with Prisma 6.6.0 ORM. Schema at `backend/prisma/schema.prisma`.
> **35 models, 11 enums, 40+ indexes, 150+ relations.**

---

## Table of Contents

- [Model Summary](#model-summary)
- [Enums](#enums)
- [Core Models](#core-models)
- [Messaging Models](#messaging-models)
- [Community & Channel Models](#community--channel-models)
- [Auth & Session Models](#auth--session-models)
- [Social Models](#social-models)
- [File & Storage Models](#file--storage-models)
- [Notification Models](#notification-models)
- [Moderation Models](#moderation-models)
- [Voice & Replay Models](#voice--replay-models)
- [Settings Models](#settings-models)
- [Cascade Delete Chains](#cascade-delete-chains)
- [Notable Design Decisions](#notable-design-decisions)

---

## Model Summary

| # | Model | Purpose | Key Relations |
|---|-------|---------|---------------|
| 1 | User | Core user account | Hub with 40+ relations |
| 2 | RefreshToken | JWT token family tracking | → User |
| 3 | Community | Server/workspace | → Channels, Memberships, Roles |
| 4 | Channel | Text/voice channel | → Community, Messages |
| 5 | Message | Core messaging | → Channel/DM, Author, Spans, Reactions |
| 6 | MessageSpan | Rich text annotations | → Message (mentions, formatting) |
| 7 | MessageReaction | Emoji reactions | → Message, User |
| 8 | MessageAttachment | File references | → Message, File |
| 9 | ThreadSubscriber | Thread notification tracking | → User, Message |
| 10 | ReadReceipt | Message read watermarks | → User, Channel/DM |
| 11 | Membership | User ↔ Community | → User, Community |
| 12 | ChannelMembership | Private channel access | → User, Channel |
| 13 | Role | RBAC role definitions | → Community (or instance) |
| 14 | UserRoles | User ↔ Role assignment | → User, Role, Community |
| 15 | DirectMessageGroup | 1:1 and group DMs | → Members, Messages |
| 16 | DirectMessageGroupMember | DM membership | → DirectMessageGroup, User |
| 17 | Friendship | Friend requests/status | → User (A), User (B) |
| 18 | UserBlock | User blocking | → Blocker, Blocked |
| 19 | File | Polymorphic file storage | → User, Community, Message |
| 20 | InstanceInvite | Invite codes | → User, DefaultCommunities |
| 21 | InstanceInviteUsage | Invite tracking | → Invite, User |
| 22 | InstanceInviteDefaultCommunity | Invite → Community junction | → Invite, Community |
| 23 | InstanceSettings | Global instance config | Singleton |
| 24 | Notification | User notifications | → User, Message, Channel |
| 25 | UserNotificationSettings | Notification preferences | → User (1:1) |
| 26 | ChannelNotificationOverride | Per-channel notification level | → User, Channel |
| 27 | AliasGroup | Group mentions | → Community, Members |
| 28 | AliasGroupMember | Alias → User junction | → AliasGroup, User |
| 29 | CommunityBan | Ban enforcement | → Community, User, Moderator |
| 30 | CommunityTimeout | Temporary muting | → Community, User, Moderator |
| 31 | ModerationLog | Audit trail | → Community, Moderator, Target |
| 32 | EgressSession | LiveKit recording | → User, Channel |
| 33 | ReplayClip | Saved video clips | → User, File, Channel |
| 34 | PushSubscription | Web push endpoints | → User |
| 35 | UserAppearanceSettings | UI theme preferences | → User (1:1) |

---

## Enums

| Enum | Values | Usage |
|------|--------|-------|
| **InstanceRole** | `OWNER`, `USER` | `User.role` — instance-level permission tier |
| **RegistrationMode** | `OPEN`, `INVITE_ONLY`, `CLOSED` | `InstanceSettings.registrationMode` |
| **ChannelType** | `TEXT`, `VOICE` | `Channel.type` |
| **FileType** | `IMAGE`, `VIDEO`, `AUDIO`, `DOCUMENT`, `OTHER` | `File.fileType` |
| **ResourceType** | `USER_AVATAR`, `USER_BANNER`, `COMMUNITY_AVATAR`, `COMMUNITY_BANNER`, `MESSAGE_ATTACHMENT`, `CUSTOM_EMOJI`, `REPLAY_CLIP` | `File.resourceType` |
| **StorageType** | `LOCAL`, `S3`, `AZURE_BLOB` | `File.storageType` |
| **FriendshipStatus** | `PENDING`, `ACCEPTED`, `BLOCKED` | `Friendship.status` |
| **SpanType** | `PLAINTEXT`, `USER_MENTION`, `SPECIAL_MENTION`, `COMMUNITY_MENTION`, `ALIAS_MENTION` | `MessageSpan.type` |
| **NotificationType** | `USER_MENTION`, `SPECIAL_MENTION`, `DIRECT_MESSAGE`, `CHANNEL_MESSAGE`, `THREAD_REPLY` | `Notification.type` |
| **ModerationAction** | `BAN_USER`, `UNBAN_USER`, `KICK_USER`, `TIMEOUT_USER`, `REMOVE_TIMEOUT`, `DELETE_MESSAGE`, `PIN_MESSAGE`, `UNPIN_MESSAGE` | `ModerationLog.action` |
| **RbacActions** | 50 granular permissions | `Role.actions[]` — see [03-auth-and-rbac.md](./03-auth-and-rbac.md) |

---

## Core Models

### User

The central hub with 40+ relations. Stores auth credentials, profile, storage quotas.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `username` | String | Unique |
| `email` | String? | Unique, nullable |
| `verified` | Boolean | Email verification |
| `hashedPassword` | String | bcrypt |
| `role` | InstanceRole | `OWNER` or `USER` |
| `displayName` | String? | Profile display name |
| `bio` | String? | Max 500 chars |
| `status` | String? | Custom status, max 128 chars |
| `statusUpdatedAt` | DateTime? | |
| `avatarUrl` | FK → File? | |
| `bannerUrl` | FK → File? | |
| `lastSeen` | DateTime? | Presence tracking |
| `storageQuotaBytes` | BigInt | Default 50GB |
| `storageUsedBytes` | BigInt | Cached total |
| `banned` | Boolean | Instance-wide ban |
| `bannedAt` | DateTime? | |
| `bannedById` | FK → User? | SetNull |

> **Review Point:** `storageUsedBytes` is a cached counter. A daily cron (3 AM) recalculates from actual files. Race conditions between concurrent uploads could cause drift until the next recalculation.

---

## Messaging Models

### Message

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `channelId` | FK → Channel? | For channel messages |
| `directMessageGroupId` | FK → DM? | For DM messages |
| `authorId` | FK → User? | SetNull on user delete |
| `sentAt` | DateTime | Default: now |
| `editedAt` | DateTime? | |
| `deletedAt` | DateTime? | Soft delete |
| `pendingAttachments` | Int? | Tracks files still uploading |
| `searchText` | Text? | Flattened from spans for FTS |
| `pinned` | Boolean | |
| `pinnedAt` | DateTime? | |
| `pinnedBy` | FK → User? | |
| `deletedBy` | FK → User? | Moderator deletion |
| `deletedByReason` | Text? | |
| `parentMessageId` | FK → Message? | Threading (NoAction) |
| `replyCount` | Int | Denormalized thread count |
| `lastReplyAt` | DateTime? | |

**Indexes:** `[channelId, sentAt]`, `[channelId, authorId, sentAt]` (slowmode), `[directMessageGroupId, sentAt]`, `[channelId, pinned]`, `[parentMessageId]`, `[authorId]`

> **Review Point:** `authorId` uses SetNull on delete — messages from deleted users remain with `null` author. This preserves conversation history but the frontend needs to handle missing author gracefully.

### MessageSpan

Structured text annotations for rich messages.

| Field | Type | Notes |
|-------|------|-------|
| `type` | SpanType | PLAINTEXT, USER_MENTION, SPECIAL_MENTION, etc. |
| `position` | Int | Ordering within message |
| `text` | Text? | Content for PLAINTEXT spans |
| `userId` | FK → User? | For USER_MENTION |
| `specialKind` | String? | "here", "channel" |
| `communityId` | FK → Community? | COMMUNITY_MENTION |
| `aliasId` | FK → AliasGroup? | ALIAS_MENTION |

### MessageReaction

| Unique constraint | `[messageId, emoji, userId]` |
|---|---|

### MessageAttachment

| Unique constraint | `[messageId, fileId]` |
|---|---|

### ThreadSubscriber

| Unique constraint | `[userId, parentMessageId]` |
|---|---|

---

## Community & Channel Models

### Community

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `name` | String | Unique |
| `description` | String? | |
| `avatar` | FK → File? | |
| `banner` | FK → File? | |

### Channel

| Field | Type | Notes |
|-------|------|-------|
| `type` | ChannelType | TEXT or VOICE |
| `position` | Int | Ordering |
| `slowmodeSeconds` | Int | 0 = disabled |
| `isPrivate` | Boolean | Requires ChannelMembership for access |

**Unique constraint:** `[communityId, name]`
**Index:** `[communityId, type, position]`

> **Review Point:** VOICE channels use channel ID as LiveKit room ID. Channel deletion must ensure LiveKit room cleanup and voice presence eviction.

### ChannelMembership

Private channel access control. `addedBy` tracks who granted access.

### Membership

Community membership. **Unique:** `[userId, communityId]`

---

## Auth & Session Models

### RefreshToken

Token rotation with reuse detection (RFC 9700).

| Field | Type | Notes |
|-------|------|-------|
| `tokenHash` | String | bcrypt hashed |
| `familyId` | String? | Groups tokens from same login |
| `consumed` | Boolean | Marked on rotation |
| `consumedAt` | DateTime? | |
| `deviceName` | String? | "Chrome on Windows", "Kraken Desktop (macOS)" |
| `userAgent` | String? | |
| `ipAddress` | String? | |
| `lastUsedAt` | DateTime | Session activity tracking |

**Indexes:** `[userId, lastUsedAt]`, `[familyId]`

> **Review Point:** If a consumed token is replayed, the entire `familyId` is invalidated. Consumed tokens are kept for 7 days for detection before cleanup. See [03-auth-and-rbac.md](./03-auth-and-rbac.md).

### InstanceInvite

| Field | Type | Notes |
|-------|------|-------|
| `code` | String | Unique invite code |
| `maxUses` | Int? | null = unlimited |
| `uses` | Int | Counter |
| `validUntil` | DateTime? | null = no expiration |
| `disabled` | Boolean | Admin can disable |

Related: `InstanceInviteUsage` (who used it), `InstanceInviteDefaultCommunity` (auto-join communities).

### InstanceSettings

Singleton configuration row.

| Field | Type | Notes |
|-------|------|-------|
| `name` | String | "Kraken" |
| `registrationMode` | RegistrationMode | OPEN, INVITE_ONLY, CLOSED |
| `defaultStorageQuotaBytes` | BigInt | 50GB |
| `maxFileSizeBytes` | BigInt | 500MB |
| `vapidPublicKey` | String? | Web push — auto-generated if not set |
| `vapidPrivateKey` | String? | |

---

## Social Models

### Friendship

| Field | Type | Notes |
|-------|------|-------|
| `userAId` | FK → User | Requester |
| `userBId` | FK → User | Recipient |
| `status` | FriendshipStatus | PENDING, ACCEPTED, BLOCKED |

**Unique:** `[userAId, userBId]`

### UserBlock

Separate from friendship blocking. **Unique:** `[blockerId, blockedId]`

### DirectMessageGroup

| Field | Type | Notes |
|-------|------|-------|
| `name` | String? | null for 1:1, set for groups |
| `isGroup` | Boolean | false = 1:1, true = group DM |

Members tracked via `DirectMessageGroupMember` junction.

---

## File & Storage Models

### File

Polymorphic file storage with typed foreign keys.

| Field | Type | Notes |
|-------|------|-------|
| `filename` | String | |
| `mimeType` | String | |
| `fileType` | FileType | IMAGE, VIDEO, AUDIO, DOCUMENT, OTHER |
| `size` | Int | Bytes |
| `checksum` | String | SHA-256 |
| `storageType` | StorageType | LOCAL, S3, AZURE_BLOB |
| `storagePath` | String | |
| `thumbnailPath` | String? | For videos |
| `resourceType` | ResourceType | What the file is used for |
| `fileUserId` | FK → User? | USER_AVATAR, USER_BANNER |
| `fileCommunityId` | FK → Community? | COMMUNITY_AVATAR, COMMUNITY_BANNER |
| `fileMessageId` | FK → Message? | MESSAGE_ATTACHMENT |
| `deletedAt` | DateTime? | Soft delete |

**Indexes:** `[uploadedById]`, `[deletedAt]`, `[fileUserId]`, `[fileCommunityId]`, `[fileMessageId]`

> **Review Point:** Typed FKs (`fileUserId`, `fileCommunityId`, `fileMessageId`) replace a polymorphic `resourceId` pattern. This provides referential integrity but means adding a new resource type requires a schema migration to add a new FK column.

---

## Notification Models

### Notification

| Field | Type | Notes |
|-------|------|-------|
| `type` | NotificationType | USER_MENTION, DM, THREAD_REPLY, etc. |
| `read` | Boolean | |
| `dismissed` | Boolean | |
| `parentMessageId` | FK → Message? | For THREAD_REPLY |

**Indexes:** `[userId, read]`, `[userId, createdAt]`

### UserNotificationSettings

Per-user preferences. 1:1 with User.

| Field | Type | Notes |
|-------|------|-------|
| `desktopEnabled` | Boolean | Desktop notifications |
| `playSound` | Boolean | |
| `doNotDisturb` | Boolean | |
| `dndStartTime` | String? | "HH:MM" format |
| `defaultChannelLevel` | String | "mentions" |
| `dmNotifications` | Boolean | |

### ChannelNotificationOverride

Per-user per-channel override. **Unique:** `[userId, channelId]`. Level: `'all'|'mentions'|'none'`.

---

## Moderation Models

### CommunityBan

| Field | Type | Notes |
|-------|------|-------|
| `expiresAt` | DateTime? | null = permanent |
| `active` | Boolean | |

**Unique:** `[communityId, userId]`

### CommunityTimeout

| Field | Type | Notes |
|-------|------|-------|
| `expiresAt` | DateTime | Always required (always temporary) |

**Unique:** `[communityId, userId]`

### ModerationLog

| Field | Type | Notes |
|-------|------|-------|
| `action` | ModerationAction | BAN_USER, KICK_USER, etc. |
| `metadata` | JSON? | Flexible additional data |

**Index:** `[communityId, createdAt]`

---

## Voice & Replay Models

### EgressSession

| Field | Type | Notes |
|-------|------|-------|
| `egressId` | String | Unique — LiveKit egress ID |
| `roomName` | String | LiveKit room name (= channel ID) |
| `segmentPath` | String | HLS segment directory |
| `status` | String | "active", "stopped", "failed" |

**Indexes:** `[userId, status]`, `[status, createdAt]`

### ReplayClip

| Field | Type | Notes |
|-------|------|-------|
| `durationSeconds` | Int | |
| `isPublic` | Boolean | Show on user's public profile |

**Index:** `[userId, capturedAt]`

---

## Settings Models

### UserAppearanceSettings

1:1 with User.

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `themeMode` | String | "dark" | "dark" or "light" |
| `accentColor` | String | "blue" | 12 colors available |
| `intensity` | String | "minimal" | "minimal", "balanced", "vibrant" |

---

## Cascade Delete Chains

```
Community (delete)
├── Channel[] (Cascade)
│   ├── Message[] (Cascade)
│   │   ├── MessageSpan[] (Cascade)
│   │   ├── MessageReaction[] (Cascade)
│   │   ├── MessageAttachment[] (Cascade)
│   │   ├── ThreadSubscriber[] (Cascade)
│   │   ├── ReadReceipt[] (Cascade)
│   │   └── Notification[] (Cascade)
│   ├── ChannelMembership[] (Cascade)
│   ├── ChannelNotificationOverride[] (Cascade)
│   ├── EgressSession[] (Cascade)
│   └── ReplayClip[] (Cascade)
├── Role[] (Cascade) → UserRoles[] (Cascade)
├── AliasGroup[] (Cascade) → AliasGroupMember[] (Cascade)
├── CommunityBan[] (Cascade)
├── CommunityTimeout[] (Cascade)
└── ModerationLog[] (Cascade)

User (delete)
├── Message[] (as author → SetNull, preserves messages)
├── MessageReaction[] (Cascade)
├── ChannelMembership[] (Cascade)
├── ThreadSubscriber[] (Cascade)
├── ReadReceipt[] (Cascade)
├── Notification[] (Cascade)
├── UserNotificationSettings (Cascade)
├── UserAppearanceSettings (Cascade)
├── UserRoles[] (Cascade)
├── DirectMessageGroupMember[] (Cascade)
├── Friendship[] (both directions, Cascade)
├── UserBlock[] (both directions, Cascade)
├── RefreshToken[] (Cascade)
├── EgressSession[] (Cascade)
├── ReplayClip[] (Cascade)
├── PushSubscription[] (Cascade)
└── AliasGroupMember[] (Cascade)
```

> **Review Point:** User deletion sets `Message.authorId` to null (SetNull) rather than cascading. This preserves conversation history but creates orphan messages. The frontend must handle null authors gracefully everywhere messages are displayed.

---

## Notable Design Decisions

### 1. Span-Based Rich Text
Messages use `MessageSpan[]` for structured annotations rather than markdown. `searchText` is a flattened plaintext version for full-text search. This allows typed mentions and avoids markdown parsing ambiguity.

### 2. Token Family Rotation (RFC 9700)
`RefreshToken.familyId` groups tokens from the same login session. On rotation, old tokens are marked `consumed` (not deleted). If a consumed token is replayed, the entire family is invalidated — detecting token theft.

### 3. Typed Polymorphic FKs
`File` model uses separate FK columns (`fileUserId`, `fileCommunityId`, `fileMessageId`) instead of a single polymorphic `resourceId`. This provides database-level referential integrity at the cost of needing a migration for new resource types.

### 4. Denormalized Thread Counters
`Message.replyCount` and `lastReplyAt` are denormalized for performance. The service layer keeps these in sync when replies are added/deleted.

### 5. Dual-Context Messages
Messages can belong to either a Channel or a DirectMessageGroup (via mutually exclusive nullable FKs). This avoids a separate DM message table but requires null-checking context everywhere.

### 6. Redis-Backed Presence
User online status and voice presence use Redis with TTLs rather than database records. This provides fast lookups and automatic cleanup at the cost of being ephemeral. The database stores no presence data.

### 7. Read Receipt Watermarks
`ReadReceipt.lastReadMessageId` uses a watermark pattern — only the last-read message is tracked per user per channel/DM. This is space-efficient compared to tracking every individual message read.

### 8. Storage Quota Caching
`User.storageUsedBytes` is a cached counter incremented on upload and decremented on delete. A daily cron job recalculates from actual files to correct any drift.

---

## Cross-References

- RBAC actions enum → [03-auth-and-rbac.md](./03-auth-and-rbac.md)
- File upload/storage flow → [07-voice-and-media.md](./07-voice-and-media.md)
- Cascade delete code → [02-backend-modules.md](./02-backend-modules.md)
- Message span types → [06-websocket-system.md](./06-websocket-system.md)
