# Redux State Management Documentation

> **Complete documentation for all Redux slices and RTK Query APIs in Kraken**

## Overview

The Kraken frontend uses Redux Toolkit with RTK Query for comprehensive state management. This documentation covers all API slices, Redux slices, and state management patterns used throughout the application.

## Architecture Summary

### State Management Approach

Kraken uses a **hybrid state management approach** combining:

1. **RTK Query APIs** - Server state management with automatic caching, invalidation, and sync
2. **Redux Slices** - Local UI state management with actions and reducers  
3. **Dual Caching** - RTK Query cache + localStorage for frequently accessed data
4. **Optimistic Updates** - Immediate UI feedback with server-side validation
5. **WebSocket Integration** - Real-time updates integrated with cached state

### Store Configuration

```typescript
export const store = configureStore({
  reducer: {
    // RTK Query API reducers
    [authApi.reducerPath]: authApi.reducer,
    [usersApi.reducerPath]: usersApi.reducer,
    [communityApi.reducerPath]: communityApi.reducer,
    [channelApi.reducerPath]: channelApi.reducer,
    [messagesApi.reducerPath]: messagesApi.reducer,
    [rolesApi.reducerPath]: rolesApi.reducer,
    [livekitApi.reducerPath]: livekitApi.reducer,
    [voicePresenceApi.reducerPath]: voicePresenceApi.reducer,
    [membershipApi.reducerPath]: membershipApi.reducer,
    [channelMembershipApi.reducerPath]: channelMembershipApi.reducer,
    [inviteApi.reducerPath]: inviteApi.reducer,
    [onboardingApi.reducerPath]: onboardingApi.reducer,
    
    // Local state slices
    messages: messagesReducer,
    voice: voiceReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      // RTK Query middleware for all APIs
      authApi.middleware,
      usersApi.middleware,
      communityApi.middleware,
      channelApi.middleware,
      messagesApi.middleware,
      rolesApi.middleware,
      livekitApi.middleware,
      voicePresenceApi.middleware,
      membershipApi.middleware,
      channelMembershipApi.middleware,
      inviteApi.middleware,
      onboardingApi.middleware
    ),
});
```

## API Slices Documentation

### Authentication & User Management

| API | Purpose | Key Features |
|-----|---------|--------------|
| **[Auth API](./authApi.md)** | User authentication | Login/logout, token management, no caching |
| **[Users API](./usersApi.md)** | User profiles & search | localStorage caching, user search, registration |
| **[Roles API](./rolesApi.md)** | RBAC permissions | Permission checking, role-based UI rendering |

### Community & Channel Management  

| API | Purpose | Key Features |
|-----|---------|--------------|
| **[Community API](./communityApi.md)** | Community/server management | CRUD operations, member communities |
| **[Channel API](./channelApi.md)** | Channel management | Text/voice channels, private channels |
| **[Membership API](./membershipApi.md)** | Community membership | Add/remove members, member lists |
| **[Channel Membership API](./channelMembershipApi.md)** | Private channel access | Channel-specific membership, role management |

### Messaging System

| API | Purpose | Key Features |
|-----|---------|--------------|
| **[Messages API & Slice](./messagesApi.md)** | Real-time messaging | Pagination, WebSocket integration, optimistic updates |

### Voice & Video Communication

| API | Purpose | Key Features |
|-----|---------|--------------|
| **[Voice Presence API](./voicePresenceApi.md)** | Voice channel presence | User voice states, optimistic updates |
| **[LiveKit API](./livekitApi.md)** | WebRTC connections | Token generation, connection management |
| **[Voice Slice](./voiceSlice.md)** | Local voice state | Connection state, device preferences |

### Instance Management

| API | Purpose | Key Features |
|-----|---------|--------------|
| **[Invite API](./inviteApi.md)** | Instance invitations | Invite code management, registration control |
| **[Onboarding API](./onboardingApi.md)** | Instance setup | First-time configuration, admin setup |

## RTK Query Features

### Automated Caching
- **Smart Cache Invalidation** - Tag-based cache management
- **Background Refetching** - Automatic data synchronization
- **Optimistic Updates** - Immediate UI updates with rollback on error
- **Cache Persistence** - Optional data persistence across sessions

### Real-time Integration
- **WebSocket Events** - Automatic cache updates from real-time events
- **Selective Updates** - Granular cache updates for specific data
- **Conflict Resolution** - Handling concurrent updates gracefully

### Performance Optimization
- **Selective Re-rendering** - Components only re-render when relevant data changes
- **Request Deduplication** - Automatic deduplication of identical requests
- **Code Splitting** - Feature-based code splitting with lazy loading
- **Bundle Optimization** - Tree shaking for unused endpoints

## Slice Documentation Format

Each Redux slice documentation includes:

- **API Configuration** - Base query setup and tag types
- **Query Endpoints** - Data fetching endpoints with caching strategies
- **Mutation Endpoints** - Data modification with cache invalidation
- **Type Definitions** - Complete TypeScript interfaces
- **Caching Strategy** - Tag management and invalidation patterns
- **WebSocket Integration** - Real-time cache updates
- **Component Integration** - Usage examples in React components
- **Error Handling** - Error states and recovery patterns
- **Testing** - Unit and integration test examples

## Common Patterns

### Basic Query Usage

```typescript
import { useGetCommunitiesQuery } from '@/features/community/api/communityApi';

function CommunityList() {
  const { 
    data: communities = [], 
    error, 
    isLoading,
    refetch 
  } = useGetCommunitiesQuery();

  if (isLoading) return <Loading />;
  if (error) return <Error error={error} />;

  return (
    <div>
      {communities.map(community => (
        <CommunityCard key={community.id} community={community} />
      ))}
    </div>
  );
}
```

### Mutation with Optimistic Updates

```typescript
import { useCreateCommunityMutation } from '@/features/community/api/communityApi';

function CreateCommunityForm() {
  const [createCommunity, { isLoading, error }] = useCreateCommunityMutation();

  const handleSubmit = async (data) => {
    try {
      const newCommunity = await createCommunity(data).unwrap();
      // Success handling
    } catch (err) {
      // Error handling
    }
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### WebSocket Integration

```typescript
import { useWebSocketEvent } from '@/hooks/useWebSocketEvent';
import { communityApi } from '@/features/community/api/communityApi';

function RealTimeCommunityUpdates() {
  const dispatch = useAppDispatch();

  useWebSocketEvent('COMMUNITY_UPDATED', (updatedCommunity) => {
    dispatch(communityApi.util.updateQueryData(
      'getCommunities',
      undefined,
      (draft) => {
        const index = draft.findIndex(c => c.id === updatedCommunity.id);
        if (index !== -1) {
          draft[index] = updatedCommunity;
        }
      }
    ));
  });
}
```

### Conditional Queries

```typescript
const { data: userProfile } = useGetUserProfileQuery(userId, {
  skip: !userId, // Skip query if no userId
});

const { data: messages } = useGetMessagesQuery(channelId, {
  pollingInterval: 30000, // Poll every 30 seconds
  refetchOnFocus: true,   // Refetch when window gains focus
});
```

## Cache Management

### Tag-based Invalidation

```typescript
// Provide tags for caching
providesTags: (result) => 
  result
    ? [
        ...result.map(({ id }) => ({ type: 'Community', id })),
        { type: 'Community', id: 'LIST' },
      ]
    : [{ type: 'Community', id: 'LIST' }],

// Invalidate tags on mutation
invalidatesTags: [{ type: 'Community', id: 'LIST' }],
```

### Manual Cache Updates

```typescript
// Direct cache manipulation
dispatch(messagesApi.util.updateQueryData(
  'getMessages',
  channelId,
  (draft) => {
    draft.unshift(newMessage);
  }
));

// Prefetch data
dispatch(communityApi.util.prefetch('getCommunity', communityId));
```

## Error Handling

### Query Error Handling

```typescript
const { data, error, isError, isLoading } = useGetDataQuery();

if (isError) {
  if ('status' in error) {
    // RTK Query error with HTTP status
    const { status, data: errorData } = error;
    if (status === 404) {
      return <NotFound />;
    }
    if (status === 403) {
      return <Forbidden />;
    }
  } else {
    // Network error
    return <NetworkError />;
  }
}
```

### Mutation Error Handling

```typescript
const [updateData, { isLoading, error }] = useUpdateDataMutation();

const handleUpdate = async (data) => {
  try {
    await updateData(data).unwrap();
  } catch (err) {
    if (err.status === 400) {
      // Validation error
      setValidationErrors(err.data.message);
    } else {
      // Other error
      setGeneralError('Update failed');
    }
  }
};
```

## Performance Best Practices

### Selective Re-rendering

```typescript
// Use selectFromResult to prevent unnecessary re-renders
const { relevantData } = useGetDataQuery(params, {
  selectFromResult: ({ data, ...other }) => ({
    ...other,
    relevantData: data?.filter(item => item.relevant),
  }),
});
```

### Query Optimization

```typescript
// Skip queries when not needed
const { data } = useGetUserDataQuery(userId, {
  skip: !userId || !isVisible,
});

// Use polling judiciously
const { data } = useGetLiveDataQuery(id, {
  pollingInterval: isActive ? 5000 : 0,
});
```

## Testing Strategies

### Mock Store Testing

```typescript
import { configureStore } from '@reduxjs/toolkit';
import { api } from '@/app/api';

const mockStore = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware),
});
```

### Hook Testing

```typescript
import { renderHook } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { useGetDataQuery } from '../api';

test('should fetch data successfully', async () => {
  const { result } = renderHook(
    () => useGetDataQuery(testId),
    { wrapper: ({ children }) => <Provider store={mockStore}>{children}</Provider> }
  );

  await waitFor(() => {
    expect(result.current.isSuccess).toBe(true);
  });
});
```

## Development Guidelines

### Creating New Slices

1. **Define API Structure** - Plan endpoints and data relationships
2. **Setup Base Query** - Configure authentication and error handling
3. **Define Tag Types** - Plan cache invalidation strategy
4. **Implement Endpoints** - Add queries and mutations
5. **Add WebSocket Integration** - Real-time cache updates
6. **Write Tests** - Unit and integration tests
7. **Document Usage** - Component integration examples

### Naming Conventions

- **API Slices**: `[feature]Api` (e.g., `communityApi`)
- **Endpoints**: `get[Resource]`, `create[Resource]`, `update[Resource]`
- **Tags**: Singular resource names (e.g., `Community`, `Message`)
- **Hooks**: Auto-generated with `use` prefix

### Common Anti-Patterns

- **Over-fetching**: Fetching more data than needed
- **Under-invalidation**: Not invalidating related cache entries
- **Manual State Management**: Using useState when RTK Query suffices
- **Ignoring Loading States**: Not handling loading/error states properly

## Integration Examples

### Component Integration

```typescript
function CommunityManager() {
  const { data: communities } = useGetCommunitiesQuery();
  const [createCommunity] = useCreateCommunityMutation();
  const [updateCommunity] = useUpdateCommunityMutation();
  const [deleteCommunity] = useDeleteCommunityMutation();

  // Component logic using all CRUD operations
}
```

### WebSocket + Redux Integration

```typescript
function useRealTimeUpdates() {
  const dispatch = useAppDispatch();

  useWebSocketEvent('DATA_UPDATED', (update) => {
    // Update specific cache entry
    dispatch(api.util.updateQueryData('getData', update.id, () => update));
  });

  useWebSocketEvent('DATA_DELETED', (deletedId) => {
    // Invalidate cache
    dispatch(api.util.invalidateTags([{ type: 'Data', id: deletedId }]));
  });
}
```

## Getting Started

To understand a Redux slice:

1. **Read the API configuration** to understand the base setup
2. **Check endpoint definitions** for available queries and mutations
3. **Review caching strategy** to understand data invalidation
4. **Look at component integration** for usage patterns
5. **Check WebSocket integration** for real-time features