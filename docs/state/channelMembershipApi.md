# Channel Membership Redux API Slice

> **Location:** `frontend/src/features/membership/channelMembershipApiSlice.ts`  
> **Type:** RTK Query API  
> **Domain:** Private channel access control

## Overview

The Channel Membership API slice manages access control for private channels within communities. It provides functionality for adding/removing users from private channels, managing channel-specific permissions, and maintaining channel member lists. This enables Discord-like private channel functionality with fine-grained access control.

## API Configuration

```typescript
export const channelMembershipApi = createApi({
  reducerPath: "channelMembershipApi",
  baseQuery: getBaseAuthedQuery(
    fetchBaseQuery({
      baseUrl: "/api/channel-membership",
      prepareHeaders,
    })
  ),
  tagTypes: ["ChannelMembership"],
  endpoints: (builder) => ({
    // Endpoints defined below
  }),
});
```

### Base Configuration
- **Reducer Path:** `channelMembershipApi`
- **Base Query:** `getBaseAuthedQuery` (includes JWT authentication and token refresh)
- **Base URL:** `/api/channel-membership`
- **Tag Types:** `["ChannelMembership"]`

## Endpoints

### Query Endpoints (Data Fetching)

#### getMembersForChannel
```typescript
getMembersForChannel: builder.query<ChannelMembershipResponseDto[], string>({
  query: (channelId) => ({
    url: `/channel/${channelId}`,
    method: "GET",
  }),
  providesTags: (_result, _error, channelId) => [
    { type: "ChannelMembership", id: `channel-${channelId}` },
  ],
})
```

**Purpose:** Fetches all members with access to a specific private channel.

**Usage:**
```typescript
const { 
  data: channelMembers = [], 
  error, 
  isLoading,
  refetch 
} = useChannelMembershipApi.useGetMembersForChannelQuery(channelId);
```

#### getChannelMembershipsForUser
```typescript
getChannelMembershipsForUser: builder.query<
  ChannelMembershipResponseDto[],
  string
>({
  query: (userId) => ({
    url: `/user/${userId}`,
    method: "GET",
  }),
  providesTags: (_result, _error, userId) => [
    { type: "ChannelMembership", id: `user-${userId}` },
  ],
})
```

**Purpose:** Fetches all private channel memberships for a specific user.

**Usage:**
```typescript
const { 
  data: userChannelMemberships = [], 
  error, 
  isLoading 
} = useChannelMembershipApi.useGetChannelMembershipsForUserQuery(userId, {
  skip: !userId,
});
```

#### getMyChannelMemberships
```typescript
getMyChannelMemberships: builder.query<
  ChannelMembershipResponseDto[],
  void
>({
  query: () => ({
    url: "/my",
    method: "GET",
  }),
  providesTags: [{ type: "ChannelMembership", id: "my" }],
})
```

**Purpose:** Fetches all private channel memberships for the current user.

**Usage:**
```typescript
const { 
  data: myChannelMemberships = [], 
  error, 
  isLoading 
} = useChannelMembershipApi.useGetMyChannelMembershipsQuery();
```

#### getChannelMembership
```typescript
getChannelMembership: builder.query<
  ChannelMembershipResponseDto,
  { userId: string; channelId: string }
>({
  query: ({ userId, channelId }) => ({
    url: `/channel/${channelId}/user/${userId}`,
    method: "GET",
  }),
  providesTags: (_result, _error, { userId, channelId }) => [
    { type: "ChannelMembership", id: `${userId}-${channelId}` },
  ],
})
```

**Purpose:** Fetches a specific channel membership relationship.

**Usage:**
```typescript
const { 
  data: channelMembership, 
  error, 
  isLoading 
} = useChannelMembershipApi.useGetChannelMembershipQuery({ 
  userId, 
  channelId 
}, {
  skip: !userId || !channelId,
});
```

### Mutation Endpoints (Data Modification)

#### createChannelMembership
```typescript
createChannelMembership: builder.mutation<
  ChannelMembershipResponseDto,
  CreateChannelMembershipDto
>({
  query: (body) => ({
    url: "/",
    method: "POST",
    body,
  }),
  invalidatesTags: (_result, _error, { channelId }) => [
    { type: "ChannelMembership", id: `channel-${channelId}` },
    "ChannelMembership",
  ],
})
```

**Purpose:** Adds a user to a private channel with specified role (requires channel management permissions).

**Usage:**
```typescript
const [createChannelMembership, { isLoading, error }] = useChannelMembershipApi.useCreateChannelMembershipMutation();

const handleAddChannelMember = async (userId: string, channelId: string, role?: "MEMBER" | "MODERATOR" | "ADMIN") => {
  try {
    const membership = await createChannelMembership({
      userId,
      channelId,
      role: role || "MEMBER"
    }).unwrap();
    // Show success message
  } catch (err) {
    // Handle error
  }
};
```

#### removeChannelMembership
```typescript
removeChannelMembership: builder.mutation<
  void,
  { userId: string; channelId: string }
>({
  query: ({ userId, channelId }) => ({
    url: `/channel/${channelId}/user/${userId}`,
    method: "DELETE",
  }),
  invalidatesTags: (_result, _error, { userId, channelId }) => [
    { type: "ChannelMembership", id: `channel-${channelId}` },
    { type: "ChannelMembership", id: `user-${userId}` },
    { type: "ChannelMembership", id: `${userId}-${channelId}` },
    "ChannelMembership",
  ],
})
```

**Purpose:** Removes a user from a private channel (requires channel management permissions).

**Usage:**
```typescript
const [removeChannelMembership, { isLoading }] = useChannelMembershipApi.useRemoveChannelMembershipMutation();

const handleRemoveChannelMember = async (userId: string, channelId: string) => {
  if (confirm('Remove this member from the channel?')) {
    try {
      await removeChannelMembership({ userId, channelId }).unwrap();
      // Show success message
    } catch (err) {
      // Handle error
    }
  }
};
```

#### leaveChannel
```typescript
leaveChannel: builder.mutation<void, string>({
  query: (channelId) => ({
    url: `/leave/${channelId}`,
    method: "DELETE",
  }),
  invalidatesTags: (_result, _error, channelId) => [
    { type: "ChannelMembership", id: `channel-${channelId}` },
    { type: "ChannelMembership", id: "my" },
    "ChannelMembership",
  ],
})
```

**Purpose:** Allows the current user to leave a private channel.

**Usage:**
```typescript
const [leaveChannel, { isLoading }] = useChannelMembershipApi.useLeaveChannelMutation();

const handleLeaveChannel = async (channelId: string) => {
  if (confirm('Leave this private channel?')) {
    try {
      await leaveChannel(channelId).unwrap();
      // Navigate away from channel
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
interface CreateChannelMembershipDto {
  userId: string;
  channelId: string;
  role?: "MEMBER" | "MODERATOR" | "ADMIN";
}
```

### Response Types

```typescript
interface ChannelMembershipResponseDto {
  id: string;
  userId: string;
  channelId: string;
  joinedAt: string;
  role: "MEMBER" | "MODERATOR" | "ADMIN";
  addedBy?: string;
  user?: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  channel?: {
    id: string;
    name: string;
    communityId: string;
    isPrivate: boolean;
  };
}
```

## Caching Strategy

### Cache Tags

```typescript
tagTypes: ["ChannelMembership"]

// Tagging patterns:
// - Channel members: { type: "ChannelMembership", id: `channel-${channelId}` }
// - User channel memberships: { type: "ChannelMembership", id: `user-${userId}` }
// - Specific membership: { type: "ChannelMembership", id: `${userId}-${channelId}` }
// - Current user's memberships: { type: "ChannelMembership", id: "my" }
// - Generic tag: "ChannelMembership"
```

### Cache Invalidation

| Action | Invalidates | Reason |
|--------|-------------|---------|
| Create Channel Membership | Channel tag + generic `"ChannelMembership"` | New member affects channel member list |
| Remove Channel Membership | Channel, user, specific + generic tags | Member removal affects multiple queries |
| Leave Channel | Channel tag + "my" tag + generic | User leaving affects channel and user's memberships |

### Cache Behavior

- **Automatic Refetching:** Channel member lists automatically refetch when memberships change
- **Cross-Query Updates:** Changes invalidate related queries (channel members, user memberships)
- **Permission Integration:** Works with role-based access control for channel visibility

## State Management

### Generated Hooks

```typescript
export const {
  // Query hooks
  useGetMembersForChannelQuery,
  useGetChannelMembershipsForUserQuery,
  useGetMyChannelMembershipsQuery,
  useGetChannelMembershipQuery,
  
  // Mutation hooks  
  useCreateChannelMembershipMutation,
  useRemoveChannelMembershipMutation,
  useLeaveChannelMutation,
  
  // Utility hooks
  usePrefetch,
} = channelMembershipApi;
```

### Manual Cache Operations

```typescript
// Prefetch channel members when accessing private channel
const prefetch = usePrefetch('getMembersForChannel');

const handleChannelAccess = (channelId: string) => {
  prefetch(channelId, { force: false });
};

// Optimistic member addition
const patchResult = dispatch(
  channelMembershipApi.util.updateQueryData(
    'getMembersForChannel', 
    channelId, 
    (draft) => {
      draft.push(optimisticMember);
    }
  )
);
```

## Error Handling

### Query Errors

```typescript
const { data, error, isLoading } = useGetMembersForChannelQuery(channelId);

if (error) {
  if ('status' in error) {
    switch (error.status) {
      case 403:
        // User doesn't have permission to view channel members
        return <div>Access denied to channel</div>;
      case 404:
        // Channel not found or not private
        return <div>Private channel not found</div>;
      default:
        return <div>Error loading channel members</div>;
    }
  } else {
    // Network error
    console.error('Network error:', error.message);
  }
}
```

### Mutation Errors

```typescript
const [createChannelMembership, { error, isLoading }] = useCreateChannelMembershipMutation();

const handleAddMember = async (userId: string, channelId: string) => {
  try {
    await createChannelMembership({ userId, channelId }).unwrap();
  } catch (err: any) {
    if (err.status === 400) {
      if (err.data?.message?.includes('already a member')) {
        setError("User already has access to this channel");
      } else {
        setError("Invalid membership data");
      }
    } else if (err.status === 403) {
      setError("You don't have permission to manage this channel");
    } else if (err.status === 404) {
      setError("User or channel not found");
    } else {
      setError("Failed to add channel member");
    }
  }
};
```

## WebSocket Integration

### Real-time Channel Membership Updates

```typescript
// Listen for new channel members
useWebSocket('CHANNEL_MEMBER_ADDED', (membershipData) => {
  dispatch(channelMembershipApi.util.updateQueryData(
    'getMembersForChannel',
    membershipData.channelId,
    (draft) => {
      draft.push(membershipData);
    }
  ));
});

// Listen for channel members leaving
useWebSocket('CHANNEL_MEMBER_REMOVED', ({ userId, channelId }) => {
  dispatch(channelMembershipApi.util.updateQueryData(
    'getMembersForChannel',
    channelId,
    (draft) => {
      return draft.filter(member => member.userId !== userId);
    }
  ));
});

// Listen for role updates
useWebSocket('CHANNEL_MEMBER_ROLE_UPDATED', (updatedMembership) => {
  dispatch(channelMembershipApi.util.updateQueryData(
    'getChannelMembership',
    { userId: updatedMembership.userId, channelId: updatedMembership.channelId },
    () => updatedMembership
  ));
});
```

## Component Integration

### Private Channel Member List

```typescript
import { useChannelMembershipApi } from '@/features/membership/channelMembershipApiSlice';

function PrivateChannelMemberList({ channelId }: { channelId: string }) {
  const { 
    data: channelMembers = [], 
    error, 
    isLoading,
    refetch 
  } = useChannelMembershipApi.useGetMembersForChannelQuery(channelId);

  const [removeChannelMembership] = useChannelMembershipApi.useRemoveChannelMembershipMutation();

  const handleRemoveMember = async (userId: string) => {
    if (confirm('Remove member from channel?')) {
      try {
        await removeChannelMembership({ userId, channelId }).unwrap();
      } catch (err) {
        console.error('Failed to remove channel member:', err);
      }
    }
  };

  if (isLoading) return <div>Loading channel members...</div>;
  if (error) return <div>Error loading channel members</div>;

  return (
    <div className="channel-member-list">
      <h3>Channel Members ({channelMembers.length})</h3>
      {channelMembers.map(member => (
        <div key={member.id} className="channel-member-item">
          <img 
            src={member.user?.avatarUrl || '/default-avatar.png'} 
            alt="" 
            className="member-avatar" 
          />
          <div className="member-info">
            <div className="member-name">
              {member.user?.displayName || member.user?.username}
            </div>
            <div className="member-role">
              {member.role}
            </div>
            <div className="member-joined">
              Added {formatDate(member.joinedAt)}
            </div>
          </div>
          <div className="member-actions">
            <select 
              value={member.role}
              onChange={(e) => handleRoleUpdate(member.userId, e.target.value)}
            >
              <option value="MEMBER">Member</option>
              <option value="MODERATOR">Moderator</option>
              <option value="ADMIN">Admin</option>
            </select>
            <button 
              onClick={() => handleRemoveMember(member.userId)}
              className="remove-member-btn"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Add Channel Member Form

```typescript
function AddChannelMemberForm({ channelId, communityId, onClose }: { 
  channelId: string; 
  communityId: string; 
  onClose: () => void; 
}) {
  const [createChannelMembership, { isLoading, error }] = useChannelMembershipApi.useCreateChannelMembershipMutation();
  const { data: communityMembers = [] } = useGetMembersForCommunityQuery(communityId);
  const { data: channelMembers = [] } = useGetMembersForChannelQuery(channelId);
  
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<"MEMBER" | "MODERATOR" | "ADMIN">('MEMBER');

  // Filter out users who already have channel access
  const channelMemberIds = new Set(channelMembers.map(m => m.userId));
  const availableMembers = communityMembers.filter(m => !channelMemberIds.has(m.userId));

  const handleAddMember = async () => {
    if (!selectedUserId) return;
    
    try {
      await createChannelMembership({
        userId: selectedUserId,
        channelId,
        role: selectedRole
      }).unwrap();
      onClose();
    } catch (err) {
      // Error handling
    }
  };

  return (
    <div className="add-channel-member-form">
      <h3>Add Channel Member</h3>
      
      <div className="form-group">
        <label>Select Member</label>
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
        >
          <option value="">Choose a member...</option>
          {availableMembers.map(member => (
            <option key={member.userId} value={member.userId}>
              {member.user?.displayName || member.user?.username}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Channel Role</label>
        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value as "MEMBER" | "MODERATOR" | "ADMIN")}
        >
          <option value="MEMBER">Member</option>
          <option value="MODERATOR">Moderator</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>
      
      <div className="form-actions">
        <button onClick={onClose}>Cancel</button>
        <button 
          onClick={handleAddMember} 
          disabled={!selectedUserId || isLoading}
        >
          {isLoading ? 'Adding...' : 'Add to Channel'}
        </button>
      </div>
      
      {error && <div className="error">Failed to add channel member</div>}
    </div>
  );
}
```

### My Private Channels

```typescript
function MyPrivateChannelsList() {
  const { 
    data: channelMemberships = [], 
    error, 
    isLoading 
  } = useChannelMembershipApi.useGetMyChannelMembershipsQuery();

  const [leaveChannel] = useChannelMembershipApi.useLeaveChannelMutation();

  const handleLeaveChannel = async (channelId: string, channelName: string) => {
    if (confirm(`Leave ${channelName}?`)) {
      try {
        await leaveChannel(channelId).unwrap();
      } catch (err) {
        console.error('Failed to leave channel:', err);
      }
    }
  };

  if (isLoading) return <div>Loading your channels...</div>;
  if (error) return <div>Error loading channels</div>;

  return (
    <div className="my-private-channels">
      <h2>My Private Channels</h2>
      {channelMemberships.map(membership => (
        <div key={membership.id} className="private-channel-membership">
          <div className="channel-info">
            <h4>#{membership.channel?.name}</h4>
            <p>Role: {membership.role}</p>
            <p>Added: {formatDate(membership.joinedAt)}</p>
          </div>
          <div className="channel-actions">
            <Link to={`/community/${membership.channel?.communityId}/channel/${membership.channelId}`}>
              View Channel
            </Link>
            <button 
              onClick={() => handleLeaveChannel(
                membership.channelId, 
                membership.channel?.name || 'Channel'
              )}
              className="leave-btn"
            >
              Leave
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

## Performance Optimization

### Channel Access Control

```typescript
// Check if user has channel access before rendering
const { data: channelMembership } = useGetChannelMembershipQuery({
  userId: currentUserId,
  channelId
}, {
  skip: !currentUserId || !channelId,
});

const hasChannelAccess = channelMembership || channel.isPrivate === false;
```

### Role-Based Rendering

```typescript
// Render UI elements based on channel role
const userRole = channelMembership?.role;
const canManageMembers = userRole === 'ADMIN' || userRole === 'MODERATOR';
const canEditChannel = userRole === 'ADMIN';

return (
  <div className="channel-header">
    <h2>#{channel.name}</h2>
    {canManageMembers && (
      <button onClick={() => setShowMemberManagement(true)}>
        Manage Members
      </button>
    )}
    {canEditChannel && (
      <button onClick={() => setShowEditChannel(true)}>
        Edit Channel
      </button>
    )}
  </div>
);
```

## Common Usage Patterns

### Pattern 1: Private Channel Access Gate

```typescript
function PrivateChannelAccessGate({ 
  channel, 
  children 
}: { 
  channel: Channel; 
  children: React.ReactNode; 
}) {
  const { data: user } = useProfileQuery();
  const { data: membership } = useGetChannelMembershipQuery({
    userId: user?.id || '',
    channelId: channel.id
  }, {
    skip: !user?.id || !channel.isPrivate
  });

  // Public channels are accessible to all community members
  if (!channel.isPrivate) {
    return <>{children}</>;
  }

  // Private channels require explicit membership
  if (!membership) {
    return (
      <div className="access-denied">
        <h3>Private Channel</h3>
        <p>You don't have access to this channel.</p>
      </div>
    );
  }

  return <>{children}</>;
}
```

### Pattern 2: Channel Role Management

```typescript
function ChannelRoleManager({ channelId }: { channelId: string }) {
  const { data: members = [] } = useGetMembersForChannelQuery(channelId);
  const { data: myMembership } = useGetChannelMembershipQuery({
    userId: currentUserId,
    channelId
  });
  
  const canManageRoles = myMembership?.role === 'ADMIN';

  return (
    <div className="role-manager">
      {members.map(member => (
        <MemberRoleEditor
          key={member.id}
          member={member}
          channelId={channelId}
          canEdit={canManageRoles && member.userId !== currentUserId}
        />
      ))}
    </div>
  );
}
```

## Testing

### Query Testing

```typescript
import { renderHook } from '@testing-library/react-hooks';
import { channelMembershipApi } from '../channelMembershipApiSlice';

describe('channelMembershipApi', () => {
  it('should fetch channel members successfully', async () => {
    const { result } = renderHook(
      () => channelMembershipApi.useGetMembersForChannelQuery('channel-123'),
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
it('should create channel membership successfully', async () => {
  const membershipData = {
    userId: 'user-123',
    channelId: 'channel-123',
    role: 'MEMBER' as const
  };

  const { result } = renderHook(
    () => channelMembershipApi.useCreateChannelMembershipMutation(),
    { wrapper: TestProvider }
  );

  await act(async () => {
    const response = await result.current[0](membershipData).unwrap();
    expect(response.id).toBeDefined();
    expect(response.userId).toBe(membershipData.userId);
    expect(response.channelId).toBe(membershipData.channelId);
    expect(response.role).toBe(membershipData.role);
  });
});
```

## Related Documentation

- [Channel API](./channelApi.md) - Channel management and creation
- [Membership API](./membershipApi.md) - Community-level membership
- [Roles API](./rolesApi.md) - Channel permissions and roles
- [Private Channel Components](../components/community/PrivateChannelMembership.md) - UI for channel member management
- [RBAC System](../features/auth-rbac.md) - Permission system for channel operations
- [Channel Access Control](../features/auth-rbac.md#channel-permissions) - Private channel access patterns