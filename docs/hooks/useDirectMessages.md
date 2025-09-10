# useDirectMessages Hook

## Overview

`useDirectMessages` is a custom React hook that manages direct message state and real-time WebSocket connections for a specific DM group. It provides a unified interface for accessing DM messages, handling loading states, and managing WebSocket lifecycle for real-time updates.

## Hook Details

**Location**: `frontend/src/hooks/useDirectMessages.ts`

**Type**: Custom React Hook with RTK Query integration

**Purpose**: Orchestrate DM message fetching, WebSocket connections, and state management

## Hook Signature

```typescript
export const useDirectMessages = (dmGroupId: string) => {
  // ... implementation
  
  return {
    messages: Message[];          // Array of messages for the DM group
    isLoading: boolean;          // Loading state for initial fetch
    error: unknown;              // Error from API query
    continuationToken: string;   // Pagination token (not used yet)
    isLoadingMore: boolean;      // Loading state for pagination (always false)
    onLoadMore: undefined;       // Pagination handler (not implemented)
  };
};
```

### Parameters

- **`dmGroupId`** (string, required)
  - MongoDB ObjectId of the direct message group
  - Used for API queries, WebSocket room management, and Redux state key
  - Must be a valid DM group ID where the user has access

### Return Value

```typescript
interface UseDirectMessagesReturn {
  messages: Message[];           // Messages from Redux state
  isLoading: boolean;            // Initial query loading state  
  error: unknown;                // API error if query fails
  continuationToken: string;     // Pagination token (future use)
  isLoadingMore: boolean;        // Always false (pagination not implemented)
  onLoadMore: undefined;         // Reserved for future pagination
}
```

## Implementation Architecture

### Data Flow Pattern

```
1. useGetDmMessagesQuery (API fetch) 
   ↓
2. Redux Store Update (via onQueryStarted)
   ↓
3. useSelector (state subscription)
   ↓
4. Component Re-render (with new messages)
   ↓
5. WebSocket Events → Redux Updates → Component Updates
```

### RTK Query Integration

```typescript
// Initial data fetch - populates Redux store
const { error, isLoading } = useGetDmMessagesQuery(dmGroupId);
```

**Key Features:**
- **Store Population**: Query result automatically updates Redux via `onQueryStarted`
- **Cache Management**: RTK Query handles caching and invalidation
- **Error Handling**: API errors exposed through hook return
- **Background Refetch**: Automatic data freshening

### Redux State Selection

```typescript
// Memoized selectors for performance
const selectMessagesByChannel = React.useMemo(
  () => makeSelectMessagesByChannel(),
  []
);

// State subscription - messages from Redux only
const messages: Message[] = useSelector((state: RootState) =>
  selectMessagesByChannel(state, dmGroupId)
);
```

**Selection Strategy:**
- **Redux as Source of Truth**: Messages always read from Redux state
- **Memoized Selectors**: Prevent unnecessary re-computations
- **Channel Pattern**: Uses same selector pattern as channel messages
- **Type Safety**: Full TypeScript inference for message types

### WebSocket Lifecycle Management

```typescript
const { joinDmGroup, leaveDmGroup } = useDirectMessageWebSocket();

React.useEffect(() => {
  joinDmGroup(dmGroupId);
  
  return () => {
    leaveDmGroup(dmGroupId);
  };
}, [dmGroupId, joinDmGroup, leaveDmGroup]);
```

**Lifecycle Features:**
- **Automatic Join**: Joins DM WebSocket room on mount
- **Cleanup**: Leaves room on unmount or dmGroupId change
- **Dependency Tracking**: Re-joins if dmGroupId changes
- **Stable References**: Hook functions are stable across renders

## Key Features

### Unified Message Interface

The hook provides the same interface as `useMessages` for channels, enabling shared components:

```typescript
// Same pattern for both channels and DMs
const channelMessages = useMessages(channelId);
const dmMessages = useDirectMessages(dmGroupId);

// Both return the same shape:
// { messages, isLoading, error, continuationToken, isLoadingMore, onLoadMore }
```

### Real-time Message Updates

```typescript
// WebSocket events automatically update Redux state
// Hook subscribers get updates immediately
useEffect(() => {
  // This effect runs when messages change from WebSocket events
  console.log('New message count:', messages.length);
}, [messages]);
```

**Real-time Features:**
- **New Messages**: Appear immediately via WebSocket
- **Message Updates**: Edits reflected in real-time
- **Message Deletions**: Removed from state immediately  
- **Reactions**: Added/removed in real-time
- **No Polling**: Pure WebSocket-driven updates

### State Persistence

```typescript
// Messages persist in Redux across component unmounts
// Navigating away and back maintains message state
const messages = useSelector(selectMessagesByChannel(state, dmGroupId));
```

**Persistence Benefits:**
- **Navigation Persistence**: Messages survive route changes
- **Component Remounting**: State maintained across unmount/mount cycles
- **Memory Efficient**: Only active conversations kept in state
- **Selective Cleanup**: Individual DM groups can be cleared

## Usage Examples

### Basic Direct Message Display

```typescript
import { useDirectMessages } from '@/hooks/useDirectMessages';

function DirectMessageView({ dmGroupId }: { dmGroupId: string }) {
  const { messages, isLoading, error } = useDirectMessages(dmGroupId);

  if (isLoading) return <div>Loading messages...</div>;
  if (error) return <div>Error loading messages</div>;

  return (
    <div className="dm-messages">
      {messages.map(message => (
        <MessageComponent key={message.id} message={message} />
      ))}
    </div>
  );
}
```

### With Message Sending

```typescript
function DirectMessageContainer({ dmGroupId }: { dmGroupId: string }) {
  const { messages, isLoading } = useDirectMessages(dmGroupId);
  const { sendDirectMessage } = useDirectMessageWebSocket();

  const handleSendMessage = (content: string, spans: any[]) => {
    sendDirectMessage(dmGroupId, spans);
  };

  return (
    <div className="dm-container">
      <MessageList messages={messages} isLoading={isLoading} />
      <MessageInput onSendMessage={handleSendMessage} />
    </div>
  );
}
```

### Multiple DM Groups

```typescript
function MultiDMView({ dmGroupIds }: { dmGroupIds: string[] }) {
  // Each hook manages its own state and WebSocket connection
  const dmData = dmGroupIds.map(id => ({
    id,
    ...useDirectMessages(id)
  }));

  return (
    <div className="multi-dm-view">
      {dmData.map(({ id, messages, isLoading }) => (
        <div key={id} className="dm-group">
          <h3>DM Group {id}</h3>
          {isLoading ? (
            <div>Loading...</div>
          ) : (
            <div>{messages.length} messages</div>
          )}
        </div>
      ))}
    </div>
  );
}
```

### Conditional DM Display

```typescript
function ConditionalDMView({ dmGroupId }: { dmGroupId?: string }) {
  const dmHookResult = useDirectMessages(dmGroupId || '');
  
  // Hook still runs but with empty string - query will be skipped
  if (!dmGroupId) {
    return <div>Select a DM to view messages</div>;
  }

  const { messages, isLoading, error } = dmHookResult;

  if (error) return <div>Failed to load DM</div>;
  
  return (
    <div>
      {isLoading ? 'Loading...' : `${messages.length} messages`}
    </div>
  );
}
```

## Performance Considerations

### Memoization Strategy

```typescript
// Selectors memoized once per hook instance
const selectMessagesByChannel = React.useMemo(
  () => makeSelectMessagesByChannel(),
  []
);

// No dependencies = created once per hook instance
// Each DM group gets its own selector instance
```

**Benefits:**
- **Selector Reuse**: Each hook instance gets stable selector reference
- **Reduced Computations**: Selector only re-computes when state changes
- **Memory Efficiency**: Old selector instances garbage collected with component

### WebSocket Connection Management

```typescript
// Single WebSocket connection shared across all hooks
const { joinDmGroup, leaveDmGroup } = useDirectMessageWebSocket();

// Multiple DM groups share the same connection
// Room management handles multiple concurrent subscriptions
```

**Connection Efficiency:**
- **Single Socket**: All DM groups use same WebSocket connection
- **Room-based**: Server broadcasts to specific DM room subscribers
- **Automatic Cleanup**: Rooms left when components unmount
- **Reconnection Handling**: WebSocket hook handles connection recovery

### Redux State Optimization

```typescript
// Messages stored by channelId (using dmGroupId as key)
const messages = useSelector((state) => 
  selectMessagesByChannel(state, dmGroupId)
);

// Selector only triggers re-render when this DM group's messages change
// Changes to other DM groups don't cause re-renders
```

## Error Handling

### API Error Management

```typescript
const { error, isLoading } = useGetDmMessagesQuery(dmGroupId);

// Errors exposed directly from RTK Query
if (error) {
  // Handle network errors, 403 Forbidden, 404 Not Found, etc.
  console.error('DM fetch error:', error);
}
```

**Error Types:**
- **Network Errors**: Connection failures, timeouts
- **Authentication**: 401 Unauthorized, token expiry
- **Authorization**: 403 Forbidden (not member of DM group)
- **Not Found**: 404 DM group doesn't exist
- **Server Errors**: 500 Internal Server Error

### WebSocket Error Recovery

```typescript
// WebSocket errors handled by useDirectMessageWebSocket
// Connection recovery automatic via useSocket hook
// Failed message sends could be retried (not implemented)
```

### State Consistency

```typescript
// Redux state consistency maintained by:
// 1. RTK Query cache invalidation
// 2. WebSocket event handlers updating same state
// 3. Optimistic updates for better UX (future enhancement)
```

## Future Enhancements

### Pagination Implementation

```typescript
// Currently stubbed out for future implementation
return {
  // ... existing returns
  isLoadingMore: false,        // Will become dynamic
  onLoadMore: undefined,       // Will load older messages
};
```

**Planned Features:**
- **Infinite Scrolling**: Load older messages on scroll
- **Continuation Tokens**: Server-side pagination support
- **Cache Management**: Efficient memory usage for large conversations
- **Bidirectional Loading**: Load newer messages if scrolled up

### Optimistic Updates

```typescript
// Future enhancement: optimistic message sending
const handleOptimisticSend = (content: string, spans: any[]) => {
  // 1. Add message to Redux immediately with temp ID
  // 2. Send via WebSocket
  // 3. Replace temp message with server response
  // 4. Handle failures by removing temp message
};
```

### Offline Support

```typescript
// Future enhancement: offline message queuing
const handleOfflineSend = (content: string, spans: any[]) => {
  // 1. Queue message locally
  // 2. Retry when connection restored
  // 3. Show pending status in UI
};
```

## Testing

### Unit Testing

**Test File**: `useDirectMessages.test.ts`

**Test Coverage:**
- Hook initialization and state management
- WebSocket connection lifecycle
- Message state updates from Redux
- Error handling scenarios
- Component unmounting cleanup

**Example Tests:**
```typescript
describe('useDirectMessages', () => {
  it('fetches messages and joins WebSocket room', () => {
    const mockQuery = {
      data: mockMessages,
      isLoading: false,
      error: null
    };
    
    jest.mocked(useGetDmMessagesQuery).mockReturnValue(mockQuery);
    
    const { result } = renderHook(() => useDirectMessages('dm-group-1'));
    
    expect(result.current.messages).toEqual(mockMessages);
    expect(result.current.isLoading).toBe(false);
    expect(mockJoinDmGroup).toHaveBeenCalledWith('dm-group-1');
  });

  it('leaves WebSocket room on unmount', () => {
    const { unmount } = renderHook(() => useDirectMessages('dm-group-1'));
    
    unmount();
    
    expect(mockLeaveDmGroup).toHaveBeenCalledWith('dm-group-1');
  });

  it('switches DM groups correctly', () => {
    const { rerender } = renderHook(
      ({ dmGroupId }) => useDirectMessages(dmGroupId),
      { initialProps: { dmGroupId: 'dm-1' } }
    );

    expect(mockJoinDmGroup).toHaveBeenCalledWith('dm-1');
    
    rerender({ dmGroupId: 'dm-2' });
    
    expect(mockLeaveDmGroup).toHaveBeenCalledWith('dm-1');
    expect(mockJoinDmGroup).toHaveBeenCalledWith('dm-2');
  });
});
```

### Integration Testing

- **Real WebSocket Events**: Test with actual WebSocket connections
- **Message Persistence**: Test navigation and state persistence
- **Multiple DM Groups**: Test concurrent DM group management
- **Error Recovery**: Test network failures and reconnection

## Related Hooks

### Direct Dependencies

- **`useGetDmMessagesQuery`**: RTK Query for initial DM message fetch
- **`useDirectMessageWebSocket`**: WebSocket connection and event handling
- **`useSelector`**: Redux state subscription
- **`makeSelectMessagesByChannel`**: Memoized message selector

### Related Message Hooks

- **`useMessages`**: Channel message equivalent (same interface)
- **`useChannelWebSocket`**: Channel WebSocket equivalent
- **`useSocket`**: Base WebSocket connection management

### Redux Integration

- **`messagesSlice`**: Redux slice for message state management
- **`directMessagesApiSlice`**: RTK Query API for DM operations
- **Redux Store**: Central state management

---

## Architecture Benefits

### Unified Interface

- **Consistent API**: Same interface as channel messages
- **Shared Components**: Components work with both channels and DMs
- **Predictable Behavior**: Developers know what to expect

### Performance Optimization

- **Memoized Selectors**: Efficient state subscription
- **Single WebSocket**: Shared connection across hooks
- **Redux Caching**: State persisted across component lifecycles

### Real-time Reliability

- **WebSocket Integration**: Immediate message updates
- **Connection Management**: Automatic join/leave handling
- **Error Recovery**: Built-in resilience to network issues

This hook provides a robust foundation for direct message functionality in Kraken, offering real-time updates, efficient state management, and a developer-friendly interface that mirrors the existing channel message patterns.