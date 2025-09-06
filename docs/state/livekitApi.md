# LiveKit Redux API Slice

> **Location:** `frontend/src/features/livekit/livekitApiSlice.ts`  
> **Type:** RTK Query API  
> **Domain:** WebRTC token generation and connection management

## Overview

The LiveKit API slice provides the bridge between Kraken's authentication system and LiveKit's WebRTC infrastructure. It handles secure token generation for LiveKit room connections and provides connection information for the LiveKit client. This API is essential for establishing voice and video connections in voice channels.

## API Configuration

```typescript
export const livekitApi = createApi({
  reducerPath: "livekitApi",
  baseQuery: getBaseAuthedQuery(
    fetchBaseQuery({
      baseUrl: "/api/livekit",
      prepareHeaders,
    })
  ),
  endpoints: (builder) => ({
    // Endpoints defined below
  }),
});
```

### Base Configuration
- **Reducer Path:** `livekitApi`
- **Base Query:** `getBaseAuthedQuery` (includes JWT authentication and token refresh)
- **Base URL:** `/api/livekit`
- **Tag Types:** None (tokens are short-lived and don't require caching)

## Endpoints

### Mutation Endpoints

#### generateToken
```typescript
generateToken: builder.mutation<TokenResponse, CreateTokenRequest>({
  query: (body) => ({
    url: "/token",
    method: "POST",
    body,
  }),
})
```

**Purpose:** Generates a LiveKit access token for joining a specific room with defined permissions.

**Usage:**
```typescript
const [generateToken, { isLoading, error }] = useLivekitApi.useGenerateTokenMutation();

const handleJoinVoiceChannel = async (channelId: string) => {
  try {
    const { token } = await generateToken({
      roomId: channelId, // Channel ID serves as room ID
      identity: user.id,
      name: user.displayName || user.username,
      ttl: 3600 // 1 hour token validity
    }).unwrap();
    
    // Use token to connect to LiveKit room
    await room.connect(livekitUrl, token);
  } catch (err) {
    console.error('Failed to generate LiveKit token:', err);
  }
};
```

### Query Endpoints

#### getConnectionInfo
```typescript
getConnectionInfo: builder.query<ConnectionInfo, void>({
  query: () => ({
    url: "/connection-info",
    method: "GET",
  }),
})
```

**Purpose:** Retrieves LiveKit server connection information including WebSocket URL.

**Usage:**
```typescript
const { 
  data: connectionInfo, 
  error, 
  isLoading 
} = useLivekitApi.useGetConnectionInfoQuery();

// Use connection info to establish LiveKit connection
const livekitUrl = connectionInfo?.url;
```

## Type Definitions

### Request Types

```typescript
interface CreateTokenRequest {
  roomId: string;         // Channel ID used as LiveKit room ID
  identity?: string;      // User ID for LiveKit identity
  name?: string;          // Display name for LiveKit participant
  ttl?: number;           // Token time-to-live in seconds (default: 1 hour)
}
```

### Response Types

```typescript
interface TokenResponse {
  token: string;          // JWT token for LiveKit room access
}

interface ConnectionInfo {
  url: string;            // LiveKit server WebSocket URL
}
```

## Token Management Strategy

### Security Considerations

The LiveKit API implements several security measures:

- **Authentication Required:** All requests require valid JWT authentication
- **Short-lived Tokens:** LiveKit tokens have limited TTL (typically 1 hour)
- **Room-specific Access:** Tokens are generated for specific channels/rooms
- **Identity Mapping:** User identity is mapped from authenticated session

### Token Lifecycle

```typescript
// 1. User requests to join voice channel
// 2. Generate LiveKit token with channel as room ID
const { token } = await generateToken({
  roomId: channelId,
  identity: user.id,
  name: user.displayName || user.username
});

// 3. Use token to connect to LiveKit
await room.connect(livekitUrl, token);

// 4. Token automatically expires after TTL
// 5. Reconnection requires new token generation
```

## State Management

### Generated Hooks

```typescript
export const { 
  // Mutation hooks
  useGenerateTokenMutation,
  
  // Query hooks
  useGetConnectionInfoQuery,
} = livekitApi;
```

### No Cache Management

LiveKit API doesn't use RTK Query's caching system because:
- Tokens are short-lived and shouldn't be cached
- Connection info rarely changes and is fetched once per session
- Token generation is on-demand based on user actions

## Component Integration

### LiveKit Room Connection

```typescript
import { Room } from 'livekit-client';
import { useLivekitApi } from '@/features/livekit/livekitApiSlice';

function useVoiceConnection() {
  const [generateToken] = useLivekitApi.useGenerateTokenMutation();
  const { data: connectionInfo } = useLivekitApi.useGetConnectionInfoQuery();
  const [room] = useState(() => new Room());

  const connectToVoice = async (channelId: string, userInfo: { id: string; name: string }) => {
    if (!connectionInfo?.url) {
      throw new Error('LiveKit connection info not available');
    }

    try {
      // Generate token for the channel/room
      const { token } = await generateToken({
        roomId: channelId,
        identity: userInfo.id,
        name: userInfo.name,
        ttl: 3600 // 1 hour
      }).unwrap();

      // Connect to LiveKit room
      await room.connect(connectionInfo.url, token);
      
      return room;
    } catch (error) {
      console.error('Failed to connect to voice:', error);
      throw error;
    }
  };

  const disconnectFromVoice = async () => {
    try {
      await room.disconnect();
    } catch (error) {
      console.error('Failed to disconnect from voice:', error);
    }
  };

  return { connectToVoice, disconnectFromVoice, room };
}
```

### Voice Channel Join Component

```typescript
function VoiceChannelJoinButton({ channel }: { channel: Channel }) {
  const [generateToken, { isLoading: isGeneratingToken }] = useLivekitApi.useGenerateTokenMutation();
  const { data: connectionInfo } = useLivekitApi.useGetConnectionInfoQuery();
  const { data: user } = useProfileQuery();
  const dispatch = useAppDispatch();

  const handleJoinVoice = async () => {
    if (!user || !connectionInfo?.url) return;

    try {
      // Update connecting state
      dispatch(setConnecting(true));

      // Generate LiveKit token
      const { token } = await generateToken({
        roomId: channel.id,
        identity: user.id,
        name: user.displayName || user.username,
        ttl: 3600
      }).unwrap();

      // Connect to LiveKit room
      const room = new Room();
      await room.connect(connectionInfo.url, token);

      // Update voice state
      dispatch(setConnected({
        channelId: channel.id,
        channelName: channel.name,
        communityId: channel.communityId,
        isPrivate: channel.isPrivate,
        createdAt: channel.createdAt
      }));

      // Enable local audio by default
      await room.localParticipant.setMicrophoneEnabled(true);

    } catch (error) {
      dispatch(setConnectionError('Failed to join voice channel'));
      console.error('Voice connection failed:', error);
    }
  };

  return (
    <button 
      onClick={handleJoinVoice}
      disabled={isGeneratingToken || !connectionInfo}
      className="join-voice-btn"
    >
      {isGeneratingToken ? 'Connecting...' : 'Join Voice'}
    </button>
  );
}
```

### LiveKit Video Call Component

```typescript
function LiveKitVideoCall({ channelId }: { channelId: string }) {
  const [generateToken] = useLivekitApi.useGenerateTokenMutation();
  const { data: connectionInfo } = useLivekitApi.useGetConnectionInfoQuery();
  const { data: user } = useProfileQuery();
  const [room] = useState(() => new Room());
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const connectToRoom = async () => {
      if (!user || !connectionInfo?.url) return;

      try {
        const { token } = await generateToken({
          roomId: channelId,
          identity: user.id,
          name: user.displayName || user.username
        }).unwrap();

        await room.connect(connectionInfo.url, token);
        setIsConnected(true);

        // Set up room event listeners
        room.on('participantConnected', handleParticipantConnected);
        room.on('participantDisconnected', handleParticipantDisconnected);
        
      } catch (error) {
        console.error('Failed to connect to LiveKit room:', error);
      }
    };

    connectToRoom();

    return () => {
      if (isConnected) {
        room.disconnect();
      }
    };
  }, [channelId, user, connectionInfo]);

  if (!isConnected) {
    return <div>Connecting to voice channel...</div>;
  }

  return (
    <div className="livekit-video-call">
      <VideoTiles room={room} />
      <VoiceControls room={room} channelId={channelId} />
    </div>
  );
}
```

## Error Handling

### Token Generation Errors

```typescript
const [generateToken, { error }] = useGenerateTokenMutation();

const handleJoinVoice = async (channelId: string) => {
  try {
    await generateToken({ roomId: channelId }).unwrap();
  } catch (err: any) {
    if (err.status === 403) {
      setError("You don't have permission to join this voice channel");
    } else if (err.status === 404) {
      setError("Voice channel not found");
    } else if (err.status === 429) {
      setError("Too many connection attempts. Please wait.");
    } else {
      setError("Failed to connect to voice. Please try again.");
    }
  }
};
```

### Connection Info Errors

```typescript
const { data: connectionInfo, error: connectionError } = useGetConnectionInfoQuery();

if (connectionError) {
  return (
    <div className="connection-error">
      <p>Voice service is currently unavailable.</p>
      <button onClick={() => refetch()}>Retry Connection</button>
    </div>
  );
}

if (!connectionInfo) {
  return <div>Loading voice service...</div>;
}
```

## Performance Optimization

### Connection Info Caching

```typescript
// Connection info is cached for the session
const { data: connectionInfo } = useGetConnectionInfoQuery(undefined, {
  staleTime: 1000 * 60 * 15, // 15 minutes
  cacheTime: 1000 * 60 * 30, // 30 minutes
});
```

### Token Generation Debouncing

```typescript
// Prevent rapid token generation requests
const [generateToken, { isLoading }] = useGenerateTokenMutation();
const [lastTokenRequest, setLastTokenRequest] = useState(0);

const handleJoinVoice = async (channelId: string) => {
  const now = Date.now();
  if (now - lastTokenRequest < 1000) return; // Debounce 1 second
  
  setLastTokenRequest(now);
  
  try {
    await generateToken({ roomId: channelId }).unwrap();
  } catch (err) {
    // Handle error
  }
};
```

## Integration Patterns

### Pattern 1: Voice Connection Manager

```typescript
function useVoiceConnectionManager() {
  const [generateToken] = useLivekitApi.useGenerateTokenMutation();
  const { data: connectionInfo } = useLivekitApi.useGetConnectionInfoQuery();
  const { data: user } = useProfileQuery();
  const [room] = useState(() => new Room());

  const connectToChannel = async (channelId: string) => {
    if (!user || !connectionInfo) {
      throw new Error('User or connection info not available');
    }

    // Generate token
    const { token } = await generateToken({
      roomId: channelId,
      identity: user.id,
      name: user.displayName || user.username
    }).unwrap();

    // Connect to room
    await room.connect(connectionInfo.url, token);

    return room;
  };

  const disconnectFromChannel = async () => {
    await room.disconnect();
  };

  return { connectToChannel, disconnectFromChannel, room };
}
```

### Pattern 2: Token Refresh Handler

```typescript
function useTokenRefresh(room: Room, channelId: string) {
  const [generateToken] = useLivekitApi.useGenerateTokenMutation();
  const { data: user } = useProfileQuery();

  useEffect(() => {
    const handleTokenExpiry = async () => {
      try {
        const { token } = await generateToken({
          roomId: channelId,
          identity: user?.id,
          name: user?.displayName || user?.username
        }).unwrap();

        // Refresh room token
        await room.engine.updateToken(token);
      } catch (error) {
        console.error('Failed to refresh LiveKit token:', error);
        // Handle token refresh failure (disconnect user)
        await room.disconnect();
      }
    };

    // Listen for token expiry events
    room.on('tokenWillExpire', handleTokenExpiry);

    return () => {
      room.off('tokenWillExpire', handleTokenExpiry);
    };
  }, [room, channelId, user]);
}
```

## Testing

### Token Generation Testing

```typescript
import { renderHook } from '@testing-library/react-hooks';
import { livekitApi } from '../livekitApiSlice';

describe('livekitApi', () => {
  it('should generate token successfully', async () => {
    const { result } = renderHook(
      () => livekitApi.useGenerateTokenMutation(),
      { wrapper: TestProvider }
    );

    const tokenRequest = {
      roomId: 'channel-123',
      identity: 'user-123',
      name: 'Test User'
    };

    await act(async () => {
      const response = await result.current[0](tokenRequest).unwrap();
      expect(response.token).toBeDefined();
      expect(typeof response.token).toBe('string');
    });
  });

  it('should fetch connection info successfully', async () => {
    const { result } = renderHook(
      () => livekitApi.useGetConnectionInfoQuery(),
      { wrapper: TestProvider }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.url).toBeDefined();
  });
});
```

### Integration Testing

```typescript
describe('LiveKit integration', () => {
  it('should connect to room with generated token', async () => {
    const mockRoom = new Room();
    const mockConnect = jest.spyOn(mockRoom, 'connect');

    const { result } = renderHook(
      () => {
        const [generateToken] = livekitApi.useGenerateTokenMutation();
        const { data: connectionInfo } = livekitApi.useGetConnectionInfoQuery();
        return { generateToken, connectionInfo };
      },
      { wrapper: TestProvider }
    );

    await act(async () => {
      const { token } = await result.current.generateToken({
        roomId: 'test-channel',
        identity: 'test-user'
      }).unwrap();

      await mockRoom.connect(result.current.connectionInfo.url, token);
    });

    expect(mockConnect).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String)
    );
  });
});
```

## Related Documentation

- [Voice Presence API](./voicePresenceApi.md) - Server-side presence management
- [Voice Slice](./voiceSlice.md) - Local voice state management
- [Voice Components](../components/voice/) - Voice UI components
- [LiveKit Integration Guide](../architecture/frontend.md#livekit-integration) - Detailed integration patterns
- [Voice Persistence](../features/voice-persistence.md) - Cross-navigation voice connection
- [Channel API](./channelApi.md) - Voice channel management