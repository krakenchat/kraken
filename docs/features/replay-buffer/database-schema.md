# Replay Buffer - Database Schema

Complete database schema documentation for replay buffer feature.

## New Prisma Models

### EgressSession

Tracks active replay buffer recording sessions.

```prisma
model EgressSession {
  id          String    @id @default(auto()) @map("_id") @db.ObjectId
  egressId    String    @unique              // LiveKit egress ID
  userId      String    @db.ObjectId
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  communityId String?   @db.ObjectId
  community   Community? @relation(fields: [communityId], references: [id], onDelete: Cascade)
  roomName    String                        // LiveKit room name (matches channel ID)
  quality     String                        // "720p", "1080p", "1440p"
  status      String                        // "active", "stopped", "failed"
  segmentPath String                        // File path: /replay-buffer/{room}/{user}/
  startedAt   DateTime
  endedAt     DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([userId, status])
  @@index([roomName, status])
  @@index([status, endedAt])
}
```

**Fields**:
- `egressId`: Unique ID from LiveKit, used to control egress
- `userId`: Owner of the replay buffer session
- `communityId`: Optional, for enforcing per-community limits
- `roomName`: Voice channel where user is screen sharing
- `quality`: Quality preset used for encoding
- `status`: Current state (active/stopped/failed)
- `segmentPath`: Base directory where HLS segments are stored
- `startedAt`: When replay buffer was enabled
- `endedAt`: When replay buffer was stopped (null if active)

**Indexes**:
- `userId + status`: Find active sessions for a user
- `roomName + status`: Find active sessions in a room
- `status + endedAt`: Cleanup orphaned sessions

---

### ReplayClip

Metadata for captured replay clips.

```prisma
model ReplayClip {
  id              String    @id @default(auto()) @map("_id") @db.ObjectId
  userId          String    @db.ObjectId
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  communityId     String?   @db.ObjectId
  community       Community? @relation(fields: [communityId], references: [id], onDelete: SetNull)
  roomName        String                        // For context (which channel)
  durationSeconds Int                           // Actual duration (may be +10s from request)
  fileId          String    @db.ObjectId
  file            File      @relation(fields: [fileId], references: [id], onDelete: Cascade)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([userId, createdAt])
  @@index([communityId, createdAt])
}
```

**Fields**:
- `userId`: Owner of the clip
- `communityId`: Optional, for context/organization
- `roomName`: Which channel clip was captured from
- `durationSeconds`: Actual clip duration (e.g., 310 seconds = 5min10s)
- `fileId`: Reference to File model (MP4 file)

**Cascade Behavior**:
- Delete user → Delete clips (onDelete: Cascade)
- Delete file → Delete clip record (onDelete: Cascade)
- Delete community → Keep clip, set communityId=null (onDelete: SetNull)

---

### CommunityReplayConfig

Per-community replay buffer configuration.

```prisma
model CommunityReplayConfig {
  id            String    @id @default(auto()) @map("_id") @db.ObjectId
  communityId   String    @unique @db.ObjectId
  community     Community @relation(fields: [communityId], references: [id], onDelete: Cascade)
  maxConcurrent Int       @default(5)         // Max simultaneous replay buffers
  enabled       Boolean   @default(true)       // Feature toggle
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

**Fields**:
- `communityId`: Unique per community
- `maxConcurrent`: Maximum number of simultaneous replay buffers (default: 5)
- `enabled`: Feature toggle to disable replay buffer for community

**Usage**:
```typescript
// Check if community has reached limit
const config = await db.communityReplayConfig.findUnique({
  where: { communityId },
});

const activeCount = await db.egressSession.count({
  where: { communityId, status: 'active' },
});

if (activeCount >= config.maxConcurrent) {
  throw new TooManyRequestsException('Community replay buffer limit reached');
}
```

---

### UserReplayQuota

Per-user storage quota for saved replays.

```prisma
model UserReplayQuota {
  id         String   @id @default(auto()) @map("_id") @db.ObjectId
  userId     String   @unique @db.ObjectId
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  quotaBytes BigInt   @default(5368709120)   // 5GB default
  usedBytes  BigInt   @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

**Fields**:
- `userId`: Unique per user
- `quotaBytes`: Total quota in bytes (default: 5GB = 5,368,709,120 bytes)
- `usedBytes`: Currently used storage

**Usage**:
```typescript
// Check quota before capture
const quota = await db.userReplayQuota.findUnique({ where: { userId } });
if (quota.usedBytes >= quota.quotaBytes) {
  throw new InsufficientStorageException('User quota exceeded');
}

// Update quota after capture
await db.userReplayQuota.update({
  where: { userId },
  data: { usedBytes: { increment: fileSizeBytes } },
});

// Free quota after delete
await db.userReplayQuota.update({
  where: { userId },
  data: { usedBytes: { decrement: fileSizeBytes } },
});
```

---

## Enum Updates

### ResourceType

Add new enum value for replay clips.

```prisma
enum ResourceType {
  MESSAGE_ATTACHMENT
  USER_AVATAR
  USER_BANNER
  COMMUNITY_ICON
  COMMUNITY_BANNER
  CHANNEL_ATTACHMENT
  REPLAY_CLIP          // NEW
}
```

---

## Existing Model Updates

### User Model

Add relations to new models.

```prisma
model User {
  // ... existing fields

  // Replay buffer relations
  egressSessions     EgressSession[]
  replayClips        ReplayClip[]
  replayQuota        UserReplayQuota?
}
```

### Community Model

Add relations to new models.

```prisma
model Community {
  // ... existing fields

  // Replay buffer relations
  egressSessions     EgressSession[]
  replayClips        ReplayClip[]
  replayConfig       CommunityReplayConfig?
}
```

### File Model

Add relation to ReplayClip.

```prisma
model File {
  // ... existing fields

  // Replay buffer relation
  replayClips        ReplayClip[]
}
```

---

## Queries & Examples

### Start Replay Buffer

```typescript
// Create egress session
const session = await prisma.egressSession.create({
  data: {
    egressId: livekitEgressId,
    userId,
    communityId,
    roomName,
    quality: '1080p',
    status: 'active',
    segmentPath: `/replay-buffer/${roomName}/${userId}`,
    startedAt: new Date(),
  },
});
```

### Capture Replay

```typescript
// Create clip record
const clip = await prisma.replayClip.create({
  data: {
    userId,
    communityId,
    roomName,
    durationSeconds: actualDuration,
    fileId: fileRecord.id,
  },
  include: {
    file: true,  // Include file data in response
  },
});
```

### List User Clips

```typescript
const clips = await prisma.replayClip.findMany({
  where: { userId },
  include: {
    file: {
      select: {
        filename: true,
        size: true,
        storagePath: true,
      },
    },
  },
  orderBy: { createdAt: 'desc' },
  take: limit,
  skip: offset,
});
```

### Check Community Limit

```typescript
const [config, activeCount] = await Promise.all([
  prisma.communityReplayConfig.findUnique({
    where: { communityId },
  }),
  prisma.egressSession.count({
    where: { communityId, status: 'active' },
  }),
]);

const hasCapacity = activeCount < (config?.maxConcurrent || 5);
```

### Cleanup Orphaned Sessions

```typescript
const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);

const orphanedSessions = await prisma.egressSession.findMany({
  where: {
    status: 'active',
    startedAt: { lt: threeHoursAgo },
  },
});

for (const session of orphanedSessions) {
  await livekitClient.stopEgress(session.egressId);
  await prisma.egressSession.update({
    where: { id: session.id },
    data: { status: 'stopped', endedAt: new Date() },
  });
}
```

---

## Migration Script

```bash
# Generate Prisma client with new models
docker compose run backend npm run prisma:generate

# Push schema changes to MongoDB
docker compose run backend npm run prisma:push

# Verify in Prisma Studio
docker compose run -p 5555:5555 backend npx prisma studio
```

---

## Next Steps

- Review schema in Prisma Studio
- Add seed data for testing
- Implement query functions in service layer
- Add indexes for performance
