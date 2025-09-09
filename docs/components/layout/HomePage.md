# HomePage

> **Location:** `frontend/src/pages/HomePage.tsx`  
> **Type:** Page Component  
> **Feature:** layout

## Overview

The HomePage component serves as the default landing page for authenticated users. It displays the user's profile information and provides quick actions for common tasks. Features a prominent invite creation section for administrators and the user's profile card with avatar, display name, role, and status information.

## Props Interface

```typescript
// HomePage takes no props - it's a standalone page component
interface HomePageProps {}
```

## Usage Examples

### Basic Usage (React Router)
```tsx
// App.tsx route configuration
<Route path="/" element={<Layout />}>
  <Route index element={<HomePage />} />
</Route>
```

### Standalone Usage
```tsx
import HomePage from '@/pages/HomePage';

function Dashboard() {
  return <HomePage />;
}
```

## Key Features

### 1. Quick Invite System
- **Permission-Based Display**: Only visible to users with `CREATE_INSTANCE_INVITE` permission
- **One-Click Invite Creation**: Generates invites with sensible defaults (10 uses, 7-day expiration)
- **Auto-Community Selection**: Automatically selects "default" community or all available communities
- **Immediate Clipboard Copy**: Invite link automatically copied with user feedback
- **Management Integration**: Direct link to full AdminInvitePage

### 2. User Profile Display
- **Avatar with Fallback**: User image or initials display
- **Role-Based Information**: Shows user role and permissions
- **Status Information**: Last seen timestamp and online status

## Styling & Theming

- **Material-UI Components Used:**
  - `Box` (layout containers)
  - `Card` & `CardContent` (profile card)
  - `Paper` (invite section with gradient background)
  - `Typography` (text elements)
  - `Avatar` (user avatar display)
  - `Button` (action buttons)
  - `IconButton` (copy/settings actions)
  - `Tooltip` (copy feedback)
  - `Snackbar` (toast notifications)
  - `CircularProgress` (loading indicators)
  - `Alert` (error messages)
- **Custom Styles:** 
  - Gradient background for invite section
  - Responsive layout with flexbox
  - Glass-morphism effects with backdrop blur
- **Theme Variables:** Uses MUI theme colors and typography variants

```tsx
// Key styling patterns

// Invite Section (Gradient Background)
<Paper 
  sx={{ 
    p: 3, 
    width: "100%", 
    maxWidth: 500,
    borderRadius: 2,
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
  }}
>
  <Button
    sx={{
      bgcolor: "rgba(255, 255, 255, 0.2)",
      "&:hover": { bgcolor: "rgba(255, 255, 255, 0.3)" },
      color: "white",
      backdropFilter: "blur(10px)",
    }}
  >
    Quick Invite
  </Button>
</Paper>

// Profile Card (Clean Layout)
<Card
  sx={{
    width: "100%",
    maxWidth: 400,
    padding: 2,
    borderRadius: 2,
    boxShadow: 3,
  }}
>
  <Avatar
    sx={{
      width: 80,
      height: 80,
      backgroundColor: "#1976d2",
      fontSize: 32,
    }}
  />
</Card>
```

## State Management

### Local State
```typescript
const [lastCreatedInvite, setLastCreatedInvite] = useState<string | null>(null);
const [snackbarOpen, setSnackbarOpen] = useState(false);
```

### Redux Integration
- **User Data**: `useProfileQuery` from usersSlice - fetches current user profile
- **Communities**: `useMyCommunitiesQuery` from communityApiSlice - for auto-join selection  
- **Invite Creation**: `useCreateInviteMutation` from inviteApiSlice - creates new invites
- **Permissions**: `useUserPermissions` hook - determines invite creation access

### Permission-Based Rendering
```typescript
const { hasPermissions: canCreateInvites } = useUserPermissions({
  resourceType: "INSTANCE",
  actions: ["CREATE_INSTANCE_INVITE"],
});

const { hasPermissions: canViewInvites } = useUserPermissions({
  resourceType: "INSTANCE", 
  actions: ["READ_INSTANCE_INVITE"],
});
```

## Dependencies

### Internal Dependencies
- `@/features/users/usersSlice` - user profile API integration
- `@/features/invite/inviteApiSlice` - invite creation and management
- `@/features/community/communityApiSlice` - community data for auto-join
- `@/features/roles/useUserPermissions` - permission-based rendering
- `@/types/invite.type` - TypeScript interfaces

### External Dependencies
- `@mui/material` - UI components (Box, Card, Paper, Button, Typography, Avatar, etc.)
- `@mui/icons-material` - Icons (PersonAdd, ContentCopy, Link, Settings)
- `react` - component framework and hooks
- `react-router-dom` - Link component for navigation

## Related Components

- **Parent Components:** Layout (via React Router Outlet)
- **Child Components:** None (leaf component)
- **Similar Components:** Profile sections in other components

## Common Patterns

### Pattern 1: Permission-Based Feature Display
```tsx
{data && canCreateInvites && (
  <Paper sx={{ /* invite section styles */ }}>
    <Typography variant="h6">
      Invite Users to Kraken
    </Typography>
    <Button onClick={handleQuickInvite}>
      {creatingInvite ? <CircularProgress size={20} /> : "Quick Invite"}
    </Button>
  </Paper>
)}
```

### Pattern 2: Auto-Community Selection Logic
```tsx
const handleQuickInvite = async () => {
  // Auto-select communities (prefer "default" community if it exists, otherwise all communities)
  const defaultCommunity = communities.find(c => c.name.toLowerCase() === 'default');
  const selectedCommunities = defaultCommunity ? [defaultCommunity.id] : communities.map(c => c.id);
  
  const createInviteDto: CreateInviteDto = {
    communityIds: selectedCommunities,
    maxUses: 10,
    validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  };
};
```

### Pattern 3: Clipboard Copy with User Feedback
```tsx
const handleCopyInvite = async () => {
  if (lastCreatedInvite) {
    const inviteUrl = `${window.location.origin}/join/${lastCreatedInvite}`;
    await navigator.clipboard.writeText(inviteUrl);
    setSnackbarOpen(true);
  }
};

<Snackbar
  open={snackbarOpen}
  autoHideDuration={3000}
  onClose={() => setSnackbarOpen(false)}
  message="Invite link copied to clipboard!"
/>
```

### Pattern 4: Conditional Avatar Display
```tsx
<Avatar sx={{ width: 80, height: 80 }}>
  {data.avatarUrl ? (
    <img
      src={data.avatarUrl}
      alt={`${data.displayName}'s avatar`}
      style={{ width: "100%", height: "100%", borderRadius: "50%" }}
    />
  ) : (
    data.displayName?.charAt(0).toUpperCase()
  )}
</Avatar>
```

## Testing

- **Test Location:** Not currently implemented
- **Key Test Cases:**
  - **Profile Display**: Profile data, loading states, error handling
  - **Permission-Based Rendering**: Invite section only shows for authorized users
  - **Quick Invite Flow**: Invite creation, community auto-selection, clipboard copy
  - **User Feedback**: Snackbar notifications, loading indicators
  - **Avatar Fallback**: Initials when no avatar URL provided

```tsx
// Example test patterns
test('should display user profile data when loaded', () => {
  // Mock successful profile query
  // Render HomePage
  // Assert profile information is displayed
});

test('should show invite section for users with CREATE_INSTANCE_INVITE permission', () => {
  // Mock user with invite permissions
  // Mock communities data
  // Render HomePage
  // Assert invite section is visible
});

test('should hide invite section for users without permissions', () => {
  // Mock user without invite permissions
  // Render HomePage  
  // Assert invite section is not present
});

test('should create invite with auto-selected communities', () => {
  // Mock communities with "default" community
  // Mock createInviteMutation
  // Click "Quick Invite" button
  // Assert invite created with correct default community
});

test('should copy invite link to clipboard and show feedback', () => {
  // Mock clipboard API
  // Create invite first
  // Click copy button
  // Assert clipboard.writeText called with correct URL
  // Assert snackbar shows success message
});
```

## Accessibility

- **ARIA Labels:** 
  - Avatar images have proper alt text
- **Keyboard Navigation:** 
  - No interactive elements (static display)
- **Screen Reader Support:**
  - Proper heading structure (h1 for display name)
  - Semantic HTML structure with appropriate roles

## Performance Considerations

- **Memoization:** None implemented (could benefit from React.memo)
- **Bundle Size:** Minimal - uses only standard MUI components
- **Rendering:** Re-renders when profile data changes (appropriate)
- **Caching:** RTK Query handles profile data caching automatically

## API Integration

### Endpoints Used
- `GET /api/users/profile` - fetches current user profile information
- `GET /api/community/mine` - fetches user's communities for auto-join selection
- `POST /api/invite/` - creates new instance invite with community auto-join
- `GET /api/roles/my/instance` - fetches user's instance-level permissions

### RTK Query Integration
- **Profile Query:** `useProfileQuery` from usersSlice - user profile data
- **Communities Query:** `useMyCommunitiesQuery` from communityApiSlice - community list
- **Invite Mutation:** `useCreateInviteMutation` from inviteApiSlice - creates invites
- **Permission Hook:** `useUserPermissions` - determines feature access
- **Caching:** Automatic caching and background refetch by RTK Query
- **Error Handling:** Individual error handling per query/mutation

### Profile Data Structure
```typescript
interface User {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  role: string;
  lastSeen?: string;
  // ... other user properties
}
```

## Troubleshooting

### Common Issues
1. **Profile data not loading**
   - **Cause:** Authentication token expired or invalid
   - **Solution:** Check token validity, redirect to login if needed

2. **Avatar image not displaying**
   - **Cause:** Invalid avatarUrl or CORS issues
   - **Solution:** Validate image URLs, implement error handling for failed image loads

3. **Date formatting issues**
   - **Cause:** Invalid date format from backend
   - **Solution:** Add date validation and fallback formatting

## Recent Changes

- **Sep 8, 2025 (`fc418f2`):** Added quick invite functionality with community auto-selection
- **Sep 8, 2025 (`0b121ad`):** Integrated invite system with permission-based rendering  
- **Current Features:** Profile display, quick invite creation, auto-community selection, clipboard integration
- **Future Needs:** Real-time presence updates, invite analytics integration, enhanced profile editing

## Related Documentation

- [AdminInvitePage](../Admin/AdminInvitePage.md) - Full invite management interface
- [Invite API Documentation](../../api/invite.md) - Backend invite endpoints
- [Instance Invites Feature](../../features/instance-invites.md) - Complete system overview
- [Community API](../../api/community.md) - Community data integration
- [RBAC System](../../modules/auth/roles.md) - Permission system
- [Layout](./Layout.md) - Parent layout component
- [User Profile API](../../api/users.md) - Profile data endpoints
- [UsersSlice](../../state/usersApi.md) - User state management