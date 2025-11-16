# LiveKit Egress Types - Comprehensive Comparison

Complete guide to choosing the right LiveKit egress type for your use case.

## Overview

LiveKit offers **four egress types** for recording, each with different capabilities, resource requirements, and use cases:

1. **Track Egress** - Records a single audio OR video track
2. **Track Composite Egress** - Combines one video + one audio track (SDK-only)
3. **Participant Egress** - Records all tracks from a single participant (with auto-detection)
4. **Room Composite Egress** - Records entire room layout (Chrome-rendered)

## Quick Comparison Table

| Feature | Track Egress | Track Composite | Participant Egress | Room Composite |
|---------|--------------|-----------------|-------------------|----------------|
| **Chrome Rendering** | ❌ No | ❌ No | ❌ No | ✅ Yes |
| **CPU per Recording** | 0.2-0.5 | 0.5-1 | 0.5-1 | 2-6 |
| **RAM per Recording** | 200-500MB | 500MB-1GB | 500MB-1GB | 2-4GB |
| **Concurrent per 2-CPU Pod** | 8-16 | 4-8 | 4-8 | 1-2 |
| **Audio + Video Sync** | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes |
| **Multiple Audio Tracks** | ❌ No | ❌ No | ✅ Yes | ✅ Yes |
| **Custom Layouts** | ❌ No | ❌ No | ❌ No | ✅ Yes |
| **HLS Segmented Output** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Stream Output (RTMP)** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **File Output (MP4/WebM)** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Best For** | Single track | Screen share | Single user | Multi-user meetings |
| **Infrastructure Cost** | Lowest | Low | Low | **Highest** |

---

## Detailed Comparison

### 1. Track Egress

**Description**: Records a single audio OR video track (not both).

**API**:
```typescript
import { EgressClient } from 'livekit-server-sdk';

const egressClient = new EgressClient(url, apiKey, apiSecret);

// Record video track only
const videoEgress = await egressClient.startTrackEgress({
  roomName: 'my-room',
  trackId: 'TR_VideoTrackId',
  file: {
    filepath: '/path/to/output.mp4',
  },
});

// Record audio track only
const audioEgress = await egressClient.startTrackEgress({
  roomName: 'my-room',
  trackId: 'TR_AudioTrackId',
  file: {
    filepath: '/path/to/output.mp3',
  },
});
```

**Use Cases**:
- Recording audio-only podcasts
- Capturing presentation slides (video only)
- Archiving individual tracks for post-processing

**Pros**:
- Lowest resource usage (0.2-0.5 CPU, 200-500MB RAM)
- Simple API
- Fast startup

**Cons**:
- ❌ Cannot sync audio + video together
- ❌ Need separate egress sessions for each track
- ❌ Manual synchronization required for multi-track

**Resource Requirements**:
- **CPU**: 0.2-0.5 per recording
- **RAM**: 200-500MB per recording
- **Concurrent per 2-CPU Pod**: 8-16 recordings

---

### 2. Track Composite Egress ⭐ (Recommended for Replay Buffer)

**Description**: Combines **one video track + one audio track** into a single synchronized output. Uses SDK directly (no Chrome).

**API**:
```typescript
import { EgressClient, EncodingOptionsPreset } from 'livekit-server-sdk';

const egressClient = new EgressClient(url, apiKey, apiSecret);

const egressInfo = await egressClient.startTrackCompositeEgress({
  roomName: 'my-room',
  videoTrackId: 'TR_ScreenShareVideoTrack',  // Screen share video
  audioTrackId: 'TR_ScreenShareAudioTrack',   // Screen share audio (optional)
  preset: EncodingOptionsPreset.H264_1080P_60,
  segmentedFileOutputs: [{
    filenamePrefix: '/path/to/segments/segment',
    playlistName: 'playlist.m3u8',
    livePlaylistName: 'live.m3u8',
    segmentDuration: 10,  // 10-second segments
  }],
});
```

**Use Cases**:
- ✅ **Replay buffer / shadowplay feature** (our use case)
- Screen share recording with audio
- Single participant recording (user's camera + mic)
- Low-latency recording with minimal resources

**Pros**:
- ✅ Perfect audio/video synchronization
- ✅ SDK-only (no Chrome overhead)
- ✅ 80-90% lower resource usage than Room Composite
- ✅ Supports HLS segmented output (for rolling buffer)
- ✅ Simple API with explicit track IDs

**Cons**:
- ❌ Only supports ONE audio track (cannot mix desktop + microphone audio)
- ❌ No custom layouts or overlays
- ❌ Requires frontend to detect and send track IDs

**Resource Requirements**:
- **CPU**: 0.5-1 per recording
- **RAM**: 500MB-1GB per recording
- **Concurrent per 2-CPU Pod**: 4-8 recordings

**Why We Use This**:
- Our replay buffer records a single user's screen share
- No need for custom layouts
- Massive resource savings (80% less than Room Composite)
- Direct SDK usage = faster, more reliable

---

### 3. Participant Egress

**Description**: Records all tracks from a single participant. Simplified API with auto-track detection.

**API**:
```typescript
import { EgressClient, EncodingOptionsPreset } from 'livekit-server-sdk';

const egressClient = new EgressClient(url, apiKey, apiSecret);

const egressInfo = await egressClient.startParticipantEgress({
  roomName: 'my-room',
  identity: 'user-123',           // Participant identity
  screenShare: true,              // Capture screen share
  preset: EncodingOptionsPreset.H264_1080P_60,
  fileOutputs: [{
    filepath: '/path/to/output.mp4',
  }],
});
```

**Use Cases**:
- Recording a single user's camera + microphone
- Capturing screen share without manual track IDs
- Simplified recording with auto-detection

**Pros**:
- ✅ Simpler API (no need to specify track IDs)
- ✅ Auto-detects tracks (camera, mic, screen share)
- ✅ SDK-only (no Chrome)
- ✅ Supports multiple audio tracks

**Cons**:
- ❌ **Known bugs in v1.8.x** (LiveKit team confirmed)
- ❌ Less control over specific tracks
- ❌ `screenShare` parameter may not work reliably
- ❌ Auto-detection can pick wrong tracks

**Resource Requirements**:
- **CPU**: 0.5-1 per recording
- **RAM**: 500MB-1GB per recording
- **Concurrent per 2-CPU Pod**: 4-8 recordings

**Why We Don't Use This**:
- Bugs in current LiveKit version (v1.8.x)
- Less explicit control than Track Composite
- `screenShare: true` parameter unreliable

---

### 4. Room Composite Egress

**Description**: Records the entire room with custom layouts using Chrome rendering.

**API**:
```typescript
import { EgressClient, EncodingOptionsPreset } from 'livekit-server-sdk';

const egressClient = new EgressClient(url, apiKey, apiSecret);

const egressInfo = await egressClient.startRoomCompositeEgress({
  roomName: 'my-room',
  layout: 'grid',  // or 'speaker', 'custom'
  preset: EncodingOptionsPreset.H264_1080P_60,
  fileOutputs: [{
    filepath: '/path/to/output.mp4',
  }],
});
```

**Use Cases**:
- Recording full meetings with multiple participants
- Custom layouts (grid view, speaker view, picture-in-picture)
- Branded recordings with overlays and watermarks
- Webinar recordings with multiple speakers

**Pros**:
- ✅ Supports multiple participants
- ✅ Custom layouts via HTML/CSS templates
- ✅ Can add overlays, branding, watermarks
- ✅ Captures all room audio/video automatically

**Cons**:
- ❌ **Requires Chrome** (headless browser)
- ❌ **High CPU usage** (2-6 CPUs per recording)
- ❌ **High RAM usage** (2-4GB per recording)
- ❌ Only 1-2 concurrent recordings per 4-CPU pod
- ❌ Slower startup time (Chrome launch)
- ❌ **5x infrastructure cost** vs Track Composite

**Resource Requirements**:
- **CPU**: 2-6 per recording
- **RAM**: 2-4GB per recording
- **Concurrent per 4-CPU Pod**: 1-2 recordings

**Why We Don't Use This**:
- Massive resource overhead for single-user screen share
- Don't need custom layouts
- 5x more expensive than Track Composite
- Slower and less reliable (Chrome dependencies)

---

## Decision Matrix

### Choose Track Egress If:
- ✅ Recording audio-only OR video-only (not both)
- ✅ Need lowest possible resource usage
- ✅ Will synchronize tracks manually later

### Choose Track Composite If: ⭐
- ✅ Recording one video + one audio track together
- ✅ Need synchronized audio/video
- ✅ Want low resource usage (SDK-only)
- ✅ **Recording screen share** (our use case)
- ✅ Replay buffer / shadowplay feature

### Choose Participant Egress If:
- ✅ Want simplified API
- ✅ Recording single participant (all tracks)
- ⚠️ Willing to deal with v1.8.x bugs
- ⚠️ Don't need precise track control

### Choose Room Composite If:
- ✅ Recording full meetings (multiple participants)
- ✅ Need custom layouts or branding
- ✅ Have infrastructure budget for Chrome rendering
- ❌ Can afford 5x resource cost

---

## Resource Comparison (100 Concurrent Recordings)

| Egress Type | Pods Needed | Total CPU | Total RAM | AWS Cost/Month* |
|-------------|-------------|-----------|-----------|-----------------|
| **Track Egress** | 6-13 pods | 12-26 CPU | 12-26GB | ~$30 |
| **Track Composite** | 12-25 pods | 24-50 CPU | 24-50GB | ~$60 |
| **Participant Egress** | 12-25 pods | 24-50 CPU | 24-50GB | ~$60 |
| **Room Composite** | 50-100 pods | 200-600 CPU | 200-400GB | **~$600** |

*Estimated costs based on AWS c5.2xlarge instances (8 vCPU, 16GB RAM, $0.34/hr)

**Key Insight**: Room Composite costs **10x more** than Track Composite for the same workload.

---

## Migration Guide

### Switching from Participant to Track Composite

**Before** (Participant Egress):
```typescript
const egressInfo = await egressClient.startParticipantEgress({
  roomName: 'my-room',
  identity: 'user-123',
  screenShare: true,
  preset: EncodingOptionsPreset.H264_1080P_60,
});
```

**After** (Track Composite):
```typescript
// Frontend: Detect screen share tracks
room.on('trackPublished', (publication, participant) => {
  if (publication.source === Track.Source.ScreenShare) {
    const videoTrackId = publication.videoTrack?.sid;
    const audioTrackId = publication.audioTrack?.sid;

    // Send to backend via WebSocket
    socket.emit('start-replay-buffer', { videoTrackId, audioTrackId });
  }
});

// Backend: Use Track Composite
const egressInfo = await egressClient.startTrackCompositeEgress({
  roomName: 'my-room',
  videoTrackId: receivedVideoTrackId,
  audioTrackId: receivedAudioTrackId,
  preset: EncodingOptionsPreset.H264_1080P_60,
});
```

**Changes Required**:
1. Frontend: Add track detection logic
2. Backend: Change from `startParticipantEgress` to `startTrackCompositeEgress`
3. Backend: Accept `videoTrackId` and `audioTrackId` parameters
4. Infrastructure: Reduce pod resources (2 CPU → from 4 CPU)

---

## Best Practices

### 1. Always Use Track Composite for Single-User Recording

**Why?**
- 80% lower resource usage than Room Composite
- Perfect A/V sync without Chrome overhead
- Reliable and battle-tested

**Example: Replay Buffer**
```typescript
// ✅ CORRECT: Track Composite
const egress = await egressClient.startTrackCompositeEgress({
  roomName,
  videoTrackId: screenShareVideoTrack,
  audioTrackId: screenShareAudioTrack,
  segmentedFileOutputs: [segmentedOutput],
});

// ❌ WRONG: Room Composite (wasteful)
const egress = await egressClient.startRoomCompositeEgress({
  roomName,
  layout: 'speaker',  // Overkill for single participant
  fileOutputs: [fileOutput],
});
```

### 2. Avoid Participant Egress Until Bugs Fixed

**Current Issue**: LiveKit v1.8.x has known bugs with Participant Egress, especially with `screenShare: true` parameter.

**Recommendation**: Use Track Composite instead for explicit control.

### 3. Room Composite Only for Multi-Participant Meetings

**When to Use**:
- Zoom-style meeting recordings
- Webinar recordings with multiple speakers
- Custom branded recordings

**When NOT to Use**:
- Single participant recordings (use Track Composite)
- Screen share only (use Track Composite)
- High-scale deployments (cost prohibitive)

### 4. Frontend Track Detection Pattern

**Best Practice**: Detect tracks on frontend, send SIDs to backend

```typescript
// Frontend: src/hooks/useReplayBuffer.ts
import { useRoom, Track } from '@livekit/components-react';

export function useReplayBuffer() {
  const room = useRoom();

  const startReplayBuffer = async () => {
    // Wait for screen share track to be published
    const screenShareTrack = room.localParticipant.getTrackPublication(
      Track.Source.ScreenShare
    );

    if (!screenShareTrack) {
      throw new Error('No screen share active');
    }

    const videoTrackId = screenShareTrack.videoTrack?.sid;
    const audioTrackId = screenShareTrack.audioTrack?.sid;

    // Send to backend
    await fetch('/api/livekit-replay/start', {
      method: 'POST',
      body: JSON.stringify({
        roomName: room.name,
        videoTrackId,
        audioTrackId,
      }),
    });
  };

  return { startReplayBuffer };
}
```

### 5. Resource Allocation

**Egress Pod Configuration**:
```yaml
# Track Composite (recommended)
resources:
  requests:
    cpu: "2000m"
    memory: "2Gi"
  limits:
    cpu: "4000m"
    memory: "4Gi"

# Room Composite (if needed)
resources:
  requests:
    cpu: "4000m"      # 2x Track Composite
    memory: "4Gi"     # 2x Track Composite
  limits:
    cpu: "8000m"
    memory: "8Gi"
```

---

## FAQ

### Q: Can Track Composite mix multiple audio sources (desktop + microphone)?

**A**: No. Track Composite supports **one video + one audio track**.

**Solutions**:
1. **Client-side mixing** (recommended): Use Web Audio API to mix desktop + mic before publishing to LiveKit
2. **User choice**: Let user select which audio source to record
3. **Room Composite**: Use Room Composite (but accept 5x resource cost)

### Q: Why not use Participant Egress with screenShare: true?

**A**: Known bugs in LiveKit v1.8.x make this unreliable. Track Composite is more explicit and stable.

### Q: Can I switch between egress types at runtime?

**A**: No. You must stop the current egress and start a new one with a different type.

### Q: Which egress type supports HLS live streaming?

**A**: All four types support HLS segmented output with `livePlaylistName` for rolling buffers.

### Q: Does Track Composite support RTMP streaming?

**A**: Yes. Use `streamOutputs` instead of `fileOutputs`:

```typescript
const egress = await egressClient.startTrackCompositeEgress({
  roomName,
  videoTrackId,
  audioTrackId,
  streamOutputs: [{
    protocol: 'rtmp',
    urls: ['rtmp://live.twitch.tv/app/YOUR_STREAM_KEY'],
  }],
});
```

---

## Summary

**For Replay Buffer / Shadowplay**:
- ✅ **Use Track Composite** (SDK-only, low resources, explicit control)
- ❌ Don't use Room Composite (wasteful, Chrome overhead)
- ❌ Don't use Participant Egress (bugs in v1.8.x)
- ❌ Don't use Track Egress (can't sync audio + video)

**Resource Savings**:
- Track Composite: **0.5-1 CPU, 500MB-1GB RAM** per recording
- Room Composite: 2-6 CPU, 2-4GB RAM per recording
- **Savings: 80-90% reduction in infrastructure costs**

**Next Steps**:
- Review `architecture.md` for Track Composite implementation details
- Review `deployment.md` for egress service setup
- Review `implementation-guide.md` for code examples
