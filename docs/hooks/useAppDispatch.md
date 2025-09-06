# useAppDispatch & useAppSelector

> **Location:** `frontend/src/app/hooks.ts`  
> **Type:** Redux Hook  
> **Category:** state

## Overview

TypeScript-enhanced versions of React-Redux's `useDispatch` and `useSelector` hooks that provide proper type safety for the Kraken application's Redux store. These hooks ensure type inference works correctly with the app's specific store structure, dispatch types, and state shape, providing better development experience with autocomplete and compile-time type checking.

## Hook Signatures

```typescript
function useAppDispatch(): AppDispatch
function useAppSelector<TSelected = unknown>(selector: (state: RootState) => TSelected, equalityFn?: (left: TSelected, right: TSelected) => boolean): TSelected
```

## Type Definitions

```typescript
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "./store";

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

### Related Types

```typescript
// From store.ts
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

## Usage Examples

### Basic State Selection with useAppSelector

```tsx
import { useAppSelector } from '@/app/hooks';

function UserProfile() {
  // Type-safe state selection with autocomplete
  const currentUser = useAppSelector(state => state.auth.user);
  const isAuthenticated = useAppSelector(state => state.auth.isAuthenticated);
  const theme = useAppSelector(state => state.ui.theme);

  return (
    <div className={`profile-container ${theme}`}>
      {isAuthenticated ? (
        <div>
          <h1>Welcome, {currentUser?.username}</h1>
          <p>Email: {currentUser?.email}</p>
        </div>
      ) : (
        <div>Please log in</div>
      )}
    </div>
  );
}
```

### Dispatching Actions with useAppDispatch

```tsx
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { login, logout } from '@/features/auth/authSlice';
import { toggleTheme } from '@/features/ui/uiSlice';

function AuthControls() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(state => state.auth.isAuthenticated);
  const loading = useAppSelector(state => state.auth.loading);

  const handleLogin = async () => {
    try {
      // Type-safe dispatch with proper return type inference
      const result = await dispatch(login({
        username: 'user@example.com',
        password: 'password123'
      })).unwrap(); // unwrap() provides proper error handling
      
      console.log('Login successful:', result);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleLogout = () => {
    dispatch(logout());
  };

  const handleToggleTheme = () => {
    dispatch(toggleTheme());
  };

  return (
    <div className="auth-controls">
      {isAuthenticated ? (
        <>
          <button onClick={handleLogout}>Logout</button>
          <button onClick={handleToggleTheme}>Toggle Theme</button>
        </>
      ) : (
        <button onClick={handleLogin} disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      )}
    </div>
  );
}
```

### Complex State Selection with Memoization

```tsx
import { useAppSelector } from '@/app/hooks';
import { createSelector } from '@reduxjs/toolkit';
import { useMemo } from 'react';

// Memoized selector to prevent unnecessary re-renders
const selectMessagesByChannel = createSelector(
  [(state: RootState) => state.messages.messagesByChannel, (_, channelId: string) => channelId],
  (messagesByChannel, channelId) => messagesByChannel[channelId] || []
);

const selectUnreadCount = createSelector(
  [selectMessagesByChannel],
  (messages) => messages.filter(msg => !msg.read).length
);

function ChannelMessageList({ channelId }: { channelId: string }) {
  const messages = useAppSelector(state => selectMessagesByChannel(state, channelId));
  const unreadCount = useAppSelector(state => selectUnreadCount(state, channelId));
  
  // Alternative: inline memoization
  const sortedMessages = useAppSelector(
    state => selectMessagesByChannel(state, channelId).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    ),
    // Custom equality function to prevent re-renders when order doesn't change
    (prev, next) => prev.length === next.length && 
                    prev.every((msg, index) => msg.id === next[index].id)
  );

  return (
    <div className="message-list">
      <div className="message-header">
        <h3>Messages ({messages.length})</h3>
        {unreadCount > 0 && (
          <span className="unread-badge">{unreadCount} unread</span>
        )}
      </div>
      
      <div className="messages">
        {sortedMessages.map(message => (
          <MessageComponent key={message.id} message={message} />
        ))}
      </div>
    </div>
  );
}
```

### RTK Query Integration

```tsx
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { messagesApi } from '@/features/messages/messagesApiSlice';

function MessageContainer({ channelId }: { channelId: string }) {
  const dispatch = useAppDispatch();
  
  // RTK Query hooks work seamlessly with typed hooks
  const {
    data: messages,
    error,
    isLoading,
    refetch
  } = messagesApi.useGetChannelMessagesQuery(channelId);

  // Access RTK Query cache state directly if needed
  const queryState = useAppSelector(state => 
    messagesApi.endpoints.getChannelMessages.select(channelId)(state)
  );

  // Manually trigger cache updates
  const handleRefresh = () => {
    dispatch(messagesApi.util.invalidateTags(['Messages']));
    // or
    refetch();
  };

  // Optimistic updates
  const handleOptimisticUpdate = (newMessage: Message) => {
    dispatch(
      messagesApi.util.updateQueryData('getChannelMessages', channelId, (draft) => {
        draft.unshift(newMessage);
      })
    );
  };

  if (isLoading) return <div>Loading messages...</div>;
  if (error) return <div>Error loading messages</div>;

  return (
    <div>
      <button onClick={handleRefresh}>Refresh</button>
      <div>Query Status: {queryState.status}</div>
      <MessageList 
        messages={messages || []} 
        onOptimisticUpdate={handleOptimisticUpdate}
      />
    </div>
  );
}
```

### Async Thunks with Error Handling

```tsx
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { createCommunity, updateCommunity } from '@/features/community/communitySlice';

function CommunityManager() {
  const dispatch = useAppDispatch();
  const { communities, loading, error } = useAppSelector(state => state.community);

  const handleCreateCommunity = async (communityData: CreateCommunityData) => {
    try {
      // Async thunk with proper error handling
      const result = await dispatch(createCommunity(communityData)).unwrap();
      
      console.log('Community created:', result);
      // Handle success (e.g., navigate, show success message)
      
    } catch (error) {
      // Handle different error types
      if (error.name === 'ValidationError') {
        console.error('Validation failed:', error.details);
      } else if (error.name === 'NetworkError') {
        console.error('Network error:', error.message);
      } else {
        console.error('Unexpected error:', error);
      }
    }
  };

  const handleUpdateCommunity = async (id: string, updates: Partial<Community>) => {
    try {
      const result = await dispatch(updateCommunity({ id, updates })).unwrap();
      
      // Optimistic UI updates are handled automatically by the slice
      console.log('Community updated:', result);
      
    } catch (error) {
      console.error('Update failed:', error);
      // The slice automatically reverts optimistic updates on error
    }
  };

  return (
    <div className="community-manager">
      <div className="status">
        {loading && <div>Processing...</div>}
        {error && <div className="error">Error: {error}</div>}
      </div>

      <div className="communities">
        {communities.map(community => (
          <div key={community.id} className="community-item">
            <h3>{community.name}</h3>
            <button onClick={() => handleUpdateCommunity(community.id, { 
              name: `${community.name} (Updated)` 
            })}>
              Update Name
            </button>
          </div>
        ))}
      </div>

      <button onClick={() => handleCreateCommunity({
        name: 'New Community',
        description: 'A new community'
      })}>
        Create Community
      </button>
    </div>
  );
}
```

### Performance Optimization Patterns

```tsx
import { useAppSelector } from '@/app/hooks';
import { shallowEqual } from 'react-redux';

function OptimizedComponent() {
  // Use shallowEqual for object selections to prevent unnecessary re-renders
  const userPreferences = useAppSelector(
    state => ({
      theme: state.user.preferences.theme,
      notifications: state.user.preferences.notifications,
      language: state.user.preferences.language
    }),
    shallowEqual
  );

  // Select only what you need to minimize re-renders
  const unreadCount = useAppSelector(state => {
    return Object.values(state.messages.messagesByChannel)
      .flat()
      .filter(message => !message.read)
      .length;
  });

  // Avoid selecting entire objects when you only need primitives
  const userName = useAppSelector(state => state.auth.user?.name);
  const isOnline = useAppSelector(state => state.auth.user?.isOnline);
  
  return (
    <div className={`app ${userPreferences.theme}`}>
      <div className="user-info">
        <span>{userName}</span>
        <span className={`status ${isOnline ? 'online' : 'offline'}`}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>
      
      {unreadCount > 0 && (
        <div className="notifications">
          You have {unreadCount} unread messages
        </div>
      )}
    </div>
  );
}
```

## Implementation Details

### Type Safety Benefits

```typescript
// Before: Untyped dispatch and selector
const dispatch = useDispatch(); // any
const user = useSelector(state => state.auth.user); // any

// After: Typed dispatch and selector  
const dispatch = useAppDispatch(); // AppDispatch with correct return types
const user = useAppSelector(state => state.auth.user); // User | null with autocomplete
```

### Store Structure Integration

```typescript
// These hooks work with the complete store structure:
interface RootState {
  auth: AuthState;
  messages: MessagesState;
  communities: CommunityState;
  voice: VoiceState;
  ui: UIState;
  // RTK Query API slices
  messagesApi: MessagesApiState;
  communityApi: CommunityApiState;
  // ... other slices
}
```

### Dispatch Type Safety

```typescript
// Dispatch knows about all available actions and thunks
dispatch(login({ username: 'user', password: 'pass' })); // ✅ Typed
dispatch(fetchMessages(channelId)); // ✅ Async thunk typed
dispatch({ type: 'INVALID_ACTION' }); // ❌ TypeScript error
```

## Performance Considerations

### Selector Optimization

- **Use Memoized Selectors**: Create reusable selectors with `createSelector`
- **Select Specific Data**: Avoid selecting entire state slices when possible
- **Shallow Equality**: Use `shallowEqual` for object selections
- **Stable References**: Ensure selector functions have stable references

### Dispatch Optimization

- **Async Thunk Patterns**: Use `.unwrap()` for proper error handling
- **Batch Updates**: Redux Toolkit automatically batches updates
- **Avoid Excessive Dispatching**: Debounce user interactions when necessary

## Error Handling Patterns

### Async Action Error Handling

```tsx
const handleAsyncAction = async () => {
  try {
    const result = await dispatch(someAsyncThunk(data)).unwrap();
    // Handle success
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Action was cancelled');
    } else {
      console.error('Action failed:', error);
    }
  }
};
```

### Error State Selection

```tsx
const error = useAppSelector(state => state.someSlice.error);
const isLoading = useAppSelector(state => state.someSlice.loading);

useEffect(() => {
  if (error) {
    // Handle error display
    showErrorNotification(error.message);
  }
}, [error]);
```

## Testing

### Testing Components Using These Hooks

```tsx
import { renderWithProviders } from '@/utils/test-utils';
import { screen } from '@testing-library/react';
import ComponentUsingRedux from './ComponentUsingRedux';

// Mock store setup
const mockStore = {
  auth: {
    user: { id: '1', username: 'testuser' },
    isAuthenticated: true,
    loading: false
  },
  messages: {
    messagesByChannel: {},
    loading: false
  }
};

describe('ComponentUsingRedux', () => {
  it('should display user information', () => {
    renderWithProviders(<ComponentUsingRedux />, {
      preloadedState: mockStore
    });
    
    expect(screen.getByText('testuser')).toBeInTheDocument();
  });
});
```

### Testing Dispatch Calls

```tsx
import { createMockStore } from '@/utils/test-utils';

describe('Component dispatch behavior', () => {
  it('should dispatch login action', async () => {
    const store = createMockStore();
    const { result } = renderHookWithProviders(
      () => useAppDispatch(),
      { store }
    );
    
    await act(async () => {
      await result.current(login({ username: 'test', password: 'test' }));
    });
    
    const actions = store.getActions();
    expect(actions[0].type).toBe('auth/login/pending');
  });
});
```

## Common Patterns

### Pattern 1: Loading and Error States

```tsx
function DataComponent() {
  const dispatch = useAppDispatch();
  const { data, loading, error } = useAppSelector(state => state.someSlice);

  useEffect(() => {
    dispatch(fetchData());
  }, [dispatch]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!data) return <EmptyState />;

  return <DataDisplay data={data} />;
}
```

### Pattern 2: Optimistic Updates

```tsx
function OptimisticComponent() {
  const dispatch = useAppDispatch();
  
  const handleUpdate = async (id: string, updates: Updates) => {
    // Optimistic update
    dispatch(updateItemOptimistically({ id, updates }));
    
    try {
      await dispatch(updateItemAsync({ id, updates })).unwrap();
      // Success - optimistic update is kept
    } catch (error) {
      // Failure - revert optimistic update
      dispatch(revertOptimisticUpdate(id));
      console.error('Update failed:', error);
    }
  };

  return <UpdateInterface onUpdate={handleUpdate} />;
}
```

### Pattern 3: Conditional Rendering Based on State

```tsx
function ConditionalComponent() {
  const isAuthenticated = useAppSelector(state => state.auth.isAuthenticated);
  const userRole = useAppSelector(state => state.auth.user?.role);
  const hasPermission = useAppSelector(state => 
    state.auth.user?.permissions.includes('ADMIN')
  );

  if (!isAuthenticated) return <LoginPrompt />;
  if (userRole === 'BANNED') return <BannedMessage />;
  if (!hasPermission) return <AccessDenied />;

  return <AdminInterface />;
}
```

## Related Hooks

- **Standard React-Redux hooks** - `useDispatch`, `useSelector` (these are typed versions)
- **RTK Query hooks** - Generated API hooks that work with these typed hooks
- **Custom selector hooks** - Application-specific selectors built on useAppSelector

## Troubleshooting

### Common Issues

1. **Type errors with dispatch**
   - **Symptoms:** TypeScript errors when dispatching actions
   - **Cause:** Using untyped `useDispatch` instead of `useAppDispatch`
   - **Solution:** Always use `useAppDispatch()` for type safety

2. **Selector return type issues**
   - **Symptoms:** Incorrect types inferred from selectors
   - **Cause:** Complex selector logic or incorrect state typing
   - **Solution:** Use explicit type annotations or typed selectors

3. **Unnecessary re-renders**
   - **Symptoms:** Component re-renders too frequently
   - **Cause:** Selecting objects or complex data without proper equality checks
   - **Solution:** Use memoized selectors or shallow equality comparisons

### Best Practices

- **Always use typed hooks** instead of standard React-Redux hooks
- **Select specific data** rather than entire state slices
- **Use memoized selectors** for complex computations
- **Handle async action errors** with `.unwrap()`
- **Batch related dispatches** when possible
- **Test components** with proper mock stores

## Version History

- **1.0.0:** Initial implementation with basic type safety
- **1.1.0:** Enhanced TypeScript integration
- **1.2.0:** Added RTK Query compatibility

## Related Documentation

- [Redux Store Architecture](../architecture/redux-store.md)
- [RTK Query Integration](../features/rtk-query.md)
- [State Management Patterns](../guides/state-management.md)
- [Redux Testing Guide](../testing/redux-testing.md)