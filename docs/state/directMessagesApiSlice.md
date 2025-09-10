# Direct Messages Redux API Slice

## Overview

The Direct Messages API slice manages all API interactions for direct messaging functionality, including DM group management, message fetching, and member operations. It integrates with Redux store to provide caching, real-time updates, and seamless state management for direct message conversations.

## API Slice Configuration

**Location**: `frontend/src/features/directMessages/directMessagesApiSlice.ts`

**Type**: RTK Query API Slice

**Domain**: Direct message groups and DM-specific operations

### Base Configuration

```typescript
export const directMessagesApi = createApi({
  reducerPath: "directMessagesApi",
  baseQuery: getBaseAuthedQuery(
    fetchBaseQuery({
      baseUrl: "/api/direct-messages",
      prepareHeaders,
    })
  ),
  tagTypes: ["DirectMessageGroup", "DirectMessages"],
  endpoints: (builder) => ({
    // Endpoints defined below
  }),
});
```

**Configuration Details:**
- **Reducer Path**: `directMessagesApi` (separate from other API slices)
- **Base Query**: `getBaseAuthedQuery` (includes JWT authentication and token refresh)
- **Base URL**: `/api/direct-messages` (DM-specific API endpoints)
- **Tag Types**: `["DirectMessageGroup", "DirectMessages"]` for cache invalidation
- **Authentication**: Automatic JWT token handling via prepareHeaders

## Query Endpoints (Data Fetching)

### getUserDmGroups

```typescript
getUserDmGroups: builder.query<DirectMessageGroup[], void>({
  query: () => "/",
  providesTags: ["DirectMessageGroup"],
})
```

**Purpose**: Fetch all DM groups/conversations for the current user

**API Endpoint**: `GET /api/direct-messages`

**Response**: Array of `DirectMessageGroup` objects

**Cache Tags**: `["DirectMessageGroup"]` (invalidated when DM groups change)

**Usage**:
```typescript
const { data: dmGroups, isLoading, error } = useGetUserDmGroupsQuery();

// dmGroups contains all user's DM conversations with member info and last message
```

### getDmGroup

```typescript
getDmGroup: builder.query<DirectMessageGroup, string>({
  query: (id) => `/${id}`,
  providesTags: (result, error, id) => [{ type: "DirectMessageGroup", id }],
})
```

**Purpose**: Fetch specific DM group details by ID

**API Endpoint**: `GET /api/direct-messages/{id}`

**Parameters**: DM group ID (string)

**Response**: Single `DirectMessageGroup` object with complete member information

**Cache Tags**: Specific DM group tag `[{ type: "DirectMessageGroup", id }]`

**Usage**:
```typescript
const { data: dmGroup, isLoading } = useGetDmGroupQuery(dmGroupId);

// dmGroup contains member details, group name, creation date, etc.
```

### getDmMessages

```typescript
getDmMessages: builder.query<
  { messages: Message[]; continuationToken?: string },
  string
>({
  query: (dmGroupId) => `/${dmGroupId}/messages`,
  providesTags: (result, error, dmGroupId) => [
    { type: "DirectMessages", id: dmGroupId },
  ],
  async onQueryStarted(dmGroupId, { dispatch, queryFulfilled }) {
    try {
      const { data } = await queryFulfilled;
      // Populate Redux store with DM messages, just like channel messages
      if (data && data.messages) {
        dispatch(
          setMessages({
            channelId: dmGroupId, // Use dmGroupId as channelId in the store
            messages: data.messages,
            continuationToken: data.continuationToken,
          })
        );
      }
    } catch (error) {
      console.error("Failed to fetch DM messages:", error);
    }
  },
})
```

**Purpose**: Fetch messages for a specific DM group with Redux integration

**API Endpoint**: `GET /api/direct-messages/{id}/messages`

**Parameters**: DM group ID (string)

**Response**: Object with messages array and optional continuation token

**Cache Tags**: Specific DM messages tag `[{ type: "DirectMessages", id: dmGroupId }]`

**Special Feature**: **Redux Store Integration** via `onQueryStarted`
- Messages automatically populated in Redux store using `setMessages` action
- Uses `dmGroupId` as `channelId` key for unified message storage
- Enables shared message components between channels and DMs

**Usage**:
```typescript
const { data, isLoading } = useGetDmMessagesQuery(dmGroupId);

// Messages also available in Redux store via useDirectMessages hook
```

## Mutation Endpoints (Data Modification)

### createDmGroup

```typescript
createDmGroup: builder.mutation<DirectMessageGroup, CreateDmGroupDto>({
  query: (body) => ({
    url: "/",
    method: "POST",
    body,
  }),
  invalidatesTags: ["DirectMessageGroup"],
})
```

**Purpose**: Create a new DM group (1:1 conversation or group chat)

**API Endpoint**: `POST /api/direct-messages`

**Request Body**: `CreateDmGroupDto`
```typescript
interface CreateDmGroupDto {
  userIds: string[];     // Array of user IDs to include
  name?: string;         // Optional name for group DMs
  isGroup?: boolean;     // Auto-determined if not provided
}
```

**Response**: Created `DirectMessageGroup` object

**Cache Invalidation**: `["DirectMessageGroup"]` (refreshes user's DM list)

**Usage**:
```typescript
const [createDmGroup, { isLoading, error }] = useCreateDmGroupMutation();

const handleCreateDM = async () => {
  try {
    const newDmGroup = await createDmGroup({
      userIds: ['user1', 'user2'],
      name: 'Project Discussion',
      isGroup: true
    }).unwrap();
    
    // Navigate to new DM or handle success
  } catch (error) {
    // Handle creation error
  }
};
```

### addMembersToDmGroup

```typescript
addMembersToDmGroup: builder.mutation<
  DirectMessageGroup,
  { id: string; addMembersDto: AddMembersDto }
>({
  query: ({ id, addMembersDto }) => ({
    url: `/${id}/members`,
    method: "POST",
    body: addMembersDto,
  }),
  invalidatesTags: (result, error, { id }) => [
    { type: "DirectMessageGroup", id },
    "DirectMessageGroup",
  ],
})
```

**Purpose**: Add members to an existing group DM

**API Endpoint**: `POST /api/direct-messages/{id}/members`

**Parameters**: 
- `id`: DM group ID
- `addMembersDto`: Object with `userIds` array

**Request Body**: `AddMembersDto`
```typescript
interface AddMembersDto {
  userIds: string[];  // Array of user IDs to add
}
```

**Response**: Updated `DirectMessageGroup` object with new members

**Cache Invalidation**: Both specific DM group and general DM group list

**Usage**:
```typescript
const [addMembers, { isLoading }] = useAddMembersToDmGroupMutation();

const handleAddMembers = async (dmGroupId: string, userIds: string[]) => {
  await addMembers({
    id: dmGroupId,
    addMembersDto: { userIds }
  }).unwrap();
};
```

### leaveDmGroup

```typescript
leaveDmGroup: builder.mutation<void, string>({
  query: (id) => ({
    url: `/${id}/members/me`,
    method: "DELETE",
  }),
  invalidatesTags: ["DirectMessageGroup"],
})
```

**Purpose**: Leave a DM group (remove current user from members)

**API Endpoint**: `DELETE /api/direct-messages/{id}/members/me`

**Parameters**: DM group ID (string)

**Response**: Void (204 No Content)

**Cache Invalidation**: `["DirectMessageGroup"]` (refreshes user's DM list)

**Usage**:
```typescript
const [leaveDmGroup, { isLoading }] = useLeaveDmGroupMutation();

const handleLeaveDM = async (dmGroupId: string) => {
  try {
    await leaveDmGroup(dmGroupId).unwrap();
    // Navigate away from DM or show confirmation
  } catch (error) {
    // Handle leave error
  }
};
```

## Data Types and Interfaces

### DirectMessageGroup

```typescript
interface DirectMessageGroup {
  id: string;                    // MongoDB ObjectId
  name?: string | null;          // Optional group name
  isGroup: boolean;             // True for group DMs, false for 1:1
  createdAt: Date;              // Creation timestamp
  members: DirectMessageGroupMember[];  // Array of member objects
  lastMessage?: Message | null; // Most recent message preview
}
```

### DirectMessageGroupMember

```typescript
interface DirectMessageGroupMember {
  id: string;                   // Membership ID
  userId: string;               // User ID
  joinedAt: Date;              // When user joined the DM
  user: {                      // User profile information
    id: string;
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
}
```

### CreateDmGroupDto

```typescript
interface CreateDmGroupDto {
  userIds: string[];            // Required: Users to include (excluding creator)
  name?: string;               // Optional: Group name for multi-user DMs
  isGroup?: boolean;           // Optional: Auto-determined if not provided
}
```

### AddMembersDto

```typescript
interface AddMembersDto {
  userIds: string[];           // Required: User IDs to add to the group
}
```

## Cache Management Strategy

### Tag-Based Invalidation

```typescript
tagTypes: ["DirectMessageGroup", "DirectMessages"]
```

**Tag Structure:**
- **`"DirectMessageGroup"`**: General tag for all DM groups
- **`{ type: "DirectMessageGroup", id: string }`**: Specific DM group
- **`{ type: "DirectMessages", id: string }`**: Messages for specific DM group

### Invalidation Patterns

1. **Create DM**: Invalidates `["DirectMessageGroup"]` (refreshes user's DM list)
2. **Add Members**: Invalidates specific group + general list
3. **Leave DM**: Invalidates `["DirectMessageGroup"]` (removes from user's list)
4. **Get Messages**: Provides specific messages cache tag

### Cache Optimization

```typescript
// Specific cache tags prevent unnecessary refetches
providesTags: (result, error, id) => [{ type: "DirectMessageGroup", id }]

// Only invalidate what's necessary
invalidatesTags: (result, error, { id }) => [
  { type: "DirectMessageGroup", id },
  "DirectMessageGroup"
]
```

## Redux Store Integration

### Message Store Population

The `getDmMessages` endpoint includes special Redux integration:

```typescript
async onQueryStarted(dmGroupId, { dispatch, queryFulfilled }) {
  try {
    const { data } = await queryFulfilled;
    if (data && data.messages) {
      dispatch(
        setMessages({
          channelId: dmGroupId, // DM group ID used as channel ID
          messages: data.messages,
          continuationToken: data.continuationToken,
        })
      );
    }
  } catch (error) {
    console.error("Failed to fetch DM messages:", error);
  }
}
```

**Integration Benefits:**
- **Unified Storage**: DM messages use same Redux structure as channel messages
- **Shared Components**: Message components work with both channels and DMs
- **WebSocket Integration**: Real-time updates work with existing message system
- **State Consistency**: Single source of truth for all message data

### State Structure

```typescript
// Redux messages state structure
{
  byChannelId: {
    "channel-123": { messages: [...], continuationToken: "...", hasMore: true },
    "dm-group-456": { messages: [...], continuationToken: "...", hasMore: true }
  }
}
```

**Key Insight**: DM groups are stored using their ID as the `channelId` key, enabling unified message handling.

## Hook Exports

```typescript
export const {
  useGetUserDmGroupsQuery,        // Fetch user's DM groups
  useCreateDmGroupMutation,       // Create new DM group
  useGetDmGroupQuery,            // Fetch specific DM group
  useGetDmMessagesQuery,         // Fetch DM messages
  useAddMembersToDmGroupMutation, // Add members to group DM
  useLeaveDmGroupMutation,       // Leave DM group
} = directMessagesApi;
```

## Usage Examples

### DM Group List with Creation

```typescript
function DirectMessageList() {
  const { data: dmGroups = [], isLoading } = useGetUserDmGroupsQuery();
  const [createDmGroup] = useCreateDmGroupMutation();

  const handleCreateDM = async (userIds: string[], groupName?: string) => {
    const isGroup = userIds.length > 1;
    await createDmGroup({
      userIds,
      name: isGroup ? groupName : undefined,
      isGroup
    }).unwrap();
  };

  if (isLoading) return <div>Loading DM groups...</div>;

  return (
    <div>
      {dmGroups.map(group => (
        <DMGroupItem key={group.id} group={group} />
      ))}
      <CreateDMButton onClick={handleCreateDM} />
    </div>
  );
}
```

### DM Group Management

```typescript
function DMGroupSettings({ dmGroupId }: { dmGroupId: string }) {
  const { data: dmGroup } = useGetDmGroupQuery(dmGroupId);
  const [addMembers] = useAddMembersToDmGroupMutation();
  const [leaveDmGroup] = useLeaveDmGroupMutation();

  const handleAddMembers = async (userIds: string[]) => {
    await addMembers({
      id: dmGroupId,
      addMembersDto: { userIds }
    }).unwrap();
  };

  const handleLeaveGroup = async () => {
    await leaveDmGroup(dmGroupId).unwrap();
    // Navigate away from group
  };

  return (
    <div>
      <h3>{dmGroup?.name || 'Direct Message'}</h3>
      <p>{dmGroup?.members.length} members</p>
      
      {dmGroup?.isGroup && (
        <>
          <AddMembersButton onAdd={handleAddMembers} />
          <LeaveGroupButton onLeave={handleLeaveGroup} />
        </>
      )}
    </div>
  );
}
```

### Message Integration with Real-time

```typescript
function DirectMessageContainer({ dmGroupId }: { dmGroupId: string }) {
  // Fetch messages (populates Redux store)
  const { isLoading } = useGetDmMessagesQuery(dmGroupId);
  
  // Get messages from Redux store + WebSocket updates
  const { messages } = useDirectMessages(dmGroupId);
  
  // WebSocket sending
  const { sendDirectMessage } = useDirectMessageWebSocket();

  return (
    <div>
      {isLoading ? (
        <MessageSkeleton />
      ) : (
        <MessageList messages={messages} />
      )}
      <MessageInput 
        onSendMessage={(content, spans) => 
          sendDirectMessage(dmGroupId, spans)
        } 
      />
    </div>
  );
}
```

## Error Handling

### API Error Types

```typescript
// Common error responses
interface APIError {
  status: number;
  data: {
    statusCode: number;
    message: string;
    error: string;
  };
}

// Error handling in components
const { error } = useGetUserDmGroupsQuery();

if (error) {
  if ('status' in error && error.status === 403) {
    // Handle permission error
    return <div>You don't have permission to access direct messages</div>;
  }
  
  if ('status' in error && error.status === 404) {
    // Handle not found
    return <div>DM group not found</div>;
  }
  
  // Generic error
  return <div>Failed to load direct messages</div>;
}
```

### Mutation Error Handling

```typescript
const [createDmGroup, { error: createError, isLoading }] = useCreateDmGroupMutation();

const handleCreateDM = async (data: CreateDmGroupDto) => {
  try {
    const newDmGroup = await createDmGroup(data).unwrap();
    // Success handling
  } catch (error) {
    if (error.status === 400) {
      // Validation error
      setValidationErrors(error.data.message);
    } else if (error.status === 403) {
      // Permission error
      setPermissionError(true);
    }
    // Handle other errors
  }
};
```

## Testing

### Unit Testing

**Test Coverage:**
- Query endpoint functionality
- Mutation endpoint functionality
- Cache invalidation behavior
- Redux store integration
- Error handling scenarios

**Example Tests:**
```typescript
describe('directMessagesApi', () => {
  it('fetches user DM groups', async () => {
    const mockDmGroups = [
      { id: '1', name: 'Chat', isGroup: true, members: [] }
    ];

    // Mock API response
    server.use(
      rest.get('/api/direct-messages', (req, res, ctx) => {
        return res(ctx.json(mockDmGroups));
      })
    );

    const { result, waitForNextUpdate } = renderHook(() =>
      useGetUserDmGroupsQuery()
    );

    await waitForNextUpdate();

    expect(result.current.data).toEqual(mockDmGroups);
    expect(result.current.isLoading).toBe(false);
  });

  it('creates DM group and invalidates cache', async () => {
    const newDmGroup = { id: '2', name: 'New Chat', isGroup: false };
    
    // Mock successful creation
    server.use(
      rest.post('/api/direct-messages', (req, res, ctx) => {
        return res(ctx.json(newDmGroup));
      })
    );

    const { result } = renderHook(() => useCreateDmGroupMutation());
    
    await act(async () => {
      const createResult = await result.current[0]({
        userIds: ['user1'],
        isGroup: false
      }).unwrap();
      
      expect(createResult).toEqual(newDmGroup);
    });
  });
});
```

### Integration Testing

- **End-to-end DM Creation**: Full flow from UI to API
- **Real-time Message Integration**: Test with WebSocket events
- **Cache Behavior**: Verify proper cache updates across operations
- **Error Recovery**: Test network failures and retries

## Related Components

### Direct Dependencies

- **RTK Query**: `@reduxjs/toolkit/query/react`
- **AuthedBaseQuery**: Authentication wrapper for API calls
- **Message Slice**: Redux slice for message state management
- **Type Definitions**: DirectMessage types and DTOs

### Integration Points

- **useDirectMessages Hook**: Consumes `useGetDmMessagesQuery`
- **useDirectMessageWebSocket**: Handles real-time DM events
- **Message Components**: Shared between channels and DMs
- **Redux Store**: Unified message storage structure

---

## Architecture Benefits

### Unified Message Architecture

- **Single Storage**: DMs and channels share Redux message structure
- **Component Reuse**: Same message components work for both contexts
- **WebSocket Integration**: Real-time updates use existing infrastructure

### Performance Optimization

- **Selective Caching**: Specific cache tags prevent unnecessary refetches
- **Background Updates**: RTK Query handles cache updates automatically
- **Memory Efficiency**: Only active conversations kept in state

### Developer Experience

- **Type Safety**: Full TypeScript coverage for all operations
- **Predictable Caching**: Clear cache invalidation patterns
- **Error Handling**: Comprehensive error types and handling patterns

This API slice provides a robust foundation for direct messaging in Kraken, with excellent caching, real-time integration, and developer-friendly patterns that mirror the existing channel message architecture.