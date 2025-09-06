# RegisterPage

> **Location:** `frontend/src/pages/RegisterPage.tsx`  
> **Type:** Page Component  
> **Feature:** auth

## Overview

The RegisterPage component provides user registration functionality for the Kraken application. It renders a registration form with fields for username, email, password, and invitation code. Upon successful registration, it automatically logs the user in and redirects them to the home page.

## Props Interface

```typescript
// RegisterPage takes no props - it's a standalone page component
interface RegisterPageProps {}
```

## Usage Examples

### Basic Usage
```tsx
import RegisterPage from '@/pages/RegisterPage';

// Used in React Router
<Route path="/register" element={<RegisterPage />} />
```

### Route Integration
```tsx
// App.tsx or router configuration
import { Routes, Route } from 'react-router-dom';
import RegisterPage from './pages/RegisterPage';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/register" element={<RegisterPage />} />
      {/* other routes */}
    </Routes>
  );
}
```

## Styling & Theming

- **Material-UI Components Used:**
  - `Box` (layout containers)
  - `Button` (submit button)
  - `TextField` (form inputs)
  - `Typography` (headings and text)
  - `Alert` (error messages)
  - `CircularProgress` (loading spinner)
- **Custom Styles:** MUI styled components with custom styling
- **Theme Variables:** Uses MUI box shadow and border radius tokens

```tsx
// Key styling patterns using styled components
const FormContainer = styled(Box)({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px",
});

const FormBox = styled(Box)({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "32px",
  borderRadius: "8px",
  boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)",
  width: "100%",
  maxWidth: "400px",
});
```

## State Management

- **Local State:**
  - `username` (string) - controlled input for username field
  - `email` (string) - controlled input for email field  
  - `password` (string) - controlled input for password field
  - `code` (string) - controlled input for invitation code field
- **Redux Integration:**
  - `useLazyRegisterQuery` from `features/users/usersSlice`
  - `useLazyLoginQuery` from `features/auth/authSlice`
  - Provides registration and login functions with loading/error states
- **WebSocket Events:** None - this is a pre-authentication component

## Dependencies

### Internal Dependencies
- `@/features/users/usersSlice` - provides user registration mutation
- `@/features/auth/authSlice` - provides login mutation for auto-login
- `react-router-dom` - navigation after successful registration

### External Dependencies
- `@mui/material` - UI components and styling
- `@mui/system/styled` - styled component creation
- `react` (useState) - local form state management

## Related Components

- **Parent Components:** App router, route configuration
- **Child Components:** None (leaf component)
- **Similar Components:** LoginPage (similar form structure)

## Common Patterns

### Pattern 1: Dual API Calls (Register + Auto-login)
```tsx
const [register, { isLoading, error }] = useLazyRegisterQuery();
const [login, { isLoading: isLoginLoading }] = useLazyLoginQuery();

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  try {
    await register({ username, email, password, code }).unwrap();
    await login({ username, password }).unwrap();
    navigate("/");
  } catch (err) {
    console.error("Registration failed:", err);
  }
};
```

### Pattern 2: Styled Components for Layout
```tsx
const FormContainer = styled(Box)({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px",
});
```

### Pattern 3: Combined Loading States
```tsx
<Button disabled={isLoading}>
  {isLoading || isLoginLoading ? (
    <CircularProgress size={24} color="inherit" />
  ) : (
    "Register"
  )}
</Button>
```

## Testing

- **Test Location:** Not currently implemented
- **Key Test Cases:**
  - Form validation (required fields, email format)
  - Successful registration and auto-login flow
  - Error handling for invalid registration data
  - Loading state display during registration and login
  - Navigation after successful registration

```tsx
// Example test pattern
test('should register user and auto-login successfully', async () => {
  // Mock successful register and login responses
  // Fill all form fields
  // Submit form
  // Assert both API calls were made
  // Assert navigation occurred
});
```

## Accessibility

- **ARIA Labels:**
  - `aria-labelledby="register-title"` on form element
  - `aria-label="Go to login page"` on login link
- **Keyboard Navigation:** Standard form navigation (Tab order)
- **Screen Reader Support:**
  - Proper heading structure with h1
  - Role="alert" on error messages
  - Required attributes on all form fields
  - Proper input types (email, password)

## Performance Considerations

- **Memoization:** None implemented (stateful form component)
- **Bundle Size:** Uses styled components which may increase bundle size
- **Rendering:** Simple controlled inputs, minimal re-renders

## API Integration

### Endpoints Used
- `POST /api/users/` - creates new user account
- `POST /api/auth/login` - automatically logs in after registration

### RTK Query Integration
- **Registration Mutation:** `useLazyRegisterQuery` from usersApi slice
- **Login Mutation:** `useLazyLoginQuery` from authApi slice  
- **Error Handling:** Displays generic error message for registration failures

## Troubleshooting

### Common Issues
1. **Registration fails with "code required" error**
   - **Cause:** Instance requires invitation codes for registration
   - **Solution:** User needs valid invitation code from instance admin

2. **Registration succeeds but auto-login fails**
   - **Cause:** Timing issue or auth service disconnect between operations
   - **Solution:** Implement separate error handling for login step

3. **Form submission doesn't work**
   - **Cause:** Missing form element or incorrect event handler
   - **Solution:** Ensure FormBox uses `as="form"` prop and onSubmit handler

## Recent Changes

- **Current:** Basic registration with required invitation code
- **Needs:** Form validation, password strength requirements, email verification

## Related Documentation

- [LoginPage](./LoginPage.md)
- [UsersSlice](../../features/users.md)
- [AuthSlice](../../features/auth.md)
- [User Registration API](../../api/users.md)