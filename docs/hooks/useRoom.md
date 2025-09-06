# useRoom

> **Location:** `frontend/src/hooks/useRoom.ts`  
> **Type:** Context Hook  
> **Category:** voice

## Overview

A simple context hook that provides access to the LiveKit Room instance and its management functions throughout the voice/video components. This hook is essential for accessing the WebRTC room connection for all LiveKit-related operations and serves as the bridge between React components and the LiveKit client library.

## Hook Signature

```typescript
function useRoom(): RoomContextType
```

### Parameters

This hook takes no parameters.

### Return Value

```typescript
interface RoomContextType {
  room: Room | null;              // Current LiveKit Room instance or null
  setRoom: (room: Room | null) => void;  // Function to set/update the room instance
  getRoom: () => Room | null;     // Function to get the current room instance
}
```

## Usage Examples

### Basic Usage

```tsx
import { useRoom } from '@/hooks/useRoom';

function VoiceComponent() {
  const { room, setRoom, getRoom } = useRoom();

  const handleJoinRoom = async () => {
    const newRoom = new Room();
    try {
      await newRoom.connect(liveKitUrl, token);
      setRoom(newRoom); // Update room in context
    } catch (error) {
      console.error('Failed to join room:', error);
    }
  };

  const handleLeaveRoom = () => {
    if (room) {
      room.disconnect();
      setRoom(null); // Clear room from context
    }
  };

  return (
    <div>
      <p>Room Status: {room?.state || 'Disconnected'}</p>
      <button onClick={handleJoinRoom} disabled={!!room}>
        Join Room
      </button>
      <button onClick={handleLeaveRoom} disabled={!room}>
        Leave Room
      </button>
    </div>
  );
}
```

### Advanced Usage with Audio Control

```tsx
import { useRoom } from '@/hooks/useRoom';
import { Track } from 'livekit-client';

function AudioControls() {
  const { room, getRoom } = useRoom();

  const toggleMicrophone = async () => {
    const currentRoom = getRoom();
    if (!currentRoom) return;

    const audioTrack = currentRoom.localParticipant.getTrack(Track.Source.Microphone);
    if (audioTrack) {
      await audioTrack.setMuted(!audioTrack.isMuted);
    } else {
      // Create and publish new audio track
      await currentRoom.localParticipant.setMicrophoneEnabled(true);
    }
  };

  const toggleCamera = async () => {
    const currentRoom = getRoom();
    if (!currentRoom) return;

    const videoTrack = currentRoom.localParticipant.getTrack(Track.Source.Camera);
    if (videoTrack) {
      await videoTrack.setMuted(!videoTrack.isMuted);
    } else {
      await currentRoom.localParticipant.setCameraEnabled(true);
    }
  };

  if (!room) {
    return <div>Not connected to room</div>;
  }

  return (
    <div className="audio-controls">
      <button onClick={toggleMicrophone}>
        {room.localParticipant.isMicrophoneEnabled ? 'Mute' : 'Unmute'}
      </button>
      <button onClick={toggleCamera}>
        {room.localParticipant.isCameraEnabled ? 'Stop Video' : 'Start Video'}
      </button>
    </div>
  );
}
```

### Integration with Voice Connection

```tsx
import { useRoom } from '@/hooks/useRoom';
import { useVoiceConnection } from '@/hooks/useVoiceConnection';

function VoiceIntegrationExample() {
  const { room, setRoom } = useRoom();
  const { state, actions } = useVoiceConnection();

  // The voice connection hook uses setRoom internally
  const handleJoinVoice = async () => {
    await actions.joinVoiceChannel(
      'channel-123',
      'General',
      'community-456',
      false,
      new Date().toISOString()
    );
    // setRoom is called internally by the voice connection logic
  };

  // Room instance is now available for direct LiveKit operations
  useEffect(() => {
    if (room) {
      const handleRoomEvent = (event) => {
        console.log('Room event:', event);
      };

      room.on('participantConnected', handleRoomEvent);
      room.on('participantDisconnected', handleRoomEvent);

      return () => {
        room.off('participantConnected', handleRoomEvent);
        room.off('participantDisconnected', handleRoomEvent);
      };
    }
  }, [room]);

  return (
    <div>
      <p>Room Connected: {!!room}</p>
      <p>Voice Connected: {state.isConnected}</p>
      <button onClick={handleJoinVoice}>
        Join Voice Channel
      </button>
    </div>
  );
}
```

## Implementation Details

### Internal State

The hook accesses the room context but doesn't manage state itself:

```typescript
const context = useContext(RoomContext);
if (!context) {
  throw new Error("useRoom must be used within a RoomProvider");
}
return context;
```

### Dependencies

#### Internal Hooks
- `useContext` - Accesses the RoomContext

#### External Dependencies
- `RoomContext` - React context that provides the room state and management functions
- `livekit-client` - LiveKit Room class and related types

## Context Provider Integration

### Room Provider Setup

The hook must be used within a RoomProvider:

```tsx
import { RoomProvider } from '@/contexts/RoomContext';

function App() {
  return (
    <RoomProvider>
      {/* Components that use useRoom */}
      <VoiceComponents />
    </RoomProvider>
  );
}
```

### Context Implementation

```typescript
// RoomContext.tsx
const RoomContext = createContext<RoomContextType | null>(null);

export function RoomProvider({ children }) {
  const [room, setRoom] = useState<Room | null>(null);
  
  const getRoom = useCallback(() => room, [room]);
  
  const value = useMemo(() => ({
    room,
    setRoom,
    getRoom,
  }), [room, getRoom]);

  return (
    <RoomContext.Provider value={value}>
      {children}
    </RoomContext.Provider>
  );
}
```

## LiveKit Room Management

### Room Lifecycle

```typescript
function RoomLifecycleManager() {
  const { room, setRoom } = useRoom();

  const createAndConnectRoom = async (url: string, token: string) => {
    const newRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
    });

    // Set up event listeners before connecting
    newRoom.on('participantConnected', (participant) => {
      console.log('Participant joined:', participant.identity);
    });

    newRoom.on('disconnected', () => {
      console.log('Room disconnected');
      setRoom(null);
    });

    try {
      await newRoom.connect(url, token);
      setRoom(newRoom);
      return newRoom;
    } catch (error) {
      await newRoom.disconnect();
      throw error;
    }
  };

  const disconnectRoom = async () => {
    if (room) {
      await room.disconnect();
      setRoom(null);
    }
  };

  return { createAndConnectRoom, disconnectRoom };
}
```

### Track Management

```typescript
function TrackManager() {
  const { getRoom } = useRoom();

  const publishAudioTrack = async (deviceId?: string) => {
    const room = getRoom();
    if (!room) return;

    const audioTrack = await createLocalAudioTrack({
      deviceId: deviceId ? { exact: deviceId } : undefined,
    });

    await room.localParticipant.publishTrack(audioTrack);
  };

  const publishVideoTrack = async (deviceId?: string) => {
    const room = getRoom();
    if (!room) return;

    const videoTrack = await createLocalVideoTrack({
      deviceId: deviceId ? { exact: deviceId } : undefined,
      resolution: VideoPresets.h720.resolution,
    });

    await room.localParticipant.publishTrack(videoTrack);
  };

  return { publishAudioTrack, publishVideoTrack };
}
```

## Error Handling

### Context Validation

```typescript
// Hook automatically throws if used outside provider
function ComponentUsingRoom() {
  try {
    const { room } = useRoom();
    // Safe to use room context here
  } catch (error) {
    // Handle "useRoom must be used within a RoomProvider" error
    return <div>Room context not available</div>;
  }
}
```

### Room State Validation

```typescript
function SafeRoomOperations() {
  const { room, getRoom } = useRoom();

  const safeRoomOperation = async () => {
    const currentRoom = getRoom();
    if (!currentRoom) {
      console.warn('No room available for operation');
      return;
    }

    if (currentRoom.state !== 'connected') {
      console.warn('Room not connected:', currentRoom.state);
      return;
    }

    // Safe to perform room operations here
    await currentRoom.localParticipant.setMicrophoneEnabled(true);
  };

  return <button onClick={safeRoomOperation}>Toggle Mic</button>;
}
```

## Performance Considerations

### Context Optimization

- **Stable References:** The context provides stable function references that don't change
- **Minimal Re-renders:** Only re-renders when room instance changes
- **Direct Access:** getRoom() provides direct access without causing re-renders

### Memory Management

```typescript
function RoomCleanup() {
  const { room, setRoom } = useRoom();

  useEffect(() => {
    // Clean up room on component unmount
    return () => {
      if (room) {
        room.disconnect();
        setRoom(null);
      }
    };
  }, []); // Empty dependency array - only on unmount

  // Component logic...
}
```

## Testing

### Test Examples

```typescript
import { renderHook } from '@testing-library/react-hooks';
import { useRoom } from '../useRoom';
import { RoomProvider } from '../../contexts/RoomContext';

describe('useRoom', () => {
  const wrapper = ({ children }) => (
    <RoomProvider>
      {children}
    </RoomProvider>
  );

  it('should provide room context', () => {
    const { result } = renderHook(() => useRoom(), { wrapper });
    
    expect(result.current).toHaveProperty('room');
    expect(result.current).toHaveProperty('setRoom');
    expect(result.current).toHaveProperty('getRoom');
  });

  it('should throw error when used outside provider', () => {
    const { result } = renderHook(() => useRoom());
    
    expect(result.error).toBeDefined();
    expect(result.error.message).toContain('useRoom must be used within a RoomProvider');
  });

  it('should allow setting and getting room', () => {
    const { result } = renderHook(() => useRoom(), { wrapper });
    const mockRoom = {} as Room;
    
    act(() => {
      result.current.setRoom(mockRoom);
    });
    
    expect(result.current.room).toBe(mockRoom);
    expect(result.current.getRoom()).toBe(mockRoom);
  });
});
```

## Common Patterns

### Pattern 1: Room Status Display

```tsx
function RoomStatusDisplay() {
  const { room } = useRoom();

  const getRoomStatus = () => {
    if (!room) return 'Disconnected';
    return room.state;
  };

  const getParticipantCount = () => {
    if (!room) return 0;
    return room.participants.size + 1; // +1 for local participant
  };

  return (
    <div className="room-status">
      <div>Status: {getRoomStatus()}</div>
      <div>Participants: {getParticipantCount()}</div>
      {room && (
        <div>Room ID: {room.name}</div>
      )}
    </div>
  );
}
```

### Pattern 2: Conditional Room Operations

```tsx
function ConditionalRoomControls() {
  const { room, getRoom } = useRoom();

  const performRoomAction = useCallback(async (action: string) => {
    const currentRoom = getRoom();
    if (!currentRoom || currentRoom.state !== 'connected') {
      console.warn(`Cannot perform ${action}: room not connected`);
      return;
    }

    switch (action) {
      case 'toggleAudio':
        await currentRoom.localParticipant.setMicrophoneEnabled(
          !currentRoom.localParticipant.isMicrophoneEnabled
        );
        break;
      case 'toggleVideo':
        await currentRoom.localParticipant.setCameraEnabled(
          !currentRoom.localParticipant.isCameraEnabled
        );
        break;
    }
  }, [getRoom]);

  if (!room) {
    return <div>Connect to a room first</div>;
  }

  return (
    <div>
      <button onClick={() => performRoomAction('toggleAudio')}>
        Toggle Audio
      </button>
      <button onClick={() => performRoomAction('toggleVideo')}>
        Toggle Video
      </button>
    </div>
  );
}
```

## Related Hooks

- **useVoiceConnection** - Uses this hook to manage LiveKit room instance
- **useDeviceSettings** - Often used together for device management in voice calls
- **useVoiceEvents** - Complements this hook for voice presence management

## Troubleshooting

### Common Issues

1. **"useRoom must be used within a RoomProvider" error**
   - **Symptoms:** Hook throws error when used
   - **Cause:** Component is not wrapped with RoomProvider
   - **Solution:** Ensure RoomProvider wraps the component tree

2. **Room operations fail silently**
   - **Symptoms:** Room methods don't work but don't throw errors
   - **Cause:** Room is null or not connected
   - **Solution:** Always check room state before operations

3. **Stale room references**
   - **Symptoms:** Operations use old room instance
   - **Cause:** Using direct room reference instead of getRoom()
   - **Solution:** Use getRoom() for dynamic access to current room

### Best Practices

- **Provider placement:** Place RoomProvider at appropriate level in component tree
- **Room validation:** Always validate room state before operations
- **Function preference:** Use getRoom() for accessing room in callbacks
- **Cleanup:** Always disconnect room when component unmounts

## Version History

- **1.0.0:** Initial implementation with basic room context
- **1.1.0:** Added getRoom function for dynamic access
- **1.2.0:** Improved error handling and TypeScript types

## Related Documentation

- [RoomContext](../../contexts/RoomContext.md)
- [useVoiceConnection Hook](./useVoiceConnection.md)
- [LiveKit Integration](../../api/livekit.md)
- [Voice Architecture](../../architecture/voice.md)