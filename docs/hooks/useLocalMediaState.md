# useLocalMediaState Hook

**Path**: `frontend/src/hooks/useLocalMediaState.ts`
**Type**: Custom React Hook
**Purpose**: Read local participant's media state directly from LiveKit (camera, microphone, screen share)

---

## Overview

The `useLocalMediaState` hook provides real-time access to the local participant's media state by reading directly from LiveKit room participants. It replaces Redux state management for media controls, making LiveKit the single source of truth.

### Key Features

- **Direct LiveKit Integration**: Reads state from `room.localParticipant` track publications
- **Real-time Updates**: Listens to LiveKit events for immediate state changes
- **Auto-cleanup**: Properly manages event listeners and resets state on disconnect
- **Type-safe**: Returns strongly-typed media state and track references
- **Replaces Redux**: Eliminates state synchronization issues between LiveKit and Redux

---

## API

### Signature

```typescript
function useLocalMediaState(): {
  isCameraEnabled: boolean;
  isMicrophoneEnabled: boolean;
  isScreenShareEnabled: boolean;
  audioTrack: LocalAudioTrack | undefined;
  videoTrack: LocalVideoTrack | undefined;
}
```

### Parameters

None - automatically reads from current LiveKit room via `useRoom()` hook.

### Return Value

```typescript
{
  isCameraEnabled: boolean;           // Camera track is published and unmuted
  isMicrophoneEnabled: boolean;       // Microphone track is published and unmuted
  isScreenShareEnabled: boolean;      // Screen share track is published and unmuted
  audioTrack: LocalAudioTrack | undefined;   // Local audio track reference
  videoTrack: LocalVideoTrack | undefined;   // Local video track reference
}
```

---

## Usage

### Basic Usage

```typescript
import { useLocalMediaState } from '@/hooks/useLocalMediaState';

function VoiceControls() {
  const {
    isCameraEnabled,
    isMicrophoneEnabled,
    isScreenShareEnabled,
    audioTrack,
    videoTrack
  } = useLocalMediaState();

  return (
    <div>
      <button disabled={!isMicrophoneEnabled}>
        {isMicrophoneEnabled ? 'Mute' : 'Unmute'}
      </button>
      <button disabled={!isCameraEnabled}>
        {isCameraEnabled ? 'Stop Video' : 'Start Video'}
      </button>
      <button disabled={!isScreenShareEnabled}>
        {isScreenShareEnabled ? 'Stop Sharing' : 'Share Screen'}
      </button>
    </div>
  );
}
```

### Conditional UI Rendering

```typescript
function VideoTileOverlay() {
  const { isCameraEnabled, isScreenShareEnabled } = useLocalMediaState();

  if (!isCameraEnabled && !isScreenShareEnabled) {
    return <p>Enable camera or screen share to see video</p>;
  }

  return <VideoTiles />;
}
```

### Audio Level Monitoring

```typescript
function MicrophoneIndicator() {
  const { isMicrophoneEnabled, audioTrack } = useLocalMediaState();

  return (
    <div>
      {isMicrophoneEnabled ? (
        <AudioLevelIndicator track={audioTrack} />
      ) : (
        <MutedIcon />
      )}
    </div>
  );
}
```

---

## Implementation Details

### LiveKit Event Listeners

The hook listens to multiple LiveKit events for comprehensive state tracking:

```typescript
// Track publication/unpublication
room.on(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
room.on(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);

// Track mute/unmute
room.on(RoomEvent.TrackMuted, handleTrackMuted);
room.on(RoomEvent.TrackUnmuted, handleTrackUnmuted);
```

### State Determination Logic

A track is considered "enabled" when:
1. **Track publication exists** for the given source (Camera, Microphone, or ScreenShare)
2. **Track is NOT muted** (`!publication.isMuted`)

```typescript
const cameraPublication = localParticipant.getTrackPublication(Track.Source.Camera);
const isCameraEnabled = !!cameraPublication && !cameraPublication.isMuted;
```

### Auto-reset on Disconnect

When the room disconnects, all state resets to `false`:

```typescript
useEffect(() => {
  if (!room) {
    setIsCameraEnabled(false);
    setIsMicrophoneEnabled(false);
    setIsScreenShareEnabled(false);
    return;
  }
  // ... event listeners
}, [room]);
```

---

## Why This Hook Exists

### Problem: State Duplication

**Before (Redux-based):**
- Media state stored in both Redux and LiveKit
- Sync bugs: UI showed screen share as inactive when actually active
- Extra API calls needed to update backend state
- Race conditions between Redux updates and LiveKit events

**After (useLocalMediaState):**
- LiveKit is the single source of truth
- No state synchronization needed
- UI always reflects actual media state
- Simpler codebase, fewer bugs

### Migration from Redux

```typescript
// ❌ OLD: Reading from Redux (outdated, removed)
const isVideoEnabled = useSelector((state) => state.voice.isVideoEnabled);
const isMuted = useSelector((state) => state.voice.isMuted);

// ✅ NEW: Reading from LiveKit directly
const { isCameraEnabled, isMicrophoneEnabled } = useLocalMediaState();
```

---

## Dependencies

### Internal Dependencies
- **useRoom()** - Provides LiveKit room instance

### External Dependencies
- **livekit-client**:
  - `LocalAudioTrack`
  - `LocalVideoTrack`
  - `LocalTrackPublication`
  - `Track` (source enum)
  - `RoomEvent` (event enum)

---

## Related Hooks

- **useParticipantTracks(userId)** - Read media state for remote participants
- **useVoiceConnection()** - Join/leave voice channels, toggle media controls
- **useRoom()** - Access LiveKit room instance
- **useDeafenEffect()** - Handle deafen functionality

---

## Related Components

- **VoiceBottomBar** - Uses this hook to show mic/camera status
- **VideoTiles** - Uses this hook to determine if local tiles should render
- **VoiceControls** - Uses this hook to enable/disable control buttons

---

## Best Practices

### ✅ Do:
- Use this hook for local participant media state
- Combine with `useVoiceConnection()` for control actions
- Use `audioTrack` and `videoTrack` for advanced track manipulation
- Read state reactively - hook automatically updates on changes

### ❌ Don't:
- Store media state in Redux (deprecated pattern)
- Call LiveKit track methods directly without this hook
- Use for remote participant state (use `useParticipantTracks` instead)
- Assume state persists across room disconnection

---

## Example: Complete Voice Controls

```typescript
import { useLocalMediaState } from '@/hooks/useLocalMediaState';
import { useVoiceConnection } from '@/hooks/useVoiceConnection';

function CompleteVoiceControls() {
  const {
    isCameraEnabled,
    isMicrophoneEnabled,
    isScreenShareEnabled
  } = useLocalMediaState();

  const {
    toggleCamera,
    toggleMicrophone,
    toggleScreenShare
  } = useVoiceConnection();

  return (
    <div className="voice-controls">
      <button onClick={toggleMicrophone}>
        {isMicrophoneEnabled ? (
          <MicIcon color="green" />
        ) : (
          <MicOffIcon color="red" />
        )}
      </button>

      <button onClick={toggleCamera}>
        {isCameraEnabled ? (
          <VideocamIcon color="green" />
        ) : (
          <VideocamOffIcon color="red" />
        )}
      </button>

      <button onClick={toggleScreenShare}>
        {isScreenShareEnabled ? (
          <StopScreenShareIcon color="green" />
        ) : (
          <ScreenShareIcon />
        )}
      </button>
    </div>
  );
}
```

---

## Troubleshooting

### State Not Updating

**Problem**: Media state doesn't update when toggling camera/mic.

**Solution**: Ensure you're toggling via LiveKit SDK, not Redux actions:

```typescript
// ✅ Correct: Toggle via LiveKit
const { toggleCamera } = useVoiceConnection();
await toggleCamera();

// ❌ Wrong: Dispatching Redux action (deprecated)
dispatch(setVideoEnabled(true));  // Don't do this
```

### Stale State After Reconnect

**Problem**: State shows old values after reconnecting to room.

**Solution**: The hook automatically resets on disconnect. Verify `room` prop from `useRoom()` is updating correctly.

---

## Testing

```typescript
import { renderHook } from '@testing-library/react-hooks';
import { useLocalMediaState } from './useLocalMediaState';
import { useRoom } from './useRoom';

jest.mock('./useRoom');

describe('useLocalMediaState', () => {
  it('should return false values when no room connected', () => {
    (useRoom as jest.Mock).mockReturnValue({ room: null });

    const { result } = renderHook(() => useLocalMediaState());

    expect(result.current.isCameraEnabled).toBe(false);
    expect(result.current.isMicrophoneEnabled).toBe(false);
    expect(result.current.isScreenShareEnabled).toBe(false);
  });

  it('should read camera state from LiveKit participant', () => {
    const mockRoom = {
      localParticipant: {
        getTrackPublication: jest.fn((source) => {
          if (source === Track.Source.Camera) {
            return { isMuted: false };
          }
          return null;
        })
      },
      on: jest.fn(),
      off: jest.fn()
    };

    (useRoom as jest.Mock).mockReturnValue({ room: mockRoom });

    const { result } = renderHook(() => useLocalMediaState());

    expect(result.current.isCameraEnabled).toBe(true);
  });
});
```

---

## Related Documentation

- [Voice-Presence API](../api/voice-presence.md) - Backend voice presence system
- [useParticipantTracks Hook](./useParticipantTracks.md) - Remote participant media state
- [useVoiceConnection Hook](./useVoiceConnection.md) - Voice channel connection management
- [LiveKit Module](../modules/voice/livekit.md) - LiveKit integration

---

**Last Updated**: 2025 (LiveKit cleanup refactor)
**Status**: ✅ Production-ready
**Breaking Changes**: Replaces Redux-based media state management
