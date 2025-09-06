# Membership Redux API Slice

> **Location:** `frontend/src/features/membership/membershipApiSlice.ts`  
> **Type:** RTK Query API  
> **Domain:** Community membership management

## Overview

The Membership API slice manages community membership operations, including adding/removing members from communities, fetching member lists, and managing user's community memberships. It provides a comprehensive interface for Discord-like server membership functionality.

## API Configuration

```typescript
export const membershipApi = createApi({
  reducerPath: "membershipApi",
  baseQuery: getBaseAuthedQuery(
    fetchBaseQuery({
      baseUrl: "/api/membership",
      prepareHeaders,
    })
  ),
  tagTypes: ["Membership"],
  endpoints: (builder) => ({
    // Endpoints defined below
  }),
});
```

### Base Configuration
- **Reducer Path:** `membershipApi`
- **Base Query:** `getBaseAuthedQuery` (includes JWT authentication and token refresh)
- **Base URL:** `/api/membership`
- **Tag Types:** `["Membership"]`

## Endpoints

### Query Endpoints (Data Fetching)

#### getMembersForCommunity
```typescript
getMembersForCommunity: builder.query<MembershipResponseDto[], string>({
  query: (communityId) => ({
    url: `/community/${communityId}`,
    method: "GET",
  }),
  providesTags: (_result, _error, communityId) => [
    { type: "Membership", id: `community-${communityId}` },
  ],
})
```

**Purpose:** Fetches all members for a specific community with their user information.

**Usage:**
```typescript
const { 
  data: members = [], 
  error, 
  isLoading,
  refetch 
} = useMembershipApi.useGetMembersForCommunityQuery(communityId);
```

#### getMembershipsForUser
```typescript
getMembershipsForUser: builder.query<MembershipResponseDto[], string>({
  query: (userId) => ({
    url: `/user/${userId}`,
    method: "GET",
  }),
  providesTags: (_result, _error, userId) => [
    { type: "Membership", id: `user-${userId}` },
  ],
})
```

**Purpose:** Fetches all community memberships for a specific user.

**Usage:**
```typescript
const { 
  data: userMemberships = [], 
  error, 
  isLoading 
} = useMembershipApi.useGetMembershipsForUserQuery(userId, {
  skip: !userId,
});
```

#### getMyMemberships
```typescript
getMyMemberships: builder.query<MembershipResponseDto[], void>({
  query: () => ({
    url: "/my",
    method: "GET",
  }),
  providesTags: [{ type: "Membership", id: "my" }],
})
```

**Purpose:** Fetches all community memberships for the current user.

**Usage:**
```typescript
const { 
  data: myMemberships = [], 
  error, 
  isLoading,
  refetch 
} = useMembershipApi.useGetMyMembershipsQuery();
```

#### getMembership
```typescript
getMembership: builder.query<
  MembershipResponseDto,
  { userId: string; communityId: string }
>({
  query: ({ userId, communityId }) => ({
    url: `/community/${communityId}/user/${userId}`,
    method: "GET",
  }),
  providesTags: (_result, _error, { userId, communityId }) => [
    { type: "Membership", id: `${userId}-${communityId}` },
  ],
})
```

**Purpose:** Fetches a specific membership relationship between a user and community.

**Usage:**
```typescript
const { 
  data: membership, 
  error, 
  isLoading 
} = useMembershipApi.useGetMembershipQuery({ 
  userId, 
  communityId 
}, {
  skip: !userId || !communityId,
});
```

### Mutation Endpoints (Data Modification)

#### createMembership
```typescript
createMembership: builder.mutation<
  MembershipResponseDto,
  CreateMembershipDto
>({
  query: (body) => ({
    url: "/",
    method: "POST",
    body,
  }),
  invalidatesTags: (_result, _error, { communityId }) => [
    { type: "Membership", id: `community-${communityId}` },
    "Membership",
  ],
})
```

**Purpose:** Adds a user as a member to a community (requires admin permissions).

**Usage:**
```typescript
const [createMembership, { isLoading, error }] = useMembershipApi.useCreateMembershipMutation();

const handleAddMember = async (userId: string, communityId: string) => {
  try {
    const membership = await createMembership({
      userId,
      communityId
    }).unwrap();
    // Show success message
  } catch (err) {
    // Handle error
  }
};
```

#### removeMembership
```typescript
removeMembership: builder.mutation<
  void,
  { userId: string; communityId: string }
>({
  query: ({ userId, communityId }) => ({
    url: `/community/${communityId}/user/${userId}`,
    method: "DELETE",
  }),
  invalidatesTags: (_result, _error, { userId, communityId }) => [
    { type: "Membership", id: `community-${communityId}` },
    { type: "Membership", id: `user-${userId}` },
    { type: "Membership", id: `${userId}-${communityId}` },
    "Membership",
  ],
})
```

**Purpose:** Removes a member from a community (requires admin permissions).

**Usage:**
```typescript
const [removeMembership, { isLoading }] = useMembershipApi.useRemoveMembershipMutation();

const handleRemoveMember = async (userId: string, communityId: string) => {
  if (confirm('Remove this member from the community?')) {
    try {
      await removeMembership({ userId, communityId }).unwrap();
      // Show success message
    } catch (err) {
      // Handle error
    }
  }
};
```

#### leaveCommunity
```typescript
leaveCommunity: builder.mutation<void, string>({
  query: (communityId) => ({
    url: `/leave/${communityId}`,
    method: "DELETE",
  }),
  invalidatesTags: (_result, _error, communityId) => [
    { type: "Membership", id: `community-${communityId}` },
    { type: "Membership", id: "my" },
    "Membership",
  ],
})
```

**Purpose:** Allows the current user to leave a community.

**Usage:**
```typescript
const [leaveCommunity, { isLoading }] = useMembershipApi.useLeaveCommunityMutation();

const handleLeaveCommunity = async (communityId: string) => {
  if (confirm('Are you sure you want to leave this community?')) {
    try {
      await leaveCommunity(communityId).unwrap();
      // Navigate away from community
      navigate('/communities');
    } catch (err) {
      // Handle error
    }
  }
};
```

## Type Definitions

### Request Types

```typescript
interface CreateMembershipDto {
  userId: string;
  communityId: string;
}
```

### Response Types

```typescript
interface MembershipResponseDto {
  id: string;
  userId: string;
  communityId: string;
  joinedAt: string;
  user?: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}
```

## Caching Strategy

### Cache Tags

```typescript
tagTypes: ["Membership"]

// Tagging patterns:
// - Community members: { type: "Membership", id: `community-${communityId}` }
// - User memberships: { type: "Membership", id: `user-${userId}` }
// - Specific membership: { type: "Membership", id: `${userId}-${communityId}` }
// - Current user's memberships: { type: "Membership", id: "my" }
// - Generic tag: "Membership"
```

### Cache Invalidation

| Action | Invalidates | Reason |
|--------|-------------|---------|
| Create Membership | Community tag + generic `"Membership"` | New member affects community member list |
| Remove Membership | Community, user, specific + generic tags | Member removed affects multiple queries |
| Leave Community | Community tag + "my" tag + generic | User leaving affects community and user's memberships |

### Cache Behavior

- **Automatic Refetching:** Member lists automatically refetch when memberships change
- **Cross-Query Updates:** Changes invalidate related queries (community members, user memberships)
- **Optimistic Updates:** Can be implemented for better UX on join/leave operations

## State Management

### Generated Hooks

```typescript
export const {
  // Query hooks
  useGetMembersForCommunityQuery,
  useGetMembershipsForUserQuery,
  useGetMyMembershipsQuery,
  useGetMembershipQuery,
  
  // Mutation hooks  
  useCreateMembershipMutation,
  useRemoveMembershipMutation,
  useLeaveCommunityMutation,
  
  // Utility hooks
  usePrefetch,
} = membershipApi;
```

### Manual Cache Operations

```typescript
// Prefetch member list when hovering over community
const prefetch = usePrefetch('getMembersForCommunity');

const handleCommunityHover = (communityId: string) => {
  prefetch(communityId, { force: false });
};

// Optimistic membership creation
const patchResult = dispatch(
  membershipApi.util.updateQueryData('getMembersForCommunity', communityId, (draft) => {
    draft.push(optimisticMember);
  })
);
```

## Error Handling

### Query Errors

```typescript
const { data, error, isLoading } = useGetMembersForCommunityQuery(communityId);

if (error) {
  if ('status' in error) {
    switch (error.status) {
      case 403:
        // User doesn't have permission to view members
        return <div>Access denied to member list</div>;
      case 404:
        // Community not found
        return <div>Community not found</div>;
      default:
        return <div>Error loading members</div>;
    }
  } else {
    // Network error
    console.error('Network error:', error.message);
  }
}
```

### Mutation Errors

```typescript
const [createMembership, { error, isLoading }] = useCreateMembershipMutation();

const handleAddMember = async (userId: string, communityId: string) => {
  try {
    await createMembership({ userId, communityId }).unwrap();
  } catch (err: any) {
    if (err.status === 400) {
      if (err.data?.message?.includes('already a member')) {
        setError("User is already a member of this community");
      } else {
        setError("Invalid member data");
      }
    } else if (err.status === 403) {
      setError("You don't have permission to add members");
    } else if (err.status === 404) {
      setError("User or community not found");
    } else {
      setError("Failed to add member");
    }
  }
};
```

## WebSocket Integration

### Real-time Membership Updates

```typescript
// Listen for new members joining
useWebSocket('MEMBER_JOINED', (membershipData) => {
  dispatch(membershipApi.util.updateQueryData(
    'getMembersForCommunity',
    membershipData.communityId,
    (draft) => {
      draft.push(membershipData);
    }
  ));
});

// Listen for members leaving
useWebSocket('MEMBER_LEFT', ({ userId, communityId }) => {
  dispatch(membershipApi.util.updateQueryData(
    'getMembersForCommunity',
    communityId,
    (draft) => {
      return draft.filter(member => member.userId !== userId);
    }
  ));
});

// Listen for membership updates (role changes, etc.)
useWebSocket('MEMBERSHIP_UPDATED', (updatedMembership) => {
  dispatch(membershipApi.util.updateQueryData(
    'getMembership',
    { userId: updatedMembership.userId, communityId: updatedMembership.communityId },
    () => updatedMembership
  ));
});
```

## Component Integration

### Member List Component

```typescript
import { useMembershipApi } from '@/features/membership/membershipApiSlice';

function MemberList({ communityId }: { communityId: string }) {
  const { 
    data: members = [], 
    error, 
    isLoading,
    refetch 
  } = useMembershipApi.useGetMembersForCommunityQuery(communityId);

  const [removeMembership] = useMembershipApi.useRemoveMembershipMutation();

  const handleRemoveMember = async (userId: string) => {
    if (confirm('Remove this member?')) {
      try {
        await removeMembership({ userId, communityId }).unwrap();
      } catch (err) {
        console.error('Failed to remove member:', err);
      }
    }
  };

  if (isLoading) return <div>Loading members...</div>;
  if (error) return <div>Error loading members</div>;

  return (
    <div className="member-list">
      <h3>Members ({members.length})</h3>
      {members.map(member => (
        <div key={member.id} className="member-item">
          <img 
            src={member.user?.avatarUrl || '/default-avatar.png'} 
            alt="" 
            className="member-avatar" 
          />
          <div className="member-info">
            <div className="member-name">
              {member.user?.displayName || member.user?.username}
            </div>
            <div className="member-joined">
              Joined {formatDate(member.joinedAt)}
            </div>
          </div>
          <div className="member-actions">
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

### Add Member Form

```typescript
function AddMemberForm({ communityId, onClose }: { 
  communityId: string; 
  onClose: () => void; 
}) {
  const [createMembership, { isLoading, error }] = useMembershipApi.useCreateMembershipMutation();
  const [searchUsers, { data: searchResults = [] }] = useLazySearchUsersQuery();
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.length >= 2) {
      searchUsers({ query, communityId }); // Exclude existing members
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId) return;
    
    try {
      await createMembership({
        userId: selectedUserId,
        communityId
      }).unwrap();
      onClose();
    } catch (err) {
      // Error handling
    }
  };

  return (
    <div className="add-member-form">
      <h3>Add Member</h3>
      
      <div className="user-search">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search users..."
        />
        
        {searchResults.length > 0 && (
          <div className="search-results">
            {searchResults.map(user => (
              <div 
                key={user.id}
                className={`search-result ${selectedUserId === user.id ? 'selected' : ''}`}
                onClick={() => setSelectedUserId(user.id)}
              >
                <img src={user.avatarUrl} alt="" className="user-avatar" />
                <span>{user.displayName || user.username}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="form-actions">
        <button onClick={onClose}>Cancel</button>
        <button 
          onClick={handleAddMember} 
          disabled={!selectedUserId || isLoading}
        >
          {isLoading ? 'Adding...' : 'Add Member'}
        </button>
      </div>
      
      {error && <div className="error">Failed to add member</div>}
    </div>
  );
}
```

### My Communities List

```typescript
function MyCommunitiesList() {
  const { 
    data: memberships = [], 
    error, 
    isLoading 
  } = useMembershipApi.useGetMyMembershipsQuery();

  const [leaveCommunity] = useMembershipApi.useLeaveCommunityMutation();

  const handleLeaveCommunity = async (communityId: string, communityName: string) => {
    if (confirm(`Leave ${communityName}?`)) {
      try {
        await leaveCommunity(communityId).unwrap();
      } catch (err) {
        console.error('Failed to leave community:', err);
      }
    }
  };

  if (isLoading) return <div>Loading your communities...</div>;
  if (error) return <div>Error loading communities</div>;

  return (
    <div className="my-communities">
      <h2>My Communities</h2>
      {memberships.map(membership => (
        <div key={membership.id} className="community-membership">
          <Link to={`/community/${membership.communityId}`}>
            View Community
          </Link>
          <button 
            onClick={() => handleLeaveCommunity(
              membership.communityId, 
              'Community' // Would need community name from membership
            )}
            className="leave-btn"
          >
            Leave
          </button>
        </div>
      ))}
    </div>
  );
}
```

## Performance Optimization

### Member List Virtualization

```typescript
// For large member lists, use virtualization
import { FixedSizeList as List } from 'react-window';

function VirtualizedMemberList({ members }: { members: MembershipResponseDto[] }) {
  const MemberRow = ({ index, style }: { index: number; style: any }) => (
    <div style={style}>
      <MemberItem member={members[index]} />
    </div>
  );

  return (
    <List
      height={400}
      itemCount={members.length}
      itemSize={60}
    >
      {MemberRow}
    </List>
  );
}
```

### Selective Member Data

```typescript
// Only fetch necessary member data for lists
const { memberSummaries } = useGetMembersForCommunityQuery(communityId, {
  selectFromResult: ({ data, ...other }) => ({
    ...other,
    memberSummaries: data?.map(m => ({
      id: m.id,
      userId: m.userId,
      username: m.user?.username,
      avatarUrl: m.user?.avatarUrl
    }))
  }),
});
```

## Common Usage Patterns

### Pattern 1: Member Management Dashboard

```typescript
function MemberManagementDashboard({ communityId }: { communityId: string }) {
  const { data: members = [] } = useGetMembersForCommunityQuery(communityId);
  const { data: userPermissions } = useGetMyRolesForCommunityQuery(communityId);
  
  const canManageMembers = userPermissions?.actions.includes('MANAGE_MEMBERS');
  const canRemoveMembers = userPermissions?.actions.includes('REMOVE_MEMBERS');

  return (
    <div className="member-management">
      <div className="member-stats">
        <h3>Member Statistics</h3>
        <p>Total Members: {members.length}</p>
        <p>Online Members: {members.filter(m => m.user?.isOnline).length}</p>
      </div>
      
      {canManageMembers && <AddMemberForm communityId={communityId} />}
      
      <MemberList 
        members={members} 
        canRemove={canRemoveMembers}
        communityId={communityId}
      />
    </div>
  );
}
```

### Pattern 2: Optimistic Membership Operations

```typescript
const [createMembership] = useCreateMembershipMutation({
  onQueryStarted: async ({ userId, communityId }, { dispatch, queryFulfilled }) => {
    // Optimistic update
    const patchResult = dispatch(
      membershipApi.util.updateQueryData('getMembersForCommunity', communityId, (draft) => {
        draft.push({
          id: 'temp-id',
          userId,
          communityId,
          joinedAt: new Date().toISOString(),
          user: { /* user data from cache */ }
        });
      })
    );
    
    try {
      await queryFulfilled;
    } catch {
      // Revert on error
      patchResult.undo();
    }
  },
});
```

## Testing

### Query Testing

```typescript
import { renderHook } from '@testing-library/react-hooks';
import { membershipApi } from '../membershipApiSlice';

describe('membershipApi', () => {
  it('should fetch community members successfully', async () => {
    const { result } = renderHook(
      () => membershipApi.useGetMembersForCommunityQuery('community-123'),
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
it('should create membership successfully', async () => {
  const membershipData = {
    userId: 'user-123',
    communityId: 'community-123'
  };

  const { result } = renderHook(
    () => membershipApi.useCreateMembershipMutation(),
    { wrapper: TestProvider }
  );

  await act(async () => {
    const response = await result.current[0](membershipData).unwrap();
    expect(response.id).toBeDefined();
    expect(response.userId).toBe(membershipData.userId);
    expect(response.communityId).toBe(membershipData.communityId);
  });
});
```

## Related Documentation

- [Community API](./communityApi.md) - Community management
- [Channel Membership API](./channelMembershipApi.md) - Private channel membership
- [Users API](./usersApi.md) - User information and search
- [Roles API](./rolesApi.md) - Member permissions and roles
- [Member Management Components](../components/community/MemberManagement.md) - UI for member management
- [RBAC System](../features/auth-rbac.md) - Permission system for member operations