# Voice Redux Slice

> **Location:** `frontend/src/features/voice/voiceSlice.ts`  
> **Type:** Redux Slice (Pure State Management)  
> **Domain:** Local voice connection and UI state

## Overview

The Voice slice manages local voice connection state and UI preferences for voice/video functionality. It works in conjunction with the Voice Presence API to provide a complete voice chat experience. This slice handles connection states, user preferences, participant information, and device settings while maintaining separation from non-serializable LiveKit objects.

## Slice Configuration

```typescript
interface VoiceState {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  
  // Current channel info
  currentChannelId: string | null;
  channelName: string | null;
  communityId: string | null;
  isPrivate: boolean | null;
  createdAt: string | null;
  
  // Participants (from voice presence)
  participants: VoicePresenceUser[];
  
  // Local user voice states
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;

  // UI state
  showVideoTiles: boolean;
  
  // Device preferences
  selectedAudioInputId: string | null;
  selectedAudioOutputId: string | null;
  selectedVideoInputId: string | null;
}

const voiceSlice = createSlice({
  name: 'voice',
  initialState,
  reducers: {
    // Connection management
    setConnecting,
    setConnected,
    setDisconnected,
    setConnectionError,
    
    // Voice state management
    setAudioEnabled,
    setVideoEnabled,
    setScreenSharing,
    setMuted,
    setDeafened,
    setSpeaking,
    
    // Participant management
    setParticipants,
    updateParticipant,
    removeParticipant,
    
    // UI management
    setShowVideoTiles,
    
    // Device management
    setSelectedAudioInputId,
    setSelectedAudioOutputId,
    setSelectedVideoInputId,
  },
});
```

### Initial State

```typescript
const initialState: VoiceState = {
  isConnected: false,
  isConnecting: false,
  connectionError: null,
  currentChannelId: null,
  channelName: null,
  communityId: null,
  isPrivate: null,
  createdAt: null,
  participants: [],
  isAudioEnabled: true,
  isVideoEnabled: false,
  isScreenSharing: false,
  isMuted: false,
  isDeafened: false,
  isSpeaking: false,
  showVideoTiles: false,
  selectedAudioInputId: null,
  selectedAudioOutputId: null,
  selectedVideoInputId: null,
};
```

## Action Creators

### Connection Management Actions

#### setConnecting
```typescript
setConnecting: (state, action: PayloadAction<boolean>) => {
  state.isConnecting = action.payload;
  if (action.payload) {
    state.connectionError = null;
  }
}
```

**Purpose:** Updates connecting state and clears any previous connection errors.

**Usage:**
```typescript
dispatch(setConnecting(true)); // Starting connection
dispatch(setConnecting(false)); // Connection attempt finished
```

#### setConnected
```typescript
setConnected: (state, action: PayloadAction<{
  channelId: string;
  channelName: string;
  communityId: string;
  isPrivate: boolean;
  createdAt: string;
}>) => {
  state.isConnected = true;
  state.isConnecting = false;
  state.connectionError = null;
  state.currentChannelId = action.payload.channelId;
  state.channelName = action.payload.channelName;
  state.communityId = action.payload.communityId;
  state.isPrivate = action.payload.isPrivate;
  state.createdAt = action.payload.createdAt;
}
```

**Purpose:** Sets connected state with channel information.

**Usage:**
```typescript
dispatch(setConnected({
  channelId: 'channel-123',
  channelName: 'General Voice',
  communityId: 'community-456',
  isPrivate: false,
  createdAt: channel.createdAt
}));
```

#### setDisconnected
```typescript
setDisconnected: (state) => {
  return {
    ...initialState,
    // Preserve some UI state that should persist
    showVideoTiles: state.showVideoTiles,
  };
}
```

**Purpose:** Resets voice state to initial values while preserving UI preferences.

**Usage:**
```typescript
dispatch(setDisconnected()); // Clean disconnect from voice
```

#### setConnectionError
```typescript
setConnectionError: (state, action: PayloadAction<string>) => {
  state.isConnecting = false;
  state.connectionError = action.payload;
}
```

**Purpose:** Sets connection error state and stops connecting state.

**Usage:**
```typescript
dispatch(setConnectionError('Failed to connect to voice channel'));
```

### Voice State Management Actions

#### setAudioEnabled
```typescript
setAudioEnabled: (state, action: PayloadAction<boolean>) => {
  state.isAudioEnabled = action.payload;
}
```

#### setVideoEnabled  
```typescript
setVideoEnabled: (state, action: PayloadAction<boolean>) => {
  state.isVideoEnabled = action.payload;
}
```

#### setScreenSharing
```typescript
setScreenSharing: (state, action: PayloadAction<boolean>) => {
  state.isScreenSharing = action.payload;
}
```

#### setMuted
```typescript
setMuted: (state, action: PayloadAction<boolean>) => {
  state.isMuted = action.payload;
}
```

#### setDeafened
```typescript
setDeafened: (state, action: PayloadAction<boolean>) => {
  state.isDeafened = action.payload;
}
```

#### setSpeaking
```typescript
setSpeaking: (state, action: PayloadAction<boolean>) => {
  state.isSpeaking = action.payload;
}
```

**Purpose:** Manage local user's voice and video states.

**Note on isSpeaking:**
The `isSpeaking` state is automatically updated by the `useSpeakingDetection` hook based on LiveKit audio level detection. You typically don't need to dispatch `setSpeaking` manually - it's handled by the hook when the local user starts/stops speaking.

**Usage:**
```typescript
// Toggle microphone
dispatch(setMuted(!voiceState.isMuted));

// Enable video
dispatch(setVideoEnabled(true));

// Start screen sharing
dispatch(setScreenSharing(true));

// isSpeaking is automatically managed by useSpeakingDetection hook
// But you can access it from state:
const isSpeaking = useSelector((state) => state.voice.isSpeaking);
```

### Participant Management Actions

#### setParticipants
```typescript
setParticipants: (state, action: PayloadAction<VoicePresenceUser[]>) => {
  state.participants = action.payload;
}
```

**Purpose:** Replace all participants with new list (used for initial load).

#### updateParticipant
```typescript
updateParticipant: (state, action: PayloadAction<VoicePresenceUser>) => {
  const index = state.participants.findIndex(p => p.id === action.payload.id);
  if (index !== -1) {
    state.participants[index] = action.payload;
  } else {
    state.participants.push(action.payload);
  }
}
```

**Purpose:** Update existing participant or add new one.

#### removeParticipant
```typescript
removeParticipant: (state, action: PayloadAction<string>) => {
  state.participants = state.participants.filter(p => p.id !== action.payload);
}
```

**Purpose:** Remove participant from list when they leave voice.

**Usage:**
```typescript
// Set initial participant list
dispatch(setParticipants(presenceData.users));

// Update single participant's state
dispatch(updateParticipant(updatedUser));

// Remove participant who left
dispatch(removeParticipant(userId));
```

### UI Management Actions

#### setShowVideoTiles
```typescript
setShowVideoTiles: (state, action: PayloadAction<boolean>) => {
  state.showVideoTiles = action.payload;
}
```

**Purpose:** Controls visibility of video tiles overlay.

**Usage:**
```typescript
// Show video tiles when someone enables video
dispatch(setShowVideoTiles(true));

// Hide video tiles to focus on chat
dispatch(setShowVideoTiles(false));
```

### Device Management Actions

#### setSelectedAudioInputId
```typescript
setSelectedAudioInputId: (state, action: PayloadAction<string | null>) => {
  state.selectedAudioInputId = action.payload;
}
```

#### setSelectedAudioOutputId
```typescript
setSelectedAudioOutputId: (state, action: PayloadAction<string | null>) => {
  state.selectedAudioOutputId = action.payload;
}
```

#### setSelectedVideoInputId
```typescript
setSelectedVideoInputId: (state, action: PayloadAction<string | null>) => {
  state.selectedVideoInputId = action.payload;
}
```

**Purpose:** Store user's selected audio/video devices.

**Usage:**
```typescript
// Set preferred microphone
dispatch(setSelectedAudioInputId('microphone-device-id'));

// Set preferred speakers
dispatch(setSelectedAudioOutputId('speakers-device-id'));

// Set preferred camera
dispatch(setSelectedVideoInputId('camera-device-id'));
```

## Selectors

### Basic Selectors

```typescript
// Get full voice state
const voiceState = useSelector((state: RootState) => state.voice);

// Get connection status
const isConnected = useSelector((state: RootState) => state.voice.isConnected);

// Get current channel info
const currentChannel = useSelector((state: RootState) => ({
  id: state.voice.currentChannelId,
  name: state.voice.channelName,
  communityId: state.voice.communityId
}));

// Get voice controls state
const voiceControls = useSelector((state: RootState) => ({
  isMuted: state.voice.isMuted,
  isDeafened: state.voice.isDeafened,
  isVideoEnabled: state.voice.isVideoEnabled,
  isScreenSharing: state.voice.isScreenSharing
}));

// Get participants
const participants = useSelector((state: RootState) => state.voice.participants);
```

### Memoized Selectors

```typescript
import { createSelector } from '@reduxjs/toolkit';

// Get connection info
export const selectVoiceConnectionInfo = createSelector(
  [(state: RootState) => state.voice],
  (voice) => ({
    isConnected: voice.isConnected,
    isConnecting: voice.isConnecting,
    connectionError: voice.connectionError,
    channelId: voice.currentChannelId,
    channelName: voice.channelName
  })
);

// Get user voice state for UI
export const selectUserVoiceState = createSelector(
  [(state: RootState) => state.voice],
  (voice) => ({
    isAudioEnabled: voice.isAudioEnabled,
    isVideoEnabled: voice.isVideoEnabled,
    isScreenSharing: voice.isScreenSharing,
    isMuted: voice.isMuted,
    isDeafened: voice.isDeafened
  })
);

// Check if any video is active
export const selectHasActiveVideo = createSelector(
  [(state: RootState) => state.voice.participants, (state: RootState) => state.voice.isVideoEnabled],
  (participants, localVideoEnabled) => {
    return localVideoEnabled || participants.some(p => p.isVideoEnabled || p.isScreenSharing);
  }
);
```

## Integration with Voice Presence API

The voice slice works closely with the Voice Presence API:

```typescript
// Voice Presence API updates server state
const [updateVoiceState] = useUpdateVoiceStateMutation();

// Voice slice manages local state
const dispatch = useAppDispatch();

const handleToggleMute = async () => {
  const newMuteState = !isMuted;
  
  // 1. Update local state immediately for responsive UI
  dispatch(setMuted(newMuteState));
  
  // 2. Update server state
  try {
    await updateVoiceState({
      channelId,
      updates: { isMuted: newMuteState }
    });
  } catch (error) {
    // 3. Revert local state on server error
    dispatch(setMuted(isMuted));
  }
};
```

## Component Integration

### Voice Connection Hook

```typescript
function useVoiceConnection() {
  const voiceState = useSelector((state: RootState) => state.voice);
  const dispatch = useAppDispatch();
  
  const connect = async (channel: Channel) => {
    dispatch(setConnecting(true));
    
    try {
      // Connect to voice channel (LiveKit integration)
      await connectToVoiceChannel(channel);
      
      dispatch(setConnected({
        channelId: channel.id,
        channelName: channel.name,
        communityId: channel.communityId,
        isPrivate: channel.isPrivate,
        createdAt: channel.createdAt
      }));
    } catch (error) {
      dispatch(setConnectionError('Failed to connect to voice channel'));
    }
  };

  const disconnect = async () => {
    try {
      await disconnectFromVoiceChannel();
    } finally {
      dispatch(setDisconnected());
    }
  };

  return {
    ...voiceState,
    connect,
    disconnect
  };
}
```

### Voice Bottom Bar Component

```typescript
function VoiceBottomBar() {
  const voiceState = useSelector((state: RootState) => state.voice);
  const dispatch = useAppDispatch();
  
  const handleToggleMute = () => {
    dispatch(setMuted(!voiceState.isMuted));
    // Sync with LiveKit and server
  };

  const handleToggleDeafen = () => {
    dispatch(setDeafened(!voiceState.isDeafened));
    // Sync with LiveKit and server
  };

  const handleToggleVideo = () => {
    dispatch(setVideoEnabled(!voiceState.isVideoEnabled));
    // Show/hide video tiles based on state
    if (!voiceState.isVideoEnabled) {
      dispatch(setShowVideoTiles(true));
    }
  };

  const handleDisconnect = () => {
    dispatch(setDisconnected());
    // Cleanup LiveKit connection
  };

  if (!voiceState.isConnected) return null;

  return (
    <div className="voice-bottom-bar">
      <div className="channel-info">
        <span>🔊 {voiceState.channelName}</span>
        <span>{voiceState.participants.length} connected</span>
      </div>
      
      <div className="voice-controls">
        <button 
          onClick={handleToggleMute}
          className={voiceState.isMuted ? 'muted' : ''}
        >
          {voiceState.isMuted ? '🔇' : '🎤'}
        </button>
        
        <button 
          onClick={handleToggleDeafen}
          className={voiceState.isDeafened ? 'deafened' : ''}
        >
          {voiceState.isDeafened ? '🔈' : '🔊'}
        </button>
        
        <button 
          onClick={handleToggleVideo}
          className={voiceState.isVideoEnabled ? 'video-on' : ''}
        >
          {voiceState.isVideoEnabled ? '📹' : '📷'}
        </button>
        
        <button onClick={handleDisconnect} className="disconnect">
          📞
        </button>
      </div>
    </div>
  );
}
```

### Video Tiles Component

```typescript
function VideoTiles() {
  const { participants, isVideoEnabled, showVideoTiles } = useSelector((state: RootState) => state.voice);
  const dispatch = useAppDispatch();

  const handleCloseVideoTiles = () => {
    dispatch(setShowVideoTiles(false));
  };

  // Only show if video tiles are enabled and there's video content
  const hasVideo = isVideoEnabled || participants.some(p => p.isVideoEnabled || p.isScreenSharing);
  
  if (!showVideoTiles || !hasVideo) return null;

  return (
    <div className="video-tiles-overlay">
      <div className="video-tiles-header">
        <span>Video Chat</span>
        <button onClick={handleCloseVideoTiles}>✕</button>
      </div>
      
      <div className="video-tiles-grid">
        {/* Local video */}
        {isVideoEnabled && (
          <div className="video-tile local">
            <video autoPlay muted />
            <span>You</span>
          </div>
        )}
        
        {/* Remote videos */}
        {participants.filter(p => p.isVideoEnabled || p.isScreenSharing).map(participant => (
          <div key={participant.id} className="video-tile remote">
            <video autoPlay />
            <span>{participant.displayName || participant.username}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Device Settings Component

```typescript
function DeviceSettings() {
  const { selectedAudioInputId, selectedAudioOutputId, selectedVideoInputId } = useSelector((state: RootState) => state.voice);
  const dispatch = useAppDispatch();
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    const getDevices = async () => {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAvailableDevices(devices);
    };
    getDevices();
  }, []);

  const audioInputs = availableDevices.filter(d => d.kind === 'audioinput');
  const audioOutputs = availableDevices.filter(d => d.kind === 'audiooutput');
  const videoInputs = availableDevices.filter(d => d.kind === 'videoinput');

  const handleAudioInputChange = (deviceId: string) => {
    dispatch(setSelectedAudioInputId(deviceId));
    // Update LiveKit audio track
  };

  const handleAudioOutputChange = (deviceId: string) => {
    dispatch(setSelectedAudioOutputId(deviceId));
    // Update audio output device
  };

  const handleVideoInputChange = (deviceId: string) => {
    dispatch(setSelectedVideoInputId(deviceId));
    // Update LiveKit video track
  };

  return (
    <div className="device-settings">
      <div className="setting-group">
        <label>Microphone</label>
        <select
          value={selectedAudioInputId || ''}
          onChange={(e) => handleAudioInputChange(e.target.value)}
        >
          <option value="">Default</option>
          {audioInputs.map(device => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))}
        </select>
      </div>

      <div className="setting-group">
        <label>Speakers</label>
        <select
          value={selectedAudioOutputId || ''}
          onChange={(e) => handleAudioOutputChange(e.target.value)}
        >
          <option value="">Default</option>
          {audioOutputs.map(device => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))}
        </select>
      </div>

      <div className="setting-group">
        <label>Camera</label>
        <select
          value={selectedVideoInputId || ''}
          onChange={(e) => handleVideoInputChange(e.target.value)}
        >
          <option value="">Default</option>
          {videoInputs.map(device => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
```

## State Persistence

### Session Storage Integration

```typescript
// Save device preferences to localStorage
useEffect(() => {
  const devicePreferences = {
    selectedAudioInputId,
    selectedAudioOutputId,
    selectedVideoInputId
  };
  localStorage.setItem('voiceDevicePreferences', JSON.stringify(devicePreferences));
}, [selectedAudioInputId, selectedAudioOutputId, selectedVideoInputId]);

// Load device preferences on app start
useEffect(() => {
  const saved = localStorage.getItem('voiceDevicePreferences');
  if (saved) {
    const preferences = JSON.parse(saved);
    dispatch(setSelectedAudioInputId(preferences.selectedAudioInputId));
    dispatch(setSelectedAudioOutputId(preferences.selectedAudioOutputId));
    dispatch(setSelectedVideoInputId(preferences.selectedVideoInputId));
  }
}, []);
```

## Performance Considerations

### Optimistic Updates

The voice slice enables optimistic updates for responsive voice controls:

1. **Immediate UI Feedback:** State changes happen instantly
2. **Server Sync:** Changes are sent to server/LiveKit
3. **Error Handling:** State reverts if server operations fail

### Memory Management

```typescript
// Clean up participants when disconnecting
const setDisconnected = (state) => {
  return {
    ...initialState,
    // Don't reset device preferences
    selectedAudioInputId: state.selectedAudioInputId,
    selectedAudioOutputId: state.selectedAudioOutputId,
    selectedVideoInputId: state.selectedVideoInputId,
  };
};
```

## Testing

### Slice Testing

```typescript
import voiceReducer, { 
  setConnected, 
  setMuted, 
  updateParticipant 
} from '../voiceSlice';

describe('voiceSlice', () => {
  it('should handle setConnected', () => {
    const initialState = {
      isConnected: false,
      currentChannelId: null,
      // ... other initial state
    };

    const channelInfo = {
      channelId: 'channel-123',
      channelName: 'General Voice',
      communityId: 'community-456',
      isPrivate: false,
      createdAt: '2023-01-01T00:00:00Z'
    };

    const newState = voiceReducer(initialState, setConnected(channelInfo));

    expect(newState.isConnected).toBe(true);
    expect(newState.currentChannelId).toBe('channel-123');
    expect(newState.channelName).toBe('General Voice');
  });

  it('should handle participant updates', () => {
    const initialState = {
      participants: [
        { id: 'user-1', username: 'user1', isMuted: false }
      ]
    };

    const updatedParticipant = {
      id: 'user-1',
      username: 'user1',
      isMuted: true
    };

    const newState = voiceReducer(initialState, updateParticipant(updatedParticipant));

    expect(newState.participants[0].isMuted).toBe(true);
  });
});
```

### Integration Testing

```typescript
describe('Voice integration', () => {
  it('should sync local and server state', async () => {
    const store = createTestStore();
    
    // Dispatch local state change
    store.dispatch(setMuted(true));
    
    // Verify local state updated
    expect(store.getState().voice.isMuted).toBe(true);
    
    // Mock server sync
    const mockUpdateVoiceState = jest.fn();
    await mockUpdateVoiceState({ channelId: 'test', updates: { isMuted: true } });
    
    expect(mockUpdateVoiceState).toHaveBeenCalledWith({
      channelId: 'test',
      updates: { isMuted: true }
    });
  });
});
```

## Related Documentation

- [Voice Presence API](./voicePresenceApi.md) - Server-side voice presence management
- [LiveKit API](./livekitApi.md) - WebRTC token generation and connection
- [Voice Components](../components/voice/) - Voice UI components
- [Voice Connection Hook](../hooks/useVoiceConnection.md) - Voice connection management
- [Voice Persistence](../features/voice-persistence.md) - Cross-navigation voice connection
- [Device Settings](../hooks/useDeviceSettings.md) - Audio/video device management