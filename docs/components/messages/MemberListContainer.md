# MemberListContainer Component

## Overview

`MemberListContainer` is a smart container component that provides context-aware member data fetching and transformation for the `MemberList` component. It handles both channel and direct message contexts, fetches member data and presence information, and provides intelligent sorting and error handling.

## Component Details

**Location**: `frontend/src/components/Message/MemberListContainer.tsx`

**Type**: Container Component (Smart Component)

**Purpose**: Orchestrate member data fetching, presence integration, and context-specific logic for member display

## Props

```typescript
interface MemberListContainerProps {
  contextType: "channel" | "dm";    // Context type: channel or direct message
  contextId: string;                // Channel ID or DM group ID
  communityId?: string;             // Community ID (required for channel context)
}
```

### Prop Details

- **`contextType`** ("channel" | "dm", required)
  - Determines which data fetching strategy to use
  - "channel": Fetches community members for channel context
  - "dm": Fetches DM group participants for direct message context

- **`contextId`** (string, required)
  - For channels: Channel ID (used to identify context)
  - For DMs: Direct message group ID
  - Used for context identification and data fetching

- **`communityId`** (string, optional)
  - Required when contextType is "channel"
  - Used to fetch community members for the channel
  - Ignored when contextType is "dm"

## Data Fetching Strategy

### Multi-Source Data Integration

The component orchestrates data from multiple API endpoints:

```typescript
// 1. Channel Members (for channel context)
const {
  data: communityMembers,
  isLoading: isCommunityLoading,
  error: communityError,
} = useGetMembersForCommunityQuery(communityId || "", {
  skip: contextType !== "channel" || !communityId,
});

// 2. DM Group Members (for DM context)
const {
  data: dmGroup,
  isLoading: isDmLoading,
  error: dmError,
} = useGetDmGroupQuery(contextId, {
  skip: contextType !== "dm",
});

// 3. Presence Data (for both contexts)
const {
  data: presenceData,
  isLoading: isPresenceLoading,
  error: presenceError,
} = useGetMultipleUserPresenceQuery(userIds, {
  skip: userIds.length === 0,
});
```

### Conditional Data Fetching

**Query Skipping Logic:**
- **Channel queries**: Skipped when contextType is not "channel"
- **DM queries**: Skipped when contextType is not "dm" 
- **Presence queries**: Skipped when no user IDs are available
- **Optimization**: Prevents unnecessary API calls based on context

## Data Transformation Pipeline

### 1. Base Member Extraction

```typescript
const baseMembers = React.useMemo(() => {
  if (contextType === "channel") {
    return (communityMembers || [])
      .filter((membership) => membership.user) // Filter out invalid memberships
      .map((membership) => ({
        id: membership.user!.id,
        username: membership.user!.username,
        displayName: membership.user!.displayName,
        avatarUrl: membership.user!.avatarUrl,
      }));
  } else {
    // DM context
    return (dmGroup?.members || [])
      .map((member) => ({
        id: member.user.id,
        username: member.user.username,
        displayName: member.user.displayName,
        avatarUrl: member.user.avatarUrl,
      }));
  }
}, [contextType, communityMembers, dmGroup]);
```

**Transformation Logic:**
- **Channel Context**: Extracts user data from membership objects
- **DM Context**: Extracts user data from DM group member objects
- **Data Normalization**: Converts different API structures to unified format
- **Safety**: Filters out invalid/missing user data

### 2. User ID Extraction

```typescript
const userIds = React.useMemo(() => 
  baseMembers.map(member => member.id), 
  [baseMembers]
);
```

**Purpose:**
- Extracts user IDs for presence data fetching
- Memoized to prevent unnecessary presence query re-execution
- Used as input for presence API call

### 3. Presence Integration and Sorting

```typescript
const membersWithPresence: MemberData[] = baseMembers
  .map((member) => ({
    ...member,
    isOnline: presenceData?.presence?.[member.id] || false,
  }))
  .sort((a, b) => {
    // Sort by online status first (online users first), then alphabetically
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    return a.username.localeCompare(b.username);
  });
```

**Integration Features:**
- **Presence Mapping**: Maps user IDs to online status from presence data
- **Fallback**: Defaults to offline (false) when presence data unavailable
- **Smart Sorting**: Online users appear first, then alphabetical order
- **Case-Insensitive**: Uses `localeCompare` for proper alphabetical sorting

## Error Handling and Loading States

### Combined State Management

```typescript
const combinedLoading = contextType === "channel" 
  ? isCommunityLoading || isPresenceLoading
  : isDmLoading || isPresenceLoading;

const combinedError = contextType === "channel" 
  ? communityError || presenceError
  : dmError || presenceError;
```

**State Aggregation:**
- **Loading**: Shows loading when ANY required query is loading
- **Error**: Shows error if ANY required query fails
- **Context-Aware**: Different error sources based on context type
- **Graceful Degradation**: Component works even if presence fails

### Context-Specific Titles

```typescript
const listTitle = contextType === "channel" 
  ? "Members" 
  : (dmGroup?.isGroup ? "Group Members" : "Participants");
```

**Title Logic:**
- **Channel**: Always shows "Members"
- **Group DM**: Shows "Group Members" for multi-user DMs
- **1:1 DM**: Shows "Participants" for two-person conversations
- **Context-Aware**: Title reflects the actual context type

## Performance Optimizations

### Memoization Strategy

```typescript
// Base members memoized on context and raw data changes
const baseMembers = React.useMemo(() => {
  // transformation logic
}, [contextType, communityMembers, dmGroup]);

// User IDs memoized on base members changes
const userIds = React.useMemo(() => 
  baseMembers.map(member => member.id), 
  [baseMembers]
);

// Final result memoized on all dependencies
const { members, isLoading, error, title } = React.useMemo(() => {
  // final transformation logic
}, [
  baseMembers, presenceData, contextType,
  isCommunityLoading, isDmLoading, isPresenceLoading,
  communityError, dmError, presenceError,
  dmGroup?.isGroup,
]);
```

**Optimization Benefits:**
- **Prevents Unnecessary Re-renders**: Only re-compute when dependencies change
- **Reduces API Calls**: User ID extraction memoized to prevent presence re-fetch
- **Efficient Sorting**: Member sorting only happens when data actually changes
- **Stable References**: Memoized objects prevent child component re-renders

### Query Optimization

```typescript
// Skip queries based on context
const memberQuery = useGetMembersForCommunityQuery(communityId || "", {
  skip: contextType !== "channel" || !communityId,
});

const dmQuery = useGetDmGroupQuery(contextId, {
  skip: contextType !== "dm",
});
```

**Benefits:**
- **Conditional Fetching**: Only fetch data relevant to current context
- **Reduced Network Traffic**: Prevents unnecessary API calls
- **Better Performance**: Fewer concurrent queries
- **Cache Efficiency**: RTK Query can optimize caching per context

## Usage Examples

### Channel Member List Integration

```typescript
function ChannelSidebar({ channelId, communityId }: ChannelSidebarProps) {
  return (
    <aside className="channel-sidebar">
      <MemberListContainer
        contextType="channel"
        contextId={channelId}
        communityId={communityId}
      />
    </aside>
  );
}
```

### Direct Message Participants

```typescript
function DMSidebar({ dmGroupId }: DMSidebarProps) {
  return (
    <aside className="dm-sidebar">
      <MemberListContainer
        contextType="dm"
        contextId={dmGroupId}
        // communityId not needed for DM context
      />
    </aside>
  );
}
```

### Message Container Integration

```typescript
function MessageContainerWrapper({ contextType, contextId, communityId }) {
  return (
    <div className="message-container">
      <main className="message-content">
        {/* Message list and input */}
      </main>
      
      <aside className="member-sidebar">
        <MemberListContainer
          contextType={contextType}
          contextId={contextId}
          communityId={communityId}
        />
      </aside>
    </div>
  );
}
```

### Error Boundary Integration

```typescript
function SafeMemberListContainer(props: MemberListContainerProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="member-list-error">
          <p>Failed to load members</p>
          <button onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      }
    >
      <MemberListContainer {...props} />
    </ErrorBoundary>
  );
}
```

## Real-time Updates

### Presence System Integration

```typescript
// Component automatically receives presence updates via RTK Query
const { data: presenceData } = useGetMultipleUserPresenceQuery(userIds, {
  // RTK Query handles WebSocket updates and cache invalidation
  pollingInterval: 30000, // Fallback polling every 30 seconds
});
```

**Real-time Features:**
- **WebSocket Integration**: Presence updates received via WebSocket
- **Cache Updates**: RTK Query automatically updates cached presence data
- **Live Status**: Online/offline status changes immediately
- **Fallback Polling**: Ensures updates even if WebSocket fails

### Member Changes

- **Dynamic Updates**: New members appear automatically when joining
- **Leave Handling**: Members removed when leaving channel/DM
- **Profile Updates**: Avatar and display name changes reflected immediately
- **Cache Synchronization**: Changes propagated across all components

## Testing

### Unit Testing

**Test File**: `MemberListContainer.test.tsx`

**Test Coverage:**
- Context switching between channel and DM modes
- Data transformation from different API shapes
- Presence integration and sorting logic
- Error handling for failed API calls
- Loading state management
- Memoization behavior

**Example Tests:**
```typescript
describe('MemberListContainer', () => {
  it('fetches community members for channel context', () => {
    const mockMembers = [
      { user: { id: '1', username: 'alice' } },
      { user: { id: '2', username: 'bob' } }
    ];
    
    jest.mocked(useGetMembersForCommunityQuery).mockReturnValue({
      data: mockMembers,
      isLoading: false,
      error: null
    });

    render(
      <MemberListContainer
        contextType="channel"
        contextId="channel-1"
        communityId="community-1"
      />
    );

    expect(useGetMembersForCommunityQuery).toHaveBeenCalledWith(
      "community-1",
      { skip: false }
    );
  });

  it('fetches DM group for DM context', () => {
    const mockDmGroup = {
      members: [
        { user: { id: '1', username: 'alice' } },
        { user: { id: '2', username: 'bob' } }
      ]
    };

    jest.mocked(useGetDmGroupQuery).mockReturnValue({
      data: mockDmGroup,
      isLoading: false,
      error: null
    });

    render(
      <MemberListContainer
        contextType="dm"
        contextId="dm-group-1"
      />
    );

    expect(useGetDmGroupQuery).toHaveBeenCalledWith(
      "dm-group-1",
      { skip: false }
    );
  });

  it('sorts members with online users first', () => {
    const mockMembers = [
      { user: { id: '1', username: 'charlie' } },
      { user: { id: '2', username: 'alice' } },
      { user: { id: '3', username: 'bob' } }
    ];

    const mockPresence = {
      presence: {
        '2': true, // alice is online
        '3': false, // bob is offline
        '1': false, // charlie is offline
      }
    };

    // Setup mocks and render
    // ...

    // Expected order: alice (online), bob (offline), charlie (offline)
    const memberElements = screen.getAllByTestId('member-item');
    expect(memberElements[0]).toHaveTextContent('alice');
    expect(memberElements[1]).toHaveTextContent('bob');
    expect(memberElements[2]).toHaveTextContent('charlie');
  });
});
```

### Integration Testing

- **Real API Data**: Test with actual API responses
- **WebSocket Updates**: Test real-time presence changes
- **Context Switching**: Test changing between channel and DM contexts
- **Error Recovery**: Test recovery from network failures

## Related Components

### Direct Dependencies

- **`MemberList`**: The presentational component that renders the UI
- **`useGetMembersForCommunityQuery`**: Fetches community/channel members
- **`useGetDmGroupQuery`**: Fetches direct message group data
- **`useGetMultipleUserPresenceQuery`**: Fetches presence data for multiple users

### Parent Components

- **`MessageContainerWrapper`**: Integrates member list as sidebar
- **`DirectMessageContainer`**: Uses for DM participant display
- **`ChannelContainer`**: Uses for channel member display

### Related Container Components

- **`PresenceContainer`**: Similar pattern for managing presence data
- **`MessageContainer`**: Similar container pattern for message management
- **`ChannelContainer`**: Similar container pattern for channel context

---

## Architecture Benefits

### Separation of Concerns

- **Data Logic**: Container handles all data fetching and transformation
- **Presentation Logic**: MemberList handles only UI concerns
- **Context Abstraction**: Single component works for multiple contexts
- **Reusability**: MemberList can be used with different data sources

### Performance Benefits

- **Efficient Queries**: Only fetches data relevant to current context
- **Smart Memoization**: Prevents unnecessary re-computations
- **Cache Optimization**: Leverages RTK Query caching efficiently
- **Minimal Re-renders**: Stable references prevent child re-renders

### Maintainability Benefits

- **Single Source of Truth**: All member list logic in one place
- **Easy Testing**: Clear separation of concerns enables focused testing
- **Type Safety**: Full TypeScript coverage with proper type inference
- **Error Boundaries**: Clear error propagation and handling patterns

This container component demonstrates excellent patterns for managing complex, context-aware data fetching while maintaining clean separation between data and presentation concerns.