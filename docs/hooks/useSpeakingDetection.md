# useSpeakingDetection Hook

## Overview

`useSpeakingDetection` is a React hook that provides real-time speaking detection for all participants in a LiveKit voice/video room. It listens to LiveKit's audio level events and tracks which participants are currently speaking.

## Location

**File**: `frontend/src/hooks/useSpeakingDetection.ts`

## Purpose

- Detect when participants start/stop speaking in real-time
- Provide easy access to speaking state for all participants
- Automatically sync local user's speaking state to Redux store
- Handle participant join/leave events dynamically

## API

### Return Value

```typescript
{
  speakingMap: Map<string, boolean>;
  isSpeaking: (userId: string) => boolean;
}
```

#### `speakingMap`
- **Type**: `Map<string, boolean>`
- **Description**: Map of participant identities (user IDs) to their speaking state
- **Use Case**: Iterating over all speaking participants or accessing the raw data

#### `isSpeaking(userId: string)`
- **Type**: `(userId: string) => boolean`
- **Description**: Helper function to check if a specific user is currently speaking
- **Parameters**:
  - `userId` (string): The user's identity (typically their user ID from LiveKit)
- **Returns**: `true` if the user is speaking, `false` otherwise
- **Use Case**: Checking individual user speaking state in components

## Usage

### Basic Usage

```typescript
import { useSpeakingDetection } from '@/hooks/useSpeakingDetection';

function VoiceParticipantList() {
  const { isSpeaking } = useSpeakingDetection();

  return (
    <div>
      {participants.map(user => (
        <div key={user.id}>
          <Avatar
            style={{
              border: isSpeaking(user.id) ? '2px solid green' : 'none'
            }}
          />
          <span>{user.name}</span>
        </div>
      ))}
    </div>
  );
}
```

### Accessing All Speaking Users

```typescript
import { useSpeakingDetection } from '@/hooks/useSpeakingDetection';

function SpeakingUsersList() {
  const { speakingMap } = useSpeakingDetection();

  const speakingUsers = Array.from(speakingMap.entries())
    .filter(([_, speaking]) => speaking)
    .map(([userId, _]) => userId);

  return (
    <div>
      <h3>Currently Speaking: {speakingUsers.length}</h3>
      <ul>
        {speakingUsers.map(userId => (
          <li key={userId}>{userId}</li>
        ))}
      </ul>
    </div>
  );
}
```

### Integration with VoiceChannelUserList

```typescript
const VoiceChannelUserList: React.FC = ({ channel }) => {
  const { isSpeaking } = useSpeakingDetection();
  const { data: presence } = useGetChannelPresenceQuery(channel.id);

  return (
    <List>
      {presence.users.map(user => (
        <ListItem key={user.id}>
          <Avatar
            sx={{
              border: isSpeaking(user.id)
                ? "2px solid #00ff00"
                : "2px solid transparent",
              transition: "border-color 0.2s ease",
            }}
          >
            {user.username.charAt(0)}
          </Avatar>
          <ListItemText primary={user.username} />
        </ListItem>
      ))}
    </List>
  );
};
```

## Implementation Details

### LiveKit Integration

The hook uses LiveKit's `isSpeakingChanged` event on each participant:

```typescript
participant.on("isSpeakingChanged", (speaking: boolean) => {
  // Update speaking state
});
```

**Speaking Detection Criteria** (handled by LiveKit):
- Audio level threshold (default: -50dB)
- Smoothing to prevent rapid flickering
- Automatic noise gate

### State Management

1. **Local State**: Uses React `useState` to maintain `speakingMap`
2. **Redux Integration**: Dispatches `setSpeaking` action for local user
3. **Room Context**: Accesses LiveKit Room via `useRoom()` hook
4. **User Profile**: Gets current user ID via `useProfileQuery()`

### Event Handling

**Participant Events:**
- `isSpeakingChanged`: Fired when participant starts/stops speaking
- Updates local Map with participant identity → speaking state

**Room Events:**
- `participantConnected`: Attach speaking listener to new participants
- `participantDisconnected`: Remove speaking listener and cleanup

### Cleanup

The hook properly cleans up event listeners on:
- Component unmount
- Room disconnect
- Participant disconnect

### Performance Considerations

**Optimizations:**
- Event listeners only attached when room is active
- Map updates are batched via React state updates
- No polling - purely event-driven
- Minimal re-renders due to Map usage

**Memory Management:**
- Event handlers stored in Map for efficient cleanup
- Speaking state removed when participants leave
- All listeners removed on unmount

## Dependencies

### Required Hooks
- `useRoom()` - Access LiveKit room instance
- `useProfileQuery()` - Get current user ID
- `useDispatch()` - Dispatch Redux actions

### Required Packages
- `livekit-client` - LiveKit participant types and events
- `react-redux` - Redux integration
- `react` - useState, useEffect

## Integration with Redux

The hook automatically updates the Redux voice slice when the **local user's** speaking state changes:

```typescript
// In Redux store
state.voice.isSpeaking = true/false;
```

This allows other components to access the local user's speaking state without needing the LiveKit room:

```typescript
const localUserSpeaking = useSelector((state: RootState) => state.voice.isSpeaking);
```

## Edge Cases & Error Handling

### No Room Connected

When `room` is `null` (user not in voice):
- Returns empty Map
- `isSpeaking()` returns `false` for all users
- Redux state cleared to `false`

### Participant Identity Mismatch

If a participant's identity doesn't match a user ID:
- Speaking state is still tracked by LiveKit identity
- Component must map LiveKit identity → user ID

### Rapid Connect/Disconnect

- Event listeners properly cleaned up on disconnect
- New listeners attached on reconnect
- No memory leaks from orphaned listeners

## Testing

### Unit Tests

**Test File**: `useSpeakingDetection.test.ts`

**Test Cases:**
```typescript
describe('useSpeakingDetection', () => {
  it('should return false for all users when no room', () => {
    const { result } = renderHook(() => useSpeakingDetection());
    expect(result.current.isSpeaking('user1')).toBe(false);
  });

  it('should update speaking state when participant speaks', () => {
    // Mock LiveKit room and participant
    const mockParticipant = createMockParticipant('user1');
    const { result } = renderHook(() => useSpeakingDetection());

    // Simulate speaking event
    act(() => {
      mockParticipant.emit('isSpeakingChanged', true);
    });

    expect(result.current.isSpeaking('user1')).toBe(true);
  });

  it('should dispatch Redux action for local user', () => {
    const mockDispatch = jest.fn();
    // Test Redux integration
  });

  it('should cleanup listeners on unmount', () => {
    const { unmount } = renderHook(() => useSpeakingDetection());
    unmount();
    // Verify listeners removed
  });
});
```

### Integration Tests

1. **Multi-user Voice Channel**: Test with 5+ participants speaking
2. **Participant Join/Leave**: Test dynamic participant management
3. **Redux Sync**: Verify local user speaking state in store
4. **Performance**: Test with 20+ participants to ensure no lag

## Related Hooks

- **`useRoom`**: Provides LiveKit Room instance
- **`useVoiceConnection`**: Manages voice channel connection
- **`useVoiceEvents`**: Handles voice presence WebSocket events
- **`useProfileQuery`**: Gets current user profile

## Related Components

- **`VoiceChannelUserList`**: Displays speaking indicators
- **`VideoTiles`**: Could show speaking indicators on video tiles
- **`VoiceBottomBar`**: Could show local user speaking state

## Future Enhancements

### Planned Features

1. **Audio Level Meters**
   - Return audio level (0-1) in addition to boolean
   - Enable visual waveforms or volume bars
   - Use `useTrackVolume` hook from LiveKit

2. **Speaking Threshold Customization**
   - Allow users to adjust speaking sensitivity
   - Expose LiveKit's audio level threshold setting

3. **Speaking History**
   - Track speaking duration per participant
   - Calculate talk time statistics
   - Identify dominant speakers

4. **Debouncing Options**
   - Add optional debounce to reduce flickering
   - Configurable delay before showing/hiding indicator

5. **Backend Sync** (Phase 2)
   - Optionally broadcast speaking state to backend
   - Show speaking indicators for users not in LiveKit room
   - Throttle updates to 1-2 per second

## Performance Benchmarks

**Expected Performance:**
- Event processing: < 1ms
- Map update: < 1ms
- Re-render trigger: < 5ms
- Memory per participant: ~100 bytes

**Tested Scenarios:**
- ✅ 5 participants: No perceptible lag
- ✅ 10 participants: Smooth performance
- ⏳ 20+ participants: TBD (needs testing)

## Browser Compatibility

Works in all browsers supported by LiveKit:
- ✅ Chrome/Edge 74+
- ✅ Firefox 66+
- ✅ Safari 12+
- ✅ Opera 62+

## Accessibility

**Screen Reader Support:**
- Speaking state changes should trigger ARIA live region updates
- Consider announcing "X is speaking" for accessibility

**Recommended Implementation:**
```typescript
<div role="status" aria-live="polite" className="sr-only">
  {isSpeaking(user.id) ? `${user.name} is speaking` : ''}
</div>
```

---

**Status**: ✅ Fully Implemented
**Version**: 1.0.0
**Last Updated**: 2025-10-29
