# Replay Buffer - Backend Service Documentation

Complete reference for `LivekitReplayService`.

## Service Overview

The `LivekitReplayService` is the core backend service that orchestrates replay buffer functionality. It manages LiveKit egress sessions, segment lifecycle, and replay capture processing.

**Location**: `backend/src/livekit-replay/livekit-replay.service.ts`

## Dependencies

```typescript
@Injectable()
export class LivekitReplayService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    private readonly livekitClient: RoomServiceClient,
  ) {}
}
```

## Configuration

Loaded from environment variables via `ConfigService`:

```typescript
bufferPath: string;              // REPLAY_BUFFER_PATH
storagePath: string;             // REPLAY_STORAGE_PATH
bufferDurationMinutes: number;   // REPLAY_BUFFER_DURATION_MINUTES
cleanupBufferMinutes: number;    // REPLAY_CLEANUP_BUFFER_MINUTES
segmentDurationSeconds: number;  // REPLAY_SEGMENT_DURATION_SECONDS
```

---

## Public Methods

### startReplayBuffer()

Start continuous recording of screen share to HLS segments.

**Signature**:
```typescript
async startReplayBuffer(
  roomName: string,
  userId: string,
  communityId: string | null,
  quality: '720p' | '1080p' | '1440p' = '1080p',
): Promise<EgressSession>
```

**Parameters**:
- `roomName`: LiveKit room name (matches voice channel ID)
- `userId`: User who owns the replay buffer
- `communityId`: Optional community ID for limits
- `quality`: Encoding quality preset

**Returns**: Created `EgressSession` record

**Throws**:
- `BadRequestException`: User already has active buffer

**Flow**:
1. Check if user has existing active session
2. Create segment directory (`/replay-buffer/{room}/{user}/`)
3. Configure encoding based on quality preset
4. Create LiveKit `ParticipantEgressRequest`
5. Start egress via LiveKit API
6. Store session in database
7. Return session record

**Example**:
```typescript
const session = await livekitReplayService.startReplayBuffer(
  'voice-channel-123',
  'user-456',
  'community-789',
  '1080p'
);

console.log(session.egressId); // "EG_xxxxx"
```

---

### stopReplayBuffer()

Stop continuous recording and cleanup all segments.

**Signature**:
```typescript
async stopReplayBuffer(sessionId: string): Promise<void>
```

**Parameters**:
- `sessionId`: Database ID of EgressSession

**Returns**: void

**Throws**:
- `NotFoundException`: Session not found
- `BadRequestException`: Session not active

**Flow**:
1. Fetch session from database
2. Call LiveKit `stopEgress(egressId)`
3. Update session status to 'stopped'
4. Delete all segments in `segmentPath`

**Example**:
```typescript
await livekitReplayService.stopReplayBuffer('60f7b3c4e4b0c8d8f8e4b0c8');
```

---

### captureReplay()

Capture last N minutes from active replay buffer.

**Signature**:
```typescript
async captureReplay(options: {
  sessionId: string;
  durationMinutes: 1 | 2 | 5 | 10;
  userId: string;
}): Promise<{
  clipId: string;
  fileId: string;
  durationSeconds: number;
  sizeBytes: number;
}>
```

**Parameters**:
- `sessionId`: Active EgressSession ID
- `durationMinutes`: How much to capture
- `userId`: Owner verification

**Returns**: Captured clip metadata

**Throws**:
- `NotFoundException`: Session not found
- `BadRequestException`: No segments in range OR not owner
- `InternalServerErrorException`: FFmpeg failure

**Flow**:
1. Validate session exists and belongs to user
2. Calculate time range (now - durationMinutes to now)
3. List segments in time range
4. Create temp directory
5. Copy segments to temp
6. Concatenate with FFmpeg (stream copy)
7. Generate checksum
8. Move to permanent storage (`/replays/{userId}/`)
9. Create File record
10. Create ReplayClip record
11. Update user quota
12. Cleanup temp files
13. Return clip metadata

**Example**:
```typescript
const clip = await livekitReplayService.captureReplay({
  sessionId: 'session-id',
  durationMinutes: 5,
  userId: 'user-id',
});

console.log(clip.clipId);           // "clip-123"
console.log(clip.durationSeconds);  // 310 (5min 10sec due to segment boundaries)
console.log(clip.sizeBytes);        // 240000000 (~240MB)
```

---

### getActiveSessions()

Get all active replay buffers in a room.

**Signature**:
```typescript
async getActiveSessions(roomName: string): Promise<Array<{
  id: string;
  userId: string;
  username: string;
  quality: string;
  startedAt: Date;
  durationMinutes: number;
}>>
```

**Example**:
```typescript
const sessions = await livekitReplayService.getActiveSessions('voice-channel-123');

console.log(sessions);
// [{ id: '...', userId: '...', username: 'john', quality: '1080p', ... }]
```

---

### getUserClips()

List all replay clips for a user.

**Signature**:
```typescript
async getUserClips(userId: string, options?: {
  limit?: number;
  offset?: number;
  communityId?: string;
}): Promise<{
  clips: Array<ReplayClip & { file: File }>;
  total: number;
  hasMore: boolean;
}>
```

**Example**:
```typescript
const { clips, total, hasMore } = await livekitReplayService.getUserClips('user-id', {
  limit: 10,
  offset: 0,
});
```

---

### deleteClip()

Delete a replay clip and free quota.

**Signature**:
```typescript
async deleteClip(clipId: string, userId: string): Promise<{
  freedBytes: number;
  remainingQuotaBytes: number;
}>
```

**Throws**:
- `NotFoundException`: Clip not found
- `ForbiddenException`: Not owner

**Flow**:
1. Fetch clip with file data
2. Verify ownership
3. Delete file from filesystem
4. Delete File record (cascade deletes ReplayClip)
5. Update user quota (decrement usedBytes)
6. Return freed space

---

## Cron Jobs

### cleanupOldSegments()

Deletes segments older than buffer duration.

**Schedule**: Every 5 minutes (`*/5 * * * *`)

**Logic**:
```typescript
@Cron('*/5 * * * *')
async cleanupOldSegments() {
  const cutoffTime = Date.now() - (this.cleanupBufferMinutes * 60 * 1000);

  const activeSessions = await this.db.egressSession.findMany({
    where: { status: 'active' },
  });

  for (const session of activeSessions) {
    const files = await fs.readdir(session.segmentPath);

    for (const file of files.filter(f => f.startsWith('segment-'))) {
      const timestamp = extractTimestampFromFilename(file);
      if (timestamp < cutoffTime) {
        await fs.unlink(path.join(session.segmentPath, file));
      }
    }
  }
}
```

---

### cleanupOrphanedSessions()

Stops egress sessions that have been active too long.

**Schedule**: Every hour (`0 * * * *`)

**Logic**:
```typescript
@Cron(CronExpression.EVERY_HOUR)
async cleanupOrphanedSessions() {
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);

  const orphanedSessions = await this.db.egressSession.findMany({
    where: {
      status: 'active',
      startedAt: { lt: threeHoursAgo },
    },
  });

  for (const session of orphanedSessions) {
    await this.livekitClient.stopEgress(session.egressId);
    await this.db.egressSession.update({
      where: { id: session.id },
      data: { status: 'stopped', endedAt: new Date() },
    });
    await this.cleanupAllSegments(session.segmentPath);
  }
}
```

---

## Private Helper Methods

### getEncodingConfig()

Returns encoding configuration for quality preset.

**Signature**:
```typescript
private getEncodingConfig(quality: string): {
  preset?: EncodingOptionsPreset;
  advanced?: EncodingOptions;
}
```

**Presets**:
- `720p`: `H264_720P_30`
- `1080p`: `H264_1080P_60`
- `1440p`: Custom `EncodingOptions` (2560x1440, 30fps, 8Mbps)

---

### listSegmentsInRange()

Find segments within time range.

**Signature**:
```typescript
private async listSegmentsInRange(
  segmentPath: string,
  startTime: number,
  endTime: number
): Promise<string[]>
```

**Returns**: Array of segment file paths sorted by timestamp

---

### extractTimestampFromFilename()

Extract UNIX timestamp from segment filename.

**Signature**:
```typescript
private extractTimestampFromFilename(filename: string): number | null
```

**Example**:
```typescript
extractTimestampFromFilename('segment-1699564800000.ts'); // 1699564800000
extractTimestampFromFilename('invalid.ts');               // null
```

---

### concatenateSegments()

Concatenate TS segments into MP4 using FFmpeg.

**Signature**:
```typescript
private async concatenateSegments(
  segmentPaths: string[],
  outputPath: string
): Promise<void>
```

**Process**:
1. Create concat demuxer file
2. Run FFmpeg with `-c copy` (stream copy)
3. Add `-movflags +faststart` for web playback
4. Wait for completion
5. Cleanup concat file

**Performance**: ~1-2 seconds for 10-minute video

---

### generateChecksum()

Generate SHA-256 checksum for file.

**Signature**:
```typescript
private async generateChecksum(filePath: string): Promise<string>
```

---

### updateUserQuota()

Update user's storage quota after capture.

**Signature**:
```typescript
private async updateUserQuota(userId: string, sizeBytes: number): Promise<void>
```

**Uses**: Prisma `upsert` with `increment`

---

## Error Handling

### Common Error Patterns

```typescript
// User validation
if (session.userId !== userId) {
  throw new ForbiddenException('Session does not belong to user');
}

// Resource not found
if (!session) {
  throw new NotFoundException('Egress session not found');
}

// State validation
if (session.status !== 'active') {
  throw new BadRequestException('Session is not active');
}

// Filesystem errors
try {
  await fs.unlink(filePath);
} catch (error) {
  this.logger.warn(`Failed to delete file: ${error.message}`);
  // Continue (don't throw)
}

// FFmpeg errors
try {
  await this.concatenateSegments(segments, output);
} catch (error) {
  this.logger.error('FFmpeg failed:', error);
  await this.cleanupTempFiles(tempDir);
  throw new InternalServerErrorException('Failed to process replay');
}
```

---

## Logging

### Log Levels

```typescript
// Info: Normal operations
this.logger.log(`Replay buffer started: ${egressId}`);
this.logger.log(`Replay captured: ${clipId}`);

// Debug: Detailed info
this.logger.debug(`Found ${segments.length} segments`);
this.logger.debug(`Cleanup took ${duration}ms`);

// Warn: Recoverable errors
this.logger.warn(`Failed to cleanup file: ${error}`);
this.logger.warn(`Cleanup took >1 minute, consider optimization`);

// Error: Unrecoverable errors
this.logger.error(`FFmpeg failed: ${error}`);
this.logger.error(`LiveKit egress failed: ${error}`);
```

---

## Testing

See `testing-guide.md` for comprehensive testing strategies.

**Quick Test**:
```typescript
const service = new LivekitReplayService(/* mocked deps */);
const session = await service.startReplayBuffer('room', 'user', null, '1080p');
expect(session.egressId).toBeDefined();
```

---

## Next Steps

- Review `api-reference.md` for HTTP endpoints
- Review `deployment.md` for production setup
- Review `troubleshooting.md` for common issues
