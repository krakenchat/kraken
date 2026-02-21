# Database Schema

Kraken uses **MongoDB** with **Prisma ORM**. Schema changes use `prisma db push` (no migrations). MongoDB runs as a replica set for change stream support.

---

## Core Models

### User

```prisma
model User {
  id             String       @id @default(auto()) @map("_id") @db.ObjectId
  username       String       @unique
  email          String?      @unique
  verified       Boolean      @default(false)
  hashedPassword String
  role           InstanceRole @default(USER)
  displayName    String?
  avatarUrl      String?
  lastSeen       DateTime?
  createdAt      DateTime     @default(now())

  memberships                       Membership[]
  UserRoles                         UserRoles[]
  RefreshToken                      RefreshToken[]
  ChannelMembership                 ChannelMembership[]
  directMessageGroupMemberships     DirectMessageGroupMember[]
  friendshipsA                      Friendship[] @relation("FriendshipA")
  friendshipsB                      Friendship[] @relation("FriendshipB")
}
```

### Community

```prisma
model Community {
  id          String       @id @default(auto()) @map("_id") @db.ObjectId
  name        String       @unique
  description String?
  avatar      String?
  banner      String?
  createdAt   DateTime     @default(now())

  memberships Membership[]
  channels    Channel[]
  UserRoles   UserRoles[]
}
```

### Channel

```prisma
model Channel {
  id          String      @id @default(auto()) @map("_id") @db.ObjectId
  name        String
  communityId String      @db.ObjectId
  type        ChannelType @default(TEXT)
  isPrivate   Boolean     @default(false)
  createdAt   DateTime    @default(now())

  community         Community?          @relation(fields: [communityId], references: [id], onDelete: Cascade)
  Message           Message[]
  ChannelMembership ChannelMembership[]

  @@unique([communityId, name])
}

enum ChannelType {
  TEXT
  VOICE
}
```

### Message

Messages use a **span-based rich text system** and support both channel and DM contexts.

```prisma
model Message {
  id                   String       @id @default(auto()) @map("_id") @db.ObjectId
  channelId            String?      @db.ObjectId
  directMessageGroupId String?      @db.ObjectId
  authorId             String
  spans                Span[]
  attachments          Attachment[]
  reactions            Reaction[]
  sentAt               DateTime     @default(now())
  editedAt             DateTime?
  deletedAt            DateTime?

  channel            Channel?            @relation(fields: [channelId], references: [id], onDelete: Cascade)
  directMessageGroup DirectMessageGroup? @relation(fields: [directMessageGroupId], references: [id], onDelete: Cascade)
}
```

#### Span System (Rich Text)

```prisma
type Span {
  type        SpanType
  text        String?
  userId      String?     // USER_MENTION
  specialKind String?     // SPECIAL_MENTION: "here", "everyone", "mods"
  channelId   String?     // CHANNEL_MENTION
  communityId String?     // COMMUNITY_MENTION
  aliasId     String?     // ALIAS_MENTION
}

enum SpanType {
  PLAINTEXT
  USER_MENTION
  SPECIAL_MENTION
  CHANNEL_MENTION
  COMMUNITY_MENTION
  ALIAS_MENTION
}
```

#### Embedded Types

```prisma
type Attachment {
  url      String
  filename String
  filetype String
  size     Int
}

type Reaction {
  emoji   String
  userIds String[]
}
```

---

## Membership & Access Control

### Membership (Community)

```prisma
model Membership {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  userId      String   @db.ObjectId
  communityId String   @db.ObjectId
  joinedAt    DateTime @default(now())

  user      User      @relation(fields: [userId], references: [id])
  community Community @relation(fields: [communityId], references: [id])

  @@unique([userId, communityId])
}
```

### ChannelMembership (Private Channels)

```prisma
model ChannelMembership {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  userId    String   @db.ObjectId
  channelId String   @db.ObjectId
  joinedAt  DateTime @default(now())
  addedBy   String?  @db.ObjectId

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  channel Channel @relation(fields: [channelId], references: [id], onDelete: Cascade)

  @@unique([userId, channelId])
}
```

### RBAC System

```prisma
model Role {
  id        String        @id @default(auto()) @map("_id") @db.ObjectId
  name      String        @unique
  actions   RbacActions[] @default([])
  createdAt DateTime      @default(now())

  UserRoles UserRoles[]
}

model UserRoles {
  id             String     @id @default(auto()) @map("_id") @db.ObjectId
  userId         String     @db.ObjectId
  communityId    String?    @db.ObjectId  // Null for instance-level roles
  roleId         String     @db.ObjectId
  isInstanceRole Boolean    @default(false)

  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  community Community? @relation(fields: [communityId], references: [id], onDelete: Cascade)
  role      Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@unique([userId, communityId, roleId])
}
```

---

## Direct Messaging

```prisma
model DirectMessageGroup {
  id        String                     @id @default(auto()) @map("_id") @db.ObjectId
  name      String?                    // Optional, for group DMs
  isGroup   Boolean                    @default(false)
  createdAt DateTime                   @default(now())

  members  DirectMessageGroupMember[]
  messages Message[]                   @relation("DirectMessageGroupMessages")
}

model DirectMessageGroupMember {
  id       String             @id @default(auto()) @map("_id") @db.ObjectId
  groupId  String             @db.ObjectId
  userId   String             @db.ObjectId
  joinedAt DateTime           @default(now())

  group DirectMessageGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  user  User               @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([groupId, userId])
}
```

---

## Social Features

### Friendship

```prisma
model Friendship {
  id        String           @id @default(auto()) @map("_id") @db.ObjectId
  userAId   String           @db.ObjectId
  userBId   String           @db.ObjectId
  status    FriendshipStatus @default(PENDING)
  createdAt DateTime         @default(now())

  userA User @relation("FriendshipA", fields: [userAId], references: [id], onDelete: Cascade)
  userB User @relation("FriendshipB", fields: [userBId], references: [id], onDelete: Cascade)

  @@unique([userAId, userBId])
}

enum FriendshipStatus {
  PENDING
  ACCEPTED
  BLOCKED
}
```

### Alias Groups (Mention Groups)

```prisma
model AliasGroup {
  id          String             @id @default(auto()) @map("_id") @db.ObjectId
  name        String
  communityId String             @db.ObjectId
  members     AliasGroupMember[]
  createdAt   DateTime           @default(now())

  @@unique([communityId, name])
}
```

---

## Relationships Diagram

```
User ──────┐
    │      ├── Membership ────────── Community
    │      ├── UserRoles ─────────── Role
    │      ├── ChannelMembership ─── Channel ── Community
    │      ├── DM Group Member ───── DirectMessageGroup ── Message
    │      └── Friendship (bidirectional)
    │
    └── Message ── Channel ── Community
```

---

## Query Patterns

### Get User's Communities

```typescript
const userCommunities = await prisma.membership.findMany({
  where: { userId },
  include: { community: { include: { channels: true } } },
});
```

### Paginated Messages

```typescript
const messages = await prisma.message.findMany({
  where: { channelId, deletedAt: null },
  orderBy: { sentAt: 'desc' },
  take: 50,
  skip: offset,
});
```

### Check User Permissions

```typescript
const userRoles = await prisma.userRoles.findMany({
  where: {
    userId,
    OR: [
      { communityId: null, isInstanceRole: true },
      { communityId },
    ],
  },
  include: { role: true },
});
```

---

## Schema Management

- **Development**: `prisma db push` applies changes directly
- **Production**: Coordinate schema changes carefully; back up before major changes
- **Indexing**: Prisma auto-creates indexes for `@unique` and `@@unique` constraints; compound indexes on `Message.channelId + sentAt` and `Membership.userId + communityId` are critical for performance
