# Database Schema & Architecture

Kraken uses **MongoDB** as its primary database with **Prisma** as the ORM layer. The schema is designed to support Discord-like functionality with communities, channels, messaging, and role-based permissions.

## 🗄️ Database Overview

### Technology Stack
- **Database**: MongoDB (with replica set for change streams)
- **ORM**: Prisma Client with MongoDB connector
- **Schema Management**: `prisma db push` (no migrations)
- **Type Safety**: Fully typed database operations with Prisma

### Database Configuration
```javascript
// mongo-init.js - Replica set initialization
rs.initiate({
  _id: "rs0",
  members: [{ _id: 0, host: "localhost:27017" }]
});
```

## 📊 Core Data Models

### User Management

#### **User Model**
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
  
  // Relationships
  memberships               Membership[]
  UserRoles                UserRoles[]
  RefreshToken             RefreshToken[]
  ChannelMembership        ChannelMembership[]
  directMessageGroupMemberships DirectMessageGroupMember[]
  friendshipsA             Friendship[] @relation("FriendshipA")
  friendshipsB             Friendship[] @relation("FriendshipB")
}
```

**Key Features:**
- Unique username and email constraints
- Instance-level roles (OWNER, USER)
- Avatar and display name support
- Comprehensive relationship mapping

#### **RefreshToken Model**
```prisma
model RefreshToken {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  userId    String   @db.ObjectId
  tokenHash String
  createdAt DateTime @default(now())
  expiresAt DateTime
  user      User     @relation(fields: [userId], references: [id])
}
```

### Community Structure

#### **Community Model**
```prisma
model Community {
  id          String       @id @default(auto()) @map("_id") @db.ObjectId
  name        String       @unique
  description String?
  avatar      String?
  banner      String?
  createdAt   DateTime     @default(now())
  
  // Relationships
  memberships Membership[]
  channels    Channel[]
  UserRoles   UserRoles[]
}
```

**Features:**
- Unique community names globally
- Rich media support (avatar, banner)
- Hierarchical role system

#### **Membership Model**
```prisma
model Membership {
  id          String    @id @default(auto()) @map("_id") @db.ObjectId
  userId      String    @db.ObjectId
  communityId String    @db.ObjectId
  joinedAt    DateTime  @default(now())
  
  user        User      @relation("UserMemberships", fields: [userId], references: [id])
  community   Community @relation("CommunityMemberships", fields: [communityId], references: [id])
  
  @@unique([userId, communityId])
}
```

### Channel System

#### **Channel Model**
```prisma
model Channel {
  id          String              @id @default(auto()) @map("_id") @db.ObjectId
  name        String
  communityId String              @db.ObjectId
  type        ChannelType         @default(TEXT)
  isPrivate   Boolean             @default(false)
  createdAt   DateTime            @default(now())
  
  // Relationships
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

**Key Features:**
- Text and voice channel types
- Private channel support
- Community-scoped unique names
- Cascade deletion with community

#### **ChannelMembership Model**
```prisma
model ChannelMembership {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  userId    String   @db.ObjectId
  channelId String   @db.ObjectId
  joinedAt  DateTime @default(now())
  addedBy   String?  @db.ObjectId // Who added this user (for private channels)
  
  user      User     @relation("UserChannelMemberships", fields: [userId], references: [id], onDelete: Cascade)
  channel   Channel  @relation("ChannelMembership", fields: [channelId], references: [id], onDelete: Cascade)
  
  @@unique([userId, channelId])
}
```

### Messaging System

#### **Message Model**
```prisma
model Message {
  id                   String       @id @default(auto()) @map("_id") @db.ObjectId
  channelId            String?      @db.ObjectId // Optional for DMs
  directMessageGroupId String?      @db.ObjectId // For DMs
  authorId             String
  spans                Span[]       // Rich text content
  attachments          Attachment[]
  reactions            Reaction[]
  sentAt               DateTime     @default(now())
  editedAt             DateTime?
  deletedAt            DateTime?
  
  channel            Channel?            @relation(fields: [channelId], references: [id], onDelete: Cascade)
  directMessageGroup DirectMessageGroup? @relation("DirectMessageGroupMessages", fields: [directMessageGroupId], references: [id], onDelete: Cascade)
}
```

**Advanced Features:**
- **Flexible Content**: Span-based rich text system
- **Dual Context**: Supports both channel and DM messages
- **Soft Deletion**: Messages marked as deleted, not removed
- **Edit History**: Track message modifications

#### **Span System** (Rich Text)
```prisma
type Span {
  type        SpanType
  text        String?
  userId      String? // For USER_MENTION
  specialKind String? // For SPECIAL_MENTION: "here", "everyone", "mods"
  channelId   String? // For CHANNEL_MENTION
  communityId String? // For COMMUNITY_MENTION
  aliasId     String? // For ALIAS_MENTION
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

#### **Attachment & Reaction Types**
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

### Direct Messaging

#### **DirectMessageGroup Model**
```prisma
model DirectMessageGroup {
  id        String                     @id @default(auto()) @map("_id") @db.ObjectId
  name      String? // Optional, for group DMs
  isGroup   Boolean                    @default(false) // true for group DMs, false for 1:1
  createdAt DateTime                   @default(now())
  
  members   DirectMessageGroupMember[]
  messages  Message[]                  @relation("DirectMessageGroupMessages")
}

model DirectMessageGroupMember {
  id       String             @id @default(auto()) @map("_id") @db.ObjectId
  groupId  String             @db.ObjectId
  userId   String             @db.ObjectId
  joinedAt DateTime           @default(now())
  
  group    DirectMessageGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  user     User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([groupId, userId])
}
```

### Social Features

#### **Friendship Model**
```prisma
model Friendship {
  id        String           @id @default(auto()) @map("_id") @db.ObjectId
  userAId   String           @db.ObjectId
  userBId   String           @db.ObjectId
  status    FriendshipStatus @default(PENDING)
  createdAt DateTime         @default(now())
  
  userA     User @relation("FriendshipA", fields: [userAId], references: [id], onDelete: Cascade)
  userB     User @relation("FriendshipB", fields: [userBId], references: [id], onDelete: Cascade)
  
  @@unique([userAId, userBId])
}

enum FriendshipStatus {
  PENDING
  ACCEPTED
  BLOCKED
}
```

## 🔐 Role-Based Access Control (RBAC)

### Role System

#### **Role Model**
```prisma
model Role {
  id        String        @id @default(auto()) @map("_id") @db.ObjectId
  name      String        @unique
  actions   RbacActions[] @default([])
  createdAt DateTime      @default(now())
  
  UserRoles UserRoles[]
}
```

#### **UserRoles Model** (Junction Table)
```prisma
model UserRoles {
  id             String     @id @default(auto()) @map("_id") @db.ObjectId
  userId         String     @db.ObjectId
  communityId    String?    @db.ObjectId // Null for instance-level roles
  roleId         String     @db.ObjectId
  isInstanceRole Boolean    @default(false)
  
  user           User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  community      Community? @relation(fields: [communityId], references: [id], onDelete: Cascade)
  role           Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  
  @@unique([userId, communityId, roleId])
}
```

### Permission Actions
```prisma
enum RbacActions {
  // Message permissions
  CREATE_MESSAGE
  DELETE_MESSAGE
  READ_MESSAGE
  
  // Channel permissions
  CREATE_CHANNEL
  UPDATE_CHANNEL
  DELETE_CHANNEL
  READ_CHANNEL
  JOIN_CHANNEL
  
  // Community permissions
  CREATE_COMMUNITY
  UPDATE_COMMUNITY
  DELETE_COMMUNITY
  READ_COMMUNITY
  READ_ALL_COMMUNITIES
  
  // Member management
  CREATE_MEMBER
  UPDATE_MEMBER
  DELETE_MEMBER
  READ_MEMBER
  
  // Role management
  CREATE_ROLE
  UPDATE_ROLE
  DELETE_ROLE
  READ_ROLE
  
  // Additional permissions...
}
```

## 🏷️ Alias System (Mention Groups)

```prisma
model AliasGroup {
  id          String             @id @default(auto()) @map("_id") @db.ObjectId
  name        String
  communityId String             @db.ObjectId
  members     AliasGroupMember[]
  createdAt   DateTime           @default(now())
  
  @@unique([communityId, name])
}

model AliasGroupMember {
  id           String      @id @default(auto()) @map("_id") @db.ObjectId
  aliasGroupId String      @db.ObjectId
  userId       String      @db.ObjectId
  aliasGroup   AliasGroup? @relation(fields: [aliasGroupId], references: [id])
}
```

## 🎫 Invitation System

```prisma
model InstanceInvite {
  id                 String    @id @default(auto()) @map("_id") @db.ObjectId
  code               String    @unique
  createdById        String?   @db.ObjectId
  defaultCommunityId String[]  @db.ObjectId
  maxUses            Int?
  uses               Int       @default(0)
  validUntil         DateTime?
  usedByIds          String[]  @db.ObjectId
  disabled           Boolean   @default(false)
  createdAt          DateTime  @default(now())
  
  createdBy          User?     @relation(fields: [createdById], references: [id])
}
```

## 📊 Database Relationships Diagram

```
User ──────┐
    │      │
    │      ├── Membership ── Community
    │      │                     │
    │      ├── UserRoles ────────┼── Role
    │      │     │               │
    │      │     └── Community ──┘
    │      │
    │      ├── ChannelMembership ── Channel ── Community
    │      │
    │      ├── DirectMessageGroupMember ── DirectMessageGroup ── Message
    │      │
    │      └── Friendship (bidirectional)
    │
    └── Message ── Channel ── Community
```

## 🔍 Query Patterns

### Common Queries

#### **Get User's Communities**
```typescript
const userCommunities = await prisma.membership.findMany({
  where: { userId },
  include: {
    community: {
      include: {
        channels: true
      }
    }
  }
});
```

#### **Get Channel Messages with Pagination**
```typescript
const messages = await prisma.message.findMany({
  where: { 
    channelId,
    deletedAt: null 
  },
  orderBy: { sentAt: 'desc' },
  take: 50,
  skip: offset,
});
```

#### **Check User Permissions**
```typescript
const userRoles = await prisma.userRoles.findMany({
  where: {
    userId,
    OR: [
      { communityId: null, isInstanceRole: true },
      { communityId }
    ]
  },
  include: { role: true }
});
```

### Performance Considerations

#### **Indexing Strategy**
- `User.username` and `User.email` (unique indexes)
- `Message.channelId` and `Message.sentAt` (compound index)
- `Membership.userId` and `Membership.communityId` (compound index)
- `UserRoles.userId`, `UserRoles.communityId`, `UserRoles.roleId` (compound index)

#### **Query Optimization**
- Use `include` strategically to avoid N+1 queries
- Implement pagination for message lists
- Cache frequently accessed data (user permissions, community lists)
- Use MongoDB aggregation pipelines for complex queries

## 🚀 Data Migration Strategy

### Schema Evolution
Since Kraken uses `prisma db push` instead of migrations:
- **Development**: Schema changes applied directly
- **Production**: Careful coordination required for schema changes
- **Backup Strategy**: Database backups before major schema changes

### Data Seeding
```typescript
// prisma/seed.ts
const defaultRoles = [
  {
    name: 'Community Admin',
    actions: [...allAdminActions]
  },
  {
    name: 'Moderator', 
    actions: [...moderatorActions]
  }
];
```

## 🔒 Security Considerations

### Data Protection
- **Password Hashing**: bcrypt for user passwords
- **Sensitive Data**: No plaintext secrets in database
- **Audit Trail**: Soft deletion for messages and users
- **Access Control**: RBAC system prevents unauthorized access

### Connection Security
- **Replica Set**: Required for change streams and production deployment
- **Connection Pooling**: Managed by Prisma client
- **Connection Limits**: Configured via environment variables

This database schema provides a robust foundation for a Discord-like application with room for future expansion and feature additions.