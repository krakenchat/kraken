# 07 — Voice, Video & File Systems

> LiveKit for voice/video, Redis for presence, HLS egress for replay buffer, FFmpeg for clips, abstracted file storage.

---

## Table of Contents

- [LiveKit Integration](#livekit-integration)
- [Voice Presence System](#voice-presence-system)
- [Replay Buffer](#replay-buffer)
- [Clip Library](#clip-library)
- [Screen Sharing](#screen-sharing)
- [DM Voice Calls](#dm-voice-calls)
- [File Upload System](#file-upload-system)
- [File Storage Abstraction](#file-storage-abstraction)
- [Storage Quotas](#storage-quotas)
- [Thumbnail Generation](#thumbnail-generation)
- [File Access Control](#file-access-control)

---

## LiveKit Integration

### Architecture

```
Client (Browser/Electron)
    │
    ├─ 1. POST /livekit/token (or /dm-token) → get JWT
    ├─ 2. Connect to LiveKit server (:7880) with token
    │      └─ WebRTC peer connection established
    │      └─ Audio/video tracks published/subscribed
    │
    └─ 3. LiveKit webhooks → Backend
           └─ participant_joined → voice presence join
           └─ participant_left → voice presence leave
           └─ egress_ended → replay buffer cleanup
```

### Token Generation (`LivekitService`)

```typescript
// Token grants
{
  roomJoin: true,
  canPublish: true,
  canSubscribe: true,
  canPublishData: true,
  canUpdateOwnMetadata: true,
  room: channelId,              // Channel ID = LiveKit room ID
}
// TTL: 3600 seconds (1 hour)
```

### Server-Side Muting

`POST /livekit/channels/:channelId/mute-participant` — requires `MUTE_PARTICIPANT` RBAC action. Filters audio tracks and calls LiveKit's `mutePublishedTrack` API.

### Webhook Controller (`/livekit/webhook`)

| Event | Handler |
|-------|---------|
| `participant_joined` | `VoicePresenceService.handleWebhookParticipantJoined()` |
| `participant_left` | `VoicePresenceService.handleWebhookParticipantLeft()` + stop replay |
| `egress_ended` | `LivekitReplayService.handleEgressEnded()` |
| `room_finished` | Cleanup |

---

## Voice Presence System

### Redis Architecture

Uses SET-based keys for O(1) lookups:

```
voice_presence:user:{channelId}:{userId}     → JSON(user data) [TTL: 90s]
voice_presence:channel:{channelId}:members   → SET of userIds
voice_presence:user_channels:{userId}        → SET of channelIds
```

### Presence Data

```typescript
{
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  joinedAt: Date;
  isDeafened: boolean;
  isServerMuted: boolean;
}
```

### Lifecycle

```
LiveKit webhook: participant_joined
    ↓
VoicePresenceService:
  1. Add user to Redis channel member SET
  2. Add channel to Redis user_channels SET
  3. Store user data with 90s TTL
  4. Emit VOICE_CHANNEL_USER_JOINED via WebSocket
    ↓
Client heartbeat every 30s (VOICE_PRESENCE_REFRESH)
  → refreshPresence() resets 90s TTL
    ↓
LiveKit webhook: participant_left (or TTL expires)
  1. Remove from Redis SETs
  2. Emit VOICE_CHANNEL_USER_LEFT
  3. Stop replay buffer if active
```

### DM Voice Presence

Separate Redis keys: `dm_voice_presence:user:{dmGroupId}:{userId}`

| Event | Trigger |
|-------|---------|
| `DM_VOICE_CALL_STARTED` | First user joins DM voice |
| `DM_VOICE_USER_JOINED` | Additional users join |
| `DM_VOICE_USER_LEFT` | User leaves DM voice |

### REST Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/channels/:id/voice-presence` | Users in channel |
| POST | `/channels/:id/voice-presence/join` | Register join |
| POST | `/channels/:id/voice-presence/leave` | Register leave |
| POST | `/channels/:id/voice-presence/refresh` | Refresh TTL |
| POST | `/channels/:id/voice-presence/deafen` | Update deafen state |
| GET | `/dm-groups/:id/voice-presence` | Users in DM voice |
| GET | `/voice-presence/me` | User's current channels |

---

## Replay Buffer

### Overview

```
Screen Share active
    ↓
LiveKit Egress (HLS recording)
    ↓
/app/storage/replay-segments/{sessionId}/
    ├── segment_0.ts
    ├── segment_1.ts
    └── ...
    ↓
FFmpeg processing
    ↓
MP4 clip → File storage → ReplayClip record
```

### Session Management

One active egress session per user:

```
POST /livekit/replay/start
  → videoTrackId, audioTrackId, participantIdentity
  → Creates LiveKit HLS egress targeting segment directory
  → Stores EgressSession in database

POST /livekit/replay/stop
  → Stops active egress for current user
```

### Capture Flow

```
POST /livekit/replay/capture (rate limited: 3/min, 15/hr)
    │
    ├─ 1. Find segments within requested time window
    ├─ 2. Create temporary concat file list
    ├─ 3. FFmpeg concatenates segments → MP4
    │      └─ Supports trim (startOffset + duration)
    ├─ 4. Create File record (storage)
    ├─ 5. Create ReplayClip record
    └─ 6. Return clip metadata
```

### HLS Preview Serving

| Endpoint | Purpose |
|----------|---------|
| `GET /livekit/replay/preview/playlist.m3u8` | Live HLS playlist |
| `GET /livekit/replay/preview/segment/:file` | Individual .ts segments |

Segments are **remuxed on-the-fly** from HDMV-TS (LiveKit egress format) to standard MPEG-TS for HLS.js compatibility.

### Stream Download

`GET /livekit/replay/stream?durationMinutes=X` — Downloads last X minutes as MP4. Temporary file, deleted after streaming. Does NOT create a persistent clip.

### Cron Jobs

| Schedule | Job | Purpose |
|----------|-----|---------|
| Every 5 min | `cleanupOldSegments` | Delete segments > 2 hours old |
| Every 1 hr | `cleanupOrphanedSessions` | Clean sessions without recent activity |
| Every 1 min | `reconcileEgressStatus` | Query LiveKit for status updates |
| Every 30 min | `cleanupRemuxCache` | Clean cached remuxed segments |

### Frontend Integration (`useReplayBuffer`)

- **Auto-start:** Listens for `RoomEvent.LocalTrackPublished` with `Track.Source.ScreenShare`
- **Track detection:** Extracts video + audio track IDs (retries up to 10x for audio, 200ms each)
- **Operation queuing:** Refs prevent race conditions on rapid screen share toggles
- **Cleanup:** Graceful stop on unmount (handles 404 if already stopped)

> **Review Point:** The replay buffer auto-starts whenever screen sharing begins. There's no user opt-in — it just records. This should be clearly communicated to users, especially for privacy.

---

## Clip Library

### Service (`ClipLibraryService`)

| Operation | Endpoint | Notes |
|-----------|----------|-------|
| Get my clips | `GET /livekit/clips` | Sorted by capturedAt desc |
| Get public clips | `GET /livekit/clips/user/:userId` | For profile display |
| Update clip | `PUT /livekit/clips/:clipId` | Toggle `isPublic` |
| Delete clip | `DELETE /livekit/clips/:clipId` | Deletes file from storage too |
| Share clip | `POST /livekit/clips/:clipId/share` | Creates message with clip attachment |

### Data Model

```typescript
ReplayClip {
  id, userId, fileId, channelId?,
  durationSeconds, isPublic, capturedAt
}
```

---

## Screen Sharing

### Platform-Aware Hook (`useScreenShare`)

```
Start screen share
    │
    ├─ Electron + X11/macOS/Windows?
    │   └─ Show custom ScreenSourcePicker dialog
    │   └─ User selects source (screen/window)
    │   └─ Source stored in state
    │   └─ Electron main process intercepts via setDisplayMediaRequestHandler
    │
    └─ Web or Electron + Wayland?
        └─ Browser/OS native picker (getDisplayMedia)
```

### Electron Main Process Handling

```typescript
// main.ts
session.defaultSession.setDisplayMediaRequestHandler(
  (request, callback) => {
    if (isWayland) {
      // PipeWire portal: return single pre-selected source
    } else {
      // X11/macOS/Windows: use window.__selectedScreenSourceId
    }
    // Audio loopback configuration:
    // - macOS: loopbackWithoutChrome
    // - Windows: loopback
    // - Linux: no audio (restrictOwnAudio not supported)
    callback({ video: desktopSource, audio: audioConfig });
  }
);
```

### Audio Loopback

| Platform | Method | Notes |
|----------|--------|-------|
| macOS | `loopbackWithoutChrome` | System audio minus app |
| Windows | `loopback` | System audio (WASAPI) |
| Linux | Not supported | `restrictOwnAudio` missing |

> **Review Point:** Audio loopback requires `electron-audio-loopback` (native module). Build failures on Linux are expected. The screen share will still work — just without system audio.

---

## DM Voice Calls

### Incoming Call Flow

```
User A starts DM voice
    │
    ├─ Backend: First user joins → emit DM_VOICE_CALL_STARTED
    │   └─ Payload: { dmGroupId, startedBy, starter: { id, username, avatar } }
    │
    └─ User B's client:
        ├─ IncomingCallListener receives event
        ├─ Checks: logged in, not own call, not already in DM voice
        ├─ Plays Sounds.incomingCall (repeats every 3.5s)
        ├─ Shows IncomingCallBanner with caller info
        └─ Desktop notification (requireInteraction: true)
```

### Controls

`DMVoiceControls` component provides join/leave buttons for DM voice calls, integrating with `useVoiceConnection` hook.

---

## File Upload System

### Upload Flow

```
POST /file-upload (multipart FormData)
    │
    ├─ 1. Multer receives file
    ├─ 2. MIME type validation (per resource type)
    ├─ 3. Storage quota check (canUploadFile)
    ├─ 4. SHA-256 checksum generation
    ├─ 5. Determine FileType from MIME
    ├─ 6. Write to storage (local filesystem)
    ├─ 7. Create File record in database
    ├─ 8. Increment user's storageUsedBytes
    ├─ 9. Fire-and-forget thumbnail generation (videos)
    └─ 10. Return { fileId, filename, mimeType, size }
```

### Validation Strategies

MIME-type-aware size limits per resource type:

| Resource | Max Size | Allowed Types |
|----------|----------|---------------|
| User avatar | Per instance setting | image/* |
| User banner | Per instance setting | image/* |
| Community avatar | Per instance setting | image/* |
| Community banner | Per instance setting | image/* |
| Message attachment | Per instance setting | Configurable |
| Custom emoji | Per instance setting | image/* |

### File Metadata

```typescript
File {
  id, filename, mimeType, fileType,
  size (bytes), checksum (SHA-256),
  storageType, storagePath, thumbnailPath?,
  uploadedById, resourceType,
  fileUserId?, fileCommunityId?, fileMessageId?,
  deletedAt?
}
```

---

## File Storage Abstraction

### Provider Pattern

```
StorageService (facade)
  ├── LocalStorageProvider (filesystem)  ← Currently used
  ├── S3Provider (prepared)
  └── AzureBlobProvider (prepared)
```

### LocalStorageProvider Methods

| Method | Purpose |
|--------|---------|
| `writeFile(path, data)` | Store file |
| `readFile(path)` | Read file buffer |
| `createReadStream(path)` | Stream for download responses |
| `deleteFile(path)` | Remove file |
| `fileExists(path)` | Check existence |
| `getFileStats(path)` | Size, mtime, ctime |
| `deleteOldFiles(dir, olderThan)` | Cleanup cron |
| `listSegmentFiles(dir)` | Replay segment listing |
| `readSegmentFile(path)` | Segment access with prefix |

### Configuration

| Env Var | Default | Purpose |
|---------|---------|---------|
| `STORAGE_TYPE` | `LOCAL` | Storage backend |
| `FILE_UPLOAD_DEST` | `./uploads` | Upload directory |
| `REPLAY_SEGMENTS_PATH` | `/app/storage/replay-segments` | Egress segments |

---

## Storage Quotas

### Per-User Tracking

```typescript
User {
  storageQuotaBytes: BigInt  // Default: 50GB
  storageUsedBytes: BigInt   // Cached counter
}
```

### Instance Defaults

```typescript
InstanceSettings {
  defaultStorageQuotaBytes: BigInt  // 50GB
  maxFileSizeBytes: BigInt          // 500MB
}
```

### Quota Operations

| Method | Purpose |
|--------|---------|
| `canUploadFile(userId, size)` | Pre-upload check |
| `incrementUserStorage(userId, bytes)` | After upload |
| `decrementUserStorage(userId, bytes)` | After deletion |
| `recalculateUserStorage(userId)` | Fix drift |

**Daily cron (3 AM):** Recalculates all users' storage from actual files.

### Soft Delete + Cleanup

```
User requests delete
    ↓ File.deletedAt = now()
    ↓ storageUsedBytes decremented immediately
    ↓
Cron (every 10 min): cleanupOldFiles
    ↓ Find files where deletedAt IS NOT NULL
    ↓ Remove from physical storage
    ↓ Delete DB record
```

---

## Thumbnail Generation

### Process

```
Video uploaded
    ↓ (fire-and-forget, non-blocking)
FFmpeg:
  -ss 1           (seek 1 second in)
  -vframes 1      (single frame)
  -vf scale=480:-1 (480px wide, preserve ratio)
  -q:v 5          (JPEG quality 5)
  Timeout: 30s
    ↓
Store path in File.thumbnailPath
```

---

## File Access Control

### Guard Chain

```
GET /file/:id
    │
    ├─ FileAuthGuard: accept JWT OR signed URL (?sig=&exp=&uid=)
    │
    └─ FileAccessGuard: check access strategy
        ├─ Public access (public resources)
        ├─ Community membership (community avatar/banner)
        └─ Message attachment (channel/DM membership)
```

### Signed URLs

Generated by `SignedUrlService` for:
- Video streaming (where cookies may not work)
- Electron file access (cross-origin)
- Time-limited: includes expiry timestamp
- HMAC-signed: prevents tampering

---

## Frontend Voice Hooks

| Hook | Purpose |
|------|---------|
| `useVoiceConnection` | Core: join/leave, toggle audio/video/screen/deafen |
| `useRoom` | LiveKit Room instance from context |
| `useLocalMediaState` | Current mic/camera/screen state from LiveKit |
| `useParticipantTracks` | Any participant's media state (local or remote) |
| `useSpeakingDetection` | Speaking state for all participants |
| `useVoicePresenceHeartbeat` | 30s heartbeat to keep Redis TTL alive |
| `useScreenShare` | Platform-aware screen sharing |
| `usePushToTalk` | PTT key handling |
| `useVoiceSettings` | Voice activity vs PTT mode, key binding |
| `useVoicePresenceSounds` | Play sounds on join/leave |
| `useDeafenEffect` | Mute all remote audio (volume = 0) |
| `useRemoteVolumeEffect` | Reapply per-user volume from localStorage |
| `useServerMuteEffect` | Enforce server-side mute |
| `useVoiceRecovery` | Auto-reconnect after page refresh |
| `useReplayBuffer` | Auto-manage egress recording during screen share |

---

## Cross-References

- EgressSession/ReplayClip models → [01-database-schema.md](./01-database-schema.md)
- LiveKit module endpoints → [02-backend-modules.md](./02-backend-modules.md)
- Voice WebSocket events → [06-websocket-system.md](./06-websocket-system.md)
- Voice components (VoiceBottomBar, VideoTiles) → [05-frontend-components.md](./05-frontend-components.md)
- Docker Compose LiveKit services → [09-infrastructure.md](./09-infrastructure.md)
