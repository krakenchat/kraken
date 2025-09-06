# Voice Presence Redux API Slice

> **Location:** `frontend/src/features/voice-presence/voicePresenceApiSlice.ts`  
> **Type:** RTK Query API  
> **Domain:** Voice channel presence and state management

## Overview

The Voice Presence API slice manages user presence in voice channels, including who is currently in voice channels, their audio/video states, and voice-related actions. It integrates with LiveKit for actual voice/video communication while maintaining server-side presence tracking for UI consistency and cross-session awareness.

## API Configuration

```typescript
export const voicePresenceApi = createApi({
  reducerPath: "voicePresenceApi",
  baseQuery: getBaseAuthedQuery(
    fetchBaseQuery({
      baseUrl: "/api",
      prepareHeaders,
    })
  ),
  tagTypes: ["VoicePresence"],
  endpoints: (builder) => ({
    // Endpoints defined below
  }),
});
```

### Base Configuration
- **Reducer Path:** `voicePresenceApi`
- **Base Query:** `getBaseAuthedQuery` (includes JWT authentication and token refresh)
- **Base URL:** `/api` (uses multiple endpoints under different routes)
- **Tag Types:** `["VoicePresence"]`

## Endpoints

### Query Endpoints (Data Fetching)

#### getChannelPresence
```typescript
getChannelPresence: builder.query<ChannelPresenceResponse, string>({
  query: (channelId) => ({
    url: `/channels/${channelId}/voice-presence`,
    method: "GET",
  }),
  providesTags: (result, error, channelId) => [
    { type: "VoicePresence", id: channelId },
  ],
})
```

**Purpose:** Fetches current voice presence information for a specific voice channel.

**Usage:**
```typescript
const { 
  data: channelPresence, 
  error, 
  isLoading,
  refetch 
} = useVoicePresenceApi.useGetChannelPresenceQuery(channelId, {
  skip: !channelId,
  pollingInterval: 10000, // Poll every 10 seconds for real-time updates
});
```

#### getMyVoiceChannels
```typescript
getMyVoiceChannels: builder.query<UserVoiceChannelsResponse, void>({
  query: () => ({
    url: `/voice-presence/me`,
    method: "GET",
  }),
})
```

**Purpose:** Fetches all voice channels the current user is currently connected to.

**Usage:**
```typescript
const { 
  data: myVoiceChannels, 
  error, 
  isLoading 
} = useVoicePresenceApi.useGetMyVoiceChannelsQuery();
```

### Mutation Endpoints (Voice Actions)

#### joinVoiceChannel
```typescript
joinVoiceChannel: builder.mutation<VoiceActionResponse, string>({
  query: (channelId) => ({
    url: `/channels/${channelId}/voice-presence/join`,
    method: "POST",
  }),
  invalidatesTags: (result, error, channelId) => [
    { type: "VoicePresence", id: channelId },
  ],
})
```

**Purpose:** Joins a voice channel and updates server-side presence.

**Usage:**
```typescript
const [joinVoiceChannel, { isLoading, error }] = useVoicePresenceApi.useJoinVoiceChannelMutation();

const handleJoinVoice = async (channelId: string) => {
  try {
    const result = await joinVoiceChannel(channelId).unwrap();
    // Voice connection established, now connect to LiveKit
    await connectToLiveKitRoom(channelId);
  } catch (err) {
    console.error('Failed to join voice channel:', err);
  }
};
```

#### leaveVoiceChannel
```typescript
leaveVoiceChannel: builder.mutation<VoiceActionResponse, string>({
  query: (channelId) => ({
    url: `/channels/${channelId}/voice-presence/leave`,
    method: "DELETE",
  }),
  invalidatesTags: (result, error, channelId) => [
    { type: "VoicePresence", id: channelId },
  ],
})
```

**Purpose:** Leaves a voice channel and updates server-side presence.

**Usage:**
```typescript
const [leaveVoiceChannel, { isLoading }] = useVoicePresenceApi.useLeaveVoiceChannelMutation();

const handleLeaveVoice = async (channelId: string) => {
  try {
    // Disconnect from LiveKit first
    await disconnectFromLiveKitRoom();
    // Then update server presence
    await leaveVoiceChannel(channelId).unwrap();
  } catch (err) {
    console.error('Failed to leave voice channel:', err);
  }
};
```

#### updateVoiceState
```typescript
updateVoiceState: builder.mutation<
  VoiceActionResponse,
  { channelId: string; updates: VoiceStateUpdate }
>({
  query: ({ channelId, updates }) => ({
    url: `/channels/${channelId}/voice-presence/state`,
    method: "PUT",
    body: updates,
  }),
  onQueryStarted: async ({ channelId, updates }, { dispatch, queryFulfilled, getState }) => {
    // Optimistic update logic for immediate UI feedback
    const state = getState() as RootState;
    const profileQueryState = state.usersApi?.queries?.[`profile(undefined)`];
    const currentUserId = profileQueryState?.data?.id;
    
    const patchResult = dispatch(
      voicePresenceApi.util.updateQueryData('getChannelPresence', channelId, (draft) => {
        if (currentUserId) {
          const userIndex = draft.users.findIndex(user => user.id === currentUserId);
          if (userIndex !== -1) {
            const existingUser = draft.users[userIndex];
            const updatedUser = {
              ...existingUser,
              ...updates,
              // Preserve existing values for undefined updates
              isMuted: updates.isMuted !== undefined ? updates.isMuted : existingUser.isMuted,
              isDeafened: updates.isDeafened !== undefined ? updates.isDeafened : existingUser.isDeafened,
              isVideoEnabled: updates.isVideoEnabled !== undefined ? updates.isVideoEnabled : existingUser.isVideoEnabled,
              isScreenSharing: updates.isScreenSharing !== undefined ? updates.isScreenSharing : existingUser.isScreenSharing,
            };
            draft.users[userIndex] = updatedUser;
          }
        }
      })
    );
    
    try {
      await queryFulfilled;
    } catch (error) {
      patchResult.undo();
      throw error;
    }
  },
})
```

**Purpose:** Updates the user's voice state (muted, deafened, video enabled, screen sharing).

**Usage:**
```typescript
const [updateVoiceState, { isLoading }] = useVoicePresenceApi.useUpdateVoiceStateMutation();

const handleToggleMute = async (channelId: string, isMuted: boolean) => {
  try {
    await updateVoiceState({
      channelId,
      updates: { isMuted }
    }).unwrap();
  } catch (err) {
    console.error('Failed to update mute state:', err);
  }
};
```

#### refreshPresence
```typescript
refreshPresence: builder.mutation<VoiceActionResponse, string>({
  query: (channelId) => ({
    url: `/channels/${channelId}/voice-presence/refresh`,
    method: "POST",
  }),
})
```

**Purpose:** Refreshes voice presence data (useful for recovering from connection issues).

## Type Definitions

### Request Types

```typescript
interface VoiceStateUpdate {
  isVideoEnabled?: boolean;
  isScreenSharing?: boolean;
  isMuted?: boolean;
  isDeafened?: boolean;
}
```

### Response Types

```typescript
interface VoicePresenceUser {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  joinedAt: string;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isMuted: boolean;
  isDeafened: boolean;
}

interface ChannelPresenceResponse {
  channelId: string;
  users: VoicePresenceUser[];
  count: number;
}

interface UserVoiceChannelsResponse {
  userId: string;
  voiceChannels: string[];
}

interface VoiceActionResponse {
  success: boolean;
  message: string;
  channelId: string;
}
```

## Caching Strategy

### Cache Tags

```typescript
tagTypes: ["VoicePresence"]

// Tagging patterns:
// - Channel presence: { type: "VoicePresence", id: channelId }
```

### Cache Invalidation

| Action | Invalidates | Reason |
|--------|-------------|---------|
| Join Voice Channel | Channel-specific presence tag | New user affects channel presence |
| Leave Voice Channel | Channel-specific presence tag | User leaving affects channel presence |
| Update Voice State | Uses optimistic updates instead of invalidation | Real-time feedback without server roundtrip |

### Optimistic Updates

The `updateVoiceState` mutation implements sophisticated optimistic updates:
- Immediately updates UI with new voice state
- Preserves existing state for fields not being updated
- Reverts changes if the server request fails
- Provides instant feedback for mute/video toggles

## State Management

### Generated Hooks

```typescript
export const {
  // Query hooks
  useGetChannelPresenceQuery,
  useGetMyVoiceChannelsQuery,
  
  // Mutation hooks  
  useJoinVoiceChannelMutation,
  useLeaveVoiceChannelMutation,
  useUpdateVoiceStateMutation,
  useRefreshPresenceMutation,
  
  // Utility hooks
  usePrefetch,
} = voicePresenceApi;
```

### Integration with Voice Slice

Voice presence works closely with the voice Redux slice for local state management:

```typescript
// Voice presence API updates server state
await updateVoiceState({ channelId, updates: { isMuted: true } });

// Voice slice manages local UI state
dispatch(setMuted(true));
```

## WebSocket Integration

### Real-time Presence Updates

```typescript
// Listen for voice presence updates
useWebSocket('VOICE_STATE_UPDATED', (voiceUpdate) => {
  dispatch(voicePresenceApi.util.updateQueryData(
    'getChannelPresence',
    voiceUpdate.channelId,
    (draft) => {
      const userIndex = draft.users.findIndex(u => u.id === voiceUpdate.userId);
      if (userIndex !== -1) {
        draft.users[userIndex] = { ...draft.users[userIndex], ...voiceUpdate.state };
      }
    }
  ));
});

// Listen for users joining voice
useWebSocket('USER_JOINED_VOICE', (joinData) => {
  dispatch(voicePresenceApi.util.updateQueryData(
    'getChannelPresence',
    joinData.channelId,
    (draft) => {
      draft.users.push(joinData.user);
      draft.count = draft.users.length;
    }
  ));
});

// Listen for users leaving voice
useWebSocket('USER_LEFT_VOICE', (leaveData) => {
  dispatch(voicePresenceApi.util.updateQueryData(
    'getChannelPresence',
    leaveData.channelId,
    (draft) => {
      draft.users = draft.users.filter(u => u.id !== leaveData.userId);
      draft.count = draft.users.length;
    }
  ));
});
```

## Component Integration

### Voice Channel User List

```typescript
import { useVoicePresenceApi } from '@/features/voice-presence/voicePresenceApiSlice';

function VoiceChannelUserList({ channelId }: { channelId: string }) {
  const { 
    data: presence, 
    error, 
    isLoading 
  } = useVoicePresenceApi.useGetChannelPresenceQuery(channelId, {
    pollingInterval: 15000, // Poll every 15 seconds as fallback
  });

  if (isLoading) return <div>Loading voice users...</div>;
  if (error) return <div>Error loading voice users</div>;
  if (!presence || presence.users.length === 0) return <div>No users in voice</div>;

  return (
    <div className="voice-user-list">
      <h4>In Voice ({presence.count})</h4>
      {presence.users.map(user => (
        <VoiceUserItem key={user.id} user={user} />
      ))}
    </div>
  );
}

function VoiceUserItem({ user }: { user: VoicePresenceUser }) {
  return (
    <div className="voice-user-item">
      <img 
        src={user.avatarUrl || '/default-avatar.png'} 
        alt={user.username}
        className="user-avatar"
      />
      <div className="user-info">
        <span className="username">{user.displayName || user.username}</span>
        <div className="voice-indicators">
          {user.isMuted && <span className="muted-indicator">🔇</span>}
          {user.isDeafened && <span className="deafened-indicator">🔈</span>}
          {user.isVideoEnabled && <span className="video-indicator">📹</span>}
          {user.isScreenSharing && <span className="screen-share-indicator">🖥️</span>}
        </div>
      </div>
    </div>
  );
}
```

### Voice Controls Component

```typescript
function VoiceControls({ channelId }: { channelId: string }) {
  const [updateVoiceState, { isLoading }] = useVoicePresenceApi.useUpdateVoiceStateMutation();
  const [leaveVoiceChannel] = useVoicePresenceApi.useLeaveVoiceChannelMutation();
  
  // Get current voice state from Redux slice
  const voiceState = useSelector((state: RootState) => state.voice);
  const dispatch = useAppDispatch();

  const handleToggleMute = async () => {
    const newMuteState = !voiceState.isMuted;
    
    // Update local state immediately
    dispatch(setMuted(newMuteState));
    
    try {
      await updateVoiceState({
        channelId,
        updates: { isMuted: newMuteState }
      }).unwrap();
    } catch (err) {
      // Revert local state on error
      dispatch(setMuted(voiceState.isMuted));
      console.error('Failed to update mute state:', err);
    }
  };

  const handleToggleDeafen = async () => {
    const newDeafenState = !voiceState.isDeafened;
    
    dispatch(setDeafened(newDeafenState));
    
    try {
      await updateVoiceState({
        channelId,
        updates: { isDeafened: newDeafenState }
      }).unwrap();
    } catch (err) {
      dispatch(setDeafened(voiceState.isDeafened));
      console.error('Failed to update deafen state:', err);
    }
  };

  const handleToggleVideo = async () => {
    const newVideoState = !voiceState.isVideoEnabled;
    
    dispatch(setVideoEnabled(newVideoState));
    
    try {
      await updateVoiceState({
        channelId,
        updates: { isVideoEnabled: newVideoState }
      }).unwrap();
    } catch (err) {
      dispatch(setVideoEnabled(voiceState.isVideoEnabled));
      console.error('Failed to update video state:', err);
    }
  };

  const handleLeaveVoice = async () => {
    try {
      await leaveVoiceChannel(channelId).unwrap();
      dispatch(setDisconnected());
    } catch (err) {
      console.error('Failed to leave voice:', err);
    }
  };

  return (
    <div className="voice-controls">
      <button 
        onClick={handleToggleMute}
        className={`control-btn ${voiceState.isMuted ? 'active' : ''}`}
        disabled={isLoading}
      >
        {voiceState.isMuted ? '🔇' : '🎤'}
      </button>
      
      <button 
        onClick={handleToggleDeafen}
        className={`control-btn ${voiceState.isDeafened ? 'active' : ''}`}
        disabled={isLoading}
      >
        {voiceState.isDeafened ? '🔈' : '🔊'}
      </button>
      
      <button 
        onClick={handleToggleVideo}
        className={`control-btn ${voiceState.isVideoEnabled ? 'active' : ''}`}
        disabled={isLoading}
      >
        {voiceState.isVideoEnabled ? '📹' : '📷'}
      </button>
      
      <button 
        onClick={handleLeaveVoice}
        className="control-btn leave-btn"
      >
        📞
      </button>
    </div>
  );
}
```

## Performance Optimization

### Polling vs WebSocket Strategy

```typescript
// Use polling as fallback with WebSocket as primary
const { data: presence } = useGetChannelPresenceQuery(channelId, {
  pollingInterval: webSocketConnected ? 0 : 10000, // Only poll when WebSocket disconnected
});
```

### Selective Re-rendering

```typescript
// Only re-render when specific presence data changes
const { userCount, currentUserState } = useGetChannelPresenceQuery(channelId, {
  selectFromResult: ({ data, ...other }) => ({
    ...other,
    userCount: data?.count || 0,
    currentUserState: data?.users.find(u => u.id === currentUserId)
  }),
});
```

### Optimistic Updates for Voice Controls

The voice controls provide immediate visual feedback while the server request is processing:

1. Update local Redux state immediately
2. Send server request
3. Revert local state if server request fails

This ensures responsive UI even with network latency.

## Error Handling

### Voice Action Errors

```typescript
const [joinVoiceChannel, { error }] = useJoinVoiceChannelMutation();

const handleJoinVoice = async (channelId: string) => {
  try {
    await joinVoiceChannel(channelId).unwrap();
  } catch (err: any) {
    if (err.status === 403) {
      setError("You don't have permission to join this voice channel");
    } else if (err.status === 409) {
      setError("You're already connected to a voice channel");
    } else {
      setError("Failed to join voice channel");
    }
  }
};
```

### Presence Sync Issues

```typescript
// Handle presence desync with refresh
const [refreshPresence] = useRefreshPresenceMutation();

const handlePresenceSync = async (channelId: string) => {
  try {
    await refreshPresence(channelId).unwrap();
    // Refetch presence data
    refetch();
  } catch (err) {
    console.error('Failed to refresh presence:', err);
  }
};
```

## Testing

### Optimistic Update Testing

```typescript
describe('updateVoiceState optimistic updates', () => {
  it('should optimistically update mute state', async () => {
    const { result } = renderHook(
      () => useUpdateVoiceStateMutation(),
      { wrapper: TestProvider }
    );

    // Mock current presence data
    const mockPresence = {
      channelId: 'channel-123',
      users: [{ id: 'user-123', isMuted: false }],
      count: 1
    };

    // Trigger optimistic update
    act(() => {
      result.current[0]({
        channelId: 'channel-123',
        updates: { isMuted: true }
      });
    });

    // Verify optimistic update applied
    const updatedCache = store.getState().voicePresenceApi.queries[
      'getChannelPresence("channel-123")'
    ];
    
    expect(updatedCache.data.users[0].isMuted).toBe(true);
  });
});
```

## Related Documentation

- [Voice Slice](./voiceSlice.md) - Local voice state management
- [LiveKit API](./livekitApi.md) - WebRTC connection management
- [Channel API](./channelApi.md) - Voice channel creation and management
- [Voice Components](../components/voice/) - Voice UI components
- [Voice Persistence](../features/voice-persistence.md) - Cross-navigation voice connection
- [WebSocket Events](../api/websocket-events.md) - Real-time voice presence events