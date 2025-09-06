# useVoiceConnection

> **Location:** `frontend/src/hooks/useVoiceConnection.ts`  
> **Type:** State Hook  
> **Category:** voice

## Overview

A comprehensive hook that manages all aspects of voice and video connections in Kraken using LiveKit. It provides a unified interface for joining/leaving voice channels, controlling audio/video settings, managing device preferences, and handling screen sharing. This is the primary hook for voice communication features and integrates deeply with Redux state management and WebSocket events.

## Hook Signature

```typescript
function useVoiceConnection(): {
  state: VoiceConnectionState;
  actions: VoiceConnectionActions;
}
```

### Parameters

This hook takes no parameters.

### Return Value

```typescript
interface UseVoiceConnectionReturn {
  state: VoiceConnectionState;
  actions: VoiceConnectionActions;
}

interface VoiceConnectionState {
  // Voice state from Redux
  isConnected: boolean;
  currentChannelId: string | null;
  currentChannelName: string | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  participants: VoicePresenceUser[];
  showVideoTiles: boolean;
  
  // LiveKit room instance
  room: Room | null;
}

interface VoiceConnectionActions {
  joinVoiceChannel: (
    channelId: string,
    channelName: string,
    communityId: string,
    isPrivate: boolean,
    createdAt: string
  ) => Promise<void>;
  leaveVoiceChannel: () => Promise<void>;
  toggleAudio: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  toggleMute: () => Promise<void>;
  toggleDeafen: () => Promise<void>;
  setShowVideoTiles: (show: boolean) => void;
  switchAudioInputDevice: (deviceId: string) => Promise<void>;
  switchAudioOutputDevice: (deviceId: string) => Promise<void>;
  switchVideoInputDevice: (deviceId: string) => Promise<void>;
}
```

## Usage Examples

### Basic Voice Connection

```tsx
import { useVoiceConnection } from '@/hooks/useVoiceConnection';

function VoiceChannelButton({ channel }) {
  const { state, actions } = useVoiceConnection();

  const handleJoinVoice = async () => {
    if (state.isConnected) {
      await actions.leaveVoiceChannel();
    } else {
      await actions.joinVoiceChannel(
        channel.id,
        channel.name,
        channel.communityId,
        channel.isPrivate,
        channel.createdAt
      );
    }
  };

  return (
    <div>
      <h3>{channel.name}</h3>
      <button onClick={handleJoinVoice}>
        {state.isConnected && state.currentChannelId === channel.id 
          ? 'Leave Voice' 
          : 'Join Voice'
        }
      </button>
      
      {state.isConnected && state.currentChannelId === channel.id && (
        <div>
          <span>Connected to {state.currentChannelName}</span>
          <span>Participants: {state.participants.length}</span>
        </div>
      )}
    </div>
  );
}
```

### Voice Control Panel

```tsx
function VoiceControlPanel() {
  const { state, actions } = useVoiceConnection();

  if (!state.isConnected) {
    return <div>Not connected to voice</div>;
  }

  return (
    <div className="voice-controls">
      <div className="connection-info">
        <h4>Connected to: {state.currentChannelName}</h4>
        <p>Participants: {state.participants.length}</p>
      </div>

      <div className="audio-controls">
        <button 
          onClick={actions.toggleAudio}
          className={state.isAudioEnabled ? 'active' : 'inactive'}
        >
          {state.isAudioEnabled ? 'Disable Audio' : 'Enable Audio'}
        </button>
        
        <button 
          onClick={actions.toggleMute}
          className={state.isMuted ? 'muted' : 'unmuted'}
        >
          {state.isMuted ? 'Unmute' : 'Mute'}
        </button>
        
        <button 
          onClick={actions.toggleDeafen}
          className={state.isDeafened ? 'deafened' : 'undeafened'}
        >
          {state.isDeafened ? 'Undeafen' : 'Deafen'}
        </button>
      </div>

      <div className="video-controls">
        <button 
          onClick={actions.toggleVideo}
          className={state.isVideoEnabled ? 'active' : 'inactive'}
        >
          {state.isVideoEnabled ? 'Stop Video' : 'Start Video'}
        </button>
        
        <button 
          onClick={actions.toggleScreenShare}
          className={state.isScreenSharing ? 'sharing' : 'not-sharing'}
        >
          {state.isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
        </button>
        
        <button 
          onClick={() => actions.setShowVideoTiles(!state.showVideoTiles)}
        >
          {state.showVideoTiles ? 'Hide Video' : 'Show Video'}
        </button>
      </div>
    </div>
  );
}
```

### Advanced Device Management

```tsx
function VoiceSettingsPanel() {
  const { state, actions } = useVoiceConnection();
  const { audioInputDevices, audioOutputDevices, videoInputDevices } = useDeviceSettings();

  const handleAudioInputChange = async (deviceId: string) => {
    try {
      await actions.switchAudioInputDevice(deviceId);
    } catch (error) {
      console.error('Failed to switch audio input:', error);
    }
  };

  return (
    <div className="voice-settings">
      <div className="device-selection">
        <h4>Audio Input</h4>
        <select onChange={(e) => handleAudioInputChange(e.target.value)}>
          {audioInputDevices.map(device => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))}
        </select>

        <h4>Audio Output</h4>
        <select onChange={(e) => actions.switchAudioOutputDevice(e.target.value)}>
          {audioOutputDevices.map(device => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))}
        </select>

        <h4>Video Input</h4>
        <select onChange={(e) => actions.switchVideoInputDevice(e.target.value)}>
          {videoInputDevices.map(device => (
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

## Implementation Details

### Internal State

The hook combines Redux state with LiveKit room state:

```typescript
const dispatch = useDispatch<AppDispatch>();
const voiceState = useSelector((state: RootState) => state.voice);
const { room, setRoom, getRoom } = useRoom();
```

### Dependencies

#### Internal Hooks
- `useSelector` - Accesses Redux voice state
- `useDispatch` - Dispatches voice actions and thunks
- `useCallback` - Memoizes action functions
- `useSocket` - Gets WebSocket instance for voice events
- `useRoom` - Manages LiveKit room instance
- `useVoiceEvents` - Sets up voice-related event listeners

#### External Hooks
- `useProfileQuery` - Gets current user information
- `useGetConnectionInfoQuery` - Gets LiveKit connection credentials

#### External Dependencies
- `livekit-client` - LiveKit WebRTC library
- `socket.io-client` - WebSocket communication

## Redux Integration

### Voice Actions and Thunks

The hook dispatches complex async thunks for voice operations:

```typescript
// Join voice channel
await dispatch(joinVoiceChannel({
  channelId,
  channelName,
  communityId,
  isPrivate,
  createdAt,
  user: { id: user.id, username: user.username, displayName: user.displayName },
  connectionInfo,
  socket: socket ?? undefined,
  setRoom,
})).unwrap();

// Toggle audio
await dispatch(toggleAudio({ getRoom })).unwrap();

// Switch device
await dispatch(switchAudioInputDevice({ deviceId, getRoom })).unwrap();
```

### State Management

```typescript
const voiceState = useSelector((state: RootState) => state.voice);
// Contains: isConnected, currentChannelId, currentChannelName, isAudioEnabled, 
// isVideoEnabled, isScreenSharing, isMuted, isDeafened, participants, showVideoTiles
```

## LiveKit Integration

### Room Management

```typescript
const { room, setRoom, getRoom } = useRoom();

// Room is passed between actions for consistent state
const handleToggleVideo = useCallback(async () => {
  await dispatch(toggleVideo({ getRoom })).unwrap();
}, [dispatch, getRoom]);
```

### WebRTC Operations

The hook handles complex WebRTC operations through LiveKit:
- **Audio/Video Track Management:** Enable/disable local tracks
- **Screen Sharing:** Capture and share screen content
- **Device Switching:** Change input/output devices dynamically
- **Participant Management:** Track remote participants and their states

## Side Effects

### Voice Event Listeners

```typescript
// Set up voice event listeners (handled by useVoiceEvents internally)
useVoiceEvents();
```

### Error Handling and Validation

```typescript
const handleJoinVoiceChannel = useCallback(async (...args) => {
  if (!user || !connectionInfo) {
    throw new Error("User or connection info not available");
  }
  
  await dispatch(joinVoiceChannel({
    // ... args with validation
  })).unwrap(); // .unwrap() throws on rejection for proper error handling
}, [dispatch, user, connectionInfo, socket, setRoom]);
```

## Performance Considerations

### Memoization Strategy

All action functions are memoized with `useCallback`:

```typescript
const handleToggleAudio = useCallback(async () => {
  await dispatch(toggleAudio({ getRoom })).unwrap();
}, [dispatch, getRoom]); // Stable dependencies ensure consistent memoization
```

### State Optimization

- **Selective State Access:** Only accesses specific parts of Redux state
- **Room Instance Sharing:** Shares single room instance across all operations
- **Event Listener Efficiency:** Uses dedicated hook for voice events to prevent re-registration

## Error Handling

### Async Operation Error Handling

```typescript
// All async operations can throw errors
try {
  await actions.joinVoiceChannel(channelId, channelName, communityId, false, date);
} catch (error) {
  console.error('Failed to join voice channel:', error);
  // Handle specific error cases
  if (error.message.includes('permission')) {
    showPermissionError();
  }
}
```

### Device Error Handling

```typescript
const handleDeviceSwitch = async (deviceId: string) => {
  try {
    await actions.switchAudioInputDevice(deviceId);
  } catch (error) {
    if (error.message.includes('NotFoundError')) {
      console.error('Device not found:', deviceId);
    } else if (error.message.includes('NotAllowedError')) {
      console.error('Permission denied for device:', deviceId);
    }
  }
};
```

## Testing

### Test Examples

```typescript
import { renderHook } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { useVoiceConnection } from '../useVoiceConnection';
import { store } from '../../app/store';

describe('useVoiceConnection', () => {
  const wrapper = ({ children }) => (
    <Provider store={store}>
      <MockRoomProvider>
        <MockSocketProvider>
          {children}
        </MockSocketProvider>
      </MockRoomProvider>
    </Provider>
  );

  it('should return voice state and actions', () => {
    const { result } = renderHook(() => useVoiceConnection(), { wrapper });
    
    expect(result.current).toHaveProperty('state');
    expect(result.current).toHaveProperty('actions');
    expect(typeof result.current.actions.joinVoiceChannel).toBe('function');
    expect(typeof result.current.actions.toggleAudio).toBe('function');
  });

  it('should handle joining voice channel', async () => {
    const { result } = renderHook(() => useVoiceConnection(), { wrapper });
    
    await act(async () => {
      await result.current.actions.joinVoiceChannel(
        'channel-123', 'General', 'community-456', false, '2023-01-01'
      );
    });
    
    expect(result.current.state.isConnected).toBe(true);
    expect(result.current.state.currentChannelId).toBe('channel-123');
  });
});
```

## Common Patterns

### Pattern 1: Voice Bottom Bar

```tsx
function VoiceBottomBar() {
  const { state, actions } = useVoiceConnection();

  if (!state.isConnected) return null;

  return (
    <div className="voice-bottom-bar">
      <div className="channel-info">
        <span>{state.currentChannelName}</span>
        <span>{state.participants.length} participants</span>
      </div>
      
      <div className="controls">
        <VoiceButton 
          active={state.isAudioEnabled && !state.isMuted}
          onClick={actions.toggleMute}
          icon="microphone"
        />
        <VoiceButton 
          active={!state.isDeafened}
          onClick={actions.toggleDeafen}
          icon="headphones"
        />
        <VoiceButton 
          active={state.isVideoEnabled}
          onClick={actions.toggleVideo}
          icon="video"
        />
        <VoiceButton 
          active={state.isScreenSharing}
          onClick={actions.toggleScreenShare}
          icon="screen-share"
        />
        <button onClick={actions.leaveVoiceChannel}>
          Leave
        </button>
      </div>
    </div>
  );
}
```

### Pattern 2: Voice Channel Join Button

```tsx
function VoiceChannelJoinButton({ channel }) {
  const { state, actions } = useVoiceConnection();
  const [joining, setJoining] = useState(false);

  const isCurrentChannel = state.currentChannelId === channel.id;
  const canJoin = !state.isConnected || isCurrentChannel;

  const handleClick = async () => {
    if (isCurrentChannel && state.isConnected) {
      await actions.leaveVoiceChannel();
    } else {
      setJoining(true);
      try {
        await actions.joinVoiceChannel(
          channel.id,
          channel.name,
          channel.communityId,
          channel.isPrivate,
          channel.createdAt
        );
      } finally {
        setJoining(false);
      }
    }
  };

  return (
    <button 
      onClick={handleClick} 
      disabled={joining || !canJoin}
      className={isCurrentChannel && state.isConnected ? 'connected' : 'disconnected'}
    >
      {joining ? 'Joining...' : isCurrentChannel && state.isConnected ? 'Leave' : 'Join'}
    </button>
  );
}
```

## Related Hooks

- **useRoom** - Manages LiveKit room instance and context
- **useVoiceEvents** - Handles voice-related WebSocket events
- **useDeviceSettings** - Manages audio/video device enumeration and preferences
- **useSocket** - Provides WebSocket instance for voice presence updates

## Troubleshooting

### Common Issues

1. **Cannot join voice channel**
   - **Symptoms:** joinVoiceChannel throws errors or never resolves
   - **Cause:** Missing user data, connection info, or WebSocket connection
   - **Solution:** Ensure user is authenticated and connection info is loaded

   ```tsx
   const { data: user, isLoading: userLoading } = useProfileQuery();
   const { data: connectionInfo, isLoading: connLoading } = useGetConnectionInfoQuery();
   
   if (userLoading || connLoading) {
     return <div>Loading...</div>;
   }
   ```

2. **Audio/video not working**
   - **Symptoms:** toggleAudio/toggleVideo doesn't enable tracks
   - **Cause:** Missing device permissions or device not available
   - **Solution:** Check permissions and device availability

3. **State not updating**
   - **Symptoms:** Voice state doesn't reflect actual connection status
   - **Cause:** Redux thunks failing silently or room state out of sync
   - **Solution:** Use .unwrap() on dispatch calls and handle errors

### Best Practices

- **Error handling:** Always wrap voice operations in try-catch blocks
- **Permission checks:** Verify microphone/camera permissions before joining
- **State consistency:** Use the provided state rather than accessing room directly
- **Cleanup:** Ensure voice connections are properly cleaned up on component unmount

## Version History

- **1.0.0:** Initial implementation with basic join/leave functionality
- **1.1.0:** Added device switching and screen sharing support
- **1.2.0:** Improved error handling and state management
- **1.3.0:** Added mute/deafen functionality separate from audio enable/disable

## Related Documentation

- [useRoom Hook](./useRoom.md)
- [useVoiceEvents Hook](./useVoiceEvents.md)
- [Voice Slice](../../features/voice-slice.md)
- [LiveKit Integration](../../api/livekit.md)