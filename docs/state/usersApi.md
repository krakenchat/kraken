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
  tagTypes: ["Profile", "User"],
  endpoints: (builder) => ({
    // Endpoints defined below
  }),
});
```

### Base Configuration
- **Reducer Path:** `usersApi`
- **Base Query:** `getBaseAuthedQuery` (includes JWT authentication and token refresh)
- **Base URL:** `/api/users`
- **Tag Types:** `["Profile", "User"]` (RTK Query tag-based cache invalidation)

## Endpoints

### Query Endpoints (Data Fetching)

**Note:** All query endpoints use RTK Query's built-in caching. Tag-based invalidation ensures data stays fresh when mutations occur.

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

#### getUserById
```typescript
getUserById: builder.query<User, string>({
  query: (userId) => `/${userId}`,
  providesTags: (result, _error, userId) => [{ type: "User", id: userId }],
})
```

**Purpose:** Fetches user data by ID with RTK Query automatic caching.

**Usage:**
```typescript
const {
  data: user,
  error,
  isLoading
} = useUsersApi.useGetUserByIdQuery(userId, {
  skip: !userId,
});

// RTK Query handles caching automatically
// Cache is invalidated when user profile is updated
```

**Cache Tags:**
- Provides tag: `{ type: "User", id: userId }`
- Invalidated by: `updateProfile` mutation

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

---

### Mutation Endpoints (Data Modification)

#### updateProfile
```typescript
updateProfile: builder.mutation<
  User,
  { displayName?: string; avatar?: string; banner?: string }
>({
  query: (body) => ({
    url: "/profile",
    method: "PATCH",
    body,
  }),
  invalidatesTags: (result) =>
    result ? ["Profile", { type: "User", id: result.id }] : ["Profile"],
})
```

**Purpose:** Updates the current user's profile (display name, avatar, banner).

**Usage:**
```typescript
const [updateProfile, { isLoading, error }] = useUsersApi.useUpdateProfileMutation();

const handleProfileUpdate = async (displayName: string, avatarFileId?: string, bannerFileId?: string) => {
  try {
    const updatedUser = await updateProfile({
      displayName,
      avatar: avatarFileId,
      banner: bannerFileId,
    }).unwrap();

    console.log('Profile updated:', updatedUser);
    // RTK Query automatically invalidates cache
    // All components using useProfileQuery or useGetUserByIdQuery will re-fetch
  } catch (err) {
    console.error('Failed to update profile:', err);
  }
};
```

**Complete Example with File Upload:**
```typescript
import { useFileUpload } from '@/hooks/useFileUpload';
import { useUpdateProfileMutation } from '@/features/users/usersSlice';

function ProfileEditForm({ currentUser }: { currentUser: User }) {
  const { uploadFile } = useFileUpload();
  const [updateProfile, { isLoading }] = useUpdateProfileMutation();
  const [displayName, setDisplayName] = useState(currentUser.displayName || '');

  const handleAvatarChange = async (file: File) => {
    try {
      // 1. Upload avatar file
      const uploadedFile = await uploadFile(file, {
        resourceType: 'USER_AVATAR',
        resourceId: currentUser.id,
      });

      // 2. Update profile with new avatar file ID
      await updateProfile({
        avatar: uploadedFile.id,
      }).unwrap();

      // Profile and User caches automatically invalidated
    } catch (error) {
      console.error('Avatar upload failed:', error);
    }
  };

  const handleSave = async () => {
    await updateProfile({
      displayName: displayName.trim(),
    }).unwrap();
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
      <TextField
        label="Display Name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
      />
      <input
        type="file"
        accept="image/*"
        onChange={(e) => e.target.files?.[0] && handleAvatarChange(e.target.files[0])}
      />
      <Button type="submit" disabled={isLoading}>
        {isLoading ? 'Saving...' : 'Save Profile'}
      </Button>
    </form>
  );
}
```

**Cache Invalidation:**
- Invalidates `"Profile"` tag → `useProfileQuery` re-fetches
- Invalidates `{ type: "User", id: userId }` tag → `useGetUserByIdQuery` re-fetches
- All components displaying this user's profile update automatically

**Validation:**
- `displayName`: 1-32 characters, trimmed automatically
- `avatar`: Must be valid file ID from file upload endpoint
- `banner`: Must be valid file ID from file upload endpoint
- All fields optional - only send fields you want to update

---

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
  bannerUrl: string | null;  // Profile banner image file ID
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

interface UpdateProfilePayload {
  displayName?: string;  // Optional: New display name (1-32 chars)
  avatar?: string;       // Optional: File ID for avatar image
  banner?: string;       // Optional: File ID for banner image
}
```

## Caching Strategy

### RTK Query Tag-Based Cache Invalidation

The Users API uses RTK Query's built-in caching with tag-based invalidation for automatic cache management:

**Tag Types:**
- `"Profile"` - Current user's profile data
- `"User"` - Individual user data by ID

**Cache Flow:**
```typescript
// Query provides tags
useGetUserByIdQuery(userId) → Provides: [{ type: "User", id: userId }]
useProfileQuery() → Provides: ["Profile"]

// Mutation invalidates tags
updateProfile() → Invalidates: ["Profile", { type: "User", id: userId }]

// Result: All components using these queries automatically re-fetch
```

### Cache Invalidation Examples

```typescript
// Scenario 1: User updates their profile
await updateProfile({ displayName: "New Name" });
// ✅ useProfileQuery() automatically re-fetches
// ✅ useGetUserByIdQuery(currentUserId) automatically re-fetches
// ✅ All components displaying this user update automatically

// Scenario 2: Multiple components showing same user
<UserAvatar userId="123" />           // useGetUserByIdQuery("123")
<UserProfile userId="123" />          // useGetUserByIdQuery("123")
<MessageAuthor authorId="123" />      // useGetUserByIdQuery("123")
// All three components share the same cached data
// When user "123" updates profile, all three update automatically
```

### Cache Benefits

- **Automatic Invalidation:** No manual cache management required
- **Deduplication:** Multiple components requesting same user share one fetch
- **Performance:** RTK Query's normalized cache prevents duplicate data
- **Real-time Updates:** Profile changes propagate instantly to all components
- **Type Safety:** Full TypeScript support for cache tags and queries

## State Management

### Generated Hooks

```typescript
export const {
  // Query hooks
  useProfileQuery,
  useGetUserByIdQuery,       // Renamed from useGetUserByIdWithCacheQuery
  useGetAllUsersQuery,

  // Lazy query hooks (manual trigger)
  useLazyRegisterQuery,
  useLazySearchUsersQuery,

  // Mutation hooks
  useUpdateProfileMutation,  // NEW: Profile updates

  // Utility hooks
  usePrefetch,
} = usersApi;
```

### Helper Functions

```typescript
import { usersApi } from '@/features/users/usersSlice';
import { useAppDispatch } from '@/app/hooks';

// User API helper functions
export const userApiHelpers = {
  // Prefetch user data for performance
  prefetchUser: (userId: string, dispatch: AppDispatch) => {
    dispatch(usersApi.util.prefetch('getUserById', userId));
  },

  // Invalidate user cache manually (if needed)
  invalidateUser: (userId: string, dispatch: AppDispatch) => {
    dispatch(
      usersApi.util.invalidateTags([{ type: "User", id: userId }])
    );
  },

  // Invalidate profile cache
  invalidateProfile: (dispatch: AppDispatch) => {
    dispatch(
      usersApi.util.invalidateTags(["Profile"])
    );
  },

  // Bulk prefetch users (e.g., for message list)
  prefetchUsers: (userIds: string[], dispatch: AppDispatch) => {
    userIds.forEach(id => {
      dispatch(usersApi.util.prefetch('getUserById', id));
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
  } = useUsersApi.useGetUserByIdQuery(userId);

  // Use authenticated image hook for avatar
  const { blobUrl: avatarUrl } = useAuthenticatedImage(user?.avatarUrl);
  const { blobUrl: bannerUrl } = useAuthenticatedImage(user?.bannerUrl);

  if (isLoading) return <UserProfileSkeleton />;
  if (error) return <div>User not found</div>;
  if (!user) return null;

  return (
    <div className="user-profile">
      {/* Profile banner */}
      {bannerUrl && (
        <div
          className="profile-banner"
          style={{ backgroundImage: `url(${bannerUrl})` }}
        />
      )}

      {/* Avatar */}
      <img
        src={avatarUrl || '/default-avatar.png'}
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