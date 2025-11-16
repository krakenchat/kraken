# Replay Buffer - Technical Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User's Browser                           │
│  ┌────────────────┐         ┌──────────────────────────────┐   │
│  │ Screen Share   │────────▶│ LiveKit Room (WebRTC)        │   │
│  │ getUserMedia() │         │                               │   │
│  └────────────────┘         └──────────────────────────────┘   │
└─────────────────────────────────────┬───────────────────────────┘
                                      │
                                      │ WebRTC media stream
                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      LiveKit Server                              │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Participant Egress (screenShare: true)                 │    │
│  │                                                          │    │
│  │  ┌──────────────────────────────────────────────────┐ │    │
│  │  │ GStreamer Pipeline                                │ │    │
│  │  │  1. Receive WebRTC stream                         │ │    │
│  │  │  2. Encode to H.264 (1080p 60fps)                │ │    │
│  │  │  3. Create HLS segments (10-second chunks)       │ │    │
│  │  │  4. Write to filesystem                           │ │    │
│  │  └──────────────────────────────────────────────────┘ │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────┬───────────────────────────┘
                                      │
                                      │ Writes segments to shared volume
                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Shared Storage Volume                        │
│  (Docker volume: local disk, NFS mount, or network storage)     │
│                                                                   │
│  /replay-buffer/                                                 │
│    └─ {roomName}/                                               │
│         └─ {userId}/                                            │
│              ├─ segment-1699564800000.ts  (10 seconds)         │
│              ├─ segment-1699564810000.ts  (10 seconds)         │
│              ├─ segment-1699564820000.ts  (10 seconds)         │
│              ├─ ... (continues)                                 │
│              ├─ live.m3u8  (rolling playlist, last 72 segments)│
│              └─ full.m3u8  (complete playlist, all segments)   │
│                                                                   │
│  /replays/                                                       │
│    └─ {userId}/                                                 │
│         └─ {timestamp}.mp4  (captured replays)                 │
└─────────────────────────────────────┬───────────────────────────┘
                                      │
                                      │ Reads/writes segments
                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Kraken Backend (NestJS)                     │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ LivekitReplayService                                      │  │
│  │                                                            │  │
│  │  • startReplayBuffer() → Calls LiveKit Egress API        │  │
│  │  • captureReplay() → FFmpeg concatenation                │  │
│  │  • cleanupOldSegments() → Delete segments >12min old     │  │
│  │  • cleanupOrphanedSessions() → Detect stale egresses     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Cron Jobs (@nestjs/schedule)                             │  │
│  │                                                            │  │
│  │  • Every 5 minutes: Cleanup old segments                 │  │
│  │  • Every hour: Cleanup orphaned egress sessions          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Database (MongoDB + Prisma)                               │  │
│  │                                                            │  │
│  │  • EgressSession: Track active replay buffer sessions    │  │
│  │  • ReplayClip: Store captured replay metadata           │  │
│  │  • UserReplayQuota: Track storage usage                 │  │
│  │  • CommunityReplayConfig: Per-community limits          │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### 1. LiveKit Track Composite Egress

**Purpose**: Continuously record screen share stream to HLS segments

**Technology**: LiveKit Egress Service (GStreamer + Go SDK, **NO Chrome**)

#### Why Track Composite (Not Room Composite or Participant Egress)

**The replay buffer uses Track Composite Egress** for optimal resource efficiency:

| Egress Type | Chrome? | CPU/RAM | Use Case | Our Choice |
|-------------|---------|---------|----------|------------|
| **Room Composite** | ✅ YES | 4-6 CPU, 4GB | Full room layout rendering | ❌ Too heavy |
| **Participant Egress** | ❌ NO | ~1 CPU, 1GB | Auto-detect participant tracks | ⚠️ Bug in v1.8.x |
| **Track Composite** | ❌ NO | **~1 CPU, 1GB** | Specific audio + video tracks | ✅ **BEST** |
| **Track Egress** | ❌ NO | 0.1 CPU, 256MB | Single track only | ❌ Can't sync audio+video |

**Track Composite Benefits:**
- ✅ **SDK-only architecture** — No Chrome overhead
- ✅ **Direct track access** — GStreamer processes WebRTC tracks directly
- ✅ **Explicit control** — Specify exact audio and video track IDs
- ✅ **Efficient transcoding** — VP8 (browser) → H.264 (output)
- ✅ **HLS support** — Full segmented output compatibility
- ✅ **4-8 concurrent recordings per 4-CPU pod** (vs 1-2 for Room Composite)

> "the egress service will either launch a web template in Chrome and connect to the room (room composite requests), or it will **use the sdk directly (track and track composite requests)**. It uses GStreamer to encode..."
> — LiveKit Documentation

#### Configuration

```typescript
import {
  EgressClient,
  SegmentedFileOutput,
  EncodingOptionsPreset
} from 'livekit-server-sdk';

// Initialize egress client
const egressClient = new EgressClient(
  'https://livekit.example.com',
  'api-key',
  'secret-key'
);

// Start Track Composite egress
const egressInfo = await egressClient.startTrackCompositeEgress({
  roomName: 'voice-channel-123',
  videoTrackId: 'TR_ScreenShareVideoTrackId',  // Screen share video track
  audioTrackId: 'TR_ScreenShareAudioTrackId',  // Screen share audio track (optional)

  // Encode to H.264 1080p 60fps
  preset: EncodingOptionsPreset.H264_1080P_60,  // 1920x1080, 60fps, 6 Mbps

  segmentedFileOutputs: [
    new SegmentedFileOutput({
      filenamePrefix: `/replay-buffer/${roomName}/${userId}/segment`,
      playlistName: 'full.m3u8',       // Complete playlist
      livePlaylistName: 'live.m3u8',   // Rolling playlist (last ~72 segments)
      segmentDuration: 10,              // 10-second segments
      filenameSuffix: 'TIMESTAMP',      // Use UNIX timestamp in filename
    }),
  ],
});
```

**Track ID Detection:**
```typescript
// Frontend: Detect when screen share track is published
room.on(RoomEvent.TrackPublished, async (publication, participant) => {
  if (publication.source === Track.Source.ScreenShare) {
    const videoTrackId = publication.trackSid;

    // Find screen share audio track (if exists)
    const audioTrackId = participant.tracks.find(
      t => t.source === Track.Source.ScreenShareAudio
    )?.trackSid;

    // Send track IDs to backend via WebSocket
    socket.emit('start-replay-buffer', { videoTrackId, audioTrackId });
  }
});
```

**Output Files**:
- **Segment files**: `segment-{timestamp}.ts` (MPEG-TS format, 10 seconds each)
- **Full playlist**: `full.m3u8` (references all segments)
- **Live playlist**: `live.m3u8` (references last ~72 segments for 12-min buffer)

**Performance**:
- Write speed: ~0.75 MB/s per buffer @ 1080p 60fps
- Encoding: GStreamer (software) — VP8 → H.264 transcoding
- CPU usage: **~0.5-1 CPU per recording** (vs 2-6 for Room Composite)
- RAM usage: **~500MB-1GB per recording** (vs 2-4GB for Room Composite)
- Latency: ~1-2 second delay from live to segment file

### 2. Storage Architecture

**Storage Layout**:
```
${FILE_UPLOAD_DEST}/          # Configurable mount point
├── uploads/                   # Existing user uploads (messages, avatars, etc.)
│   ├── file1.png
│   └── file2.pdf
│
├── replay-buffer/             # Temporary HLS segments (auto-cleaned)
│   ├── voice-channel-123/
│   │   ├── user-456/
│   │   │   ├── segment-1699564800000.ts
│   │   │   ├── segment-1699564810000.ts
│   │   │   ├── ...
│   │   │   ├── live.m3u8
│   │   │   └── full.m3u8
│   │   └── user-789/
│   │       └── ... (another user's buffer)
│   └── voice-channel-456/
│       └── ... (another room)
│
└── replays/                   # Permanent captured replays
    ├── user-456/
    │   ├── 1699564800000.mp4  (captured replay #1)
    │   └── 1699565000000.mp4  (captured replay #2)
    └── user-789/
        └── ... (another user's clips)
```

**Storage Types Supported**:
- ✅ **Local disk**: Standard filesystem on host
- ✅ **NFS mount**: Network-attached storage
- ✅ **Docker volume**: Bind mount to any accessible path
- ✅ **Cloud-backed volumes**: If Docker volume driver supports (e.g., Rex-Ray for EBS)

**Storage Requirements**:
- **Per active buffer**: ~540MB (12 minutes @ 1080p 60fps)
- **Per captured replay**: ~450MB (10 minutes @ 1080p 60fps)
- **Quota default**: 5GB per user for saved replays

### 3. Segment Lifecycle Management

**State Machine**:
```
[Egress Started]
       ↓
[Segments Being Created] ← Continuous loop
       ↓                   Every 10 seconds
[Cleanup Eligible]
       ↓
[Deleted After 12 Minutes]


Parallel Flow:
[User Clicks "Capture"]
       ↓
[Find Segments in Range]
       ↓
[Download to Temp Dir]
       ↓
[FFmpeg Concatenate]
       ↓
[Upload to /replays/]
       ↓
[Create File Record]
       ↓
[Clean Up Temp Files]
```

**Cleanup Strategy**:
- **Frequency**: Every 5 minutes (cron job)
- **Retention**: Keep segments from last 12 minutes
- **Buffer vs UI**: UI allows 10-min max, but we keep 12 min for safety margin
- **Reason**: Gives user time to select options without losing first few segments

**Edge Case Handling**:
- **User leaves room**: Orphaned session cleanup detects and stops egress (hourly cron)
- **Disk full**: Egress fails gracefully, user gets error message
- **Network interruption**: LiveKit retries, but gaps may occur in segments
- **Concurrent captures**: Segments are read-only, multiple captures can happen simultaneously

### 4. FFmpeg Concatenation Pipeline

**Purpose**: Combine multiple 10-second segments into single MP4 file

**Technology**: fluent-ffmpeg (Node.js wrapper for FFmpeg CLI)

**Process**:
```typescript
// 1. Create concat demuxer file
const concatFile = '/tmp/concat-uuid.txt';
await fs.writeFile(concatFile, `
file '/replay-buffer/room/user/segment-001.ts'
file '/replay-buffer/room/user/segment-002.ts'
file '/replay-buffer/room/user/segment-003.ts'
...
file '/replay-buffer/room/user/segment-030.ts'
`);

// 2. Run FFmpeg with stream copy (no re-encoding!)
ffmpeg()
  .input(concatFile)
  .inputOptions(['-f concat', '-safe 0'])
  .outputOptions([
    '-c copy',              // Copy video/audio streams (no transcode)
    '-movflags +faststart'  // Optimize for web playback (moov atom first)
  ])
  .output('/replays/user/1699564800000.mp4')
  .on('end', () => console.log('Done!'))
  .on('error', (err) => console.error('FFmpeg failed:', err))
  .run();
```

**Performance**:
- **Stream copy mode**: No re-encoding, just container remux
- **Processing time**: ~1-2 seconds for 10-minute video
- **CPU usage**: Minimal (disk I/O bound)
- **Quality**: Lossless (no quality degradation)

**Why MPEG-TS → MP4?**
- **HLS segments**: MPEG-TS format (required by HLS spec)
- **Final output**: MP4 format (better browser compatibility, smaller size)
- **Conversion**: FFmpeg remuxes streams from TS containers to MP4 container

### 5. Database Schema & Relationships

```
┌─────────────────┐
│      User       │
│  • id           │
│  • username     │
│  • ...          │
└────────┬────────┘
         │
         │ 1:N
         │
         ├──────────┬──────────────────┐
         │          │                  │
         ▼          ▼                  ▼
┌─────────────────┐ ┌───────────────┐ ┌──────────────────┐
│ EgressSession   │ │  ReplayClip   │ │ UserReplayQuota  │
│  • egressId     │ │  • fileId     │ │  • quotaBytes    │
│  • roomName     │ │  • duration   │ │  • usedBytes     │
│  • status       │ │  • createdAt  │ │                  │
│  • segmentPath  │ └───────┬───────┘ └──────────────────┘
└─────────────────┘         │
                            │ N:1
                            ▼
                    ┌───────────────┐
                    │      File     │
                    │  • storagePath│
                    │  • mimeType   │
                    │  • size       │
                    │  • checksum   │
                    └───────────────┘

┌─────────────────┐
│   Community     │
│  • id           │
│  • name         │
│  • ...          │
└────────┬────────┘
         │
         │ 1:1
         ▼
┌──────────────────────┐
│ CommunityReplayConfig│
│  • maxConcurrent     │
│  • enabled           │
└──────────────────────┘
```

**Key Relationships**:
- `EgressSession` → `User`: Track who started buffer
- `ReplayClip` → `User`: Track who captured clip
- `ReplayClip` → `File`: Reference to file metadata (reuses existing File model)
- `UserReplayQuota` → `User`: Track storage usage per user
- `CommunityReplayConfig` → `Community`: Per-community limits

### 6. Access Control & RBAC

**Permission Flow**:
```
User clicks "Enable Replay Buffer"
       ↓
Check: Does user have ENABLE_REPLAY_BUFFER permission?
       ↓ Yes
Check: Is community concurrent limit reached?
       ↓ No (3 of 5 active)
Check: Does user have available storage quota?
       ↓ Yes (2GB used of 5GB quota)
Allow: Start replay buffer
```

**New RBAC Actions**:
```typescript
enum RbacActions {
  // ... existing actions
  ENABLE_REPLAY_BUFFER = 'enable_replay_buffer',    // Can activate replay buffer
  CAPTURE_REPLAY = 'capture_replay',                 // Can capture clips
  MANAGE_REPLAY_LIMITS = 'manage_community_replay_config',  // Admin only
}
```

**Default Permissions** (recommended):
- **Instance Admin**: All replay permissions
- **Community Admin**: `MANAGE_REPLAY_LIMITS` for their community
- **Moderators**: `ENABLE_REPLAY_BUFFER`, `CAPTURE_REPLAY`
- **Members**: None (must be explicitly granted)

### 7. Integration with Existing Systems

**File Upload System**:
```typescript
// After FFmpeg concatenation, create File record
const replayFile = await this.databaseService.file.create({
  data: {
    filename: `replay-${timestamp}.mp4`,
    mimeType: 'video/mp4',
    fileType: FileType.VIDEO,
    size: stats.size,
    checksum: await this.generateChecksum(outputPath),
    uploadedById: userId,
    storageType: StorageType.LOCAL,
    storagePath: `/replays/${userId}/${timestamp}.mp4`,
    resourceType: ResourceType.REPLAY_CLIP,  // New enum value
    resourceId: replayClip.id,
  },
});
```

**Message Attachment System**:
```typescript
// When user shares to channel
await this.messagesService.create({
  content: `🎬 Replay captured (${durationMinutes} min)`,
  channelId: targetChannelId,
  authorId: userId,
  attachments: [replayFile.id],  // Reuse existing attachment system!
});
```

**Benefits**:
- ✅ Replays use existing file serving (`GET /file/:id`)
- ✅ Replays can be embedded in messages like any attachment
- ✅ Replays subject to existing file cleanup logic
- ✅ No duplicate code for file handling

### 8. Scalability Considerations

**Horizontal Scaling**:
- ❌ **Not easily scalable**: Egress sessions are tied to specific LiveKit server
- ⚠️ **Workaround**: Use LiveKit Cloud (managed, auto-scaling) or dedicated egress workers
- ⚠️ **File access**: Shared storage volume required (NFS or object storage)

**Vertical Scaling**:
- ✅ **Storage**: Add more disk space as needed
- ✅ **CPU**: FFmpeg concatenation is brief and parallelizable
- ✅ **I/O**: SSD recommended for >20 concurrent buffers

**Recommended Deployment**:
- **Small (<10 users)**: Single server with local disk
- **Medium (10-50 users)**: NFS mount for shared storage
- **Large (50+ users)**: Distributed LiveKit with object storage (S3/GCS)

### 9. Monitoring & Observability

**Metrics to Track**:
```typescript
// Active replay buffers
gauge('replay_buffer.active_sessions', () =>
  await EgressSession.count({ status: 'active' })
);

// Storage usage
gauge('replay_buffer.temp_storage_bytes', () =>
  await calculateDiskUsage('/replay-buffer')
);

gauge('replay_buffer.saved_replays_bytes', () =>
  await ReplayClip.aggregate([{ $sum: '$file.size' }])
);

// Capture metrics
counter('replay_buffer.captures_total');
histogram('replay_buffer.capture_duration_seconds');
histogram('replay_buffer.ffmpeg_duration_seconds');

// Errors
counter('replay_buffer.errors_total', { type: 'egress_failed' });
counter('replay_buffer.errors_total', { type: 'ffmpeg_failed' });
counter('replay_buffer.errors_total', { type: 'quota_exceeded' });
```

**Logging**:
```typescript
// Egress lifecycle
logger.info('Replay buffer started', { userId, roomName, egressId });
logger.info('Replay captured', { userId, duration, size });
logger.warn('Cleanup job removed X segments', { count: deletedSegments.length });

// Errors
logger.error('FFmpeg concatenation failed', { error, segmentCount });
logger.error('Egress session failed', { egressId, error });
```

### 10. Security Considerations

**Filesystem Permissions**:
- Replay buffer directories should be writable by LiveKit and backend
- User-specific subdirectories prevent cross-user access
- Temp files cleaned up immediately after concatenation

**Path Traversal Prevention**:
```typescript
// Sanitize user input to prevent directory traversal
const sanitizedUserId = path.basename(userId);  // Remove any ../
const segmentPath = path.join(REPLAY_BUFFER_PATH, roomName, sanitizedUserId);
```

**Resource Limits**:
- **Storage quotas**: Prevent users from exhausting disk space
- **Concurrent limits**: Prevent DoS via replay buffer spam
- **FFmpeg timeouts**: Prevent hung processes

**Content Security**:
- **Ownership**: Users can only access their own replays
- **RBAC**: Capture/download subject to permissions
- **Deletion**: Users can delete their clips, freeing quota

---

## Technology Stack Summary

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Egress** | LiveKit Server (GStreamer) | Record screen share to HLS segments |
| **Storage** | Local/NFS filesystem | Store temp segments and permanent replays |
| **Concatenation** | FFmpeg | Combine segments into MP4 |
| **Backend** | NestJS + TypeScript | Orchestration and business logic |
| **Database** | MongoDB + Prisma | Session/clip/quota metadata |
| **Scheduling** | @nestjs/schedule | Cleanup cron jobs |
| **Video Codec** | H.264 (High Profile) | Broad compatibility |
| **Audio Codec** | Opus | Standard for WebRTC |
| **Container** | MPEG-TS (segments) → MP4 (final) | HLS → Web-friendly |

## Next Steps

- Read `implementation-guide.md` for step-by-step development
- Read `deployment.md` for self-hosting setup
- Read `api-reference.md` for API details
