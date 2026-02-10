# Backend Code Review: Remaining Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the remaining items from the backend code review, fix an audit issue found in existing changes, and clean up code quality issues.

**Architecture:** Continue the pattern established by the first batch of fixes — targeted, minimal changes that address specific issues without over-engineering. Use existing NestJS patterns (guards, services, Prisma). Extract shared utilities only where duplication is clear and simple.

**Tech Stack:** NestJS, Prisma (MongoDB), TypeScript, Jest with @suites/unit TestBed automocks

---

## Audit Fix (from previous session)

### Task 1: Fix missing storage quota decrement on file delete

The `file-upload.service.ts` `remove()` method soft-deletes files but does NOT decrement the user's storage quota. Deleted files count toward quota forever.

**Files:**
- Modify: `backend/src/file-upload/file-upload.service.ts:172-193`
- Modify: `backend/src/file-upload/file-upload.service.spec.ts:383-444`

**Step 1: Check if StorageQuotaService exists and what methods it has**

Read `backend/src/storage-quota/storage-quota.service.ts` to understand the API. Look for a method that decrements or releases storage.

**Step 2: Update `remove()` to decrement quota**

In `file-upload.service.ts`, the `remove()` method currently only does a soft delete. Before the update, fetch the file size, and after the soft delete call `storageQuotaService` to release the quota.

```typescript
async remove(id: string, userId: string) {
  const file = await this.databaseService.file.findUnique({
    where: { id },
    select: { uploadedById: true, size: true },
  });

  if (!file) {
    throw new NotFoundException('File not found');
  }

  if (file.uploadedById !== userId) {
    throw new ForbiddenException('You can only delete your own files');
  }

  const result = await this.databaseService.file.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  // Release storage quota for the deleted file
  if (file.size) {
    await this.storageQuotaService.releaseStorage(userId, file.size);
  }

  return result;
}
```

Note: Verify the actual method name on StorageQuotaService — it may be `releaseStorage`, `decrementStorage`, or similar. If no such method exists, add one.

**Step 3: Update tests to verify quota decrement**

Add a test that verifies `storageQuotaService.releaseStorage` is called with the correct userId and file size after deletion.

**Step 4: Run tests**

```bash
docker compose run --rm backend npx jest file-upload --verbose
```

---

## HIGH Priority

### Task 2: Complete community cascade deletes

`community.service.ts:303-329` cascade delete is missing cleanup for: `ReadReceipt`, `Notification`, `ChannelNotificationOverride`, `ThreadSubscriber`, `AliasGroup`, `AliasGroupMember`, `CommunityBan`, `CommunityTimeout`, `ModerationLog`, and `Role`.

Some of these (CommunityBan, CommunityTimeout, ModerationLog) have `onDelete: Cascade` on the community relation, but since we manually delete channels and messages first (bypassing Prisma's emulated cascade for those intermediaries), related records like Notification and ReadReceipt that cascade from channels/messages may not get cleaned up.

**Files:**
- Modify: `backend/src/community/community.service.ts:303-329`

**Step 1: Add missing deletes to cascadeDeleteCommunity**

Add explicit deletes BEFORE channels and messages are deleted (order matters — delete dependents first):

```typescript
private async cascadeDeleteCommunity(id: string): Promise<void> {
  await this.databaseService.$transaction(async (tx) => {
    // Get all channel IDs for this community (needed for dependent record cleanup)
    const channels = await tx.channel.findMany({
      where: { communityId: id },
      select: { id: true },
    });
    const channelIds = channels.map((c) => c.id);

    // Delete records that depend on channels/messages
    if (channelIds.length > 0) {
      await tx.notification.deleteMany({
        where: { channelId: { in: channelIds } },
      });

      await tx.channelNotificationOverride.deleteMany({
        where: { channelId: { in: channelIds } },
      });

      await tx.readReceipt.deleteMany({
        where: { channelId: { in: channelIds } },
      });

      await tx.threadSubscriber.deleteMany({
        where: { parentMessage: { channelId: { in: channelIds } } },
      });
    }

    await tx.channelMembership.deleteMany({
      where: { channel: { communityId: id } },
    });

    await tx.message.deleteMany({
      where: { channel: { communityId: id } },
    });

    await tx.channel.deleteMany({
      where: { communityId: id },
    });

    // Delete community-level records
    await tx.communityBan.deleteMany({
      where: { communityId: id },
    });

    await tx.communityTimeout.deleteMany({
      where: { communityId: id },
    });

    await tx.moderationLog.deleteMany({
      where: { communityId: id },
    });

    await tx.aliasGroupMember.deleteMany({
      where: { aliasGroup: { communityId: id } },
    });

    await tx.aliasGroup.deleteMany({
      where: { communityId: id },
    });

    await tx.role.deleteMany({
      where: { communityId: id },
    });

    await tx.userRoles.deleteMany({
      where: { communityId: id },
    });

    await tx.membership.deleteMany({
      where: { communityId: id },
    });

    await tx.community.delete({
      where: { id },
    });
  });
}
```

**Step 2: Run existing community tests**

```bash
docker compose run --rm backend npx jest community.service --verbose
```

---

### Task 3: Complete channel cascade deletes

`channels.service.ts:124-146` cascade delete is missing: `ReadReceipt`, `Notification`, `ChannelNotificationOverride`, `ThreadSubscriber`.

**Files:**
- Modify: `backend/src/channels/channels.service.ts:124-146`

**Step 1: Add missing deletes to channel remove**

```typescript
async remove(id: string) {
  const channel = await this.databaseService.channel.findUnique({
    where: { id },
  });

  if (!channel) {
    throw new NotFoundException('Channel not found');
  }

  await this.databaseService.$transaction(async (tx) => {
    // Delete records that depend on channel messages
    await tx.notification.deleteMany({
      where: { channelId: id },
    });

    await tx.channelNotificationOverride.deleteMany({
      where: { channelId: id },
    });

    await tx.readReceipt.deleteMany({
      where: { channelId: id },
    });

    await tx.threadSubscriber.deleteMany({
      where: { parentMessage: { channelId: id } },
    });

    await tx.channelMembership.deleteMany({
      where: { channelId: id },
    });

    await tx.message.deleteMany({
      where: { channelId: id },
    });

    await tx.channel.delete({
      where: { id },
    });
  });
}
```

**Step 2: Run existing channel tests**

```bash
docker compose run --rm backend npx jest channels.service --verbose
```

---

### Task 4: Fix Message.authorId — add @db.ObjectId annotation

`Message.authorId` is declared as plain `String` without `@db.ObjectId`. This means it's stored as a string in MongoDB instead of an ObjectId, which breaks consistency with the rest of the schema and prevents any future relation from being added.

**Important:** We should NOT add a full Prisma relation to User here, because messages should survive user deletion (we want to show "[Deleted User]" not lose the message). But we should at least fix the `@db.ObjectId` annotation for type consistency.

**Files:**
- Modify: `backend/prisma/schema.prisma:16`

**Step 1: Add @db.ObjectId to Message.authorId**

Change line 16 from:
```prisma
  authorId             String
```
to:
```prisma
  authorId             String     @db.ObjectId
```

**Step 2: Push schema change**

```bash
docker compose run --rm backend npm run prisma:push
```

Note: This is a metadata-only change for MongoDB — it won't alter existing data, just how Prisma validates the field. Existing string values that are valid ObjectId hex strings will continue to work.

**Step 3: Regenerate Prisma client**

```bash
docker compose run --rm backend npm run prisma:generate
```

---

## MEDIUM Priority

### Task 5: Fix N+1 in getUnreadCounts

`read-receipts.service.ts:283-343` runs individual `message.count()` queries in a loop for each channel/DM receipt. Replace with batch counting using `$aggregate` or `groupBy`.

**Files:**
- Modify: `backend/src/read-receipts/read-receipts.service.ts:283-343`

**Step 1: Replace sequential count queries with batch operations**

Replace the two loops (channel receipts at lines 283-312 and DM receipts at lines 314-343) with two batch aggregate queries.

For channels with receipts where we have `lastReadAt`:
```typescript
// Batch count unread messages for channels with valid read timestamps
const channelReceipts = readReceipts.filter((r) => r.channelId);
const channelReceiptsWithTimestamp: Array<{ channelId: string; lastReadAt: Date; lastReadMessageId: string; lastReadAtDate: Date }> = [];
const channelReceiptsWithoutTimestamp: string[] = [];

for (const receipt of channelReceipts) {
  const lastReadAt = lastReadMessageMap.get(receipt.lastReadMessageId);
  if (lastReadAt) {
    channelReceiptsWithTimestamp.push({
      channelId: receipt.channelId!,
      lastReadAt: receipt.lastReadAt,
      lastReadMessageId: receipt.lastReadMessageId,
      lastReadAtDate: lastReadAt,
    });
  } else {
    channelReceiptsWithoutTimestamp.push(receipt.channelId!);
  }
}

// Batch: channels where last read message was deleted — count all messages
if (channelReceiptsWithoutTimestamp.length > 0) {
  const counts = await this.databaseService.message.groupBy({
    by: ['channelId'],
    where: { channelId: { in: channelReceiptsWithoutTimestamp } },
    _count: { channelId: true },
  });
  for (const count of counts) {
    unreadCounts.push({
      channelId: count.channelId!,
      unreadCount: count._count.channelId,
    });
  }
}

// For channels with valid timestamps, we still need per-channel queries
// because each has a different sentAt threshold. Use Promise.all for parallelism.
if (channelReceiptsWithTimestamp.length > 0) {
  const countPromises = channelReceiptsWithTimestamp.map(async (receipt) => {
    const count = await this.databaseService.message.count({
      where: {
        channelId: receipt.channelId,
        sentAt: { gt: receipt.lastReadAtDate },
      },
    });
    return {
      channelId: receipt.channelId,
      unreadCount: count,
      lastReadMessageId: receipt.lastReadMessageId,
      lastReadAt: receipt.lastReadAt,
    };
  });
  const results = await Promise.all(countPromises);
  unreadCounts.push(...results);
}
```

Apply the same pattern for DM receipts. The key improvements:
1. Batch the "deleted message" case using `groupBy`
2. Parallelize the per-receipt counts using `Promise.all` instead of sequential awaits

**Step 2: Run read receipt tests**

```bash
docker compose run --rm backend npx jest read-receipts --verbose
```

---

### Task 6: Add pagination to unbounded queries

Three service methods return unbounded results. Add sensible limits.

**Files:**
- Modify: `backend/src/membership/membership.service.ts:155-168`
- Modify: `backend/src/community/community.service.ts:74-85`
- Modify: `backend/src/channels/channels.service.ts:74-84`

**Step 1: Add limit to findAllForCommunity**

This returns ALL members. Add a `take` limit. Since this is used for the member sidebar, a reasonable limit is 1000 (Discord caps at 1000 for sidebar display).

```typescript
async findAllForCommunity(
  communityId: string,
): Promise<MembershipResponseDto[]> {
  const memberships = await this.databaseService.membership.findMany({
    where: { communityId },
    include: {
      user: true,
    },
    take: 1000,
  });

  return memberships.map(
    (membership) => new MembershipResponseDto(membership),
  );
}
```

**Step 2: Add limit to community findAll (admin endpoint)**

The `else` branch at line 83 returns ALL communities. Add a limit:

```typescript
async findAll(userId?: string) {
  if (userId) {
    const communities = await this.databaseService.membership.findMany({
      where: { userId },
      include: { community: true },
    });
    return communities.map((membership) => membership.community);
  } else {
    return this.databaseService.community.findMany({
      take: 100,
    });
  }
}
```

**Step 3: Channels findAll is fine**

The channels `findAll(communityId)` is scoped to a single community. Communities typically have <100 channels. No change needed — the risk is negligible.

**Step 4: Run tests**

```bash
docker compose run --rm backend npx jest membership.service --verbose
docker compose run --rm backend npx jest community.service --verbose
```

---

### Task 7: Add remux cache cleanup

`livekit-replay.service.ts` creates remuxed segment files at `/tmp/hls-remux-cache/{userId}/` but never cleans them up.

**Files:**
- Modify: `backend/src/livekit/livekit-replay.service.ts`

**Step 1: Add a cleanup method and schedule it**

Add a `@Cron` scheduled job that cleans up remux cache files older than 1 hour. The service already imports `@nestjs/schedule` via the ScheduleModule.

```typescript
import { Cron, CronExpression } from '@nestjs/schedule';
import { promises as fs } from 'fs';
import * as path from 'path';

// Add to the class:

private readonly REMUX_CACHE_DIR = '/tmp/hls-remux-cache';
private readonly REMUX_CACHE_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

@Cron(CronExpression.EVERY_30_MINUTES)
async cleanupRemuxCache(): Promise<void> {
  try {
    const exists = await fs.access(this.REMUX_CACHE_DIR).then(() => true).catch(() => false);
    if (!exists) return;

    const userDirs = await fs.readdir(this.REMUX_CACHE_DIR);
    const now = Date.now();
    let cleaned = 0;

    for (const userDir of userDirs) {
      const userPath = path.join(this.REMUX_CACHE_DIR, userDir);
      const stat = await fs.stat(userPath);
      if (!stat.isDirectory()) continue;

      const files = await fs.readdir(userPath);
      for (const file of files) {
        const filePath = path.join(userPath, file);
        const fileStat = await fs.stat(filePath);
        if (now - fileStat.mtimeMs > this.REMUX_CACHE_MAX_AGE_MS) {
          await fs.unlink(filePath);
          cleaned++;
        }
      }

      // Remove empty user directories
      const remaining = await fs.readdir(userPath);
      if (remaining.length === 0) {
        await fs.rmdir(userPath);
      }
    }

    if (cleaned > 0) {
      this.logger.log(`Cleaned up ${cleaned} stale remux cache files`);
    }
  } catch (error) {
    this.logger.warn(`Remux cache cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
```

**Step 2: Run replay service tests**

```bash
docker compose run --rm backend npx jest livekit-replay --verbose
```

---

## LOW Priority

### Task 8: Extract shared flattenSpansToText utility

Identical function in `messages.service.ts:64-74` and `threads.service.ts:24-34`.

**Files:**
- Create: `backend/src/common/utils/text.utils.ts`
- Modify: `backend/src/messages/messages.service.ts:64-74`
- Modify: `backend/src/threads/threads.service.ts:24-34`

**Step 1: Create shared utility**

```typescript
// backend/src/common/utils/text.utils.ts

/**
 * Flattens message spans into a single searchable text string.
 * Extracts text from all spans and joins them with spaces.
 * Returns lowercase for case-insensitive search compatibility with MongoDB.
 */
export function flattenSpansToText(
  spans: { text?: string | null }[],
): string | undefined {
  const text = spans
    .filter((span) => span.text)
    .map((span) => span.text)
    .join(' ')
    .trim()
    .toLowerCase();
  return text.length > 0 ? text : undefined;
}
```

**Step 2: Update both services to import and use the shared utility**

In both `messages.service.ts` and `threads.service.ts`, remove the private method and import from the utility:

```typescript
import { flattenSpansToText } from '@/common/utils/text.utils';
```

Replace `this.flattenSpansToText(...)` calls with `flattenSpansToText(...)`.

**Step 3: Run tests**

```bash
docker compose run --rm backend npx jest messages.service --verbose
docker compose run --rm backend npx jest threads --verbose
```

---

### Task 9: Standardize Prisma error handling

Three different patterns for checking `P2002` across services. Standardize to a shared utility.

**Files:**
- Create: `backend/src/common/utils/prisma.utils.ts`
- Modify: `backend/src/community/community.service.ts` (lines 60-66)
- Modify: `backend/src/channels/channels.service.ts` (lines 56-60)
- Modify: `backend/src/membership/membership.service.ts` (lines 141-146)

**Step 1: Create shared utility**

```typescript
// backend/src/common/utils/prisma.utils.ts
import { Prisma } from '@prisma/client';

/**
 * Type guard for Prisma known request errors.
 * Use instead of ad-hoc type checks in catch blocks.
 */
export function isPrismaError(
  error: unknown,
  code: string,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === code
  );
}
```

**Step 2: Update all three services**

Replace the various error checking patterns with:

```typescript
import { isPrismaError } from '@/common/utils/prisma.utils';

// In catch blocks:
if (isPrismaError(error, 'P2002')) {
  throw new ConflictException('...');
}
```

**Step 3: Run tests**

```bash
docker compose run --rm backend npx jest community.service channels.service membership.service --verbose
```

---

### Task 10: Fix inconsistent database service naming

`invite.service.ts` and `onboarding.service.ts` use `database` instead of `databaseService`.

**Files:**
- Modify: `backend/src/invite/invite.service.ts`
- Modify: `backend/src/onboarding/onboarding.service.ts`

**Step 1: Rename in invite.service.ts**

Change constructor parameter from `database` to `databaseService` and update all references (`this.database.` → `this.databaseService.`).

**Step 2: Rename in onboarding.service.ts**

Same rename: `database` → `databaseService`.

**Step 3: Run tests**

```bash
docker compose run --rm backend npx jest invite --verbose
docker compose run --rm backend npx jest onboarding --verbose
```

---

### Task 11: Remove unused CacheModule

`CacheModule.registerAsync()` in `app.module.ts:55-78` is configured globally but `CACHE_MANAGER` is never injected anywhere. It creates an unnecessary Redis connection.

**Files:**
- Modify: `backend/src/app.module.ts:55-78`
- Modify: `backend/package.json` (remove `@keyv/redis`, `cache-manager`, `cacheable` dependencies if unused)

**Step 1: Verify CACHE_MANAGER is truly unused**

Search the entire backend for `CACHE_MANAGER` or `CacheModule` imports in service files (not app.module). If nothing uses it, proceed.

**Step 2: Remove CacheModule from imports**

Remove the `CacheModule.registerAsync({...})` block from `app.module.ts` imports array. Also remove the `CacheModule` import at the top.

**Step 3: Check if cache-related packages can be removed**

Search for other uses of `@keyv/redis`, `cacheable`, `cache-manager`, `keyv` in the codebase. If they are only used for this CacheModule, remove them from `package.json`.

**Step 4: Run full test suite**

```bash
docker compose run --rm backend npm run test
```

---

## Items NOT being implemented (with rationale)

### #8 File type validation (magic numbers)
The `skipMagicNumbersValidation: true` flag is in NestJS's `FileTypeValidator`. Enabling magic number validation requires the `file-type` package which uses ESM-only imports — complex to integrate into a CommonJS NestJS project. The existing MIME type validation combined with the new `whitelist: true` on ValidationPipe provides reasonable protection. Defer to a future task.

### #15 sendToAll for presence broadcasts
Fixing this properly requires a community-aware presence system: track which communities each user belongs to, then only broadcast to connected users who share a community. This is a significant architectural change that should be its own feature, not a code review fix.

### #27 Unlinked user references in CommunityBan/CommunityTimeout/ModerationLog
These models have `userId` fields without User relations. Adding relations would cascade-delete ban/timeout/moderation records when users are deleted, which is the wrong behavior — you want to keep ban records and moderation logs even after a user is deleted. These are intentionally unlinked. No fix needed.

### #28 DRY file metadata enrichment
The enrichment code in messages.service.ts and moderation.service.ts is similar but not identical (single message vs batch). Extracting it would require a generic utility that handles both cases. The complexity of the abstraction outweighs the duplication. Defer.

### #32 Unused CacheModule
Covered in Task 11 above.

### #33 JWT in query parameter
This is a known tradeoff for serving authenticated file downloads/embeds. Cannot be fixed without a fundamentally different auth approach for media serving (e.g., signed URLs, temporary download tokens). Document but don't fix.

---

## Commit Strategy

After all tasks pass tests:
1. Commit all remaining fixes together as one commit: `refactor: complete backend code review remaining fixes`
2. Then run full test suite to verify nothing is broken: `docker compose run --rm backend npm run test`
