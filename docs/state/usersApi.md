# Users Redux API Slice

> **Location:** `frontend/src/features/users/usersSlice.ts`  
> **Type:** RTK Query API  
> **Domain:** User management and profile operations

## Overview

The Users API slice manages user-related operations including user registration, profile management, user search, and user data retrieval with intelligent caching. It includes advanced features like local storage caching for frequently accessed user data and optimized search functionality for community member management.

## API Configuration

```typescript
export const usersApi = createApi({
  reducerPath: "usersApi",
  baseQuery: getBaseAuthedQuery(
    fetchBaseQuery({
      baseUrl: "/api/users",
      prepareHeaders,
    })
  ),
  endpoints: (builder) => ({
    // Endpoints defined below
  }),
});
```

### Base Configuration
- **Reducer Path:** `usersApi`
- **Base Query:** `getBaseAuthedQuery` (includes JWT authentication and token refresh)
- **Base URL:** `/api/users`
- **Tag Types:** None (uses manual cache management with localStorage)

## Endpoints

### Query Endpoints (Data Fetching)

#### register
```typescript
register: builder.query<User, Register>({
  query: (body) => ({
    url: "/",
    method: "POST",
    body,
  }),
})
```

**Purpose:** Registers a new user account (used as a query for lazy execution).

**Usage:**
```typescript
const [register, { data: newUser, isLoading, error }] = useUsersApi.useLazyRegisterQuery();

const handleRegister = async (registrationData: Register) => {
  try {
    const user = await register(registrationData).unwrap();
    // Handle successful registration
    navigate('/login');
  } catch (err) {
    // Handle registration error
  }
};
```

#### profile
```typescript
profile: builder.query<User, void>({
  query: () => ({
    url: "/profile",
    method: "GET",
  }),
})
```

**Purpose:** Fetches the current user's profile information.

**Usage:**
```typescript
const { 
  data: user, 
  error, 
  isLoading,
  refetch 
} = useUsersApi.useProfileQuery();

// Automatically fetches on component mount
// Use refetch() to refresh profile data
```

#### getUserByIdWithCache
```typescript
getUserByIdWithCache: builder.query<User, string>({
  async queryFn(userId, _queryApi, _extraOptions, fetchWithBQ) {
    // 1. Try localStorage cache
    const cached = getCachedItem<User>(`${USER_CACHE_PREFIX}${userId}`);
    if (cached) return { data: cached };
    
    // 2. Fetch from API
    const result = await fetchWithBQ(`/${userId}`);
    if (result.data) {
      setCachedItem(
        `${USER_CACHE_PREFIX}${userId}`,
        result.data as User,
        USER_CACHE_TTL
      );
      return { data: result.data as User };
    }
    
    return result.error ? { error: result.error } : { error: { status: 404, data: "User not found" } };
  },
})
```

**Purpose:** Fetches user data by ID with intelligent localStorage caching to reduce API calls.

**Usage:**
```typescript
const { 
  data: user, 
  error, 
  isLoading 
} = useUsersApi.useGetUserByIdWithCacheQuery(userId, {
  skip: !userId,
});

// First call fetches from API and caches result
// Subsequent calls return cached data (1 hour TTL)
```

#### searchUsers
```typescript
searchUsers: builder.query<User[], { query: string; communityId?: string }>({
  query: ({ query, communityId }) => ({
    url: "/search",
    method: "GET",
    params: {
      q: query,
      communityId,
    },
  }),
})
```

**Purpose:** Searches for users by username or display name, optionally filtered by community.

**Usage:**
```typescript
const [searchUsers, { data: searchResults = [], isLoading }] = useUsersApi.useLazySearchUsersQuery();

const handleSearch = (searchQuery: string) => {
  if (searchQuery.length >= 2) {
    searchUsers({ 
      query: searchQuery,
      communityId: currentCommunityId // Optional: filter by community
    });
  }
};
```

#### getAllUsers
```typescript
getAllUsers: builder.query<
  { users: User[]; continuationToken?: string },
  { limit?: number; continuationToken?: string }
>({
  query: ({ limit = 20, continuationToken }) => ({
    url: "/",
    method: "GET",
    params: {
      limit,
      ...(continuationToken && { continuationToken }),
    },
  }),
})
```

**Purpose:** Fetches paginated list of all users (admin functionality).

**Usage:**
```typescript
const { 
  data: usersResponse, 
  error, 
  isLoading 
} = useUsersApi.useGetAllUsersQuery({
  limit: 50
});

const users = usersResponse?.users || [];
const nextToken = usersResponse?.continuationToken;
```

## Type Definitions

### Request Types

```typescript
interface Register {
  username: string;
  password: string;
  email: string;
  code: string; // Instance invite code
}

interface UserSearchParams {
  query: string;        // Search term
  communityId?: string; // Optional community filter
}

interface GetAllUsersParams {
  limit?: number;            // Number of users per page
  continuationToken?: string; // Pagination token
}
```

### Response Types

```typescript
interface User {
  id: string;
  username: string;
  avatarUrl: string | null;
  lastSeen: Date | null;
  displayName: string | null;
  role: string;              // Instance-level role
  email?: string;            // Only included in own profile
  createdAt?: string;
  updatedAt?: string;
  isOnline?: boolean;        // Real-time presence status
}

interface GetAllUsersResponse {
  users: User[];
  continuationToken?: string;
}
```

## Caching Strategy

### Dual Caching System

The Users API implements a sophisticated dual caching system:

1. **RTK Query Cache:** For query results and automatic invalidation
2. **localStorage Cache:** For frequently accessed user data with TTL

```typescript
const USER_CACHE_PREFIX = "user_";
const USER_CACHE_TTL = 1000 * 60 * 60; // 1 hour

// Cache user data in localStorage
setCachedItem(`${USER_CACHE_PREFIX}${userId}`, userData, USER_CACHE_TTL);

// Retrieve cached user data
const cachedUser = getCachedItem<User>(`${USER_CACHE_PREFIX}${userId}`);
```

### Cache Benefits

- **Reduced API Calls:** Frequently accessed users are served from cache
- **Improved Performance:** Instant user data for message authors, mentions, etc.
- **Offline Resilience:** Cached user data available when offline
- **Cross-Session Persistence:** User data persists across browser sessions

## State Management

### Generated Hooks

```typescript
export const {
  // Query hooks
  useProfileQuery,
  useGetUserByIdWithCacheQuery,
  useGetAllUsersQuery,
  
  // Lazy query hooks (manual trigger)
  useLazyRegisterQuery,
  useLazySearchUsersQuery,
  
  // Utility hooks
  usePrefetch,
} = usersApi;
```

### Helper Functions

```typescript
// User API helper functions
export const userApiHelpers = {
  // Prefetch user data for performance
  prefetchUser: (userId: string) => {
    dispatch(usersApi.util.prefetch('getUserByIdWithCache', userId));
  },
  
  // Clear user from cache
  clearUserCache: (userId: string) => {
    localStorage.removeItem(`${USER_CACHE_PREFIX}${userId}`);
  },
  
  // Bulk prefetch users
  prefetchUsers: (userIds: string[]) => {
    userIds.forEach(id => {
      dispatch(usersApi.util.prefetch('getUserByIdWithCache', id));
    });
  },
};
```

## Component Integration

### User Profile Display

```typescript
import { useUsersApi } from '@/features/users/usersSlice';

function UserProfile({ userId }: { userId: string }) {
  const { 
    data: user, 
    error, 
    isLoading,
    refetch 
  } = useUsersApi.useGetUserByIdWithCacheQuery(userId);

  if (isLoading) return <UserProfileSkeleton />;
  if (error) return <div>User not found</div>;
  if (!user) return null;

  return (
    <div className="user-profile">
      <img 
        src={user.avatarUrl || '/default-avatar.png'} 
        alt={user.username}
        className="profile-avatar"
      />
      <div className="profile-info">
        <h3>{user.displayName || user.username}</h3>
        <p>@{user.username}</p>
        {user.lastSeen && (
          <p>Last seen: {formatDate(user.lastSeen)}</p>
        )}
        {user.isOnline && <span className="online-indicator">🟢 Online</span>}
      </div>
    </div>
  );
}
```

### User Search Component

```typescript
function UserSearchDialog({ onSelectUser }: { 
  onSelectUser: (user: User) => void 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchUsers, { data: searchResults = [], isLoading }] = useUsersApi.useLazySearchUsersQuery();
  
  const debouncedSearch = useMemo(
    () => debounce((query: string) => {
      if (query.length >= 2) {
        searchUsers({ query });
      }
    }, 300),
    [searchUsers]
  );

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  return (
    <div className="user-search-dialog">
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search users..."
        className="search-input"
      />
      
      {isLoading && <div>Searching...</div>}
      
      <div className="search-results">
        {searchResults.map(user => (
          <div 
            key={user.id}
            className="search-result"
            onClick={() => onSelectUser(user)}
          >
            <img 
              src={user.avatarUrl || '/default-avatar.png'} 
              alt="" 
              className="result-avatar" 
            />
            <div className="result-info">
              <div className="result-name">
                {user.displayName || user.username}
              </div>
              <div className="result-username">@{user.username}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Registration Form

```typescript
function RegistrationForm() {
  const [register, { isLoading, error }] = useUsersApi.useLazyRegisterQuery();
  const [formData, setFormData] = useState<Register>({
    username: '',
    password: '',
    email: '',
    code: '' // Instance invite code
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newUser = await register(formData).unwrap();
      // Registration successful
      toast.success('Registration successful! Please log in.');
      navigate('/login');
    } catch (err: any) {
      // Handle registration errors
      if (err.status === 400) {
        toast.error('Invalid registration data');
      } else if (err.status === 409) {
        toast.error('Username or email already exists');
      } else {
        toast.error('Registration failed');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="registration-form">
      <div className="form-group">
        <label>Username</label>
        <input
          type="text"
          value={formData.username}
          onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
          required
        />
      </div>

      <div className="form-group">
        <label>Email</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          required
        />
      </div>

      <div className="form-group">
        <label>Password</label>
        <input
          type="password"
          value={formData.password}
          onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
          required
        />
      </div>

      <div className="form-group">
        <label>Invite Code</label>
        <input
          type="text"
          value={formData.code}
          onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
          required
        />
      </div>

      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Creating Account...' : 'Register'}
      </button>
      
      {error && <div className="error">Registration failed</div>}
    </form>
  );
}
```

### My Profile Component

```typescript
function MyProfile() {
  const { 
    data: user, 
    error, 
    isLoading,
    refetch 
  } = useUsersApi.useProfileQuery();

  if (isLoading) return <div>Loading profile...</div>;
  if (error) return <div>Error loading profile</div>;
  if (!user) return <div>No profile data</div>;

  return (
    <div className="my-profile">
      <div className="profile-header">
        <img 
          src={user.avatarUrl || '/default-avatar.png'} 
          alt="Profile" 
          className="profile-avatar"
        />
        <div className="profile-details">
          <h2>{user.displayName || user.username}</h2>
          <p>@{user.username}</p>
          <p>{user.email}</p>
          <p>Role: {user.role}</p>
        </div>
        <button onClick={() => refetch()}>
          Refresh Profile
        </button>
      </div>
      
      <div className="profile-actions">
        <button onClick={() => setShowEditProfile(true)}>
          Edit Profile
        </button>
        <button onClick={() => setShowChangePassword(true)}>
          Change Password
        </button>
      </div>
    </div>
  );
}
```

## Performance Optimization

### User Data Prefetching

```typescript
// Prefetch users when loading message list
useEffect(() => {
  if (messages.length > 0) {
    const authorIds = [...new Set(messages.map(m => m.authorId))];
    authorIds.forEach(authorId => {
      // Only prefetch if not already cached
      if (!getCachedItem(`${USER_CACHE_PREFIX}${authorId}`)) {
        dispatch(usersApi.util.prefetch('getUserByIdWithCache', authorId));
      }
    });
  }
}, [messages]);
```

### Search Debouncing

```typescript
// Debounce search to reduce API calls
const debouncedSearch = useMemo(
  () => debounce((query: string) => {
    if (query.length >= 2) {
      searchUsers({ query });
    }
  }, 300),
  [searchUsers]
);
```

### Cache Management

```typescript
// Clean up expired cache entries
const cleanupUserCache = () => {
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith(USER_CACHE_PREFIX)) {
      const cached = getCachedItem(key);
      if (!cached) {
        localStorage.removeItem(key); // Remove expired entries
      }
    }
  });
};

// Run cleanup on app start
useEffect(() => {
  cleanupUserCache();
}, []);
```

## Error Handling

### Profile Loading Errors

```typescript
const { data: user, error } = useProfileQuery();

if (error) {
  if ('status' in error) {
    switch (error.status) {
      case 401:
        // Unauthorized - redirect to login
        navigate('/login');
        break;
      case 403:
        // Forbidden - user account issues
        return <div>Account access restricted</div>;
      default:
        return <div>Error loading profile</div>;
    }
  }
}
```

### User Search Errors

```typescript
const [searchUsers, { error }] = useLazySearchUsersQuery();

const handleSearch = async (query: string) => {
  try {
    await searchUsers({ query }).unwrap();
  } catch (err: any) {
    if (err.status === 429) {
      toast.error('Search rate limit exceeded. Please wait.');
    } else {
      toast.error('Search failed. Please try again.');
    }
  }
};
```

### Registration Errors

```typescript
const [register, { error }] = useLazyRegisterQuery();

const handleRegistrationError = (error: any) => {
  if (error.status === 400) {
    const { data } = error;
    if (data.field === 'username') {
      setFieldError('username', 'Username is already taken');
    } else if (data.field === 'email') {
      setFieldError('email', 'Email is already registered');
    } else {
      setGeneralError('Invalid registration data');
    }
  } else if (error.status === 403) {
    setGeneralError('Invalid invite code');
  } else {
    setGeneralError('Registration failed. Please try again.');
  }
};
```

## Testing

### Cache Testing

```typescript
describe('getUserByIdWithCache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return cached user data', async () => {
    const userId = 'user-123';
    const userData = { id: userId, username: 'testuser' };
    
    // Set cache
    setCachedItem(`${USER_CACHE_PREFIX}${userId}`, userData, USER_CACHE_TTL);
    
    const { result } = renderHook(
      () => usersApi.useGetUserByIdWithCacheQuery(userId),
      { wrapper: TestProvider }
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(userData);
    });
    
    // Should not make API call
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should fetch from API when cache is empty', async () => {
    const userId = 'user-456';
    
    const { result } = renderHook(
      () => usersApi.useGetUserByIdWithCacheQuery(userId),
      { wrapper: TestProvider }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    
    // Should make API call
    expect(mockFetch).toHaveBeenCalledWith(`/api/users/${userId}`);
  });
});
```

### Search Testing

```typescript
describe('searchUsers', () => {
  it('should search users successfully', async () => {
    const { result } = renderHook(
      () => usersApi.useLazySearchUsersQuery(),
      { wrapper: TestProvider }
    );

    await act(async () => {
      const response = await result.current[0]({ query: 'test' }).unwrap();
      expect(Array.isArray(response)).toBe(true);
    });
  });
});
```

## Related Documentation

- [Auth API](./authApi.md) - User authentication and session management
- [Membership API](./membershipApi.md) - Community membership management
- [Roles API](./rolesApi.md) - User permissions and roles
- [Profile Components](../components/layout/ProfileIcon.md) - User profile UI components
- [User Management](../features/auth-rbac.md#user-management) - Admin user management features
- [Storage Utils](../architecture/frontend.md#local-storage) - Cache management utilities