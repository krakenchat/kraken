# Channel Redux API Slice

> **Location:** `frontend/src/features/channel/channelApiSlice.ts`  
> **Type:** RTK Query API  
> **Domain:** Channel management within communities

## Overview

The Channel API slice manages text and voice channels within communities. It provides full CRUD operations for channel management including creating channels, fetching community channels, and managing channel properties. Channels can be either public (visible to all community members) or private (restricted access).

## API Configuration

```typescript
export const channelApi = createApi({
  reducerPath: "channelApi",
  baseQuery: getBaseAuthedQuery(
    fetchBaseQuery({
      baseUrl: "/api/channels",
      prepareHeaders,
    })
  ),
  tagTypes: ["Channel"],
  endpoints: (builder) => ({
    // Endpoints defined below
  }),
});
```

### Base Configuration
- **Reducer Path:** `channelApi`
- **Base Query:** `getBaseAuthedQuery` (includes JWT authentication and token refresh)
- **Base URL:** `/api/channels`
- **Tag Types:** `["Channel"]`

## Endpoints

### Query Endpoints (Data Fetching)

#### getChannelsForCommunity
```typescript
getChannelsForCommunity: builder.query<Channel[], string>({
  query: (communityId) => ({
    url: `/community/${communityId}`,
    method: "GET",
  }),
  providesTags: (_result, _error, communityId) => [
    { type: "Channel", id: `community-${communityId}` },
  ],
})
```

**Purpose:** Fetches all channels that the current user can access within a specific community.

**Usage:**
```typescript
const { 
  data: channels = [], 
  error, 
  isLoading,
  refetch 
} = useChannelApi.useGetChannelsForCommunityQuery(communityId);
```

#### getChannelById
```typescript
getChannelById: builder.query<Channel, string>({
  query: (channelId) => ({
    url: `/${channelId}`,
    method: "GET",
  }),
  providesTags: (_result, _error, channelId) => [
    { type: "Channel", id: channelId },
  ],
})
```

**Purpose:** Fetches detailed information for a specific channel by ID.

**Usage:**
```typescript
const { 
  data: channel, 
  error, 
  isLoading 
} = useChannelApi.useGetChannelByIdQuery(channelId, {
  skip: !channelId, // Skip if no ID provided
});
```

### Mutation Endpoints (Data Modification)

#### createChannel
```typescript
createChannel: builder.mutation<Channel, CreateChannelDto>({
  query: (body) => ({
    url: "/",
    method: "POST",
    body,
  }),
  invalidatesTags: (_result, _error, { communityId }) => [
    { type: "Channel", id: `community-${communityId}` },
    "Channel",
  ],
})
```

**Purpose:** Creates a new channel within a community (requires appropriate permissions).

**Usage:**
```typescript
const [createChannel, { isLoading, error }] = useChannelApi.useCreateChannelMutation();

const handleCreateChannel = async (channelData: CreateChannelDto) => {
  try {
    const newChannel = await createChannel(channelData).unwrap();
    // Navigate to new channel or show success message
    navigate(`/community/${channelData.communityId}/channel/${newChannel.id}`);
  } catch (err) {
    // Handle error
  }
};
```

#### updateChannel
```typescript
updateChannel: builder.mutation<
  Channel,
  { id: string; data: UpdateChannelDto }
>({
  query: ({ id, data }) => ({
    url: `/${id}`,
    method: "PATCH",
    body: data,
  }),
  invalidatesTags: (_result, _error, { id }) => [
    { type: "Channel", id },
    "Channel",
  ],
})
```

**Purpose:** Updates an existing channel's properties (requires channel management permissions).

**Usage:**
```typescript
const [updateChannel, { isLoading, error }] = useChannelApi.useUpdateChannelMutation();

const handleUpdate = async (channelId: string, updates: UpdateChannelDto) => {
  try {
    const updatedChannel = await updateChannel({ 
      id: channelId, 
      data: updates 
    }).unwrap();
    // Show success message
  } catch (err) {
    // Handle error
  }
};
```

#### deleteChannel
```typescript
deleteChannel: builder.mutation<void, string>({
  query: (channelId) => ({
    url: `/${channelId}`,
    method: "DELETE",
  }),
  invalidatesTags: (_result, _error, channelId) => [
    { type: "Channel", id: channelId },
    "Channel",
  ],
})
```

#### getMentionableChannels
```typescript
getMentionableChannels: builder.query<Channel[], string>({
  query: (communityId) => ({
    url: `/community/${communityId}/mentionable`,
    method: "GET",
  }),
  providesTags: (_result, _error, communityId) => [
    { type: "Channel", id: `mentionable-${communityId}` },
  ],
})
```

**Purpose:** Fetches channels that the current user can mention in messages within a specific community. Returns public channels plus private channels where the user is a member.

**Usage:**
```typescript
const { 
  data: mentionableChannels = [], 
  error, 
  isLoading 
} = useChannelApi.useGetMentionableChannelsQuery(communityId, {
  skip: !communityId,
});

// Transform for mention autocomplete
const channelMentions = mentionableChannels.map(channel => ({
  id: channel.id,
  name: channel.name,
  type: 'channel' as const
}));
```

**Purpose (deleteChannel):** Permanently deletes a channel and all its messages (requires admin permissions).

**Usage (deleteChannel):**
```typescript
const [deleteChannel, { isLoading }] = useChannelApi.useDeleteChannelMutation();

const handleDelete = async (channelId: string) => {
  if (confirm('Are you sure you want to delete this channel? This action cannot be undone.')) {
    try {
      await deleteChannel(channelId).unwrap();
      // Navigate away from deleted channel
      navigate(`/community/${communityId}`);
    } catch (err) {
      // Handle error
    }
  }
};
```

## Type Definitions

### Request Types

```typescript
interface CreateChannelDto {
  name: string;
  description?: string;
  type: "TEXT" | "VOICE";
  communityId: string;
  isPrivate?: boolean;
}

interface UpdateChannelDto {
  name?: string;
  description?: string;
  isPrivate?: boolean;
}
```

### Response Types

```typescript
interface Channel {
  id: string;
  name: string;
  description?: string;
  type: "TEXT" | "VOICE";
  communityId: string;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  position?: number;
  parentId?: string; // For channel categories
  rateLimitPerUser?: number; // Slowmode in seconds
  nsfw?: boolean;
  topic?: string;
  lastMessageId?: string;
  messageCount?: number;
  memberCount?: number; // For voice channels
}
```

## Caching Strategy

### Cache Tags

```typescript
tagTypes: ["Channel"]

// Tagging patterns:
// - Community channels: { type: "Channel", id: `community-${communityId}` }
// - Individual channels: { type: "Channel", id: channelId }
// - Mentionable channels: { type: "Channel", id: `mentionable-${communityId}` }
// - Generic tag: "Channel"
```

### Cache Invalidation

| Action | Invalidates | Reason |
|--------|-------------|---------|
| Create Channel | Community-specific tag + generic `"Channel"` | New channel affects community channel list |
| Update Channel | Specific channel ID + generic `"Channel"` | Channel details and lists need refresh |
| Delete Channel | Specific channel ID + generic `"Channel"` | Channel removed from all caches |

### Cache Behavior

- **Automatic Refetching:** Channel lists automatically refetch when channels are created/updated/deleted
- **Background Updates:** Channels refetch when user navigates back to community
- **Optimistic Updates:** Channel updates can be applied optimistically for better UX

## State Management

### Generated Hooks

```typescript
export const {
  // Query hooks
  useGetChannelsForCommunityQuery,
  useGetChannelByIdQuery,
  useGetMentionableChannelsQuery,
  
  // Mutation hooks  
  useCreateChannelMutation,
  useUpdateChannelMutation,
  useDeleteChannelMutation,
  
  // Utility hooks
  usePrefetch,
} = channelApi;
```

### Manual Cache Manipulation

```typescript
// Prefetch channel data
dispatch(channelApi.util.prefetch('getChannelById', channelId, { force: true }));

// Optimistic channel creation
const patchResult = dispatch(
  channelApi.util.updateQueryData(
    'getChannelsForCommunity', 
    communityId, 
    (draft) => {
      draft.push(optimisticChannel);
    }
  )
);
```

## Error Handling

### Query Errors

```typescript
const { data, error, isLoading } = useGetChannelsForCommunityQuery(communityId);

if (error) {
  if ('status' in error) {
    switch (error.status) {
      case 403:
        // User doesn't have permission to view channels
        return <div>Access denied to community channels</div>;
      case 404:
        // Community not found
        return <div>Community not found</div>;
      default:
        return <div>Error loading channels</div>;
    }
  } else {
    // Network error
    console.error('Network error:', error.message);
  }
}
```

### Mutation Errors

```typescript
const [createChannel, { error, isLoading }] = useCreateChannelMutation();

const handleSubmit = async (data) => {
  try {
    await createChannel(data).unwrap();
  } catch (err: any) {
    if (err.status === 400) {
      // Validation error
      if (err.data?.message?.includes('name already exists')) {
        setError("A channel with this name already exists");
      } else {
        setError("Invalid channel data");
      }
    } else if (err.status === 403) {
      // Permission error
      setError("You don't have permission to create channels");
    } else {
      // Generic error
      setError("Failed to create channel");
    }
  }
};
```

## WebSocket Integration

### Real-time Channel Updates

```typescript
// WebSocket event listeners that update the cache
useWebSocket('CHANNEL_CREATED', (newChannel) => {
  dispatch(channelApi.util.updateQueryData(
    'getChannelsForCommunity',
    newChannel.communityId,
    (draft) => {
      draft.push(newChannel);
    }
  ));
});

useWebSocket('CHANNEL_UPDATED', (updatedChannel) => {
  dispatch(channelApi.util.updateQueryData(
    'getChannelById', 
    updatedChannel.id, 
    () => updatedChannel
  ));
  
  // Also update in the community channel list
  dispatch(channelApi.util.updateQueryData(
    'getChannelsForCommunity',
    updatedChannel.communityId,
    (draft) => {
      const index = draft.findIndex(c => c.id === updatedChannel.id);
      if (index !== -1) {
        draft[index] = updatedChannel;
      }
    }
  ));
});

useWebSocket('CHANNEL_DELETED', ({ channelId, communityId }) => {
  dispatch(channelApi.util.invalidateTags([
    { type: 'Channel', id: channelId },
    { type: 'Channel', id: `community-${communityId}` }
  ]));
});
```

## Mention System Integration

### Channel Mention Autocomplete

The `getMentionableChannels` endpoint integrates with the mention autocomplete system:

```typescript
import { useMentionAutocomplete } from '@/hooks/useMentionAutocomplete';
import { useGetMentionableChannelsQuery } from '@/features/channel/channelApiSlice';

function MessageInputWithMentions({ communityId }: { communityId: string }) {
  // Fetch mentionable channels for the community
  const { data: channelData = [] } = useGetMentionableChannelsQuery(communityId);
  
  // Transform to mention format
  const channelMentions = channelData.map(channel => ({
    id: channel.id,
    name: channel.name,
    type: 'channel' as const
  }));

  // Use mention autocomplete hook
  const {
    state: mentionState,
    selectSuggestion,
    handleKeyDown
  } = useMentionAutocomplete({
    communityId,
    text: inputText,
    cursorPosition
  });

  return (
    <div className="message-input-container">
      <input 
        value={inputText}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        placeholder="Type @ for users, # for channels"
      />
      
      {mentionState.isOpen && (
        <MentionDropdown
          suggestions={mentionState.suggestions}
          selectedIndex={mentionState.selectedIndex}
          onSelectSuggestion={selectSuggestion}
        />
      )}
    </div>
  );
}
```

### Access Control for Mentions

The mentionable channels endpoint respects channel access control:

```typescript
// Frontend logic matches backend access control
function useChannelMentionFiltering(communityId: string) {
  const { data: mentionableChannels = [] } = useGetMentionableChannelsQuery(communityId);
  
  // Backend already filters by:
  // 1. Public channels (isPrivate: false)
  // 2. Private channels where user is member
  // So no additional filtering needed on frontend
  
  return mentionableChannels;
}
```

### Cache Optimization for Mentions

```typescript
// Prefetch mentionable channels when entering a community
const prefetchMentionableChannels = usePrefetch('getMentionableChannels');

useEffect(() => {
  if (communityId) {
    // Prefetch for mention autocomplete
    prefetchMentionableChannels(communityId, { force: false });
  }
}, [communityId, prefetchMentionableChannels]);
```

## Component Integration

### Channel List Component

```typescript
import { useChannelApi } from '@/features/channel/channelApiSlice';

function ChannelList({ communityId }: { communityId: string }) {
  const { 
    data: channels = [], 
    error, 
    isLoading,
    refetch 
  } = useChannelApi.useGetChannelsForCommunityQuery(communityId);

  if (isLoading) return <div>Loading channels...</div>;
  if (error) return <div>Error loading channels</div>;

  // Group channels by type
  const textChannels = channels.filter(c => c.type === 'TEXT');
  const voiceChannels = channels.filter(c => c.type === 'VOICE');

  return (
    <div className="channel-list">
      <div className="channel-section">
        <h3>Text Channels</h3>
        {textChannels.map(channel => (
          <ChannelItem 
            key={channel.id} 
            channel={channel}
            type="text"
          />
        ))}
      </div>
      
      <div className="channel-section">
        <h3>Voice Channels</h3>
        {voiceChannels.map(channel => (
          <ChannelItem 
            key={channel.id} 
            channel={channel}
            type="voice"
          />
        ))}
      </div>
    </div>
  );
}
```

### Channel Creation Form

```typescript
function CreateChannelForm({ communityId, onClose }: { 
  communityId: string; 
  onClose: () => void; 
}) {
  const [createChannel, { isLoading, error }] = useChannelApi.useCreateChannelMutation();
  const [formData, setFormData] = useState<CreateChannelDto>({
    name: '',
    description: '',
    type: 'TEXT',
    communityId,
    isPrivate: false
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newChannel = await createChannel(formData).unwrap();
      onClose();
      // Navigate to new channel
      navigate(`/community/${communityId}/channel/${newChannel.id}`);
    } catch (err) {
      // Error handling in component state
    }
  };

  return (
    <form onSubmit={handleSubmit} className="create-channel-form">
      <div className="form-group">
        <label>Channel Type</label>
        <select
          value={formData.type}
          onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'TEXT' | 'VOICE' }))}
        >
          <option value="TEXT"># Text Channel</option>
          <option value="VOICE">🔊 Voice Channel</option>
        </select>
      </div>

      <div className="form-group">
        <label>Channel Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="general"
          required
        />
      </div>

      <div className="form-group">
        <label>Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="What's this channel about?"
        />
      </div>

      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={formData.isPrivate}
            onChange={(e) => setFormData(prev => ({ ...prev, isPrivate: e.target.checked }))}
          />
          Private Channel
        </label>
      </div>

      <div className="form-actions">
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create Channel'}
        </button>
      </div>
      
      {error && <div className="error">Failed to create channel</div>}
    </form>
  );
}
```

## Performance Optimization

### Channel List Virtualization

```typescript
// For communities with many channels, use virtualization
const { data: channels = [] } = useGetChannelsForCommunityQuery(communityId, {
  selectFromResult: ({ data, ...other }) => ({
    ...other,
    data: data?.slice(0, 50) // Limit initial render
  }),
});
```

### Selective Channel Data

```typescript
// Only fetch necessary channel data for lists
const { channelNames } = useGetChannelsForCommunityQuery(communityId, {
  selectFromResult: ({ data, ...other }) => ({
    ...other,
    channelNames: data?.map(c => ({ id: c.id, name: c.name, type: c.type }))
  }),
});
```

### Prefetching Strategies

```typescript
// Prefetch channel details when hovering over channel in list
const prefetch = usePrefetch('getChannelById');

const handleChannelHover = (channelId: string) => {
  prefetch(channelId, { force: false });
};
```

## Common Usage Patterns

### Pattern 1: Channel Navigation with Active State

```typescript
function ChannelNavigation({ communityId, activeChannelId }: {
  communityId: string;
  activeChannelId?: string;
}) {
  const { data: channels = [] } = useGetChannelsForCommunityQuery(communityId);

  return (
    <nav className="channel-navigation">
      {channels.map(channel => (
        <Link
          key={channel.id}
          to={`/community/${communityId}/channel/${channel.id}`}
          className={`channel-link ${channel.id === activeChannelId ? 'active' : ''}`}
        >
          <span className="channel-icon">
            {channel.type === 'TEXT' ? '#' : '🔊'}
          </span>
          <span className="channel-name">{channel.name}</span>
          {channel.isPrivate && <span className="private-indicator">🔒</span>}
        </Link>
      ))}
    </nav>
  );
}
```

### Pattern 2: Channel Management with Permissions

```typescript
function ChannelHeader({ channel }: { channel: Channel }) {
  const { data: userPermissions } = useGetMyRolesForChannelQuery(channel.id);
  const [updateChannel] = useUpdateChannelMutation();
  const [deleteChannel] = useDeleteChannelMutation();
  
  const canManageChannel = userPermissions?.actions.includes('MANAGE_CHANNELS');
  const canDeleteChannel = userPermissions?.actions.includes('DELETE_CHANNELS');

  return (
    <div className="channel-header">
      <h2>
        {channel.type === 'TEXT' ? '#' : '🔊'} {channel.name}
      </h2>
      
      {canManageChannel && (
        <div className="channel-actions">
          <button onClick={() => openEditModal(channel)}>Edit</button>
          {canDeleteChannel && (
            <button onClick={() => handleDelete(channel.id)}>Delete</button>
          )}
        </div>
      )}
    </div>
  );
}
```

## Testing

### Query Testing

```typescript
import { renderHook } from '@testing-library/react-hooks';
import { channelApi } from '../channelApiSlice';

describe('channelApi', () => {
  it('should fetch community channels successfully', async () => {
    const { result } = renderHook(
      () => channelApi.useGetChannelsForCommunityQuery('community-123'),
      { wrapper: TestProvider }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeDefined();
    expect(Array.isArray(result.current.data)).toBe(true);
  });
});
```

### Mutation Testing

```typescript
it('should create channel successfully', async () => {
  const testChannelData = {
    name: 'test-channel',
    type: 'TEXT' as const,
    communityId: 'community-123',
    isPrivate: false
  };

  const { result } = renderHook(
    () => channelApi.useCreateChannelMutation(),
    { wrapper: TestProvider }
  );

  await act(async () => {
    const response = await result.current[0](testChannelData).unwrap();
    expect(response.id).toBeDefined();
    expect(response.name).toBe(testChannelData.name);
    expect(response.type).toBe(testChannelData.type);
  });
});
```

## Related Documentation

- [Messages API](./messagesApi.md) - Channel message management
- [Voice Presence API](./voicePresenceApi.md) - Voice channel user presence
- [Channel Membership API](./channelMembershipApi.md) - Private channel access control
- [Community API](./communityApi.md) - Parent community management
- [RBAC System](../features/auth-rbac.md) - Channel permissions and roles
- [WebSocket Events](../api/websocket-events.md) - Real-time channel updates