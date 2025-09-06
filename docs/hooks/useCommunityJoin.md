# useCommunityJoin

> **Location:** `frontend/src/hooks/useCommunityJoin.ts`  
> **Type:** Effect Hook  
> **Category:** websocket

## Overview

A simple but essential WebSocket effect hook that automatically manages joining and leaving community-based WebSocket rooms when a user navigates to different communities. This hook ensures that the user receives real-time events (messages, voice updates, etc.) for the currently active community by emitting the appropriate WebSocket events to the server.

## Hook Signature

```typescript
function useCommunityJoin(communityId: string | undefined): void
```

### Parameters

```typescript
interface UseCommunityJoinParams {
  communityId: string | undefined;  // The ID of the community to join, or undefined to join none
}
```

- `communityId` - The community ID to join WebSocket rooms for. When `undefined`, no join event is emitted.

### Return Value

This hook returns nothing (`void`). It operates purely through side effects by emitting WebSocket events.

## Usage Examples

### Basic Usage with Route Parameters

```tsx
import { useCommunityJoin } from '@/hooks/useCommunityJoin';
import { useParams } from 'react-router-dom';

function CommunityPage() {
  const { communityId } = useParams<{ communityId: string }>();
  
  // Automatically join WebSocket rooms for this community
  useCommunityJoin(communityId);

  return (
    <div className="community-page">
      <CommunityHeader />
      <ChannelList />
      <MessageContainer />
    </div>
  );
}
```

### Integration with Community Navigation

```tsx
import { useCommunityJoin } from '@/hooks/useCommunityJoin';
import { useState, useEffect } from 'react';

function CommunityNavigator() {
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | undefined>();
  
  // Join WebSocket rooms for the selected community
  useCommunityJoin(selectedCommunityId);

  const handleCommunitySelect = (communityId: string) => {
    setSelectedCommunityId(communityId);
    // Hook will automatically handle joining the new community
  };

  const handleLeaveCommunity = () => {
    setSelectedCommunityId(undefined);
    // Hook will automatically handle leaving (no join event emitted)
  };

  return (
    <div className="community-navigator">
      <div className="community-list">
        {communities.map(community => (
          <button
            key={community.id}
            onClick={() => handleCommunitySelect(community.id)}
            className={selectedCommunityId === community.id ? 'active' : ''}
          >
            {community.name}
          </button>
        ))}
      </div>
      
      {selectedCommunityId && (
        <div className="community-content">
          <button onClick={handleLeaveCommunity}>
            Leave Community
          </button>
          <CommunityDetails communityId={selectedCommunityId} />
        </div>
      )}
    </div>
  );
}
```

### Conditional Community Joining

```tsx
import { useCommunityJoin } from '@/hooks/useCommunityJoin';

function ConditionalCommunityView({ 
  communityId, 
  userHasAccess 
}: { 
  communityId: string; 
  userHasAccess: boolean; 
}) {
  // Only join if user has access
  useCommunityJoin(userHasAccess ? communityId : undefined);

  if (!userHasAccess) {
    return (
      <div className="access-denied">
        <h2>Access Denied</h2>
        <p>You don't have permission to view this community.</p>
      </div>
    );
  }

  return (
    <div className="community-view">
      <h1>Community Content</h1>
      {/* Community content - will receive real-time updates */}
    </div>
  );
}
```

### Multi-Community Dashboard

```tsx
import { useCommunityJoin } from '@/hooks/useCommunityJoin';

function MultiCommunityDashboard() {
  const [activeCommunityId, setActiveCommunityId] = useState<string | undefined>();
  const [communityTabs, setCommunityTabs] = useState<string[]>([]);

  // Join the currently active community
  useCommunityJoin(activeCommunityId);

  const openCommunityTab = (communityId: string) => {
    if (!communityTabs.includes(communityId)) {
      setCommunityTabs(prev => [...prev, communityId]);
    }
    setActiveCommunityId(communityId);
  };

  const closeCommunityTab = (communityId: string) => {
    const newTabs = communityTabs.filter(id => id !== communityId);
    setCommunityTabs(newTabs);
    
    if (activeCommunityId === communityId) {
      setActiveCommunityId(newTabs[0] || undefined);
    }
  };

  return (
    <div className="multi-community-dashboard">
      <div className="community-tabs">
        {communityTabs.map(communityId => (
          <div
            key={communityId}
            className={`tab ${activeCommunityId === communityId ? 'active' : ''}`}
          >
            <button onClick={() => setActiveCommunityId(communityId)}>
              Community {communityId}
            </button>
            <button 
              onClick={() => closeCommunityTab(communityId)}
              className="close-tab"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="community-content">
        {activeCommunityId ? (
          <CommunityView communityId={activeCommunityId} />
        ) : (
          <div className="no-community">Select a community to view</div>
        )}
      </div>
    </div>
  );
}
```

### Integration with Community Loading States

```tsx
import { useCommunityJoin } from '@/hooks/useCommunityJoin';
import { useGetCommunityQuery } from '@/features/community/communityApiSlice';

function SmartCommunityPage({ communityId }: { communityId: string }) {
  const { 
    data: community, 
    isLoading, 
    error 
  } = useGetCommunityQuery(communityId);

  // Only join WebSocket rooms after community data is loaded successfully
  useCommunityJoin(community ? communityId : undefined);

  if (isLoading) {
    return (
      <div className="loading-community">
        <div>Loading community...</div>
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="community-error">
        <h2>Failed to Load Community</h2>
        <p>Unable to load community data. Please try again.</p>
        <button onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="community-not-found">
        <h2>Community Not Found</h2>
        <p>The requested community doesn't exist or you don't have access.</p>
      </div>
    );
  }

  return (
    <div className="community-page">
      <h1>{community.name}</h1>
      <p>{community.description}</p>
      {/* Real-time content will work here since WebSocket rooms are joined */}
      <LiveMessageFeed />
      <VoiceChannelStatus />
    </div>
  );
}
```

## Implementation Details

### Internal Logic

The hook is extremely simple but important for the WebSocket architecture:

```typescript
export function useCommunityJoin(communityId: string | undefined) {
  const socket = useContext(SocketContext);
  
  useEffect(() => {
    if (!socket || !communityId) return;
    
    socket.emit(ClientEvents.JOIN_ALL, communityId);
    
    // Optionally, add cleanup for leaving rooms if needed
    // return () => socket.emit(ClientEvents.LEAVE_ALL, communityId);
  }, [socket, communityId]);
}
```

### Dependencies

#### Internal Hooks
- `useContext` - Accesses the SocketContext to get the socket instance
- `useEffect` - Manages WebSocket room joining based on communityId changes

#### External Dependencies
- `SocketContext` - React context providing the Socket.IO client instance
- `ClientEvents` - Enum containing WebSocket event names

## WebSocket Integration

### Server-Side Room Management

When the hook emits `JOIN_ALL`, the server typically:

1. **Leaves Previous Rooms**: Removes the user from any previously joined community rooms
2. **Joins Community Rooms**: Adds the user to all relevant rooms for the new community:
   - Community-wide events room
   - All accessible channel rooms
   - Voice presence room
   - Moderation room (if user has permissions)

```typescript
// Server-side handler (for reference)
socket.on('JOIN_ALL', (communityId: string) => {
  // Leave all current community rooms
  socket.leaveAll();
  
  // Join new community rooms
  socket.join(`community:${communityId}`);
  socket.join(`community:${communityId}:messages`);
  socket.join(`community:${communityId}:voice`);
  
  // Join individual channel rooms the user has access to
  const userChannels = await getUserAccessibleChannels(userId, communityId);
  userChannels.forEach(channel => {
    socket.join(`channel:${channel.id}`);
  });
});
```

### Event Types Affected

Once joined, the user will receive these real-time events:

```typescript
// Events the user will now receive for this community
socket.on('NEW_MESSAGE', handleMessage);              // New messages in community channels
socket.on('UPDATE_MESSAGE', handleMessageUpdate);     // Message edits
socket.on('DELETE_MESSAGE', handleMessageDelete);     // Message deletions
socket.on('VOICE_CHANNEL_USER_JOINED', handleVoiceJoin);    // Voice presence updates
socket.on('VOICE_CHANNEL_USER_LEFT', handleVoiceLeave);     // Voice presence updates
socket.on('COMMUNITY_UPDATED', handleCommunityUpdate);      // Community setting changes
socket.on('CHANNEL_CREATED', handleChannelCreate);          // New channels
socket.on('CHANNEL_DELETED', handleChannelDelete);          // Channel deletions
```

## Side Effects

### Effect Dependencies

```typescript
useEffect(() => {
  if (!socket || !communityId) return;
  
  socket.emit(ClientEvents.JOIN_ALL, communityId);
  
  // Effect runs when:
  // - socket instance changes
  // - communityId changes
  // - Component mounts (if socket and communityId are available)
}, [socket, communityId]); // Dependencies array
```

### Cleanup Considerations

The current implementation doesn't include explicit cleanup, but it could be added:

```typescript
useEffect(() => {
  if (!socket || !communityId) return;
  
  socket.emit(ClientEvents.JOIN_ALL, communityId);
  
  return () => {
    // Optional: Explicitly leave rooms when component unmounts or communityId changes
    socket.emit(ClientEvents.LEAVE_ALL, communityId);
  };
}, [socket, communityId]);
```

However, cleanup is often unnecessary because:
- The server typically handles leaving old rooms when joining new ones
- WebSocket disconnection automatically removes the user from all rooms
- Next `JOIN_ALL` call implicitly handles the transition

## Performance Considerations

### Optimization Notes

- **Minimal Overhead**: The hook has extremely low computational cost
- **Efficient Event Handling**: Only emits when communityId actually changes
- **Conditional Execution**: Skips emission when socket or communityId are unavailable
- **No Re-renders**: Hook doesn't manage state, so it doesn't cause component re-renders

### Network Efficiency

- **Single Emission**: One WebSocket event handles joining all necessary rooms
- **Server-Side Optimization**: Server can batch room operations efficiently
- **Automatic Cleanup**: Server implicitly handles leaving old rooms

## Error Handling

### Socket Availability

The hook gracefully handles missing socket connections:

```typescript
if (!socket || !communityId) return;
// Only proceed if both socket and communityId are available
```

### Community ID Validation

```tsx
function SafeCommunityJoin({ communityId }: { communityId?: string }) {
  // Hook handles undefined gracefully
  useCommunityJoin(communityId);
  
  if (!communityId) {
    return <div>No community selected</div>;
  }
  
  return <CommunityContent />;
}
```

### Connection State Handling

```tsx
function ConnectionAwareCommunity() {
  const socket = useSocket();
  const { communityId } = useParams();
  
  useCommunityJoin(communityId);
  
  if (!socket?.connected) {
    return (
      <div className="connection-warning">
        <p>Connecting to server...</p>
        <p>Real-time features will be available once connected.</p>
      </div>
    );
  }
  
  return <CommunityInterface />;
}
```

## Testing

### Test Examples

```typescript
import { renderHook } from '@testing-library/react-hooks';
import { useCommunityJoin } from '../useCommunityJoin';
import { SocketContext } from '../../utils/SocketContext';

describe('useCommunityJoin', () => {
  let mockSocket: { emit: jest.Mock };

  beforeEach(() => {
    mockSocket = { emit: jest.fn() };
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <SocketContext.Provider value={mockSocket}>
      {children}
    </SocketContext.Provider>
  );

  it('should emit JOIN_ALL when communityId is provided', () => {
    renderHook(() => useCommunityJoin('community-123'), { wrapper });
    
    expect(mockSocket.emit).toHaveBeenCalledWith('JOIN_ALL', 'community-123');
  });

  it('should not emit when communityId is undefined', () => {
    renderHook(() => useCommunityJoin(undefined), { wrapper });
    
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  it('should emit new JOIN_ALL when communityId changes', () => {
    const { rerender } = renderHook(
      ({ communityId }) => useCommunityJoin(communityId),
      {
        wrapper,
        initialProps: { communityId: 'community-1' }
      }
    );

    expect(mockSocket.emit).toHaveBeenCalledWith('JOIN_ALL', 'community-1');

    // Change community
    rerender({ communityId: 'community-2' });

    expect(mockSocket.emit).toHaveBeenCalledWith('JOIN_ALL', 'community-2');
    expect(mockSocket.emit).toHaveBeenCalledTimes(2);
  });

  it('should handle socket not being available', () => {
    const { result } = renderHook(() => useCommunityJoin('community-123'));
    
    // Should not throw when no socket context provided
    expect(result.error).toBeUndefined();
  });
});
```

### Integration Testing

```tsx
import { render, waitFor } from '@testing-library/react';
import { SocketProvider } from '@/utils/SocketProvider';
import CommunityPage from '../CommunityPage';

describe('CommunityPage Integration', () => {
  it('should join community rooms on mount', async () => {
    const mockEmit = jest.fn();
    const mockSocket = { emit: mockEmit, on: jest.fn(), off: jest.fn() };
    
    render(
      <SocketProvider value={mockSocket}>
        <CommunityPage communityId="community-123" />
      </SocketProvider>
    );

    await waitFor(() => {
      expect(mockEmit).toHaveBeenCalledWith('JOIN_ALL', 'community-123');
    });
  });
});
```

## Common Patterns

### Pattern 1: Route-Based Community Joining

```tsx
import { useParams } from 'react-router-dom';
import { useCommunityJoin } from '@/hooks/useCommunityJoin';

// App.tsx routing setup
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/community/:communityId/*" element={<CommunityLayout />} />
      </Routes>
    </BrowserRouter>
  );
}

// CommunityLayout.tsx
function CommunityLayout() {
  const { communityId } = useParams<{ communityId: string }>();
  
  // Automatically join when route changes
  useCommunityJoin(communityId);
  
  return (
    <div className="community-layout">
      <CommunityNavigation />
      <Outlet /> {/* Nested routes render here */}
    </div>
  );
}
```

### Pattern 2: State-Driven Community Joining

```tsx
function CommunityManager() {
  const [currentCommunity, setCurrentCommunity] = useLocalStorage<string | null>(
    'currentCommunity',
    null
  );
  
  // Join based on stored state
  useCommunityJoin(currentCommunity || undefined);
  
  const switchCommunity = (communityId: string) => {
    setCurrentCommunity(communityId);
    // Hook will automatically handle the switch
  };
  
  return (
    <CommunitySelector 
      onCommunitySelect={switchCommunity}
      currentCommunity={currentCommunity}
    />
  );
}
```

### Pattern 3: Permission-Gated Community Access

```tsx
function ProtectedCommunityView({ communityId }: { communityId: string }) {
  const { hasPermissions: canView } = useUserPermissions({
    resourceType: 'COMMUNITY',
    resourceId: communityId,
    actions: ['VIEW_COMMUNITY']
  });
  
  // Only join if user has permission to view
  useCommunityJoin(canView ? communityId : undefined);
  
  if (!canView) {
    return <AccessDeniedMessage />;
  }
  
  return <CommunityContent />;
}
```

## Related Hooks

- **useSocket** - Provides the WebSocket instance used by this hook
- **useChannelWebSocket** - Handles channel-specific message events (relies on rooms joined by this hook)
- **useVoiceEvents** - Handles voice presence events (relies on rooms joined by this hook)
- **useParams** - Often used to get communityId from route parameters

## Troubleshooting

### Common Issues

1. **Real-time events not received**
   - **Symptoms:** No live updates for messages, voice presence, etc.
   - **Cause:** Hook not called or communityId is undefined
   - **Solution:** Ensure hook is called with valid communityId

   ```tsx
   // Debug: Check what's being passed to the hook
   console.log('Joining community:', communityId);
   useCommunityJoin(communityId);
   ```

2. **Events from wrong community**
   - **Symptoms:** Receiving updates from previously viewed community
   - **Cause:** Multiple hook instances or server-side room cleanup issues
   - **Solution:** Ensure only one instance of hook per component tree

3. **Hook not triggering on route changes**
   - **Symptoms:** Switching routes doesn't join new community rooms
   - **Cause:** communityId not updating properly
   - **Solution:** Verify route parameter extraction and state management

   ```tsx
   const { communityId } = useParams<{ communityId: string }>();
   console.log('Route communityId:', communityId); // Debug log
   useCommunityJoin(communityId);
   ```

4. **Socket connection issues**
   - **Symptoms:** Hook doesn't emit any events
   - **Cause:** Socket not connected or context not provided
   - **Solution:** Verify SocketProvider setup and connection state

### Best Practices

- **Single Instance**: Use this hook only once per community context to avoid conflicts
- **Route Integration**: Pair with React Router for automatic community switching
- **Conditional Joining**: Only join when user has appropriate access
- **Error Boundaries**: Wrap components using this hook in error boundaries for robustness
- **Debug Logging**: Add temporary logging during development to verify behavior

## Version History

- **1.0.0:** Initial implementation with basic JOIN_ALL event emission
- **1.1.0:** Added better error handling for missing socket connections
- **1.2.0:** Improved TypeScript support and documentation

## Related Documentation

- [useSocket Hook](./useSocket.md)
- [useChannelWebSocket Hook](./useChannelWebSocket.md) 
- [WebSocket Events API](../api/websocket-events.md)
- [Community WebSocket Architecture](../architecture/websockets.md)