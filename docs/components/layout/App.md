# App

> **Location:** `frontend/src/App.tsx`  
> **Type:** Root Application Component  
> **Feature:** layout

## Overview

The App component serves as the root application component that handles routing, authentication guards, onboarding flow, and global theme configuration. It manages the application's main navigation structure and determines which components to render based on authentication status and onboarding requirements.

## Props Interface

```typescript
// App takes no props - it's the root component
interface AppProps {}
```

## Usage Examples

### Basic Usage
```tsx
// main.tsx
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <SocketProvider>
          <App />
        </SocketProvider>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
```

## Styling & Theming

- **Material-UI Components Used:**
  - `ThemeProvider` (theme configuration)
  - `CssBaseline` (CSS reset and baseline)
  - `CircularProgress` (loading indicator)
  - `Box` (loading container)
- **Theme Configuration:** 
  - Creates MUI theme with dark/light mode support
  - Uses `colorSchemes` for automatic theme switching
- **Custom Styles:** Inline sx props for loading spinner positioning

```tsx
// Theme configuration
const darkTheme = createTheme({
  colorSchemes: {
    dark: true,
    light: true,
  },
});
```

## State Management

- **Local State:** 
  - Uses React Router's `useLocation` hook for route information
  - Accesses `localStorage` for authentication token
- **Redux Integration:** 
  - `useGetOnboardingStatusQuery` from onboardingApiSlice
  - Conditionally fetches onboarding status based on current route
- **Context Providers:**
  - `RoomProvider` for LiveKit voice/video functionality

## Dependencies

### Internal Dependencies
- `@/Layout` - main authenticated application layout
- `@/pages/*` - all page components (LoginPage, HomePage, etc.)
- `@/contexts/RoomContext` - LiveKit room context provider
- `@/features/onboarding/onboardingApiSlice` - onboarding status API

### External Dependencies
- `react-router-dom` - routing (Routes, Route, useLocation)
- `@mui/material/styles` - theming (ThemeProvider, createTheme)
- `@mui/material` - UI components

## Related Components

- **Child Components:** All page components and Layout
- **Context Providers:** RoomProvider wraps authenticated routes
- **Router Integration:** Defines complete application route structure

## Common Patterns

### Pattern 1: Authentication Guard
```tsx
const token = localStorage.getItem("accessToken");
const publicRoutes = ["/login", "/register", "/join", "/onboarding"];
const isPublicRoute = publicRoutes.some(route => 
  location.pathname === route || location.pathname.startsWith(route + "/")
);

if (!token && !isPublicRoute) {
  return <LoginPage />;
}
```

### Pattern 2: Onboarding Flow Management
```tsx
const shouldCheckOnboarding = location.pathname !== "/onboarding";
const { data: onboardingStatus, isLoading } = useGetOnboardingStatusQuery(
  undefined,
  { skip: !shouldCheckOnboarding }
);

if (onboardingStatus?.needsSetup && location.pathname !== "/onboarding") {
  return <OnboardingPage />;
}
```

### Pattern 3: Nested Route Structure
```tsx
<Route path="/" element={<Layout />}>
  <Route index element={<HomePage />} />
  <Route path="community/:communityId">
    <Route index element={<CommunityPage />} />
    <Route path="edit" element={<EditCommunityPage />} />
    <Route path="channel/:channelId" element={<CommunityPage />} />
  </Route>
</Route>
```

## Testing

- **Test Location:** Not currently implemented
- **Key Test Cases:**
  - Authentication redirection for protected routes
  - Public route access without authentication
  - Onboarding flow initiation
  - Theme provider wrapping
  - Route parameter parsing

```tsx
// Example test pattern
test('should redirect unauthenticated users to login', () => {
  // Clear localStorage token
  // Navigate to protected route
  // Assert LoginPage is rendered
});
```

## Accessibility

- **ARIA Labels:** None specifically in App component
- **Keyboard Navigation:** Handled by React Router and child components
- **Screen Reader Support:** Uses semantic HTML structure through child components

## Performance Considerations

- **Route-based Code Splitting:** Not currently implemented
- **Conditional API Calls:** Skips onboarding check when on onboarding page
- **Bundle Size:** Imports all page components, could benefit from lazy loading
- **Theme Optimization:** Single theme instance created at module level

## API Integration

### Endpoints Used
- `GET /api/onboarding/status` - checks if instance needs initial setup

### RTK Query Integration
- **Query:** `useGetOnboardingStatusQuery` with conditional skipping
- **Error Handling:** No explicit error handling for onboarding check failures

## Route Configuration

### Public Routes (no authentication required)
- `/login` - LoginPage component
- `/register` - RegisterPage component  
- `/onboarding` - OnboardingPage component
- `/join/:inviteCode` - JoinInvitePage component

### Authenticated Routes (wrapped in Layout)
- `/` - HomePage component
- `/community/create` - CreateCommunityPage component
- `/community/:communityId` - CommunityPage component
- `/community/:communityId/edit` - EditCommunityPage component
- `/community/:communityId/channel/:channelId` - CommunityPage component

## Troubleshooting

### Common Issues
1. **Infinite redirect loops**
   - **Cause:** Token exists but is invalid/expired
   - **Solution:** Implement proper token validation and refresh logic

2. **Onboarding page not showing**
   - **Cause:** API call to check onboarding status failing
   - **Solution:** Add error handling for onboarding status query

3. **Routes not rendering**
   - **Cause:** Missing BrowserRouter wrapper or incorrect route paths
   - **Solution:** Ensure proper router configuration in main.tsx

## Recent Changes

- **Current:** Basic routing with authentication guards and onboarding flow
- **Needs:** Route-based code splitting, better error boundaries, token validation

## Related Documentation

- [Layout](./Layout.md)
- [Authentication Flow](../../features/auth-rbac.md)
- [Onboarding System](../onboarding/OnboardingWizard.md)
- [Router Configuration](../../architecture/frontend.md)