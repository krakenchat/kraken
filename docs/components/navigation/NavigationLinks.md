# NavigationLinks

> **Location:** `frontend/src/components/NavBar/NavigationLinks.tsx`  
> **Type:** Navigation Component  
> **Feature:** navigation

## Overview

The NavigationLinks component renders the primary navigation links in the application's top navigation bar. It conditionally displays different navigation options based on the user's authentication status, loading states, and provides logout functionality for authenticated users.

## Props Interface

```typescript
interface NavigationLinksProps {
  isLoading: boolean;          // Loading state for user data
  isError: boolean;            // Error state for user data
  userData: User | undefined;  // Current user data object
  handleLogout: () => void;    // Logout function handler
  logoutLoading: boolean;      // Loading state for logout operation
}
```

## Usage Examples

### Basic Usage
```tsx
import NavigationLinks from '@/components/NavBar/NavigationLinks';

function AppBar() {
  const { data: userData, isLoading, isError } = useProfileQuery();
  const [logout, { isLoading: logoutLoading }] = useLazyLogoutQuery();
  
  const handleLogout = async () => {
    await logout().unwrap();
    localStorage.removeItem("accessToken");
    window.location.href = "/login";
  };

  return (
    <NavigationLinks
      isLoading={isLoading}
      isError={isError}
      userData={userData}
      handleLogout={handleLogout}
      logoutLoading={logoutLoading}
    />
  );
}
```

### Layout Integration
```tsx
// Layout.tsx usage
<NavigationLinks
  isLoading={isLoading}
  isError={isError}
  userData={userData as User | undefined}
  handleLogout={handleLogout}
  logoutLoading={logoutLoading}
/>
```

## Styling & Theming

- **Material-UI Components Used:**
  - `Button` (logout button)
  - `Typography` (loading text)
- **Custom Styled Components:**
  - `NavLink` - styled Link component with white text and margins
- **Theme Variables:** Uses white color for AppBar contrast
- **Custom Styles:** Emotion styled components with CSS-in-JS

```tsx
// Styled component definition
const NavLink = styled(Link)`
  color: white;
  text-decoration: none;
  margin-right: 16px;
  &:last-of-type {
    margin-right: 0;
  }
`;
```

## State Management

- **Local State:** None - receives all state as props
- **Redux Integration:** None directly (parent component handles RTK Query)
- **External State:** Relies on parent component for user data and loading states

## Dependencies

### Internal Dependencies
- `@/types/auth.type` - User interface definition

### External Dependencies
- `react-router-dom` (Link) - navigation links
- `@mui/material` - UI components
- `@emotion/styled` - styled components

## Related Components

- **Parent Components:** Layout (primary usage location)
- **Child Components:** None (leaf component)
- **Related Components:** ProfileIcon (similar navigation element)

## Common Patterns

### Pattern 1: Conditional Navigation Rendering
```tsx
{isLoading ? (
  <Typography variant="body2" sx={{ color: "white" }}>
    Loading...
  </Typography>
) : isError || !userData ? (
  <>
    <NavLink to="/login">Login</NavLink>
    <NavLink to="/register">Register</NavLink>
  </>
) : (
  <Button onClick={handleLogout} disabled={logoutLoading}>
    Logout
  </Button>
)}
```

### Pattern 2: Styled Navigation Links
```tsx
const NavLink = styled(Link)`
  color: white;
  text-decoration: none;
  margin-right: 16px;
  &:last-of-type {
    margin-right: 0;
  }
`;

// Usage
<NavLink to="/">Home</NavLink>
<NavLink to="/login">Login</NavLink>
```

### Pattern 3: Loading State Button
```tsx
<Button
  onClick={handleLogout}
  disabled={logoutLoading}
  sx={{ color: "white", textTransform: "none" }}
>
  Logout
</Button>
```

## Testing

- **Test Location:** Not currently implemented
- **Key Test Cases:**
  - Shows loading message during user data fetch
  - Shows login/register links when not authenticated
  - Shows logout button when authenticated
  - Logout button disabled during logout operation
  - Home link always visible

```tsx
// Example test patterns
test('should show login/register links for unauthenticated users', () => {
  // Render with isError=true or userData=undefined
  // Assert login and register links are present
});

test('should show logout button for authenticated users', () => {
  // Render with valid userData
  // Assert logout button is present
  // Assert login/register links are not present
});

test('should disable logout button during logout', () => {
  // Render with logoutLoading=true
  // Assert logout button is disabled
});
```

## Accessibility

- **ARIA Labels:** None specifically implemented (could be improved)
- **Keyboard Navigation:** 
  - Standard Link and Button keyboard navigation
  - Tab order flows naturally left to right
- **Screen Reader Support:** 
  - Links provide navigation context
  - Button provides action context

## Performance Considerations

- **Memoization:** None implemented (could benefit from React.memo)
- **Bundle Size:** Minimal - only uses standard components
- **Rendering:** Re-renders when authentication state changes (appropriate)

## Navigation States

### Loading State
- Shows "Loading..." text while fetching user data
- No interactive navigation elements during loading

### Unauthenticated State  
- Shows "Home" link (always visible)
- Shows "Login" and "Register" links
- No logout functionality

### Authenticated State
- Shows "Home" link (always visible)
- Shows "Logout" button instead of login/register
- Logout button disabled during logout process

### Error State
- Treated same as unauthenticated (shows login/register)
- Could be improved to show error-specific messaging

## Troubleshooting

### Common Issues
1. **Links not working**
   - **Cause:** Component not wrapped in Router context
   - **Solution:** Ensure BrowserRouter wraps the application

2. **Styles not applying**
   - **Cause:** Emotion styled components not configured properly
   - **Solution:** Verify @emotion/styled is installed and configured

3. **Logout not triggering**
   - **Cause:** handleLogout function not passed correctly
   - **Solution:** Verify parent component passes valid logout handler

## Recent Changes

- **Current:** Basic navigation with authentication-based conditional rendering
- **Needs:** Better error states, loading indicators, additional navigation options

## Related Documentation

- [ProfileIcon](./ProfileIcon.md)
- [Layout](../layout/Layout.md)
- [Authentication Flow](../../features/auth-rbac.md)
- [User Management](../../api/users.md)