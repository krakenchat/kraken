# useDeafenEffect Hook

**Path**: `frontend/src/hooks/useDeafenEffect.ts`
**Type**: Custom React Hook (Side Effect)
**Purpose**: Implement proper deafen functionality by muting received audio tracks from LiveKit participants

---

## Overview

The `useDeafenEffect` hook implements Discord-style deafen functionality by controlling the volume of remote audio tracks in a LiveKit room. When deafened, the user cannot hear anyone but others can still hear them (unless also muted). This hook should be used once at the app level or in a persistent voice component.

### Key Features

- **Volume-Based Deafening**: Sets remote audio track volume to 0 (not unpublished)
- **Auto-applies to New Participants**: Automatically mutes newly joining participants when deafened
- **Redux Integration**: Reads `isDeafened` state from Redux voice slice
- **LiveKit Event Handling**: Listens for new participants and track subscriptions
- **Instant Restore**: Instantly restores audio when undeafened

---

## API

### Signature

```typescript
function useDeafenEffect(): void
```

### Parameters

None - automatically reads deafen state from Redux and room from `useRoom()`.

### Return Value

`void` - This is a side-effect-only hook.

---

## Usage

### Basic Usage (App-Level)

```typescript
import { useDeafenEffect } from '@/hooks/useDeafenEffect';

function App() {
  // Apply deafen effect globally
  useDeafenEffect();

  return (
    <Router>
      <Layout />
    </Router>
  );
}
```

### In Persistent Voice Component

```typescript
import { useDeafenEffect } from '@/hooks/useDeafenEffect';
import { useVoiceConnection } from '@/hooks/useVoiceConnection';

function VoiceBottomBar() {
  const { state } = useVoiceConnection();

  // Apply deafen effect when in voice
  useDeafenEffect();

  if (!state.isConnected) {
    return null;
  }

  return (
    <div className="voice-bottom-bar">
      {/* Voice controls */}
    </div>
  );
}
```

### With Deafen Toggle

```typescript
import { useDeafenEffect } from '@/hooks/useDeafenEffect';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { toggleDeafen } from '@/features/voice/voiceSlice';

function VoiceControls() {
  const dispatch = useAppDispatch();
  const isDeafened = useAppSelector(state => state.voice.isDeafened);

  // Apply the deafen effect based on Redux state
  useDeafenEffect();

  const handleToggleDeafen = () => {
    dispatch(toggleDeafen());
  };

  return (
    <button onClick={handleToggleDeafen}>
      {isDeafened ? <HeadsetOffIcon /> : <HeadsetIcon />}
    </button>
  );
}
```

---

## Implementation Details

### How Deafening Works

**Discord-Style Deafening:**
1. **Deafened**: Sets volume to `0` for all remote audio tracks
2. **Undeafened**: Restores volume to `1.0` for all remote audio tracks
3. **Does NOT unpublish tracks**: Other participants still see you as connected

```typescript
// When deafened
publication.track.setVolume(0);  // Mute received audio

// When undeafened
publication.track.setVolume(1.0);  // Restore received audio
```

### Auto-applies to New Participants

When a new participant joins while you're deafened, their audio is automatically muted:

```typescript
const handleParticipantConnected = () => {
  if (isDeafened) {
    // Mute new participant's audio immediately
    setTimeout(() => updateRemoteAudioVolume(0), 100);
  }
};

room.on('participantConnected', handleParticipantConnected);
```

### Handles New Track Subscriptions

When you subscribe to a new audio track while deafened, it's automatically muted:

```typescript
const handleTrackSubscribed = () => {
  if (isDeafened) {
    // Mute newly subscribed tracks
    setTimeout(() => updateRemoteAudioVolume(0), 100);
  }
};

room.on('trackSubscribed', handleTrackSubscribed);
```

### Volume Update Logic

```typescript
const updateRemoteAudioVolume = (volume: number) => {
  room.remoteParticipants.forEach((participant) => {
    participant.audioTrackPublications.forEach((publication) => {
      if (publication.track && publication.source === Track.Source.Microphone) {
        publication.track.setVolume(volume);
      }
    });
  });
};
```

---

## Why This Hook Exists

### Problem: Deafen State Not Working

**Before:**
- Deafen state was stored in Redux but not applied to LiveKit
- Users would toggle deafen but still hear others
- No consistent implementation across the app

**After (useDeafenEffect):**
- Centralized deafen logic in one hook
- Automatically applies to all remote participants
- Works consistently across entire app

### Comparison: Deafen vs Mute

| State | Deafen | Mute |
|-------|--------|------|
| **What it does** | Mutes *incoming* audio (you can't hear others) | Mutes *outgoing* audio (others can't hear you) |
| **Implementation** | Sets remote track volume to 0 | Mutes local microphone track |
| **LiveKit API** | `remoteTrack.setVolume(0)` | `localTrack.mute()` |
| **Managed by** | `useDeafenEffect` hook | `useVoiceConnection.toggleMicrophone()` |
| **Discord behavior** | Deafening also mutes you | Muting only affects your mic |

**Discord Rule**: When you deafen, you should also be muted. This is typically handled by the UI layer dispatching both actions.

---

## Dependencies

### Internal Dependencies
- **useRoom()** - Provides LiveKit room instance
- **useSelector()** - Reads `isDeafened` from Redux voice slice

### External Dependencies
- **livekit-client**: `Track` (source enum)
- **react-redux**: `useSelector`
- **Redux voice slice**: `state.voice.isDeafened`

---

## Related Hooks

- **useVoiceConnection()** - Toggle deafen via `toggleDeafen()` action
- **useLocalMediaState()** - Check microphone mute state
- **useRoom()** - Access LiveKit room instance

---

## Related Components

- **VoiceBottomBar** - Shows deafen state and toggle button
- **VoiceControls** - Contains deafen toggle button

---

## Best Practices

### ✅ Do:
- Use once at app level or in persistent voice component
- Let Redux manage deafen state, let this hook apply it
- Automatically mute user's mic when deafening (Discord behavior)
- Use with `useVoiceConnection().toggleDeafen()`

### ❌ Don't:
- Call this hook multiple times (causes duplicate event listeners)
- Manually set track volumes when using this hook
- Forget to also mute the microphone when deafening
- Use in components that mount/unmount frequently

---

## Example: Complete Deafen Implementation

```typescript
// Redux voice slice (voiceSlice.ts)
interface VoiceState {
  isDeafened: boolean;
  // ... other state
}

const voiceSlice = createSlice({
  name: 'voice',
  initialState: {
    isDeafened: false,
  },
  reducers: {
    toggleDeafen: (state) => {
      state.isDeafened = !state.isDeafened;
      // When deafening, also mute microphone (Discord behavior)
      if (state.isDeafened) {
        state.isMuted = true;
      }
    },
  },
});

// App.tsx - Apply deafen effect globally
import { useDeafenEffect } from '@/hooks/useDeafenEffect';

function App() {
  useDeafenEffect(); // Apply once at app level

  return <Router>{/* ... */}</Router>;
}

// VoiceControls.tsx - Toggle deafen
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { toggleDeafen } from '@/features/voice/voiceSlice';

function VoiceControls() {
  const dispatch = useAppDispatch();
  const { isDeafened, isMuted } = useAppSelector(state => state.voice);

  const handleDeafenToggle = () => {
    dispatch(toggleDeafen());
  };

  return (
    <div className="voice-controls">
      <button
        onClick={handleDeafenToggle}
        className={isDeafened ? 'deafened' : ''}
        title={isDeafened ? 'Undeafen' : 'Deafen'}
      >
        {isDeafened ? <HeadsetOffIcon /> : <HeadsetIcon />}
      </button>

      {/* Microphone is auto-muted when deafened */}
      <button disabled={isDeafened} title={isMuted ? 'Unmute' : 'Mute'}>
        {isMuted ? <MicOffIcon /> : <MicIcon />}
      </button>
    </div>
  );
}
```

---

## Troubleshooting

### Deafen Not Working

**Problem**: Toggling deafen doesn't mute incoming audio.

**Solution**:
1. Verify Redux `isDeafened` state is updating correctly
2. Check that `useRoom()` returns a valid room instance
3. Ensure the hook is called in a component that doesn't unmount frequently
4. Check browser console for errors from `track.setVolume()`

### Audio Unmutes When New Participant Joins

**Problem**: Deafened state resets when someone joins.

**Solution**: The hook handles this automatically via `participantConnected` event. Verify the hook is still mounted and running.

### Can't Unmute Microphone When Deafened

**Problem**: Microphone unmute button is disabled when deafened.

**This is intentional Discord behavior.** When deafened, you should be muted. Either:
1. Undeafen first (restores ability to unmute mic)
2. Or change Redux logic to allow independent mute/deafen

---

## Console Logging

The hook includes helpful console logs for debugging:

```typescript
console.log('[Voice] Deafened: muted all remote audio tracks');
console.log('[Voice] Undeafened: restored all remote audio tracks');
```

These logs appear in the browser console when deafen state changes.

---

## Testing

```typescript
import { renderHook } from '@testing-library/react-hooks';
import { useDeafenEffect } from './useDeafenEffect';
import { useRoom } from './useRoom';
import { useSelector } from 'react-redux';

jest.mock('./useRoom');
jest.mock('react-redux');

describe('useDeafenEffect', () => {
  it('should set remote audio volume to 0 when deafened', () => {
    const mockSetVolume = jest.fn();
    const mockTrack = { setVolume: mockSetVolume };
    const mockPublication = {
      track: mockTrack,
      source: 'microphone'
    };

    const mockParticipant = {
      audioTrackPublications: new Map([['audio-1', mockPublication]])
    };

    const mockRoom = {
      remoteParticipants: new Map([['user-1', mockParticipant]]),
      on: jest.fn(),
      off: jest.fn()
    };

    (useRoom as jest.Mock).mockReturnValue({ room: mockRoom });
    (useSelector as jest.Mock).mockReturnValue(true); // isDeafened = true

    renderHook(() => useDeafenEffect());

    expect(mockSetVolume).toHaveBeenCalledWith(0);
  });

  it('should restore audio volume when undeafened', () => {
    const mockSetVolume = jest.fn();
    const mockTrack = { setVolume: mockSetVolume };
    const mockPublication = {
      track: mockTrack,
      source: 'microphone'
    };

    const mockParticipant = {
      audioTrackPublications: new Map([['audio-1', mockPublication]])
    };

    const mockRoom = {
      remoteParticipants: new Map([['user-1', mockParticipant]]),
      on: jest.fn(),
      off: jest.fn()
    };

    (useRoom as jest.Mock).mockReturnValue({ room: mockRoom });
    (useSelector as jest.Mock).mockReturnValue(false); // isDeafened = false

    renderHook(() => useDeafenEffect());

    expect(mockSetVolume).toHaveBeenCalledWith(1.0);
  });
});
```

---

## Related Documentation

- [Voice-Presence API](../api/voice-presence.md) - Backend deafen state storage
- [useVoiceConnection Hook](./useVoiceConnection.md) - Voice channel management with deafen toggle
- [Voice State Slice](../state/voiceSlice.md) - Redux state management
- [LiveKit Module](../modules/voice/livekit.md) - LiveKit integration

---

**Last Updated**: 2025 (LiveKit cleanup refactor)
**Status**: ✅ Production-ready
**Note**: Should be used once at app level, not per-component
