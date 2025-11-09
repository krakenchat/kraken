# useParticipantTracks Hook

**Path**: `frontend/src/hooks/useParticipantTracks.ts`
**Type**: Custom React Hook
**Purpose**: Read media state for any participant (local or remote) from LiveKit

---

## Overview

The `useParticipantTracks` hook provides real-time access to any participant's media state by reading directly from LiveKit room participants. It works for both local and remote participants, making it the universal hook for tracking user media in voice channels.

### Key Features

- **Universal Participant State**: Works for local AND remote participants
- **Real-time Updates**: Automatically updates on track publication/mute changes
- **Speaking Detection**: Includes live speaking indicator from LiveKit audio levels
- **Auto-cleanup**: Handles participant disconnect and event listener cleanup
- **Type-safe**: Returns strongly-typed media state with participant reference
- **Replaces Backend API Calls**: No need to fetch media state from backend

---

## API

### Signature

```typescript
function useParticipantTracks(
  participantIdentity: string | undefined
): ParticipantMediaState
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `participantIdentity` | `string \| undefined` | Yes | Participant identity (typically user ID) |

### Return Value

```typescript
interface ParticipantMediaState {
  isCameraEnabled: boolean;       // Camera track published and unmuted
  isMicrophoneEnabled: boolean;   // Microphone track published and unmuted
  isScreenShareEnabled: boolean;  // Screen share track published and unmuted
  isSpeaking: boolean;            // Currently speaking (from audio levels)
  participant: Participant | null; // LiveKit participant reference
}
```

---

## Usage

### Basic Usage - Remote Participant

```typescript
import { useParticipantTracks } from '@/hooks/useParticipantTracks';

function UserVoiceIndicator({ userId }: { userId: string }) {
  const {
    isCameraEnabled,
    isMicrophoneEnabled,
    isScreenShareEnabled,
    isSpeaking
  } = useParticipantTracks(userId);

  return (
    <div>
      <UserAvatar userId={userId} />
      {!isMicrophoneEnabled && <MicOffIcon />}
      {isCameraEnabled && <VideocamIcon />}
      {isScreenShareEnabled && <ScreenShareIcon />}
      {isSpeaking && <SpeakingIndicator />}
    </div>
  );
}
```

### Voice Channel User List

```typescript
import { useVoicePresenceApi } from '@/features/voice-presence/voicePresenceApiSlice';
import { useParticipantTracks } from '@/hooks/useParticipantTracks';

function VoiceChannelUserList({ channelId }: { channelId: string }) {
  // Get list of users in voice channel from backend
  const { data: presence } = useVoicePresenceApi.useGetChannelPresenceQuery(channelId);

  return (
    <div>
      {presence?.users.map(user => (
        <VoiceUser key={user.id} userId={user.id} username={user.username} />
      ))}
    </div>
  );
}

function VoiceUser({ userId, username }: { userId: string; username: string }) {
  // Read live media state from LiveKit
  const {
    isCameraEnabled,
    isMicrophoneEnabled,
    isSpeaking
  } = useParticipantTracks(userId);

  return (
    <div className={isSpeaking ? 'speaking' : ''}>
      <span>{username}</span>
      <StatusIcons>
        {isMicrophoneEnabled ? <MicIcon /> : <MicOffIcon />}
        {isCameraEnabled && <VideocamIcon />}
      </StatusIcons>
    </div>
  );
}
```

### Conditional Video Tile Rendering

```typescript
function ParticipantVideoTile({ userId }: { userId: string }) {
  const {
    isCameraEnabled,
    isScreenShareEnabled,
    participant
  } = useParticipantTracks(userId);

  const hasVideo = isCameraEnabled || isScreenShareEnabled;

  if (!hasVideo || !participant) {
    return <AudioOnlyTile userId={userId} />;
  }

  return (
    <VideoTile
      participant={participant}
      showCamera={isCameraEnabled}
      showScreen={isScreenShareEnabled}
    />
  );
}
```

### Speaking Indicator with Animation

```typescript
function SpeakingBorder({ userId }: { userId: string }) {
  const { isSpeaking } = useParticipantTracks(userId);

  return (
    <div
      className={`user-border ${isSpeaking ? 'speaking-animation' : ''}`}
      style={{
        border: isSpeaking ? '2px solid green' : '2px solid transparent',
        transition: 'border-color 0.2s ease'
      }}
    >
      {/* User content */}
    </div>
  );
}
```

---

## Implementation Details

### Participant Lookup

The hook automatically determines if the participant is local or remote:

```typescript
let participant: Participant | null = null;
if (room.localParticipant.identity === participantIdentity) {
  participant = room.localParticipant;
} else {
  participant = room.remoteParticipants.get(participantIdentity) || null;
}
```

### Event Listeners

Listens to participant-specific events:

```typescript
// Track changes
participant.on('trackPublished', handleTrackPublished);
participant.on('trackUnpublished', handleTrackUnpublished);
participant.on('trackMuted', handleTrackMuted);
participant.on('trackUnmuted', handleTrackUnmuted);

// Speaking detection
participant.on('isSpeakingChanged', handleIsSpeakingChanged);
```

### State Determination

```typescript
const cameraPublication = participant.getTrackPublication(Track.Source.Camera);
const isCameraEnabled = !!cameraPublication && !cameraPublication.isMuted;

const micPublication = participant.getTrackPublication(Track.Source.Microphone);
const isMicrophoneEnabled = !!micPublication && !micPublication.isMuted;

const screenPublication = participant.getTrackPublication(Track.Source.ScreenShare);
const isScreenShareEnabled = !!screenPublication && !screenPublication.isMuted;

const isSpeaking = participant.isSpeaking;
```

### Auto-reset on Disconnect

State resets when:
1. `participantIdentity` becomes `undefined`
2. Room disconnects
3. Participant disconnects from room

```typescript
// Reset state when participant disconnects
const handleParticipantDisconnected = (p: RemoteParticipant) => {
  if (p.identity === participantIdentity) {
    setMediaState({
      isCameraEnabled: false,
      isMicrophoneEnabled: false,
      isScreenShareEnabled: false,
      isSpeaking: false,
      participant: null,
    });
  }
};
```

---

## Why This Hook Exists

### Problem: Backend API Calls for Media State

**Before:**
- Frontend called backend API to get media states
- Backend stored media state in Redis
- Sync issues between LiveKit and backend
- Extra network latency
- Stale data

**After (useParticipantTracks):**
- Frontend reads directly from LiveKit participants
- Real-time updates via LiveKit events
- No backend calls needed for media state
- Always accurate, no sync issues

### Comparison: Old vs New

```typescript
// ❌ OLD: Fetching from backend API (removed)
const { data: presence } = useVoicePresenceApi.useGetChannelPresenceQuery(channelId);
const userState = presence?.users.find(u => u.id === userId)?.voiceState;
const isMuted = userState?.isMuted ?? true;

// ✅ NEW: Reading from LiveKit directly
const { isMicrophoneEnabled } = useParticipantTracks(userId);
```

---

## Comparison with useLocalMediaState

| Feature | `useParticipantTracks(userId)` | `useLocalMediaState()` |
|---------|-------------------------------|------------------------|
| **Target** | Any participant (local or remote) | Local participant only |
| **Input** | Requires `participantIdentity` | No parameters |
| **Speaking** | ✅ Includes `isSpeaking` | ❌ No speaking detection |
| **Participant Ref** | ✅ Returns participant ref | ❌ No participant ref |
| **Track Refs** | ❌ No track refs | ✅ Returns audio/video track refs |
| **Use Case** | User lists, indicators, remote tiles | Local controls, local tile |

**When to Use Which:**
- **Local participant controls**: Use `useLocalMediaState()`
- **Remote participant UI**: Use `useParticipantTracks(userId)`
- **User list with speaking indicators**: Use `useParticipantTracks(userId)` for each user

---

## Dependencies

### Internal Dependencies
- **useRoom()** - Provides LiveKit room instance

### External Dependencies
- **livekit-client**:
  - `RemoteTrackPublication`
  - `LocalTrackPublication`
  - `Track` (source enum)
  - `RoomEvent`
  - `Participant`
  - `RemoteParticipant`
  - `LocalParticipant`

---

## Related Hooks

- **useLocalMediaState()** - Simplified hook for local participant only
- **useVoiceConnection()** - Join/leave voice channels
- **useRoom()** - Access LiveKit room instance
- **useSpeakingDetection()** - Alternative speaking detection hook

---

## Related Components

- **VoiceChannelUserList** - Uses this hook to show user voice indicators
- **VideoTiles** - Uses this hook to determine which tiles to render
- **UserVoiceIndicator** - Uses this hook to show mic/camera status per user

---

## Best Practices

### ✅ Do:
- Use for remote participant media state
- Use for speaking indicators in user lists
- Pass `user.id` as the identity parameter
- Handle `null` participant gracefully (user might not be in room yet)
- Use in lists with memoization to avoid unnecessary re-renders

### ❌ Don't:
- Use for local participant (use `useLocalMediaState` instead)
- Call for every participant without memoization (performance hit)
- Store returned state in Redux (defeats the purpose)
- Assume participant is always non-null

---

## Example: Complete Voice Channel UI

```typescript
import { useVoicePresenceApi } from '@/features/voice-presence/voicePresenceApiSlice';
import { useParticipantTracks } from '@/hooks/useParticipantTracks';

function VoiceChannelSidebar({ channelId }: { channelId: string }) {
  // Get user list from backend (identity only)
  const { data: presence } = useVoicePresenceApi.useGetChannelPresenceQuery(channelId);

  return (
    <div className="voice-sidebar">
      <h3>Voice Channel ({presence?.count || 0})</h3>
      <div className="user-list">
        {presence?.users.map(user => (
          <VoiceParticipant
            key={user.id}
            userId={user.id}
            username={user.username}
            avatarUrl={user.avatarUrl}
            isDeafened={user.isDeafened}
          />
        ))}
      </div>
    </div>
  );
}

interface VoiceParticipantProps {
  userId: string;
  username: string;
  avatarUrl?: string;
  isDeafened: boolean;
}

const VoiceParticipant = React.memo<VoiceParticipantProps>(({
  userId,
  username,
  avatarUrl,
  isDeafened
}) => {
  // Read live media state from LiveKit
  const {
    isCameraEnabled,
    isMicrophoneEnabled,
    isScreenShareEnabled,
    isSpeaking
  } = useParticipantTracks(userId);

  return (
    <div className={`participant ${isSpeaking ? 'speaking' : ''}`}>
      <Avatar src={avatarUrl} alt={username} />
      <span className="username">{username}</span>
      <div className="status-icons">
        {!isMicrophoneEnabled && <MicOffIcon />}
        {isCameraEnabled && <VideocamIcon />}
        {isScreenShareEnabled && <ScreenShareIcon />}
        {isDeafened && <HeadsetOffIcon />}
      </div>
    </div>
  );
});
```

---

## Troubleshooting

### Participant Always Null

**Problem**: `participant` field is always `null`.

**Solution**:
1. Verify participant has joined the LiveKit room (not just backend presence)
2. Check that `participantIdentity` matches LiveKit participant identity
3. Ensure LiveKit room is connected (`useRoom().room` is not null)

### Speaking Indicator Not Working

**Problem**: `isSpeaking` always shows `false`.

**Solution**:
1. Verify microphone is enabled and publishing audio
2. Check that LiveKit audio level detection is enabled on the room
3. Test with known speaking participant

### Stale Media State

**Problem**: Media state doesn't update when user toggles camera/mic.

**Solution**:
1. Verify participant is toggling via LiveKit SDK, not backend API
2. Check that event listeners are attached properly
3. Confirm room is still connected

---

## Performance Considerations

### Memoization in Lists

When using in lists, memoize components to prevent unnecessary re-renders:

```typescript
const VoiceParticipant = React.memo<VoiceParticipantProps>(({ userId, username }) => {
  const { isMicrophoneEnabled, isSpeaking } = useParticipantTracks(userId);
  // ...
});
```

### Conditional Hook Calls

Avoid calling the hook for participants not yet in the room:

```typescript
// ✅ Good: Check if user is in room first
const { isConnected } = useVoiceConnection();
const mediaState = isConnected ? useParticipantTracks(userId) : null;

// ❌ Bad: Calling for all users even if not in room
const mediaState = useParticipantTracks(userId); // Might cause extra lookups
```

---

## Testing

```typescript
import { renderHook } from '@testing-library/react-hooks';
import { useParticipantTracks } from './useParticipantTracks';
import { useRoom } from './useRoom';

jest.mock('./useRoom');

describe('useParticipantTracks', () => {
  it('should return inactive state when participant not in room', () => {
    const mockRoom = {
      localParticipant: { identity: 'local-user' },
      remoteParticipants: new Map(),
      on: jest.fn(),
      off: jest.fn()
    };

    (useRoom as jest.Mock).mockReturnValue({ room: mockRoom });

    const { result } = renderHook(() => useParticipantTracks('non-existent-user'));

    expect(result.current.isCameraEnabled).toBe(false);
    expect(result.current.participant).toBeNull();
  });

  it('should read microphone state from remote participant', () => {
    const mockParticipant = {
      identity: 'remote-user',
      isSpeaking: false,
      getTrackPublication: jest.fn((source) => {
        if (source === Track.Source.Microphone) {
          return { isMuted: false };
        }
        return null;
      }),
      on: jest.fn(),
      off: jest.fn()
    };

    const mockRoom = {
      localParticipant: { identity: 'local-user' },
      remoteParticipants: new Map([['remote-user', mockParticipant]]),
      on: jest.fn(),
      off: jest.fn()
    };

    (useRoom as jest.Mock).mockReturnValue({ room: mockRoom });

    const { result } = renderHook(() => useParticipantTracks('remote-user'));

    expect(result.current.isMicrophoneEnabled).toBe(true);
    expect(result.current.participant).toBe(mockParticipant);
  });
});
```

---

## Related Documentation

- [Voice-Presence API](../api/voice-presence.md) - Backend presence system (identity only)
- [useLocalMediaState Hook](./useLocalMediaState.md) - Local participant media state
- [useVoiceConnection Hook](./useVoiceConnection.md) - Voice channel management
- [LiveKit Module](../modules/voice/livekit.md) - LiveKit integration

---

**Last Updated**: 2025 (LiveKit cleanup refactor)
**Status**: ✅ Production-ready
**Breaking Changes**: Replaces backend API calls for participant media state
