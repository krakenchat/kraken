# useVoiceEvents

> **Location:** `frontend/src/hooks/useVoiceEvents.ts`  
> **Type:** Effect Hook  
> **Category:** voice

## Overview

A specialized effect hook that manages WebSocket event listeners for voice channel presence updates. It synchronizes voice participant data between WebSocket events and both Redux state and RTK Query cache, ensuring consistent real-time voice presence across the application. This hook is automatically used by `useVoiceConnection` to maintain voice channel participant lists.

## Hook Signature

```typescript
function useVoiceEvents(): void
```

### Parameters

This hook takes no parameters.

### Return Value

This hook returns nothing (`void`). It operates purely through side effects.

## Usage Examples

### Basic Usage (Internal)

```tsx
// This hook is typically used internally by useVoiceConnection
import { useVoiceEvents } from '@/hooks/useVoiceEvents';

function VoiceConnectionHandler() {
  useVoiceEvents(); // Sets up voice event listeners
  
  // Hook handles all voice presence updates automatically
  return null; // This component just manages side effects
}
```

### Manual Usage (Advanced)

```tsx
import { useVoiceEvents } from '@/hooks/useVoiceEvents';
import { useSelector } from 'react-redux';

function VoicePresenceDisplay() {
  useVoiceEvents(); // Set up voice event listeners
  
  const currentChannelId = useSelector(state => state.voice.currentChannelId);
  const participants = useSelector(state => state.voice.participants);
  
  if (!currentChannelId) {
    return <div>Not in a voice channel</div>;
  }

  return (
    <div className="voice-presence">
      <h4>Voice Participants ({participants.length})</h4>
      {participants.map(participant => (
        <div key={participant.id} className="participant">
          <span>{participant.displayName || participant.username}</span>
          <div className="participant-status">
            {participant.isMuted && <span>🔇</span>}
            {participant.isDeafened && <span>🔇🎧</span>}
            {participant.isVideoEnabled && <span>📹</span>}
            {participant.isScreenSharing && <span>🖥️</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Integration with RTK Query

```tsx
function VoiceChannelWithPresence({ channelId }) {
  useVoiceEvents(); // Keeps RTK Query cache in sync
  
  // RTK Query automatically stays updated via the hook's cache updates
  const { data: presence, isLoading } = useGetChannelPresenceQuery(channelId);
  
  if (isLoading) return <div>Loading presence...</div>;
  
  return (
    <div>
      <h3>Channel Presence</h3>
      <p>Active users: {presence?.count || 0}</p>
      {presence?.users.map(user => (
        <UserPresenceItem key={user.id} user={user} />
      ))}
    </div>
  );
}
```

## Implementation Details

### Internal State

The hook doesn't manage local state but accesses Redux state:

```typescript
const dispatch = useDispatch<AppDispatch>();
const socket = useSocket();
const currentChannelId = useSelector((state: RootState) => state.voice.currentChannelId);
```

### Dependencies

#### Internal Hooks
- `useEffect` - Sets up and tears down WebSocket event listeners
- `useSelector` - Accesses current voice channel ID from Redux
- `useDispatch` - Dispatches Redux actions for state updates
- `useSocket` - Gets WebSocket instance for event handling

#### External Dependencies
- `socket.io-client` - WebSocket event handling
- `react-redux` - Redux state management
- Voice presence API slice for cache updates

## WebSocket Event Handling

### Event Listeners

The hook sets up listeners for three voice presence events:

```typescript
// User joins voice channel
socket.on(ServerEvents.VOICE_CHANNEL_USER_JOINED, handleUserJoined);

// User leaves voice channel  
socket.on(ServerEvents.VOICE_CHANNEL_USER_LEFT, handleUserLeft);

// User updates voice state (mute, video, etc.)
socket.on(ServerEvents.VOICE_CHANNEL_USER_UPDATED, handleUserUpdated);
```

### Event Handlers

#### User Joined Handler

```typescript
const handleUserJoined = (data: { channelId: string; user: VoicePresenceUser }) => {
  if (data.channelId === currentChannelId) {
    // Update Redux state
    dispatch(updateParticipant(data.user));
    
    // Update RTK Query cache
    dispatch(
      voicePresenceApi.util.updateQueryData('getChannelPresence', data.channelId, (draft) => {
        const existingIndex = draft.users.findIndex(u => u.id === data.user.id);
        if (existingIndex === -1) {
          draft.users.push(data.user);
          draft.count = draft.users.length;
        }
      })
    );
  }
};
```

#### User Left Handler

```typescript
const handleUserLeft = (data: { channelId: string; userId: string }) => {
  if (data.channelId === currentChannelId) {
    // Remove from Redux state
    dispatch(removeParticipant(data.userId));
    
    // Remove from RTK Query cache
    dispatch(
      voicePresenceApi.util.updateQueryData('getChannelPresence', data.channelId, (draft) => {
        const index = draft.users.findIndex(u => u.id === data.userId);
        if (index !== -1) {
          draft.users.splice(index, 1);
          draft.count = draft.users.length;
        }
      })
    );
  }
};
```

#### User Updated Handler

```typescript
const handleUserUpdated = (data: { channelId: string; user: VoicePresenceUser }) => {
  if (data.channelId === currentChannelId) {
    // Update Redux state
    dispatch(updateParticipant(data.user));
    
    // Update RTK Query cache with complete user object
    dispatch(
      voicePresenceApi.util.updateQueryData('getChannelPresence', data.channelId, (draft) => {
        const index = draft.users.findIndex(u => u.id === data.user.id);
        if (index !== -1) {
          // IMPORTANT: Replace the entire user object to preserve all fields
          draft.users[index] = data.user;
        }
      })
    );
  }
};
```

## Redux and Cache Integration

### Dual State Management

The hook maintains consistency between two data sources:

1. **Redux State** - For immediate UI updates and local component state
2. **RTK Query Cache** - For API query consistency and background sync

### Cache Update Strategy

```typescript
// Updates both Redux state and RTK Query cache simultaneously
dispatch(updateParticipant(data.user)); // Redux
dispatch(voicePresenceApi.util.updateQueryData(...)); // RTK Query cache
```

### Channel Filtering

Events are filtered by current channel to prevent cross-channel pollution:

```typescript
if (data.channelId === currentChannelId) {
  // Only process events for the current voice channel
}
```

## Side Effects

### Effect Dependencies

```typescript
useEffect(() => {
  if (!socket || !currentChannelId) return;
  
  // Set up event listeners only when both socket and channelId are available
  socket.on(ServerEvents.VOICE_CHANNEL_USER_JOINED, handleUserJoined);
  socket.on(ServerEvents.VOICE_CHANNEL_USER_LEFT, handleUserLeft);
  socket.on(ServerEvents.VOICE_CHANNEL_USER_UPDATED, handleUserUpdated);
  
  return () => {
    // Clean up event listeners
    socket.off(ServerEvents.VOICE_CHANNEL_USER_JOINED, handleUserJoined);
    socket.off(ServerEvents.VOICE_CHANNEL_USER_LEFT, handleUserLeft);
    socket.off(ServerEvents.VOICE_CHANNEL_USER_UPDATED, handleUserUpdated);
  };
}, [socket, currentChannelId, dispatch]); // Re-setup when dependencies change
```

### Cleanup

Proper cleanup is essential to prevent memory leaks and duplicate listeners:

```typescript
return () => {
  // Remove all event listeners when effect cleans up
  socket.off(ServerEvents.VOICE_CHANNEL_USER_JOINED, handleUserJoined);
  socket.off(ServerEvents.VOICE_CHANNEL_USER_LEFT, handleUserLeft);
  socket.off(ServerEvents.VOICE_CHANNEL_USER_UPDATED, handleUserUpdated);
};
```

## Performance Considerations

### Optimization Notes

- **Channel Filtering:** Only processes events for the current voice channel
- **Conditional Setup:** Only sets up listeners when socket and channel are available
- **Efficient Updates:** Uses targeted Redux actions and RTK Query cache updates
- **Memory Management:** Properly cleans up event listeners to prevent leaks

### Event Handler Stability

Event handlers are stable references that don't change between renders, preventing unnecessary listener re-registration.

## Voice Presence Data Structure

### VoicePresenceUser Interface

```typescript
interface VoicePresenceUser {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  isMuted?: boolean;
  isDeafened?: boolean;
  isVideoEnabled?: boolean;
  isScreenSharing?: boolean;
  joinedAt: string;
}
```

### Presence Update Events

```typescript
// Server events that trigger presence updates
type VoicePresenceEvents = {
  VOICE_CHANNEL_USER_JOINED: { channelId: string; user: VoicePresenceUser };
  VOICE_CHANNEL_USER_LEFT: { channelId: string; userId: string };
  VOICE_CHANNEL_USER_UPDATED: { channelId: string; user: VoicePresenceUser };
};
```

## Error Handling

### Safe Event Processing

```typescript
const handleUserJoined = (data: { channelId: string; user: VoicePresenceUser }) => {
  try {
    if (data.channelId === currentChannelId && data.user) {
      // Process event only with valid data
      dispatch(updateParticipant(data.user));
      // Update cache...
    }
  } catch (error) {
    console.error('Error handling user joined event:', error, data);
  }
};
```

### Data Validation

```typescript
// Validate event data before processing
if (!data.channelId || !data.user || !data.user.id) {
  console.warn('Invalid voice presence event data:', data);
  return;
}
```

## Testing

### Test Examples

```typescript
import { renderHook } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { useVoiceEvents } from '../useVoiceEvents';
import { store } from '../../app/store';

describe('useVoiceEvents', () => {
  let mockSocket;
  let mockDispatch;
  
  beforeEach(() => {
    mockSocket = {
      on: jest.fn(),
      off: jest.fn(),
    };
    mockDispatch = jest.fn();
  });

  const wrapper = ({ children }) => (
    <Provider store={store}>
      <MockSocketProvider socket={mockSocket}>
        {children}
      </MockSocketProvider>
    </Provider>
  );

  it('should set up voice event listeners when socket and channel are available', () => {
    const { result } = renderHook(() => useVoiceEvents(), { wrapper });
    
    expect(mockSocket.on).toHaveBeenCalledWith('VOICE_CHANNEL_USER_JOINED', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('VOICE_CHANNEL_USER_LEFT', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('VOICE_CHANNEL_USER_UPDATED', expect.any(Function));
  });

  it('should clean up event listeners on unmount', () => {
    const { unmount } = renderHook(() => useVoiceEvents(), { wrapper });
    
    unmount();
    
    expect(mockSocket.off).toHaveBeenCalledWith('VOICE_CHANNEL_USER_JOINED', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('VOICE_CHANNEL_USER_LEFT', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('VOICE_CHANNEL_USER_UPDATED', expect.any(Function));
  });
});
```

## Common Patterns

### Pattern 1: Automatic Integration

```tsx
// Most common usage - integrated into voice connection hook
function useVoiceConnection() {
  useVoiceEvents(); // Automatically handles presence updates
  
  // Rest of voice connection logic...
  return { state, actions };
}
```

### Pattern 2: Voice Participant Display

```tsx
function VoiceParticipantsList() {
  useVoiceEvents(); // Ensure events are handled
  
  const participants = useSelector(state => state.voice.participants);
  const currentChannelName = useSelector(state => state.voice.currentChannelName);
  
  return (
    <div className="participants-list">
      <h4>{currentChannelName} - {participants.length} participants</h4>
      {participants.map(participant => (
        <div key={participant.id} className="participant-item">
          <Avatar user={participant} />
          <span>{participant.displayName || participant.username}</span>
          <VoiceStatusIcons user={participant} />
        </div>
      ))}
    </div>
  );
}
```

## Related Hooks

- **useVoiceConnection** - Primary voice hook that uses this hook internally
- **useSocket** - Provides WebSocket instance for event handling
- **useSelector/useDispatch** - Redux integration for state management
- **useGetChannelPresenceQuery** - RTK Query hook that benefits from cache updates

## Troubleshooting

### Common Issues

1. **Participants not updating**
   - **Symptoms:** Voice participant list doesn't reflect real-time changes
   - **Cause:** Socket not connected or currentChannelId is null
   - **Solution:** Ensure voice connection is established and channel ID is set

2. **Duplicate participants**
   - **Symptoms:** Same user appears multiple times in participant list
   - **Cause:** Event listeners not properly cleaned up or duplicate registrations
   - **Solution:** Check for proper cleanup in useEffect dependencies

3. **Cache and Redux out of sync**
   - **Symptoms:** RTK Query data differs from Redux state
   - **Cause:** Only updating one data source or event handling errors
   - **Solution:** Ensure both Redux dispatch and cache update are called for each event

### Best Practices

- **Single usage:** This hook should only be used once per voice context
- **Dependency management:** Ensure proper useEffect dependencies to prevent stale closures  
- **Error boundaries:** Wrap components using this hook in error boundaries
- **Testing:** Mock WebSocket events in tests to verify proper state updates

## Version History

- **1.0.0:** Initial implementation with basic presence event handling
- **1.1.0:** Added RTK Query cache synchronization
- **1.2.0:** Improved error handling and data validation
- **1.3.0:** Enhanced channel filtering and memory management

## Related Documentation

- [useVoiceConnection Hook](./useVoiceConnection.md)
- [Voice Presence API](../../api/voice-presence.md)
- [Voice Slice](../../features/voice-slice.md)
- [WebSocket Events](../../api/websocket-events.md)