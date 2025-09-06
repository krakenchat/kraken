# HomePage

> **Location:** `frontend/src/pages/HomePage.tsx`  
> **Type:** Page Component  
> **Feature:** layout

## Overview

The HomePage component serves as the default landing page for authenticated users. It displays the user's profile information in a centered card format, including their avatar, display name, username, role, and last seen timestamp. This page acts as a dashboard or profile summary view.

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

## Styling & Theming

- **Material-UI Components Used:**
  - `Box` (main container)
  - `Card` & `CardContent` (profile card)
  - `Typography` (text elements)
  - `Avatar` (user avatar display)
  - `CircularProgress` (loading indicator)
  - `Alert` (error message)
- **Custom Styles:** Inline sx props for layout and spacing
- **Theme Variables:** Uses MUI theme colors and typography variants

```tsx
// Key styling patterns
<Box
  sx={{
    display: "flex",
    flexDirection: "column", 
    alignItems: "center",
    justifyContent: "center",
    height: "400px",
    padding: 2,
  }}
>
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
</Box>
```

## State Management

- **Local State:** None - purely presentational component
- **Redux Integration:** 
  - `useProfileQuery` from usersSlice
  - Automatically fetches and caches current user profile data
- **WebSocket Events:** None directly (could show real-time presence updates)

## Dependencies

### Internal Dependencies
- `@/features/users/usersSlice` - user profile API integration

### External Dependencies
- `@mui/material` - UI components (Box, Card, Typography, Avatar, CircularProgress, Alert)
- `react` - component framework

## Related Components

- **Parent Components:** Layout (via React Router Outlet)
- **Child Components:** None (leaf component)
- **Similar Components:** Profile sections in other components

## Common Patterns

### Pattern 1: API Data Loading States
```tsx
const { data, isLoading, isError } = useProfileQuery(undefined);

return (
  <>
    {isLoading && <CircularProgress />}
    {isError && <Alert severity="error">Error loading profile!</Alert>}
    {data && <ProfileCard data={data} />}
  </>
);
```

### Pattern 2: Conditional Avatar Display
```tsx
<Avatar>
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

### Pattern 3: Date Formatting
```tsx
<Typography>
  Last Seen:{" "}
  {data.lastSeen ? new Date(data.lastSeen).toLocaleString() : "N/A"}
</Typography>
```

## Testing

- **Test Location:** Not currently implemented
- **Key Test Cases:**
  - Profile data display when loaded
  - Loading spinner during data fetch
  - Error message when profile fetch fails
  - Avatar fallback when no image provided
  - Date formatting for lastSeen field

```tsx
// Example test pattern
test('should display user profile data when loaded', () => {
  // Mock successful profile query
  // Render HomePage
  // Assert profile information is displayed
});

test('should show initials when no avatar URL', () => {
  // Mock profile data without avatarUrl
  // Assert first letter of displayName is shown
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

### RTK Query Integration
- **Query:** `useProfileQuery` from usersApi slice
- **Caching:** Automatic caching and background refetch by RTK Query
- **Error Handling:** Basic error display with generic error message

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

- **Current:** Basic profile display with avatar, role, and last seen
- **Needs:** Real-time presence updates, more detailed profile information, edit profile functionality

## Related Documentation

- [Layout](./Layout.md)
- [User Profile API](../../api/users.md)
- [UsersSlice](../../features/users.md)
- [ProfileIcon](../navigation/ProfileIcon.md)