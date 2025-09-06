# Auth Redux API Slice

> **Location:** `frontend/src/features/auth/authSlice.ts`  
> **Type:** RTK Query API  
> **Domain:** Authentication and session management

## Overview

The Auth API slice manages user authentication operations including login and logout functionality. Unlike other APIs in the application, this slice uses a basic `fetchBaseQuery` without authentication headers since it handles initial authentication before tokens are available.

## API Configuration

```typescript
export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api/auth" }),
  endpoints: (builder) => ({
    login: builder.query<string, Login>({
      query: (body) => ({
        url: "/login",
        method: "POST",
        body,
      }),
      transformResponse: (response: AuthResponse) => response.accessToken,
    }),
    logout: builder.query({
      query: () => ({
        url: "/logout",
        method: "POST",
      }),
    }),
  }),
});
```

### Base Configuration
- **Reducer Path:** `authApi`
- **Base Query:** `fetchBaseQuery` (no authentication - handles initial auth)
- **Base URL:** `/api/auth`
- **Tag Types:** None (no caching/invalidation needed for auth operations)

## Endpoints

### Query Endpoints (Data Fetching)

#### login
```typescript
login: builder.query<string, Login>({
  query: (body) => ({
    url: "/login",
    method: "POST",
    body,
  }),
  transformResponse: (response: AuthResponse) => response.accessToken,
})
```

**Purpose:** Authenticates user credentials and returns an access token.

**Usage:**
```typescript
const [login, { data: accessToken, error, isLoading }] = useAuthApi.useLazyLoginQuery();

const handleLogin = async (credentials: Login) => {
  try {
    const token = await login(credentials).unwrap();
    setCachedItem("accessToken", token);
    // Navigate to authenticated routes
  } catch (err) {
    // Handle login error
  }
};
```

#### logout
```typescript
logout: builder.query({
  query: () => ({
    url: "/logout",
    method: "POST",
  }),
})
```

**Purpose:** Invalidates user session on the server and cleans up authentication state.

**Usage:**
```typescript
const [logout] = useAuthApi.useLazyLogoutQuery();

const handleLogout = async () => {
  try {
    await logout().unwrap();
    // Clear local storage and redirect to login
    setCachedItem("accessToken", null);
  } catch (err) {
    // Handle logout error
  }
};
```

## Type Definitions

### Request Types

```typescript
interface Login {
  username: string;
  password: string;
}
```

### Response Types

```typescript
interface AuthResponse {
  accessToken: string;
}

interface User {
  id: string;
  username: string;
  avatarUrl: string | null;
  lastSeen: Date | null;
  displayName: string | null;
  role: string;
}

interface Register {
  username: string;
  password: string;
  email: string;
  code: string; // Instance invite code
}
```

## Caching Strategy

### No Cache Tags
The Auth API doesn't use RTK Query's caching system because:
- Authentication operations are one-time actions
- No need to cache login/logout responses
- Session state is managed via localStorage and JWT tokens

### Manual Token Management
```typescript
// Token storage and retrieval
import { getCachedItem, setCachedItem } from "../utils/storage";

// Store token after successful login
const token = await login(credentials).unwrap();
setCachedItem("accessToken", token);

// Clear token on logout
setCachedItem("accessToken", null);
```

## State Management

### Generated Hooks

```typescript
export const { 
  useLazyLoginQuery,    // Lazy query for manual login trigger
  useLazyLogoutQuery,   // Lazy query for manual logout trigger
} = authApi;
```

**Note:** Both operations use lazy queries since they should be triggered manually, not automatically on component mount.

## Error Handling

### Login Errors
```typescript
const [login, { error, isLoading }] = useLazyLoginQuery();

const handleLogin = async (credentials: Login) => {
  try {
    const token = await login(credentials).unwrap();
    // Success - store token
    setCachedItem("accessToken", token);
  } catch (err: any) {
    if (err.status === 401) {
      // Invalid credentials
      setError("Invalid username or password");
    } else if (err.status === 429) {
      // Rate limiting
      setError("Too many login attempts. Please try again later.");
    } else {
      // Network or server error
      setError("Login failed. Please try again.");
    }
  }
};
```

### Logout Errors
```typescript
const [logout] = useLazyLogoutQuery();

const handleLogout = async () => {
  try {
    await logout().unwrap();
  } catch (err) {
    // Even if logout fails on server, clear local token
    console.warn("Logout failed on server, clearing local session");
  } finally {
    // Always clear local state
    setCachedItem("accessToken", null);
    // Redirect to login page
  }
};
```

## Integration with Base Query

### Token Refresh Flow
The application uses a sophisticated token refresh system in `AuthedBaseQuery.ts`:

```typescript
const getBaseAuthedQuery = (baseQuery) => {
  return async function (args, api, extraOptions) {
    const result = await baseQuery(args, api, extraOptions);

    if (result.error?.status === 401) {
      console.log("Unauthorized, trying to refresh token");
      
      // Try to refresh token
      const refreshResponse = await axios.post("/api/auth/refresh");
      
      if (refreshResponse.data) {
        setCachedItem("accessToken", refreshResponse.data.accessToken);
        // Retry original request
        return baseQuery(args, api, extraOptions);
      }
    }
    
    return result;
  };
};
```

## Component Integration

### Login Form Integration
```typescript
import { useLazyLoginQuery } from '@/features/auth/authSlice';
import { setCachedItem } from '@/utils/storage';

function LoginForm() {
  const [login, { isLoading, error }] = useLazyLoginQuery();
  const [formData, setFormData] = useState<Login>({
    username: '',
    password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = await login(formData).unwrap();
      setCachedItem("accessToken", token);
      
      // Navigate to dashboard or redirect to intended page
      navigate('/dashboard');
    } catch (err) {
      // Error is available in the `error` state
      console.error('Login failed:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={formData.username}
        onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
        placeholder="Username"
        required
      />
      <input
        type="password"
        value={formData.password}
        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
        placeholder="Password"
        required
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Logging in...' : 'Login'}
      </button>
      {error && <div className="error">Login failed</div>}
    </form>
  );
}
```

### Logout Button Integration
```typescript
import { useLazyLogoutQuery } from '@/features/auth/authSlice';

function LogoutButton() {
  const [logout, { isLoading }] = useLazyLogoutQuery();

  const handleLogout = async () => {
    try {
      await logout().unwrap();
    } catch (err) {
      console.warn('Server logout failed:', err);
    } finally {
      // Always clear local session
      setCachedItem("accessToken", null);
      window.location.href = '/login';
    }
  };

  return (
    <button onClick={handleLogout} disabled={isLoading}>
      {isLoading ? 'Logging out...' : 'Logout'}
    </button>
  );
}
```

## Performance Considerations

### No Caching Overhead
- Auth operations don't cache responses
- Minimal memory footprint
- Fast execution for authentication flows

### Token Management
- Uses localStorage for token persistence
- Automatic token refresh on 401 responses
- Efficient token header injection via `prepareHeaders`

## Security Notes

### Token Storage
```typescript
// Secure token storage in localStorage
setCachedItem("accessToken", token);

// Token automatically included in authenticated requests
const prepareHeaders = (headers: Headers) => {
  const token = getCachedItem<string>("accessToken");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
};
```

### Automatic Token Refresh
- Transparent token refresh on expired sessions
- Graceful handling of refresh failures
- Prevents unnecessary logout on temporary network issues

## Related Documentation

- [Users API](./usersApi.md) - User profile and registration management
- [Base Query Configuration](../architecture/frontend.md#base-query) - Authenticated request setup
- [Authentication Flow](../features/auth-rbac.md) - Complete authentication and authorization system
- [Storage Utils](../hooks/useAppDispatch.md) - Token storage and retrieval utilities