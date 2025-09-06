# LoginPage

> **Location:** `frontend/src/pages/LoginPage.tsx`  
> **Type:** Page Component  
> **Feature:** auth

## Overview

The LoginPage component provides a user authentication interface for logging into the Kraken application. It renders a centered login form with username/password fields, handles form submission through RTK Query, manages loading states, and provides error feedback to users.

## Props Interface

```typescript
// LoginPage takes no props - it's a standalone page component
interface LoginPageProps {}
```

## Usage Examples

### Basic Usage
```tsx
import LoginPage from '@/pages/LoginPage';

// Used in React Router
<Route path="/login" element={<LoginPage />} />
```

### Route Integration
```tsx
// App.tsx or router configuration
import { Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* other routes */}
    </Routes>
  );
}
```

## Styling & Theming

- **Material-UI Components Used:** 
  - `Box` (layout containers)
  - `Button` (submit button)
  - `TextField` (username/password inputs)
  - `Typography` (headings and text)
  - `CircularProgress` (loading spinner)
  - `Alert` (error messages)
- **Material-UI Icons:** `LockOutlined` (decorative login icon)
- **Custom Styles:** Inline MUI `sx` props for layout and spacing
- **Theme Variables:** Uses MUI theme colors (`#1976d2` for icon, theme-based text colors)

```tsx
// Key styling patterns
<Box
  sx={{
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  }}
>
  <Box
    component="form"
    sx={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center", 
      padding: 4,
      borderRadius: 2,
      boxShadow: 3,
      maxWidth: 400,
    }}
  />
</Box>
```

## State Management

- **Local State:** 
  - `username` (string) - controlled input for username field
  - `password` (string) - controlled input for password field
- **Redux Integration:** 
  - `useLazyLoginQuery` from `features/auth/authSlice`
  - Provides `login` function, `isLoading`, and `error` states
- **WebSocket Events:** None - this is a pre-authentication component

## Dependencies

### Internal Dependencies
- `@/features/auth/authSlice` - provides login mutation via RTK Query
- `@/utils/storage` (via localStorage) - stores JWT access token after successful login
- `react-router-dom` - navigation after successful authentication

### External Dependencies
- `@mui/material` - UI components (Box, Button, TextField, Typography, CircularProgress, Alert)
- `@mui/icons-material/LockOutlined` - decorative login icon
- `react` (useState) - local form state management

## Related Components

- **Parent Components:** App router, route configuration
- **Child Components:** None (leaf component)
- **Similar Components:** RegisterPage (similar form structure)

## Common Patterns

### Pattern 1: Form Submission with RTK Query
```tsx
const [login, { isLoading, error }] = useLazyLoginQuery();

const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  try {
    const accessToken = await login({ username, password }).unwrap();
    localStorage.setItem('accessToken', JSON.stringify(accessToken));
    navigate("/");
  } catch (err) {
    console.error("Login failed:", err);
  }
};
```

### Pattern 2: Conditional Loading State
```tsx
<Button
  type="submit"
  disabled={isLoading}
>
  {isLoading ? <CircularProgress size={24} color="inherit" /> : "Login"}
</Button>
```

### Pattern 3: Error Display
```tsx
{error && (
  <Alert severity="error" role="alert">
    {"Login failed. Please try again."}
  </Alert>
)}
```

## Testing

- **Test Location:** Not currently implemented
- **Key Test Cases:** 
  - Form validation (required fields)
  - Successful login flow
  - Error handling for invalid credentials
  - Loading state display
  - Navigation after successful login

```tsx
// Example test pattern
test('should navigate to home after successful login', async () => {
  // Mock successful login response
  // Fill form fields
  // Submit form
  // Assert navigation occurred
});
```

## Accessibility

- **ARIA Labels:** 
  - `aria-labelledby="login-title"` on form element
  - `aria-label="Register for an account"` on register link
  - `aria-hidden="true"` on decorative lock icon
- **Keyboard Navigation:** Standard form navigation (Tab order)
- **Screen Reader Support:** 
  - Proper heading structure with h1
  - Role="alert" on error messages
  - Required attributes on form fields

## Performance Considerations

- **Memoization:** None implemented (stateful form component)
- **Bundle Size:** Uses tree-shakeable MUI imports
- **Rendering:** Simple controlled inputs, minimal re-renders

## API Integration

### Endpoints Used
- `POST /api/auth/login` - authenticates user credentials

### RTK Query Integration
- **Mutation:** `useLazyLoginQuery` from authApi slice
- **Transform Response:** Extracts `accessToken` from response object
- **Error Handling:** Displays generic error message for all login failures

## Troubleshooting

### Common Issues
1. **Login fails with valid credentials**
   - **Cause:** Backend authentication service may be down or misconfigured
   - **Solution:** Check backend logs, verify database connectivity

2. **Token not persisting after login**
   - **Cause:** localStorage may be disabled or quota exceeded
   - **Solution:** Implement fallback token storage or session management

3. **Navigation doesn't occur after login**
   - **Cause:** Router context not available or navigate function failing
   - **Solution:** Ensure component is wrapped in Router provider

## Recent Changes

- **Current:** Basic login implementation with JWT token storage
- **Needs:** Form validation, remember me functionality, password reset link

## Related Documentation

- [RegisterPage](./RegisterPage.md)
- [AuthSlice](../../features/auth.md)
- [Authentication API](../../api/auth.md)