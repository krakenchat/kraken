# ProfilePage

> **Location:** `frontend/src/pages/ProfilePage.tsx`
> **Type:** Page Component (Container)
> **Feature:** profile

## Overview

`ProfilePage` is the user profile viewing page that displays a user's profile information including their display name, username, avatar, and banner. It supports viewing both your own profile (with edit button) and other users' profiles. The page fetches user data via RTK Query, handles loading and error states, and provides navigation to the profile edit page for the current user.

**Key Features:**
- View any user's profile by user ID (from URL params)
- Conditional "Edit Profile" button for own profile
- Loading and error states
- Back navigation button
- Profile header with avatar and banner display
- Responsive Material-UI layout

## Component Structure

```
ProfilePage
├── useParams (React Router - get userId from URL)
├── useNavigate (React Router - navigation)
├── useProfileQuery (RTK Query - fetch current user)
├── useGetUserByIdQuery (RTK Query - fetch profile user)
└── ProfileHeader (display component)
```

## Props Interface

```typescript
// This is a page component with no props
// User ID comes from URL route parameter
```

**Route Configuration:**
```tsx
// In App.tsx or routes configuration
<Route path="/profile/:userId" element={<ProfilePage />} />
```

## Usage Examples

### Basic Usage - Route Integration

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProfilePage from '@/pages/ProfilePage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/profile/:userId" element={<ProfilePage />} />
        {/* other routes */}
      </Routes>
    </BrowserRouter>
  );
}
```

### Navigation to Profile Page

```tsx
import { useNavigate } from 'react-router-dom';

function MessageAuthor({ author }) {
  const navigate = useNavigate();

  return (
    <div onClick={() => navigate(`/profile/${author.id}`)}>
      <UserAvatar user={author} size="small" />
      <span>{author.displayName || author.username}</span>
    </div>
  );
}
```

### Link to Profile Page

```tsx
import { Link } from 'react-router-dom';

function MemberListItem({ member }) {
  return (
    <Link to={`/profile/${member.id}`}>
      <UserAvatar user={member} size="medium" />
      <span>{member.displayName || member.username}</span>
    </Link>
  );
}
```

## State Management

### RTK Query Integration

```typescript
// Get userId from URL parameters
const { userId } = useParams<{ userId: string }>();

// Fetch current authenticated user
const { data: currentUser } = useProfileQuery();

// Fetch profile user by ID from URL
const {
  data: profileUser,
  isLoading,
  error
} = useGetUserByIdQuery(userId!, {
  skip: !userId, // Skip query if no userId in URL
});
```

**Query Behavior:**
- `useProfileQuery()` - Always fetches current authenticated user
- `useGetUserByIdQuery(userId)` - Fetches user specified in URL
- `skip: !userId` - Prevents query if userId is undefined

### Navigation State

```typescript
const navigate = useNavigate();

const handleGoBack = () => {
  navigate(-1); // Go to previous page
};

const handleEditProfile = () => {
  navigate("/profile/edit");
};
```

## Component Logic Flow

### 1. Route Parameter Extraction

```typescript
const { userId } = useParams<{ userId: string }>();
// Example: URL /profile/user-123 → userId = "user-123"
```

### 2. User Data Fetching

```typescript
// Fetch current user (for comparison)
const { data: currentUser } = useProfileQuery();

// Fetch profile user (the user whose profile is being viewed)
const { data: profileUser, isLoading, error } = useGetUserByIdQuery(userId!, {
  skip: !userId,
});
```

### 3. Profile Ownership Check

```typescript
const isOwnProfile = currentUser?.id === userId;

// Used to conditionally show "Edit Profile" button
{isOwnProfile && (
  <Button onClick={handleEditProfile}>
    Edit Profile
  </Button>
)}
```

## Render Logic

### Loading State

```tsx
if (isLoading) {
  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    </Container>
  );
}
```

### Error State

```tsx
if (error || !profileUser) {
  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Alert severity="error">
        Failed to load user profile. Please try again.
      </Alert>
    </Container>
  );
}
```

### Main Content Rendering

```tsx
<Container maxWidth="md" sx={{ py: 3 }}>
  {/* Header with Back and Edit buttons */}
  <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
    <Button startIcon={<ArrowBackIcon />} onClick={handleGoBack}>
      Back
    </Button>
    {isOwnProfile && (
      <Button startIcon={<EditIcon />} onClick={handleEditProfile} variant="contained">
        Edit Profile
      </Button>
    )}
  </Box>

  {/* Profile content */}
  <Paper>
    <ProfileHeader user={profileUser} />
  </Paper>
</Container>
```

## Styling & Theming

- **Material-UI Components Used:**
  - `Container` - Page width constraint (maxWidth="md")
  - `Box` - Layout and spacing
  - `Paper` - Elevated card for profile content
  - `Button` - Back and Edit Profile actions
  - `CircularProgress` - Loading spinner
  - `Alert` - Error message display

- **Layout Pattern:**
  - Centered container with max-width constraint
  - Flexbox header with space-between for buttons
  - Profile content in elevated Paper component

```tsx
<Container maxWidth="md" sx={{ py: 3 }}>
  <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
    {/* Navigation buttons */}
  </Box>
  <Paper>
    {/* Profile content */}
  </Paper>
</Container>
```

## Dependencies

### Internal Dependencies
- `@/features/users/usersSlice` - RTK Query endpoints (useProfileQuery, useGetUserByIdQuery)
- `@/components/Profile/ProfileHeader` - Profile display component

### External Dependencies
- `@mui/material` - UI components (Container, Box, Paper, Button, CircularProgress, Alert)
- `@mui/icons-material` - Icons (Edit, ArrowBack)
- `react-router-dom` - Navigation and routing (useParams, useNavigate)

## Navigation Flow

### Entry Points

Users can navigate to this page from:

1. **Message Author Click**
   ```tsx
   // Clicking username in messages
   navigate(`/profile/${message.author.id}`);
   ```

2. **Member List Click**
   ```tsx
   // Clicking member in sidebar
   navigate(`/profile/${member.id}`);
   ```

3. **After Profile Edit**
   ```tsx
   // ProfileEditPage redirects here after save
   navigate(`/profile/${currentUser.id}`);
   ```

4. **Direct URL**
   ```
   /profile/user-abc-123
   ```

### Exit Points

Users can navigate away via:

1. **Back Button** - Returns to previous page in history
2. **Edit Profile Button** - Goes to `/profile/edit` (own profile only)
3. **Browser Navigation** - Standard browser back/forward

## Profile Ownership Logic

### Ownership Determination

```typescript
const isOwnProfile = currentUser?.id === userId;
```

**Scenarios:**
- Current user viewing own profile: `isOwnProfile = true`
- Current user viewing another user's profile: `isOwnProfile = false`
- Not authenticated: `currentUser` is null, `isOwnProfile = false`

### Conditional Edit Button

```tsx
{isOwnProfile && (
  <Button
    startIcon={<EditIcon />}
    onClick={handleEditProfile}
    variant="contained"
  >
    Edit Profile
  </Button>
)}
```

**Button Only Shown When:**
- User is authenticated
- Viewing their own profile (`currentUser.id === userId`)

## Performance Considerations

### Query Skipping

```typescript
useGetUserByIdQuery(userId!, {
  skip: !userId, // Don't fetch if no userId
});
```

**Benefits:**
- Prevents unnecessary API calls
- Avoids errors when userId is undefined
- Improves performance on initial render

### Cache Reuse

```typescript
// If viewing own profile, data may already be cached
useGetUserByIdQuery(currentUser.id);
// RTK Query returns cached data instantly if available
```

**RTK Query Caching:**
- User data cached by user ID
- Cache invalidated on profile update
- Automatic background refetch on focus/reconnect

## Accessibility

- **Navigation**: Back button with clear icon and label
- **Actions**: Edit button with descriptive text and icon
- **Loading States**: CircularProgress for visual feedback
- **Error Messages**: Alert with semantic error severity
- **Semantic HTML**: Paper provides proper content grouping

## Common Patterns

### Pattern 1: View Own Profile

```tsx
function ViewOwnProfile() {
  const { data: currentUser } = useProfileQuery();
  const navigate = useNavigate();

  return (
    <button onClick={() => navigate(`/profile/${currentUser.id}`)}>
      View My Profile
    </button>
  );
}
```

### Pattern 2: View Other User's Profile

```tsx
function UserCard({ user }) {
  const navigate = useNavigate();

  return (
    <div onClick={() => navigate(`/profile/${user.id}`)}>
      <UserAvatar user={user} />
      <span>{user.displayName || user.username}</span>
    </div>
  );
}
```

### Pattern 3: Conditional Profile Actions

```tsx
function ProfileActions({ profileUserId }) {
  const { data: currentUser } = useProfileQuery();
  const isOwnProfile = currentUser?.id === profileUserId;

  return (
    <div>
      {isOwnProfile ? (
        <button onClick={() => navigate('/profile/edit')}>
          Edit Profile
        </button>
      ) : (
        <button onClick={() => sendFriendRequest(profileUserId)}>
          Add Friend
        </button>
      )}
    </div>
  );
}
```

### Pattern 4: Profile Link Component

```tsx
import { Link } from 'react-router-dom';

function ProfileLink({ user }) {
  return (
    <Link
      to={`/profile/${user.id}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <UserAvatar user={user} size="small" />
      <span>{user.displayName || user.username}</span>
    </Link>
  );
}
```

## Testing

### Test Scenarios

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProfilePage from './ProfilePage';

describe('ProfilePage', () => {
  it('should display user profile', async () => {
    const mockUser = {
      id: 'user-123',
      username: 'johndoe',
      displayName: 'John Doe',
      avatarUrl: 'file-avatar-123',
      bannerUrl: 'file-banner-123',
    };

    // Mock RTK Query hooks
    jest.mock('@/features/users/usersSlice', () => ({
      useGetUserByIdQuery: () => ({
        data: mockUser,
        isLoading: false,
        error: null,
      }),
      useProfileQuery: () => ({
        data: { id: 'current-user-456' },
      }),
    }));

    render(
      <MemoryRouter initialEntries={['/profile/user-123']}>
        <Routes>
          <Route path="/profile/:userId" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('@johndoe')).toBeInTheDocument();
    });
  });

  it('should show edit button for own profile', async () => {
    const mockUser = { id: 'user-123', username: 'johndoe' };

    // Mock current user as same user
    jest.mock('@/features/users/usersSlice', () => ({
      useGetUserByIdQuery: () => ({
        data: mockUser,
        isLoading: false,
        error: null,
      }),
      useProfileQuery: () => ({
        data: mockUser, // Same user
      }),
    }));

    render(
      <MemoryRouter initialEntries={['/profile/user-123']}>
        <Routes>
          <Route path="/profile/:userId" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Edit Profile')).toBeInTheDocument();
    });
  });

  it('should not show edit button for other user profile', async () => {
    jest.mock('@/features/users/usersSlice', () => ({
      useGetUserByIdQuery: () => ({
        data: { id: 'user-123', username: 'johndoe' },
        isLoading: false,
        error: null,
      }),
      useProfileQuery: () => ({
        data: { id: 'current-user-456' }, // Different user
      }),
    }));

    render(
      <MemoryRouter initialEntries={['/profile/user-123']}>
        <Routes>
          <Route path="/profile/:userId" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('Edit Profile')).not.toBeInTheDocument();
    });
  });

  it('should display loading state', () => {
    jest.mock('@/features/users/usersSlice', () => ({
      useGetUserByIdQuery: () => ({
        data: null,
        isLoading: true,
        error: null,
      }),
      useProfileQuery: () => ({ data: null }),
    }));

    render(
      <MemoryRouter initialEntries={['/profile/user-123']}>
        <Routes>
          <Route path="/profile/:userId" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should display error state', () => {
    jest.mock('@/features/users/usersSlice', () => ({
      useGetUserByIdQuery: () => ({
        data: null,
        isLoading: false,
        error: { message: 'User not found' },
      }),
      useProfileQuery: () => ({ data: null }),
    }));

    render(
      <MemoryRouter initialEntries={['/profile/user-123']}>
        <Routes>
          <Route path="/profile/:userId" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/failed to load user profile/i)).toBeInTheDocument();
  });
});
```

## Troubleshooting

### Common Issues

1. **Profile not loading**
   - **Cause:** Invalid userId in URL or user doesn't exist
   - **Solution:** Verify userId format and that user exists in database

   ```tsx
   // Debug: Check URL parameters and query state
   console.log('User ID from URL:', userId);
   console.log('Profile user:', profileUser);
   console.log('Query error:', error);
   ```

2. **Edit button not showing for own profile**
   - **Cause:** `currentUser.id` doesn't match `userId` from URL
   - **Solution:** Ensure userId in URL matches authenticated user's ID

   ```tsx
   // Debug: Check ownership logic
   console.log('Current user ID:', currentUser?.id);
   console.log('Profile user ID:', userId);
   console.log('Is own profile:', isOwnProfile);
   ```

3. **Back button doesn't work**
   - **Cause:** No previous page in history (direct navigation)
   - **Solution:** Use fallback navigation or check history length

   ```tsx
   const handleGoBack = () => {
     if (window.history.length > 1) {
       navigate(-1);
     } else {
       navigate('/'); // Fallback to home
     }
   };
   ```

4. **Profile showing stale data after edit**
   - **Cause:** RTK Query cache not invalidated
   - **Solution:** Ensure updateProfile mutation invalidates correct tags

   ```typescript
   // In usersApi.ts - updateProfile mutation
   invalidatesTags: (result) =>
     result
       ? ["Profile", { type: "User", id: result.id }]
       : ["Profile"]
   ```

5. **Query skipped unexpectedly**
   - **Cause:** `skip: !userId` prevents query when userId is falsy
   - **Solution:** Ensure userId is properly extracted from URL params

   ```tsx
   // Debug: Check skip condition
   console.log('User ID:', userId);
   console.log('Skip query:', !userId);
   ```

### Best Practices

- **Validate User ID**: Check userId exists before rendering content
- **Handle Auth States**: Gracefully handle unauthenticated users
- **Provide Navigation**: Always offer back button or breadcrumbs
- **Show Ownership Actions**: Display edit button only for own profile
- **Error Boundaries**: Wrap in error boundary for unexpected failures
- **Loading States**: Show skeleton or spinner during data fetch

## Related Components

- **Child Components:**
  - `ProfileHeader` - Displays profile banner, avatar, and user info

- **Related Pages:**
  - `ProfileEditPage` - Profile editing interface (navigation target)

- **Similar Components:**
  - `CommunityPage` - Similar pattern for community viewing

## Recent Changes

- **2025-01-05:** Initial implementation of profile viewing page
- **2025-01-05:** Added conditional edit button for own profile
- **2025-01-05:** Integrated ProfileHeader component for display
- **2025-01-05:** Implemented RTK Query for user data fetching

## Related Documentation

- [ProfileHeader Component](./ProfileHeader.md) - Profile display component
- [ProfileEditPage Component](./ProfileEditPage.md) - Profile editing page
- [UserAvatar Component](../common/UserAvatar.md) - Avatar display
- [User API](../../api/user.md) - User endpoints
- [usersApi State](../../state/usersApi.md) - RTK Query endpoints
- [User Profiles Feature](../../features/user-profiles.md) - Feature overview
