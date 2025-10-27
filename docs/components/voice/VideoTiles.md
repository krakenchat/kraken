# VideoTiles Component

**Path**: `frontend/src/components/Voice/VideoTiles.tsx`
**Type**: React Functional Component
**Purpose**: Renders video tiles for participants in voice channels, handling camera feeds, screen shares, and audio tracks with LiveKit integration

---

## Overview

The `VideoTiles` component is responsible for rendering video participants in voice channels. It manages both camera feeds and screen shares, provides controls for each tile, and automatically updates when tracks are published or unpublished using LiveKit event listeners.

### Key Features

- **Dual Tile Support**: Renders separate tiles for camera and screen share per participant
- **Local & Remote Participants**: Differentiates between local user and remote participants
- **Audio Level Visualization**: Displays speaking indicators based on audio levels
- **LiveKit Event Integration**: Auto-renders on track publication/unpublication
- **Responsive Layout**: Grid layout that adapts to number of participants
- **Pin Functionality**: Allows pinning specific tiles for focused viewing
- **Mute State Handling**: Shows mute indicators but doesn't block screen shares

---

## Props

```typescript
interface VideoTilesProps {
  // No external props - uses Redux state
}
```

The component internally uses:
- Redux voice state via `useSelector(selectVoiceState)`
- Room instance from parent component state

---

## Component Structure

### Internal State

```typescript
const [pinnedTile, setPinnedTile] = useState<string | null>(null);
const [, setTrackUpdate] = useState(0); // Force re-render trigger
```

### Tile Data Structure

```typescript
interface VideoTile {
  participant: Participant;
  videoTrack?: RemoteVideoTrack | LocalVideoTrack;
  screenTrack?: RemoteVideoTrack | LocalVideoTrack;
  audioTrack?: RemoteAudioTrack | LocalAudioTrack;
  isLocal: boolean;
  tileType: 'camera' | 'screen';
  tileId: string; // Unique identifier for tile
}
```

---

## Key Functionality

### 1. Track Collection Logic

The component collects video, screen, and audio tracks for each participant:

```typescript
// Local participant tracks
const localVideoTrack = Array.from(localParticipant.videoTracks.values())
  .find((pub) => pub.source === Track.Source.Camera)?.track as LocalVideoTrack | undefined;

const localScreenTrack = Array.from(localParticipant.videoTracks.values())
  .find((pub) => pub.source === Track.Source.ScreenShare)?.track as LocalVideoTrack | undefined;

const localAudioTrack = Array.from(localParticipant.audioTracks.values())
  .find((pub) => pub.source === Track.Source.Microphone)?.track as LocalAudioTrack | undefined;

// Remote participant tracks (similar logic for each participant)
```

**Important**: The component does NOT check `isMuted` on screen share tracks - this was causing screen shares to not display even when active.

### 2. Tile Creation Strategy

Tiles are created based on available tracks:

1. **Both camera and screen share active**: Create two separate tiles
   ```typescript
   if (videoTrack && !videoTrack.isMuted && screenTrack) {
     tiles.push(
       { /* camera tile */ },
       { /* screen share tile */ }
     );
   }
   ```

2. **Only screen share active**: Single screen share tile
   ```typescript
   else if (screenTrack) {
     tiles.push({ /* screen share tile */ });
   }
   ```

3. **Only camera active**: Single camera tile
   ```typescript
   else if (videoTrack && !videoTrack.isMuted) {
     tiles.push({ /* camera tile */ });
   }
   ```

4. **No video (voice only)**: Create audio-only tile with avatar
   ```typescript
   else {
     tiles.push({ /* audio-only tile */ });
   }
   ```

### 3. LiveKit Event Handling

**Critical Feature**: Auto-rendering on track changes

```typescript
useEffect(() => {
  if (!state.room) return;

  const handleTrackPublished = () => {
    setTrackUpdate((prev) => prev + 1); // Force re-render
  };

  const handleTrackUnpublished = () => {
    setTrackUpdate((prev) => prev + 1);
  };

  // Listen to local participant events
  state.room.localParticipant.on('trackPublished', handleTrackPublished);
  state.room.localParticipant.on('trackUnpublished', handleTrackUnpublished);

  // Listen to remote participant events
  state.room.on('trackPublished', handleTrackPublished);
  state.room.on('trackUnpublished', handleTrackUnpublished);

  return () => {
    // Cleanup listeners
    state.room?.localParticipant.off('trackPublished', handleTrackPublished);
    state.room?.localParticipant.off('trackUnpublished', handleTrackUnpublished);
    state.room?.off('trackPublished', handleTrackPublished);
    state.room?.off('trackUnpublished', handleTrackUnpublished);
  };
}, [state.room]);
```

**Why This Matters**: Without event listeners, users had to navigate away and back to see their screen share tile appear. The event listeners ensure immediate UI updates when tracks are published.

### 4. Audio Level Visualization

Each tile shows a speaking indicator based on audio levels:

```typescript
<AudioLevelIndicator
  audioTrack={tile.audioTrack}
  isLocal={tile.isLocal}
  isMuted={isMuted}
/>
```

The indicator uses LiveKit's audio level events to show when participants are speaking.

### 5. Pin Functionality

Users can pin tiles for focused viewing:

```typescript
const handlePin = (tileId: string) => {
  setPinnedTile(pinnedTile === tileId ? null : tileId);
};
```

Pinned tiles are displayed larger and more prominently in the layout.

---

## UI Components

### VideoTileDisplay

Renders the actual video track:

```typescript
<VideoTileDisplay
  track={tile.videoTrack || tile.screenTrack}
  isLocal={tile.isLocal}
  isScreenShare={tile.tileType === 'screen'}
  participantName={participantName}
  isMuted={isMuted}
  isPinned={isPinned}
  onPin={() => handlePin(tile.tileId)}
/>
```

### Audio-Only Tile

For participants without video:

```typescript
<Box>
  <Avatar>{participantName.charAt(0).toUpperCase()}</Avatar>
  <Typography>{participantName}</Typography>
  <AudioLevelIndicator />
</Box>
```

---

## Layout Strategy

### Grid Layout

Tiles are arranged in a responsive grid:

```typescript
<Box
  sx={{
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fit, minmax(${tileSize}px, 1fr))`,
    gap: 2,
    p: 2,
  }}
>
  {tiles.map((tile) => renderTile(tile))}
</Box>
```

### Dynamic Tile Sizing

Tile size adjusts based on participant count:
- 1-2 participants: Large tiles (400px+)
- 3-4 participants: Medium tiles (300px)
- 5+ participants: Small tiles (200px)

---

## Recent Fixes

### Screen Share Display Issue (Fixed)

**Problem**: Screen share tiles weren't appearing even when active.

**Root Cause**: Code was checking `!screenTrack.isMuted` which prevented tiles from rendering.

**Solution**: Removed `isMuted` checks on screen share tracks:

```typescript
// OLD (broken):
if (screenTrack && !screenTrack.isMuted) { ... }

// NEW (fixed):
if (screenTrack) { ... }
```

### Auto-Render on Track Publication (Fixed)

**Problem**: Users had to navigate away and back to see screen share tiles.

**Root Cause**: Component wasn't listening to LiveKit track events.

**Solution**: Added useEffect with LiveKit event listeners to trigger re-renders on track changes.

---

## Redux State Dependencies

```typescript
const state = useSelector(selectVoiceState);

// Uses:
// - state.room: LiveKit Room instance
// - state.isMuted: Local mute state
// - state.isDeafened: Local deafen state
// - state.isVideoEnabled: Local video state
// - state.isScreenSharing: Local screen share state
```

---

## Integration Points

### LiveKit Room

Requires active LiveKit room connection:
- Provided via Redux `voiceSlice`
- Room must be connected before rendering tiles
- Manages all WebRTC connections

### Voice Controls

Coordinates with `VoiceControls` component:
- Mute/unmute affects audio tile indicators
- Video on/off affects video tile visibility
- Screen share creates separate tile

### Voice Channel Bar

Works with `VoiceChannelBar` for persistent voice UI:
- Bottom bar shows when in voice
- Video tiles overlay shows when video enabled
- Separate but coordinated components

---

## Performance Considerations

### Virtualization

Not currently implemented - all tiles rendered at once.

**Future Improvement**: For large rooms (15+ participants), consider virtualizing tiles.

### Track Event Throttling

LiveKit events trigger immediate re-renders.

**Future Improvement**: Consider debouncing track events if performance issues arise.

### Memory Management

All event listeners properly cleaned up in useEffect return.

---

## Usage Example

```tsx
import { VideoTiles } from './components/Voice/VideoTiles';

function VoiceChannelView() {
  return (
    <>
      {isInVoiceChannel && <VoiceChannelBar />}
      {isInVoiceChannel && isVideoEnabled && <VideoTiles />}
    </>
  );
}
```

---

## Dependencies

- **@livekit/components-react**: `VideoRenderer`, `useParticipants`
- **livekit-client**: `Track`, `Participant`, various track types
- **@mui/material**: UI components
- **react-redux**: State management
- **Redux voice slice**: Voice state

---

## Related Components

- **VoiceChannelBar** (`frontend/src/components/Voice/VoiceChannelBar.tsx`) - Persistent bottom bar
- **VoiceControls** (`frontend/src/components/Voice/VoiceControls.tsx`) - Mute/video/screen share controls
- **VoiceChannelUserList** (`frontend/src/components/Voice/VoiceChannelUserList.tsx`) - Participant list
- **AudioLevelIndicator** - Speaking visualization

---

## Related Documentation

- [Voice & Video Architecture](../../features/voice-and-video.md)
- [LiveKit Integration](../../modules/voice/livekit.md)
- [Voice State Management](../../state/voiceSlice.md)
- [Voice Thunks](../../state/voiceThunks.md)

---

## File Location

```
frontend/src/components/Voice/VideoTiles.tsx
```

**Last Updated**: Based on screen sharing fixes and LiveKit event listener implementation
**Maintainer**: Frontend team
**Status**: ✅ Production-ready with recent bug fixes
