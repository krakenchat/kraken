# Community Redux API Slice

> **Location:** `frontend/src/features/community/communityApiSlice.ts`  
> **Type:** RTK Query API  
> **Domain:** Community/server management

## Overview

The Community API slice manages Discord-like communities (servers) in the Kraken application. It provides full CRUD operations for community management including creating, reading, updating communities and fetching user-specific community lists.

## API Configuration

```typescript
export const communityApi = createApi({
  reducerPath: "communityApi",
  baseQuery: getBaseAuthedQuery(
    fetchBaseQuery({
      baseUrl: "/api/community",
      prepareHeaders,
    })
  ),
  tagTypes: ["Community"],
  endpoints: (builder) => ({
    // Endpoints defined below
  }),
});
```

### Base Configuration
- **Reducer Path:** `communityApi`
- **Base Query:** `getBaseAuthedQuery` (includes JWT authentication and token refresh)
- **Base URL:** `/api/community`
- **Tag Types:** `["Community"]`

## Endpoints

### Query Endpoints (Data Fetching)

#### myCommunities
```typescript
myCommunities: builder.query<Community[], void>({
  query: () => ({
    url: "/mine",
    method: "GET",
  }),
  providesTags: ["Community"],
})
```

**Purpose:** Fetches all communities that the current user is a member of.

**Usage:**
```typescript
const { 
  data: communities = [], 
  error, 
  isLoading,
  refetch 
} = useCommunityApi.useMyCommunitiesQuery();
```

#### getCommunityById
```typescript
getCommunityById: builder.query<Community, string>({
  query: (communityId) => ({
    url: `/${communityId}`,
    method: "GET",
  }),
  providesTags: (_result, _error, communityId) => [
    { type: "Community", id: communityId },
  ],
})
```

**Purpose:** Fetches detailed information for a specific community by ID.

**Usage:**
```typescript
const { 
  data: community, 
  error, 
  isLoading 
} = useCommunityApi.useGetCommunityByIdQuery(communityId, {
  skip: !communityId, // Skip if no ID provided
});
```

### Mutation Endpoints (Data Modification)

#### createCommunity
```typescript
createCommunity: builder.mutation<Community, CreateCommunity>({
  query: (createCommunityDto) => ({
    url: "/",
    method: "POST",
    body: createCommunityDto,
  }),
  invalidatesTags: ["Community"],
})
```

**Purpose:** Creates a new community with the current user as the owner/admin.

**Usage:**
```typescript
const [createCommunity, { isLoading, error }] = useCommunityApi.useCreateCommunityMutation();

const handleCreate = async (formData: CreateCommunity) => {
  try {
    const newCommunity = await createCommunity(formData).unwrap();
    // Navigate to new community or show success message
    navigate(`/community/${newCommunity.id}`);
  } catch (err) {
    // Handle error
  }
};
```

#### updateCommunity
```typescript
updateCommunity: builder.mutation<
  Community,
  { id: string; data: UpdateCommunity }
>({
  query: ({ id, data }) => ({
    url: `/${id}`,
    method: "PATCH",
    body: data,
  }),
  invalidatesTags: (_result, _error, { id }) => [
    { type: "Community", id },
    "Community",
  ],
})
```

**Purpose:** Updates an existing community's properties (requires admin permissions).

**Usage:**
```typescript
const [updateCommunity, { isLoading, error }] = useCommunityApi.useUpdateCommunityMutation();

const handleUpdate = async (communityId: string, updates: UpdateCommunity) => {
  try {
    const updatedCommunity = await updateCommunity({ 
      id: communityId, 
      data: updates 
    }).unwrap();
    // Show success message
  } catch (err) {
    // Handle error
  }
};
```

## Type Definitions

### Request Types

```typescript
interface CreateCommunity {
  name: string;
  description?: string;
  isPublic?: boolean;
  iconUrl?: string;
  bannerUrl?: string;
}

type UpdateCommunity = Partial<Omit<CreateCommunity, "id">>;
```

### Response Types

```typescript
interface Community {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  isPublic: boolean;
  iconUrl?: string;
  bannerUrl?: string;
  memberCount?: number;
  channels?: Channel[];
  createdAt: string;
  updatedAt: string;
}
```

## Caching Strategy

### Cache Tags

```typescript
tagTypes: ["Community"]

// Tagging patterns:
// - List queries: ["Community"] (generic tag)
// - Single items: { type: "Community", id: communityId }
```

### Cache Invalidation

| Action | Invalidates | Reason |
|--------|-------------|---------|
| Create Community | `"Community"` generic tag | New community affects user's community list |
| Update Community | Specific ID + generic `"Community"` | Both individual community and lists need refresh |

### Cache Behavior

- **Automatic Refetching:** Queries automatically refetch when their tags are invalidated
- **Background Updates:** Communities are refetched when user navigates back to community list
- **Persistent Cache:** Community data persists across component unmounts

## State Management

### Generated Hooks

```typescript
export const {
  // Query hooks
  useMyCommunitiesQuery,
  useGetCommunityByIdQuery,
  
  // Mutation hooks  
  useCreateCommunityMutation,
  useUpdateCommunityMutation,
  
  // Utility hooks
  usePrefetch,
} = communityApi;
```

### Manual Cache Manipulation

```typescript
// Prefetch community data
dispatch(communityApi.util.prefetch('getCommunityById', communityId, { force: true }));

// Manual cache update (for optimistic updates)
dispatch(communityApi.util.updateQueryData('myCommunities', undefined, (draft) => {
  draft.push(newCommunity);
}));
```

## Error Handling

### Query Errors

```typescript
const { data, error, isLoading } = useMyCommunitiesQuery();

if (error) {
  if ('status' in error) {
    switch (error.status) {
      case 403:
        // User doesn't have permission
        return <div>Access denied to communities</div>;
      case 404:
        // Community not found
        return <div>Community not found</div>;
      default:
        return <div>Error loading communities</div>;
    }
  } else {
    // Network error
    console.error('Network error:', error.message);
  }
}
```

### Mutation Errors

```typescript
const [updateCommunity, { error, isLoading }] = useUpdateCommunityMutation();

const handleSubmit = async (data) => {
  try {
    await updateCommunity({ id: communityId, data }).unwrap();
  } catch (err: any) {
    if (err.status === 400) {
      // Validation error
      setValidationErrors(err.data.errors);
    } else if (err.status === 403) {
      // Permission error
      setError("You don't have permission to edit this community");
    } else {
      // Generic error
      setError("Failed to update community");
    }
  }
};
```

## WebSocket Integration

### Real-time Community Updates

```typescript
// WebSocket event listeners that update the cache
useWebSocket('COMMUNITY_UPDATED', (updatedCommunity) => {
  dispatch(communityApi.util.updateQueryData(
    'getCommunityById', 
    updatedCommunity.id, 
    () => updatedCommunity
  ));
  
  // Also update in the communities list
  dispatch(communityApi.util.updateQueryData('myCommunities', undefined, (draft) => {
    const index = draft.findIndex(c => c.id === updatedCommunity.id);
    if (index !== -1) {
      draft[index] = updatedCommunity;
    }
  }));
});

useWebSocket('COMMUNITY_DELETED', (deletedCommunityId) => {
  dispatch(communityApi.util.invalidateTags([{ type: 'Community', id: deletedCommunityId }]));
});
```

## Component Integration

### Community List Component

```typescript
import { useCommunityApi } from '@/features/community/communityApiSlice';

function CommunityList() {
  const { 
    data: communities = [], 
    error, 
    isLoading,
    refetch 
  } = useCommunityApi.useMyCommunitiesQuery();

  const [deleteCommunity] = useCommunityApi.useDeleteCommunityMutation();

  if (isLoading) return <div>Loading communities...</div>;
  if (error) return <div>Error loading communities</div>;

  return (
    <div>
      <h2>My Communities</h2>
      {communities.map(community => (
        <CommunityCard 
          key={community.id} 
          community={community}
        />
      ))}
    </div>
  );
}
```

### Community Form Integration

```typescript
function CreateCommunityForm() {
  const [createCommunity, { isLoading, error }] = useCommunityApi.useCreateCommunityMutation();
  const [formData, setFormData] = useState<CreateCommunity>({
    name: '',
    description: '',
    isPublic: true
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newCommunity = await createCommunity(formData).unwrap();
      // Reset form and navigate
      setFormData({ name: '', description: '', isPublic: true });
      navigate(`/community/${newCommunity.id}`);
    } catch (err) {
      // Error handling
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={formData.name}
        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
        placeholder="Community Name"
        required
      />
      <textarea
        value={formData.description}
        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
        placeholder="Community Description"
      />
      <label>
        <input
          type="checkbox"
          checked={formData.isPublic}
          onChange={(e) => setFormData(prev => ({ ...prev, isPublic: e.target.checked }))}
        />
        Public Community
      </label>
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Creating...' : 'Create Community'}
      </button>
      {error && <div className="error">Failed to create community</div>}
    </form>
  );
}
```

## Performance Optimization

### Selective Re-rendering

```typescript
// Only re-render when specific community properties change
const { communityName, memberCount } = useGetCommunityByIdQuery(communityId, {
  selectFromResult: ({ data, ...other }) => ({
    ...other,
    communityName: data?.name,
    memberCount: data?.memberCount
  }),
});
```

### Conditional Queries

```typescript
// Skip query if user doesn't have permission or community ID is invalid
const { data } = useGetCommunityByIdQuery(communityId, {
  skip: !communityId || !userCanViewCommunity,
});
```

### Prefetching

```typescript
// Prefetch community data when user hovers over community link
const prefetch = usePrefetch('getCommunityById');

const handleMouseEnter = (communityId: string) => {
  prefetch(communityId, { force: false }); // Only prefetch if not already cached
};
```

## Common Usage Patterns

### Pattern 1: Community Dashboard

```typescript
function CommunityDashboard({ communityId }: { communityId: string }) {
  const { data: community, isLoading } = useGetCommunityByIdQuery(communityId);
  const { data: channels } = useGetChannelsForCommunityQuery(communityId);
  const { data: members } = useGetMembersForCommunityQuery(communityId);

  if (isLoading) return <CommunityDashboardSkeleton />;
  if (!community) return <div>Community not found</div>;

  return (
    <div>
      <CommunityHeader community={community} />
      <div style={{ display: 'flex' }}>
        <ChannelList channels={channels} />
        <MemberList members={members} />
      </div>
    </div>
  );
}
```

### Pattern 2: Community Settings with Optimistic Updates

```typescript
const [updateCommunity] = useUpdateCommunityMutation({
  onQueryStarted: async ({ id, data }, { dispatch, queryFulfilled }) => {
    // Optimistic update
    const patchResult = dispatch(
      communityApi.util.updateQueryData('getCommunityById', id, (draft) => {
        Object.assign(draft, data);
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
import { Provider } from 'react-redux';
import { communityApi } from '../communityApiSlice';

describe('communityApi', () => {
  it('should fetch user communities successfully', async () => {
    const { result } = renderHook(
      () => communityApi.useMyCommunitiesQuery(),
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
it('should create community successfully', async () => {
  const { result } = renderHook(
    () => communityApi.useCreateCommunityMutation(),
    { wrapper: TestProvider }
  );

  await act(async () => {
    const response = await result.current[0](testCommunityData).unwrap();
    expect(response.id).toBeDefined();
    expect(response.name).toBe(testCommunityData.name);
  });
});
```

## Related Documentation

- [Channels API](./channelApi.md) - Community channel management
- [Membership API](./membershipApi.md) - Community member management
- [Community Components](../components/community/) - UI components for communities
- [RBAC System](../features/auth-rbac.md) - Community permissions and roles
- [WebSocket Events](../api/websocket-events.md) - Real-time community updates