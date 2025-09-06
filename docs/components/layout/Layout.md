# Layout

> **Location:** `frontend/src/Layout.tsx`  
> **Type:** Layout Container Component  
> **Feature:** layout

## Overview

The Layout component provides the main application shell for authenticated users. It renders a fixed app bar with navigation, a collapsible sidebar for community navigation, the main content area using React Router's Outlet, and a persistent voice bottom bar. This component manages the overall layout structure and user interface chrome.

## Props Interface

```typescript
// Layout takes no props - receives data from React Router context
interface LayoutProps {}
```

## Usage Examples

### Basic Usage (React Router)
```tsx
// App.tsx route configuration
<Route path="/" element={<Layout />}>
  <Route index element={<HomePage />} />
  <Route path="community/:communityId" element={<CommunityPage />} />
  {/* child routes render in Layout's Outlet */}
</Route>
```

### Standalone Usage (not typical)
```tsx
import Layout from '@/Layout';

function AuthenticatedApp() {
  return <Layout />;
  // Child components render via <Outlet />
}
```

## Styling & Theming

- **Material-UI Components Used:**
  - `Box` (layout containers)
  - `AppBar` (top navigation bar)
  - `Toolbar` (app bar content container)
  - `Typography` (app title)
  - `IconButton` (menu toggle button)
- **Material-UI Icons:** `MenuIcon` (hamburger menu)
- **Layout Constants:**
  - `APPBAR_HEIGHT = 64` (fixed app bar height)
  - `SIDEBAR_WIDTH = 80` (sidebar width when collapsed)
- **Custom Styles:** Inline sx props and style objects for positioning

```tsx
// Key layout styling
<Box
  sx={{
    position: "absolute",
    top: APPBAR_HEIGHT,
    left: SIDEBAR_WIDTH, 
    right: 0,
    bottom: 0,
    overflow: "auto",
  }}
>
  <Outlet />
</Box>
```

## State Management

- **Local State:**
  - `isMenuExpanded` (boolean) - controls sidebar expansion
  - `anchorElUser` (HTMLElement | null) - user menu anchor element
- **Redux Integration:**
  - `useProfileQuery` from usersSlice - fetches current user data
  - `useLazyLogoutQuery` from authSlice - handles logout functionality
- **WebSocket Events:** None directly (child components handle WebSocket)

## Dependencies

### Internal Dependencies
- `@/features/users/usersSlice` - user profile data
- `@/features/auth/authSlice` - logout functionality
- `@/components/ThemeToggle/ThemeToggle` - theme switching
- `@/components/CommunityList/CommunityToggle` - sidebar navigation
- `@/components/NavBar/NavigationLinks` - top navigation
- `@/components/NavBar/ProfileIcon` - user profile menu
- `@/components/Voice/VoiceBottomBar` - persistent voice controls
- `@/types/auth.type` - User interface

### External Dependencies
- `@mui/material` - UI components
- `@mui/icons-material/Menu` - menu icon
- `react-router-dom` (Outlet) - renders child routes

## Related Components

- **Parent Components:** App (via React Router)
- **Child Components:** 
  - All page components (via Outlet)
  - ThemeToggle, CommunityToggle, NavigationLinks, ProfileIcon, VoiceBottomBar
- **Layout Components:** Works with CommunityToggle for sidebar functionality

## Common Patterns

### Pattern 1: User Profile Integration
```tsx
const { data: userData, isLoading, isError } = useProfileQuery(undefined);

// Transform userData for ProfileIcon component
const profileUserData = userData
  ? {
      displayName: userData.displayName ?? undefined,
      avatarUrl: userData.avatarUrl ?? undefined,
    }
  : undefined;
```

### Pattern 2: Logout Handling
```tsx
const [logout, { isLoading: logoutLoading }] = useLazyLogoutQuery();

const handleLogout = async () => {
  await logout(null, false).unwrap();
  localStorage.removeItem("accessToken");
  window.location.href = "/login";
};
```

### Pattern 3: Responsive Layout Structure
```tsx
<AppBar position="fixed">
  {/* Top navigation */}
</AppBar>
<CommunityToggle 
  isExpanded={isMenuExpanded}
  appBarHeight={APPBAR_HEIGHT}
/>
<Box sx={{ position: "absolute", top: APPBAR_HEIGHT, left: SIDEBAR_WIDTH }}>
  <Outlet />
</Box>
<VoiceBottomBar />
```

### Pattern 4: Menu State Management
```tsx
const [anchorElUser, setAnchorElUser] = React.useState<null | HTMLElement>(null);

const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
  setAnchorElUser(event.currentTarget);
};

const handleCloseUserMenu = () => {
  setAnchorElUser(null);
};
```

## Testing

- **Test Location:** Not currently implemented
- **Key Test Cases:**
  - Profile data loading and display
  - Menu toggle functionality
  - Logout flow
  - Child route rendering via Outlet
  - Layout responsiveness

```tsx
// Example test pattern
test('should toggle sidebar when menu button clicked', () => {
  // Render Layout
  // Click menu button
  // Assert sidebar expansion state changed
});
```

## Accessibility

- **ARIA Labels:**
  - `aria-label="menu"` on hamburger menu button
- **Keyboard Navigation:** 
  - Standard button navigation for menu toggle
  - Focus management handled by child components
- **Screen Reader Support:**
  - Semantic structure with proper AppBar and navigation elements

## Performance Considerations

- **Memoization:** None implemented (could benefit from memo for static sections)
- **Bundle Size:** Imports multiple child components, minimal impact
- **Rendering:** Profile query triggers re-renders when user data changes
- **Layout Shifts:** Fixed positioning prevents content jumping

## API Integration

### Endpoints Used
- `GET /api/users/profile` - fetches current user profile data
- `POST /api/auth/logout` - logs out current user

### RTK Query Integration
- **Profile Query:** `useProfileQuery` - automatic caching and background updates
- **Logout Mutation:** `useLazyLogoutQuery` - manual logout trigger

## Layout Structure

### App Bar (64px fixed height)
- Left: Hamburger menu + App title
- Right: Navigation links + Theme toggle + Profile menu

### Sidebar (80px width when collapsed)
- Community navigation (CommunityToggle component)
- Expands/collapses based on menu state

### Main Content Area
- Positioned absolutely to fill remaining space
- Renders child routes via React Router Outlet
- Scrollable container for page content

### Voice Bar (Bottom)
- Persistent voice/video controls
- Overlays main content when active

## Troubleshooting

### Common Issues
1. **Profile data not loading**
   - **Cause:** Invalid authentication token or API unavailable
   - **Solution:** Check token validity, ensure backend is running

2. **Sidebar not toggling**
   - **Cause:** State update not triggering re-render
   - **Solution:** Verify useState and onClick handler connection

3. **Child routes not rendering**
   - **Cause:** Missing Outlet or incorrect router configuration
   - **Solution:** Ensure Layout is properly nested in route structure

4. **Layout overlapping issues**
   - **Cause:** CSS positioning conflicts or incorrect height calculations
   - **Solution:** Verify APPBAR_HEIGHT and SIDEBAR_WIDTH constants

## Recent Changes

- **Current:** Fixed header with collapsible sidebar and voice integration
- **Needs:** Responsive mobile layout, better error handling for profile loading

## Related Documentation

- [App](./App.md)
- [HomePage](./HomePage.md)
- [CommunityToggle](../community/CommunityToggle.md)
- [NavigationLinks](../navigation/NavigationLinks.md)
- [ProfileIcon](../navigation/ProfileIcon.md)
- [VoiceBottomBar](../voice/VoiceBottomBar.md)