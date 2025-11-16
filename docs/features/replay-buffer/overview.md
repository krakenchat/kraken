# Replay Buffer Feature - Overview

## What is the Replay Buffer?

The Replay Buffer is a **continuous recording feature** that allows users to retroactively capture and save highlights from their screen share sessions. Similar to NVIDIA ShadowPlay or Discord Nitro's clipping feature, it solves the problem: *"Something awesome just happened - I wish I had been recording!"*

## How It Works

When a user enables the replay buffer while screen sharing:

1. **Continuous Recording**: Kraken continuously records the last 10 minutes of their screen share in the background
2. **Rolling Buffer**: Old footage is automatically deleted to maintain a fixed storage footprint
3. **On-Demand Capture**: When something interesting happens, the user clicks "Capture Replay" to save the last 1-10 minutes
4. **Instant Sharing**: The captured clip can be sent to themselves via DM or posted directly to a channel

**Key Advantage**: No need to pre-plan recording. Capture moments *after* they happen.

## Use Cases

### Gaming
- **Highlight Reels**: Capture clutch plays, funny moments, or epic wins
- **Speedrun Verification**: Save successful speedrun attempts
- **Bug Reports**: Capture gameplay bugs with full context

### Meetings & Collaboration
- **Important Decisions**: Save key discussion points or decisions made
- **Knowledge Sharing**: Capture problem-solving sessions or tutorials
- **Review & Analysis**: Save segments for later review or training

### Content Creation
- **Stream Highlights**: Capture best moments from live streams
- **Tutorial Clips**: Save successful demonstrations or explanations
- **Behind-the-Scenes**: Capture organic creative moments

### Technical Support
- **Issue Reproduction**: Show bugs or issues with full context
- **Walkthroughs**: Demonstrate steps taken to solve a problem
- **Documentation**: Create visual guides from live sessions

## Feature Comparison

### Kraken Replay Buffer vs Alternatives

| Feature | Kraken Replay Buffer | Discord Nitro | NVIDIA ShadowPlay | OBS Replay Buffer |
|---------|---------------------|---------------|-------------------|-------------------|
| **Platform** | Self-hosted, browser-based | Cloud, proprietary | Desktop, NVIDIA GPUs only | Desktop, any GPU |
| **Cost** | Free (self-hosted) | $10/month | Free with GeForce | Free |
| **Buffer Duration** | Up to 10 minutes | Up to 10 minutes | Up to 20 minutes | Configurable |
| **Quality** | Up to 1440p 60fps | Up to 1080p 60fps | Up to 4K 60fps | Configurable |
| **Storage** | Your infrastructure | Discord servers | Local disk | Local disk |
| **Sharing** | DM or channel post | Channel post | Export file | Export file |
| **Privacy** | Full control | Discord terms | Local only | Local only |

## User-Facing Capabilities

### What Users Can Do

✅ **Enable/Disable Replay Buffer**: Toggle on/off while screen sharing
✅ **Visual Indicator**: See who has replay buffer active (recording badge)
✅ **Flexible Capture**: Choose how much to save (1, 2, 5, or 10 minutes)
✅ **Instant Sharing**: Send to DM or post to channel immediately
✅ **Personal Library**: View and manage all saved replays
✅ **Storage Quota**: 5GB default quota per user (admin configurable)
✅ **Download**: Download captured replays as MP4 files

### What Users Should Know

⚠️ **Storage Limitations**: Subject to per-user storage quota (default 5GB)
⚠️ **Community Limits**: Communities may limit concurrent replay buffers (default 5)
⚠️ **Permission Required**: Requires `ENABLE_REPLAY_BUFFER` permission
⚠️ **Screen Share Only**: Only works when actively screen sharing
⚠️ **Automatic Cleanup**: Buffer content is automatically deleted when stopped
⚠️ **File Sizes**: 1080p 60fps replays are ~450MB per 10 minutes

## Limitations

### Technical Limitations

1. **Segment Boundaries**: Captures always include complete 10-second segments
   - Requesting "last 1 minute" may give 1:00-1:10 (up to 10 seconds extra)

2. **Screen Share Only**: Cannot record camera-only or audio-only streams
   - Future enhancement: Support recording any participant track

3. **No Retroactive Enablement**: Buffer must be enabled *before* the moment you want to capture
   - Cannot enable after-the-fact and capture previous content

4. **Storage Dependent**: Relies on available disk space
   - Self-hosters must provision adequate storage

5. **Processing Time**: FFmpeg concatenation takes 1-2 seconds per 10-minute clip
   - Not instant, but fast enough for good UX

### Access Control Limitations

1. **Permission-Based**: Requires explicit RBAC permission
   - Not available to all users by default

2. **Community Limits**: Max concurrent buffers per community (configurable)
   - Default: 5 simultaneous replay buffers

3. **Storage Quotas**: Per-user storage quotas enforced
   - Default: 5GB per user for saved replays

## Privacy & Security Considerations

### What Gets Recorded

✅ **Screen Share Video**: Only the screen being shared
✅ **Screen Share Audio**: Audio from the screen share source
❌ **Voice Chat**: NOT recorded (by design)
❌ **Other Participants**: NOT recorded (only the screen sharer)
❌ **Webcam**: NOT recorded (screen share only)

### Data Handling

- **Storage**: All replay data stored on your infrastructure (local disk or NFS mount)
- **Ownership**: User owns their replay clips
- **Deletion**: Users can delete their clips at any time
- **Sharing**: Clips only shared when user explicitly chooses
- **Retention**: Temporary buffer segments deleted automatically (12-minute rolling window)
- **Permanent Clips**: Saved clips persist until user deletes or quota cleanup

### GDPR & Compliance

For self-hosted deployments:

- **Data Location**: Data never leaves your infrastructure
- **User Control**: Users control capture and deletion
- **Transparency**: Clear indicators when buffer is active
- **Consent**: Requires explicit user action to enable
- **Right to Delete**: Users can delete clips anytime

## Performance Impact

### Client-Side (Browser)
- **Minimal**: No client-side recording
- **Screen Capture**: Standard WebRTC screen sharing (no additional overhead)
- **Network**: Same bandwidth as normal screen share

### Server-Side (Self-Hosted)
- **Disk I/O**: 0.75 MB/s write per active buffer (1080p 60fps)
- **Storage**: ~540MB per active buffer (12-minute retention)
- **CPU**: Minimal during recording, brief spike during FFmpeg concatenation
- **Network**: No additional network overhead (local processing)

### Recommended Specs

**For 5 Concurrent Buffers:**
- **Storage**: 3GB temp + quota allocation for saved clips
- **Disk**: HDD (7200 RPM) or better
- **Network**: Standard (if using NFS)

**For 20+ Concurrent Buffers:**
- **Storage**: 11GB temp + quota allocation
- **Disk**: SSD recommended
- **Network**: Fast (if using NFS)

## Future Enhancements

### Planned Features

🔮 **Multi-Track Recording**: Record camera + screen share simultaneously
🔮 **Voice Overlay**: Option to include voice chat in replay
🔮 **Clip Editing**: Trim clips after capture
🔮 **Highlight Detection**: AI-powered automatic highlight detection
🔮 **Thumbnail Generation**: Auto-generate preview thumbnails
🔮 **Quality Profiles**: User-selectable quality/storage tradeoffs
🔮 **Cloud Storage**: Optional S3/GCS integration for saved clips
🔮 **Clip Collections**: Organize clips into playlists/collections

### Community Requests

If you'd like to see additional features, please open an issue on the Kraken GitHub repository.

## Getting Started

### For Users

1. **Enable Replay Buffer**: Click the replay buffer toggle when screen sharing
2. **Look for Indicator**: Red recording badge appears on your avatar
3. **Do Your Thing**: Continue your activity (gaming, presentation, etc.)
4. **Capture Highlights**: Click "Capture Replay" when something interesting happens
5. **Share or Save**: Choose to post to channel or send to yourself

### For Administrators

1. **Review Deployment Guide**: See `deployment.md` for setup instructions
2. **Configure Storage**: Mount storage volume for replay buffer
3. **Set Quotas**: Configure per-user storage quotas
4. **Set Community Limits**: Configure max concurrent buffers per community
5. **Assign Permissions**: Grant `ENABLE_REPLAY_BUFFER` to desired roles

### For Developers

1. **Read Implementation Guide**: See `implementation-guide.md`
2. **Review Architecture**: See `architecture.md`
3. **API Reference**: See `api-reference.md`
4. **Testing Guide**: See `testing-guide.md`

## Support & Troubleshooting

See `troubleshooting.md` for common issues and solutions.

For bugs or feature requests, open an issue on GitHub.

---

**Next Steps:**
- Read `architecture.md` for technical details
- Read `deployment.md` for self-hosting setup
- Read `implementation-guide.md` for development
