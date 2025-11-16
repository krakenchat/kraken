# Replay Buffer - Segment Lifecycle

Detailed flow of how HLS segments are created, managed, and cleaned up.

## Timeline Example: 10-Minute Buffer with 12-Minute Cleanup

```
Time     | Event                                    | Segments | Storage
---------|------------------------------------------|----------|----------
10:00:00 | User enables replay buffer               | 0        | 0 MB
10:00:00 | Egress starts writing                    | 0        | 0 MB
10:00:10 | segment-1699564800000.ts created         | 1        | 7.5 MB
10:00:20 | segment-1699564810000.ts created         | 2        | 15 MB
10:00:30 | segment-1699564820000.ts created         | 3        | 22.5 MB
...      | (continues every 10 seconds)             | ...      | ...
10:10:00 | 60 segments exist (10 minutes)           | 60       | 450 MB
10:12:00 | 72 segments exist (12 minutes)           | 72       | 540 MB
10:15:00 | CLEANUP JOB RUNS                         | 72       | 540 MB
10:15:00 | Delete segments before 10:03:00          | 72       | 540 MB
10:15:00 | Cleanup complete                         | 72       | 540 MB
10:17:23 | USER CLICKS "Capture last 5 minutes"     | 72       | 540 MB
10:17:23 | Find segments: 10:12:20 to 10:17:30      | 72       | 540 MB
10:17:23 | Found 31 segments (5min 10sec)           | 72       | 540 MB
10:17:23 | Copy segments to temp dir                | 72       | 540 MB
10:17:24 | FFmpeg concatenating...                  | 72       | 540 MB
10:17:25 | Concatenation complete                   | 72       | 540 MB
10:17:25 | Move to /replays/{userId}/replay.mp4     | 72       | 540 MB
10:17:25 | Update user quota (+240 MB)              | 72       | 540 MB
10:17:25 | Cleanup temp files                       | 72       | 540 MB
10:17:25 | Capture complete!                        | 72       | 540 MB
10:20:00 | CLEANUP JOB RUNS                         | 72       | 540 MB
10:20:00 | Delete segments before 10:08:00          | 72       | 540 MB
10:20:00 | Cleanup complete                         | 72       | 540 MB
10:30:00 | User stops replay buffer                 | 72       | 540 MB
10:30:00 | Egress stopped                           | 72       | 540 MB
10:30:00 | Delete ALL segments for this session     | 0        | 0 MB
10:30:00 | Buffer stopped, temp storage freed       | 0        | 0 MB
```

## Segment Boundaries

### How Segments Work

HLS segments are always complete 10-second chunks. You cannot capture partial segments.

**Example: User requests "last 1 minute" at 10:30:05**

```
Current time: 10:30:05 (5 seconds into current segment)
Request: Last 1 minute (60 seconds)

Calculation:
  Start time: 10:29:05
  End time: 10:30:05

Segments needed to cover this range:
  segment-1699564140000.ts (10:29:00 - 10:29:10) ← includes 10:29:05
  segment-1699564150000.ts (10:29:10 - 10:29:20)
  segment-1699564160000.ts (10:29:20 - 10:29:30)
  segment-1699564170000.ts (10:29:30 - 10:29:40)
  segment-1699564180000.ts (10:29:40 - 10:29:50)
  segment-1699564190000.ts (10:29:50 - 10:30:00)
  segment-1699564200000.ts (10:30:00 - 10:30:10) ← includes 10:30:05

Total: 7 segments = 70 seconds (1 minute 10 seconds)
```

### Duration Mapping Table

| Requested | Actual (Min) | Actual (Max) | Reason |
|-----------|--------------|--------------|--------|
| 1 min     | 1:00         | 1:10         | Includes partial first/last segments |
| 2 min     | 2:00         | 2:10         | Includes partial first/last segments |
| 5 min     | 5:00         | 5:10         | Includes partial first/last segments |
| 10 min    | 10:00        | 10:10        | Includes partial first/last segments |

## File Naming Convention

### Segment Files

```
segment-{UNIX_TIMESTAMP_MS}.ts
```

**Examples**:
- `segment-1699564800000.ts` = November 9, 2024 10:00:00 UTC
- `segment-1699564810000.ts` = November 9, 2024 10:00:10 UTC
- `segment-1699564820000.ts` = November 9, 2024 10:00:20 UTC

**Extracting timestamp from filename**:

```typescript
function extractTimestamp(filename: string): number {
  const match = filename.match(/segment-(\d+)\.ts$/);
  return match ? parseInt(match[1]) : null;
}
```

### Playlist Files

```
full.m3u8          # Complete playlist (references all segments)
live.m3u8          # Rolling playlist (references last N segments)
```

**Example `full.m3u8`**:
```
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXTINF:10.0,
segment-1699564800000.ts
#EXTINF:10.0,
segment-1699564810000.ts
#EXTINF:10.0,
segment-1699564820000.ts
...
```

**Example `live.m3u8`** (last 72 segments):
```
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXTINF:10.0,
segment-1699564080000.ts  ← Oldest (12 min ago)
...
#EXTINF:10.0,
segment-1699564800000.ts  ← Newest
```

## Capture Flow Diagram

```
User clicks "Capture Replay" (duration: 5 minutes)
         ↓
Get active EgressSession from database
         ↓
Calculate time range: now - 5 minutes to now
  Example: 10:17:23 - 5 min = 10:12:23 to 10:17:23
         ↓
List all segment files in session's segmentPath
         ↓
Filter segments by timestamp
  segment-1699564340000.ts (10:12:20) ✓ Include
  segment-1699564350000.ts (10:12:30) ✓ Include
  ...
  segment-1699564690000.ts (10:17:10) ✓ Include
  segment-1699564700000.ts (10:17:20) ✓ Include
  segment-1699564710000.ts (10:17:30) ✓ Include (partial)
         ↓
Found 31 segments (310 seconds = 5min 10sec)
         ↓
Create temp directory: /tmp/replay-{uuid}/
         ↓
Copy segments to temp dir (parallel)
  31 segments × 7.5 MB = ~232 MB
         ↓
Create FFmpeg concat file:
  file '/tmp/replay-{uuid}/seg0.ts'
  file '/tmp/replay-{uuid}/seg1.ts'
  ...
  file '/tmp/replay-{uuid}/seg30.ts'
         ↓
Run FFmpeg concatenation (stream copy, no re-encode)
  ffmpeg -f concat -safe 0 -i concat.txt -c copy -movflags +faststart output.mp4
  Duration: ~1-2 seconds
         ↓
Move output.mp4 to /replays/{userId}/{timestamp}.mp4
         ↓
Create File record in database
  filename: replay-1699564800000.mp4
  size: ~240 MB
  checksum: sha256(...)
  storageType: LOCAL
  resourceType: REPLAY_CLIP
         ↓
Create ReplayClip record
  durationSeconds: 310
  fileId: {file-id}
         ↓
Update UserReplayQuota
  usedBytes += 240 MB
         ↓
Cleanup temp directory
  rm -rf /tmp/replay-{uuid}/
         ↓
Return clip metadata to user
```

## Cleanup Job Flow

### Every 5 Minutes: Segment Cleanup

```
Cron trigger: */5 * * * * (every 5 minutes)
         ↓
Query active EgressSessions
  WHERE status = 'active'
         ↓
For each session:
  ↓
  Calculate cutoff time
    now - REPLAY_CLEANUP_BUFFER_MINUTES (12 min)
    Example: 10:20:00 - 12 min = 10:08:00
  ↓
  List all segment files in session.segmentPath
  ↓
  For each segment:
    ↓
    Extract timestamp from filename
    ↓
    If timestamp < cutoff:
      Delete segment file
      Log deletion
  ↓
Log total deleted count
```

### Every Hour: Orphaned Session Cleanup

```
Cron trigger: 0 * * * * (every hour)
         ↓
Calculate stale threshold
  now - 3 hours
  Example: 10:00:00 - 3 hours = 07:00:00
         ↓
Query orphaned sessions
  WHERE status = 'active' AND startedAt < stale threshold
         ↓
For each orphaned session:
  ↓
  Call LiveKit API: stopEgress(session.egressId)
  ↓
  Update database: status = 'stopped', endedAt = now
  ↓
  Delete ALL segments in session.segmentPath
    rm -rf {segmentPath}
  ↓
  Log cleanup
```

## Edge Cases

### Case 1: User Captures While Cleanup Running

**Scenario**: Cleanup job deletes segments while user is capturing

**Solution**: 12-minute buffer provides 2-minute safety margin
- UI allows max 10-minute capture
- Buffer keeps 12 minutes
- User has 2 minutes to decide and capture

**Race condition**: Extremely rare, would only affect first 10 seconds
**Mitigation**: Capture finds segments by timestamp, missing segments = error

### Case 2: Disk Full During Recording

**Scenario**: Storage runs out of space while egress is writing

**Result**: LiveKit egress fails, stops writing segments

**Handling**:
```typescript
// Webhook handler
if (event.event === 'egress_ended' && event.egressInfo.error) {
  await prisma.egressSession.update({
    where: { egressId: event.egressInfo.egressId },
    data: { status: 'failed', endedAt: new Date() },
  });

  // Notify user via WebSocket
  this.websocketService.sendToUser(userId, {
    event: 'replay_buffer_failed',
    reason: 'Disk full',
  });
}
```

### Case 3: FFmpeg Failure During Concatenation

**Scenario**: FFmpeg crashes or produces corrupt output

**Handling**:
```typescript
try {
  await this.concatenateSegments(segments, outputPath);
} catch (error) {
  this.logger.error('FFmpeg failed:', error);

  // Cleanup temp files
  await fs.rm(tempDir, { recursive: true });

  throw new InternalServerErrorException(
    'Failed to concatenate replay segments. Please try again.'
  );
}
```

### Case 4: User Leaves Room Without Stopping Buffer

**Scenario**: User closes browser/app while buffer is active

**Detection**: Hourly cron job finds sessions active >3 hours

**Handling**: Automatic stop egress + cleanup segments

---

## Storage Optimization Tips

### 1. Adjust Segment Duration

**Smaller segments (6s)**:
- ✅ More precise time selection
- ✅ Better for short clips
- ❌ More files = more I/O overhead

**Larger segments (15s)**:
- ✅ Fewer files = less I/O overhead
- ✅ Better for long clips
- ❌ Less precise time selection

**Recommended**: 10 seconds (good balance)

### 2. Use Separate Volumes

```yaml
volumes:
  replay-buffer:  # Temp segments on fast SSD
    device: /mnt/ssd/replay-buffer

  replays:  # Permanent clips on slower HDD
    device: /mnt/hdd/replays
```

### 3. Monitor Cleanup Job Performance

```typescript
@Cron('*/5 * * * *')
async cleanupOldSegments() {
  const startTime = Date.now();

  // ... cleanup logic

  const duration = Date.now() - startTime;
  this.logger.log(`Cleanup took ${duration}ms, deleted ${count} segments`);

  if (duration > 60000) {
    this.logger.warn('Cleanup taking >1 minute, consider optimization');
  }
}
```

---

## Next Steps

- Read `troubleshooting.md` for handling edge cases
- Read `performance.md` for optimization strategies
- Implement monitoring for segment lifecycle
