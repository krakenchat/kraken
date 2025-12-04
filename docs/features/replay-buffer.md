# Replay Buffer (Screen Recording) Feature

> **Status:** Fully Implemented
> **Location:** `backend/src/livekit/livekit-replay.service.ts`, `frontend/src/hooks/useReplayBuffer.ts`
> **Type:** LiveKit Egress Integration

## Overview

The Replay Buffer feature provides automatic screen recording during screen sharing sessions using LiveKit's Track Composite Egress. Similar to NVIDIA ShadowPlay, it maintains a rolling buffer of recent screen share footage that can be captured, trimmed, and shared.

**Implemented Features:**
- ✅ Automatically starts egress recording when user shares screen
- ✅ Automatically stops when screen share ends
- ✅ Handles disconnections and failures gracefully via webhooks
- ✅ Cleans up old segment files and orphaned sessions
- ✅ Notifies users when recording fails
- ✅ **CaptureReplayModal** - Save clips with duration presets (1/2/5/10 min)
- ✅ **TrimPreview** - HLS video preview with trim handles for editing
- ✅ **ClipLibrary** - Browse, download, share, and manage saved clips
- ✅ **Clip sharing** - Share clips to channels or DMs
- ✅ **Public/private clips** - Toggle visibility on saved clips

## Architecture

### High-Level Flow

```
User Starts Screen Share
         ↓
Frontend: useReplayBuffer detects change
         ↓
Frontend: Extracts track IDs from LiveKit
         ↓
Frontend: POST /api/livekit/replay/start
         ↓
Backend: LivekitReplayService.startReplayBuffer()
         ↓
Backend: Calls LiveKit SDK to start Track Composite Egress
         ↓
Backend: Stores EgressSession in database (status='active')
         ↓
LiveKit Egress: Writes HLS segments to shared volume
         ↓
[User's screen share continues...]
         ↓
User Stops Screen Share OR Disconnects
         ↓
LiveKit: Auto-stops egress
         ↓
LiveKit: Sends webhook to /api/livekit/webhook
         ↓
Backend: LivekitWebhookController receives event
         ↓
Backend: LivekitReplayService.handleEgressEnded()
         ↓
Backend: Updates database (status='stopped' or 'failed')
         ↓
Backend: Sends WebSocket event to user
         ↓
Frontend: Displays notification (if failed)
```

### Components

#### Backend

**LivekitReplayService** (`backend/src/livekit/livekit-replay.service.ts`)
- `startReplayBuffer()` - Starts egress recording
- `stopReplayBuffer()` - Manually stops egress
- `handleEgressEnded()` - Processes LiveKit webhook events
- `cleanupOldSegments()` - Cron job (every 5 min) to delete segments >20 min old
- `cleanupOrphanedSessions()` - Cron job (hourly) to cleanup sessions >3 hours old
- `reconcileEgressStatus()` - Cron job (every 10 min) to verify DB matches LiveKit state

**LivekitWebhookController** (`backend/src/livekit/livekit-webhook.controller.ts`)
- Receives webhook events from LiveKit
- Verifies webhook signatures
- Delegates `egress_ended` events to LivekitReplayService

**Database Model** (`EgressSession`)
```prisma
model EgressSession {
  id          String    @id @default(auto()) @map("_id") @db.ObjectId
  egressId    String    @unique
  userId      String    @db.ObjectId
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  roomName    String
  channelId   String    @db.ObjectId
  segmentPath String
  status      String    // "active", "stopped", "failed"
  error       String?   // Error message if failed
  startedAt   DateTime
  endedAt     DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

#### Frontend

**useReplayBuffer Hook** (`frontend/src/hooks/useReplayBuffer.ts`)
- Monitors `isScreenShareEnabled` state
- Extracts track IDs when screen share starts
- Calls backend API to start/stop egress
- Listens for WebSocket events (stopped, failed)
- Cleans up on unmount

**Integration Point**
- Hook is used in `VoiceBottomBar` component
- Automatically active when user is in voice channel

## LiveKit Webhook Configuration

### Prerequisites

1. **Shared Volume Setup**
   - LiveKit egress pods and Kraken backend must share a volume
   - Configure volume mount in Kubernetes/Docker Compose
   - Set `REPLAY_SEGMENTS_PATH` to the shared path

2. **Environment Variables**

```bash
# Backend .env
LIVEKIT_URL=wss://your-livekit-server.com
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
LIVEKIT_WEBHOOK_SECRET=your-webhook-secret-from-livekit

REPLAY_SEGMENTS_PATH=/app/storage/replay-segments
REPLAY_SEGMENT_CLEANUP_AGE_MINUTES=20
```

### LiveKit Cloud Configuration

1. **Navigate to your LiveKit Cloud project**
   - Go to https://cloud.livekit.io
   - Select your project

2. **Configure Webhook**
   - Go to Settings → Webhooks
   - Click "Add Webhook"
   - **URL:** `https://your-kraken-domain.com/api/livekit/webhook`
   - **Secret:** Generate a secure random string (save to `LIVEKIT_WEBHOOK_SECRET`)
   - **Events:** Select "Egress" events

3. **Save Configuration**
   - Test webhook by triggering a test event
   - Check backend logs for webhook receipt

### Self-Hosted LiveKit Configuration

Edit your LiveKit server configuration file:

```yaml
# livekit.yaml
webhook:
  api_key: your-livekit-api-key
  urls:
    - https://your-kraken-domain.com/api/livekit/webhook

  # Optional: Specific events to send
  events:
    - egress_started
    - egress_updated
    - egress_ended
```

Restart LiveKit server to apply changes.

### Webhook Security

The webhook controller verifies signatures using the `LIVEKIT_WEBHOOK_SECRET`:

```typescript
// Automatic verification in LivekitWebhookController
const verified = await this.webhookReceiver.receive(rawBody, authorization);
if (!verified) {
  throw new BadRequestException('Invalid webhook signature');
}
```

**Important:**
- NEVER expose your webhook secret in client code
- Use HTTPS for webhook endpoint in production
- Rotate webhook secret periodically

## Failure Modes & Recovery

### Automatic Failure Handling

| Failure Scenario | Detection Method | Recovery Action | User Notification |
|------------------|------------------|-----------------|-------------------|
| User disconnects | LiveKit auto-stops → Webhook | Update DB, cleanup segments | ✅ Yes (WebSocket) |
| Browser crash | Orphaned session cleanup (hourly) | Force stop, cleanup | ❌ No (can't reach user) |
| Network drop | LiveKit auto-stops → Webhook | Update DB | ✅ Yes (when reconnects) |
| Track unpublished | LiveKit auto-stops → Webhook | Update DB | ✅ Yes |
| LiveKit server restart | Orphaned cleanup + reconciliation | Force stop all | ❌ No |
| Disk full | Egress fails → Webhook | Update DB, mark failed | ✅ Yes (error toast) |
| Missed webhook | Reconciliation (every 10 min) | Sync DB with LiveKit | ✅ Yes (if failed) |

### Cron Jobs

**1. Segment Cleanup** (Every 5 minutes)
```typescript
@Cron('*/5 * * * *')
async cleanupOldSegments()
```
- Deletes segment files older than 20 minutes (configurable)
- Runs for all active sessions
- Maintains rolling buffer size

**2. Orphaned Session Cleanup** (Every hour)
```typescript
@Cron('0 * * * *')
async cleanupOrphanedSessions()
```
- Finds sessions active for >3 hours
- Stops egress (if still running)
- Updates database
- Deletes segment directories

**3. Status Reconciliation** (Every 10 minutes)
```typescript
@Cron('*/10 * * * *')
async reconcileEgressStatus()
```
- Queries LiveKit for actual egress status
- Compares with database
- Updates mismatches
- Sends user notifications if needed

## Storage Architecture

### Directory Structure

```
{REPLAY_SEGMENTS_PATH}/          (e.g., /app/storage/replay-segments)
├── {userId1}/
│   ├── {timestamp1}/
│   │   ├── segment-0001.ts      # MPEG-TS segment
│   │   ├── segment-0002.ts
│   │   ├── segment-0003.ts
│   │   └── playlist.m3u8        # HLS playlist
│   └── {timestamp2}/
│       ├── segment-0001.ts
│       └── playlist.m3u8
└── {userId2}/
    └── {timestamp3}/
        ├── segment-0001.ts
        └── playlist.m3u8
```

### Segment Details

- **Format:** MPEG-TS (`.ts` files)
- **Codec:** H.264 720p @ 30fps
- **Segment Duration:** 10 seconds
- **Playlist:** HLS `.m3u8` file
- **Cleanup:** Files older than 20 minutes deleted automatically

### Storage Requirements

**Per active session:**
- ~5-10 MB per minute (varies by content)
- 20-minute buffer = ~100-200 MB max per user
- With 10 concurrent users: ~1-2 GB

**Shared Volume Mounting:**

Docker Compose:
```yaml
services:
  backend:
    volumes:
      - replay-segments:/app/storage/replay-segments

  # LiveKit egress (if running in same compose)
  livekit-egress:
    volumes:
      - replay-segments:/app/storage/replay-segments

volumes:
  replay-segments:
```

Kubernetes:
```yaml
# PersistentVolumeClaim
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: replay-segments-pvc
spec:
  accessModes:
    - ReadWriteMany  # Both backend and egress need RWX
  resources:
    requests:
      storage: 50Gi

# Mount in backend deployment
spec:
  containers:
    - name: backend
      volumeMounts:
        - name: replay-segments
          mountPath: /app/storage/replay-segments
  volumes:
    - name: replay-segments
      persistentVolumeClaim:
        claimName: replay-segments-pvc

# Mount in LiveKit egress deployment (same way)
```

## API Endpoints

### Start Replay Buffer

```http
POST /api/livekit/replay/start
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "channelId": "channel-id",
  "roomName": "livekit-room-name",
  "videoTrackId": "TR_video_track_sid",
  "audioTrackId": "TR_audio_track_sid"
}
```

**Response:**
```json
{
  "sessionId": "mongo-object-id",
  "egressId": "EG_livekit_egress_id",
  "status": "active"
}
```

**RBAC:** Requires `JOIN_CHANNEL` permission for the specified channel

### Stop Replay Buffer

```http
POST /api/livekit/replay/stop
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "sessionId": "mongo-object-id",
  "egressId": "EG_livekit_egress_id",
  "status": "stopped"
}
```

**Notes:**
- Automatically finds and stops user's active session
- Returns 404 if no active session found

### Webhook Endpoint (LiveKit → Backend)

```http
POST /api/livekit/webhook
Authorization: <webhook-signature>
Content-Type: application/json

{
  "event": "egress_ended",
  "egressInfo": {
    "egressId": "EG_xxx",
    "status": "EGRESS_COMPLETE",
    "startedAt": 1234567890,
    "endedAt": 1234567900
  }
}
```

**Notes:**
- No authentication required (signature verified)
- Idempotent (can receive duplicate events safely)

## WebSocket Events

### REPLAY_BUFFER_STOPPED

Sent when egress ends successfully.

```typescript
{
  sessionId: string;
  egressId: string;
  channelId: string;
}
```

**When Sent:**
- User manually stops screen share
- User disconnects from room
- Track unpublished
- Egress completes normally

### REPLAY_BUFFER_FAILED

Sent when egress fails.

```typescript
{
  sessionId: string;
  egressId: string;
  channelId: string;
  error: string;  // Error description
}
```

**Common Errors:**
- `"Disk full"` - Storage exhausted
- `"Track not found"` - Track ended before egress started
- `"Encoding error"` - Video encoding failed

**Frontend Handling:**
```typescript
// In useReplayBuffer.ts
socket.on(ServerEvents.REPLAY_BUFFER_FAILED, (data) => {
  // TODO: Show error toast
  console.error('Recording failed:', data.error);
});
```

## Testing

### Manual Testing

1. **Start Recording:**
   ```bash
   # Join voice channel
   # Start screen share
   # Check backend logs for "Starting replay buffer"
   # Verify segments appear in REPLAY_SEGMENTS_PATH
   ```

2. **Stop Recording:**
   ```bash
   # Stop screen share
   # Check backend logs for "Egress stopped"
   # Verify session status='stopped' in database
   ```

3. **Test Webhook:**
   ```bash
   curl -X POST https://your-domain.com/api/livekit/webhook \
     -H "Content-Type: application/json" \
     -H "Authorization: <livekit-signature>" \
     -d '{
       "event": "egress_ended",
       "egressInfo": {
         "egressId": "EG_test",
         "status": "EGRESS_COMPLETE"
       }
     }'
   ```

4. **Test Orphaned Cleanup:**
   ```bash
   # Manually set session.startedAt to >3 hours ago in database
   # Wait for hourly cron or trigger manually
   # Verify session cleaned up
   ```

### Integration Tests

**Backend Test Example:**
```typescript
describe('LivekitReplayService', () => {
  it('should handle egress ended webhook', async () => {
    const session = await createTestSession();

    await service.handleEgressEnded(
      session.egressId,
      'failed',
      'Disk full'
    );

    const updated = await db.egressSession.findUnique({
      where: { id: session.id }
    });

    expect(updated.status).toBe('failed');
    expect(updated.error).toBe('Disk full');
    expect(mockWebsocket.sendToRoom).toHaveBeenCalledWith(
      session.userId,
      ServerEvents.REPLAY_BUFFER_FAILED,
      expect.objectContaining({ error: 'Disk full' })
    );
  });
});
```

## Troubleshooting

### Issue: Webhooks Not Received

**Symptoms:** Egress stops in LiveKit but database still shows `status='active'`

**Diagnosis:**
1. Check LiveKit webhook configuration
2. Verify `LIVEKIT_WEBHOOK_SECRET` matches LiveKit config
3. Check backend logs for webhook signature errors
4. Ensure webhook URL is publicly accessible (not localhost)

**Fix:**
- Update LiveKit webhook URL
- Regenerate webhook secret and update both sides
- Use ngrok/cloudflare tunnel for local development

### Issue: Segments Not Appearing

**Symptoms:** Egress starts but no files in `REPLAY_SEGMENTS_PATH`

**Diagnosis:**
1. Check volume mount permissions
2. Verify LiveKit egress has write access
3. Check `REPLAY_SEGMENTS_PATH` in both backend and LiveKit config

**Fix:**
```bash
# Check permissions
ls -la /app/storage/replay-segments

# Fix permissions (if needed)
chmod 777 /app/storage/replay-segments

# Verify mounts match
docker inspect kraken-backend | grep replay-segments
docker inspect livekit-egress | grep replay-segments
```

### Issue: Orphaned Sessions Piling Up

**Symptoms:** Many sessions with `status='active'` but no actual egress running

**Diagnosis:**
1. Check if cron jobs are running (`docker logs backend | grep "cleanup"`)
2. Verify reconciliation job can reach LiveKit API

**Fix:**
```bash
# Manually trigger cleanup (in container)
docker exec -it kraken-backend node -e "
  const service = require('./dist/livekit/livekit-replay.service');
  service.cleanupOrphanedSessions();
"

# Or update all orphaned sessions in database
db.egressSession.updateMany(
  { status: 'active', startedAt: { $lt: new Date(Date.now() - 3 * 60 * 60 * 1000) } },
  { $set: { status: 'stopped', endedAt: new Date() } }
)
```

### Issue: Frontend Not Receiving WebSocket Events

**Symptoms:** Egress fails but user sees no notification

**Diagnosis:**
1. Check if user is connected to WebSocket
2. Verify `userId` room join in Socket.IO
3. Check backend logs for "Sent REPLAY_BUFFER_FAILED"

**Fix:**
- Ensure user joins their userId room on WebSocket connect
- Check frontend console for Socket.IO connection errors
- Verify `useReplayBuffer` hook is actually running (add console.log)

## UI Components

### CaptureReplayModal
Opens when user wants to save a clip. Provides:
- Duration presets (1, 2, 5, 10 minutes) with size estimates
- Option to trim before saving
- Destination picker for sharing to channel/DM
- Save to library only option

See [CaptureReplayModal Component](../components/voice/CaptureReplayModal.md)

### TrimPreview
HLS video player with interactive timeline:
- Draggable start/end trim handles
- Play/pause and skip controls
- Loop within selected range
- Time display

See [TrimPreview Component](../components/voice/TrimPreview.md)

### ClipLibrary
User's saved clips browser:
- Grid view with thumbnails
- Download, delete, share actions
- Public/private visibility toggle
- View other users' public clips

See [ClipLibrary Component](../components/profile/ClipLibrary.md)

## Future Enhancements

### S3 Storage Backend
Currently uses local/NFS storage. Future enhancement to support S3/Azure Blob:
- Configure LiveKit egress to write directly to S3
- Update segment discovery to list S3 objects
- Download segments temporarily for FFmpeg processing
- Upload final clips to cloud storage

See `CLAUDE.md` for detailed TODO on configurable egress storage.

## Related Documentation

- [LiveKit Module Documentation](../modules/voice/livekit.md)
- [LiveKit API Endpoints](../api/livekit.md)
- [Storage Module](../modules/storage.md)
- [WebSocket Events](../api/websocket-events.md)
- [RBAC Permissions](./auth-rbac.md)

## References

- [LiveKit Egress Documentation](https://docs.livekit.io/guides/egress/)
- [LiveKit Webhooks](https://docs.livekit.io/guides/webhooks/)
- [HLS Specification](https://datatracker.ietf.org/doc/html/rfc8216)
