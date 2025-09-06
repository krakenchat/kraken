# RoleBasedComponents

> **Location:** `frontend/src/features/roles/RoleBasedComponents.tsx`  
> **Type:** Permission Control Components  
> **Feature:** roles

## Overview

The RoleBasedComponents module provides a collection of utility components for implementing Role-Based Access Control (RBAC) throughout the application. These components conditionally render UI elements based on user permissions, display user roles, and provide permission-aware interactive elements.

## Components

### RoleBasedComponent

**Props Interface:**
```typescript
interface RoleBasedComponentProps {
  communityId: string;        // Community resource ID for permission checking
  children: React.ReactNode;  // Content to conditionally render
  requiredActions: string[];  // Array of required permission actions
}
```

### CommunityRoleDisplay

**Props Interface:**
```typescript
interface CommunityRoleDisplayProps {
  communityId: string;  // Community ID to fetch roles for
}
```

### ConditionalButton

**Props Interface:**
```typescript
interface ConditionalButtonProps {
  communityId: string;       // Community resource ID for permission checking
  action: string;            // Single required permission action
  onClick: () => void;       // Click handler function
  children: React.ReactNode; // Button content
  className?: string;        // Optional CSS class
}
```

## Usage Examples

### RoleBasedComponent - Conditional Rendering
```tsx
import { RoleBasedComponent } from '@/features/roles/RoleBasedComponents';

function CommunitySettings({ communityId }) {
  return (
    <Box>
      <Typography>Basic Community Info</Typography>
      
      <RoleBasedComponent
        communityId={communityId}
        requiredActions={["UPDATE_COMMUNITY"]}
      >
        <EditCommunityButton />
      </RoleBasedComponent>

      <RoleBasedComponent
        communityId={communityId}
        requiredActions={["DELETE_COMMUNITY"]}
      >
        <DeleteCommunityButton />
      </RoleBasedComponent>
    </Box>
  );
}
```

### CommunityRoleDisplay - Show User Roles
```tsx
import { CommunityRoleDisplay } from '@/features/roles/RoleBasedComponents';

function UserProfile({ communityId }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6">Profile</Typography>
        <CommunityRoleDisplay communityId={communityId} />
      </CardContent>
    </Card>
  );
}
```

### ConditionalButton - Permission-Aware Actions
```tsx
import { ConditionalButton } from '@/features/roles/RoleBasedComponents';

function MemberActions({ communityId, memberId }) {
  const handleKickMember = () => {
    // Kick member logic
  };

  return (
    <Box>
      <ConditionalButton
        communityId={communityId}
        action="DELETE_MEMBER"
        onClick={handleKickMember}
        className="danger-button"
      >
        Kick Member
      </ConditionalButton>
    </Box>
  );
}
```

### Advanced Multi-Permission Example
```tsx
function AdvancedCommunityControls({ communityId }) {
  return (
    <Box>
      {/* Requires both CREATE_CHANNEL and UPDATE_COMMUNITY permissions */}
      <RoleBasedComponent
        communityId={communityId}
        requiredActions={["CREATE_CHANNEL", "UPDATE_COMMUNITY"]}
      >
        <AdvancedChannelManager />
      </RoleBasedComponent>

      {/* Single permission check */}
      <RoleBasedComponent
        communityId={communityId}
        requiredActions={["VIEW_AUDIT_LOG"]}
      >
        <AuditLogViewer />
      </RoleBasedComponent>
    </Box>
  );
}
```

## Styling & Theming

- **Material-UI Components Used:** None directly (utility components)
- **Custom Styling:** ConditionalButton accepts className prop for styling
- **Theme Integration:** Child components handle their own styling

```tsx
// ConditionalButton styling example
<ConditionalButton
  communityId={communityId}
  action="DELETE_MEMBER"
  onClick={handleDelete}
  className="btn-danger" // Custom CSS class
>
  Delete Member
</ConditionalButton>
```

## State Management

- **Local State:** None in utility components
- **Permission Hooks Integration:**
  - `useUserPermissions` - bulk permission checking
  - `useMyRolesForCommunity` - fetches user roles
  - `useCanPerformAction` - single permission check
- **Loading States:** Components handle loading states from permission hooks

## Dependencies

### Internal Dependencies
- `@/features/roles/useUserPermissions` - all permission checking hooks

### External Dependencies
- `react` - component framework
- No direct MUI dependencies (utility components)

## Related Components

- **Parent Components:** Any component needing permission-based rendering
- **Permission Hooks:** useUserPermissions, useMyRolesForCommunity, useCanPerformAction
- **Usage Examples:** MemberManagement, CommunitySettings, ChannelManagement

## Common Patterns

### Pattern 1: Conditional Feature Access
```tsx
// Only show advanced features to users with proper permissions
<RoleBasedComponent
  communityId={communityId}
  requiredActions={["MANAGE_CHANNELS", "MANAGE_ROLES"]}
>
  <AdvancedAdminPanel />
</RoleBasedComponent>
```

### Pattern 2: Permission-Based UI States
```tsx
// Different UI based on what user can do
function ChannelListItem({ channel, communityId }) {
  return (
    <Box>
      <Typography>{channel.name}</Typography>
      
      <ConditionalButton
        communityId={communityId}
        action="UPDATE_CHANNEL"
        onClick={() => editChannel(channel.id)}
      >
        Edit
      </ConditionalButton>

      <ConditionalButton
        communityId={communityId}
        action="DELETE_CHANNEL"
        onClick={() => deleteChannel(channel.id)}
      >
        Delete
      </ConditionalButton>
    </Box>
  );
}
```

### Pattern 3: Loading State Handling
```tsx
// RoleBasedComponent shows loading during permission check
<RoleBasedComponent
  communityId={communityId}
  requiredActions={["CREATE_MESSAGE"]}
>
  <MessageInput />
</RoleBasedComponent>
// Shows "Loading permissions..." while checking
```

### Pattern 4: Role Display with Error Handling
```tsx
function UserRoleCard({ communityId }) {
  return (
    <Card>
      <CardContent>
        <CommunityRoleDisplay communityId={communityId} />
        {/* Handles loading, error, and empty states automatically */}
      </CardContent>
    </Card>
  );
}
```

## Testing

- **Test Location:** Not currently implemented
- **Key Test Cases:**
  - RoleBasedComponent shows children when permissions granted
  - RoleBasedComponent hides children when permissions denied
  - ConditionalButton renders when permission exists
  - ConditionalButton doesn't render without permission
  - CommunityRoleDisplay shows roles correctly
  - Loading states handled properly

```tsx
// Example test patterns
test('RoleBasedComponent should render children with permissions', () => {
  // Mock useUserPermissions to return hasPermissions: true
  // Render RoleBasedComponent with test children
  // Assert children are rendered
});

test('ConditionalButton should not render without permission', () => {
  // Mock useCanPerformAction to return false
  // Render ConditionalButton
  // Assert button is not in DOM
});
```

## Accessibility

- **ARIA Labels:** Handled by child components
- **Keyboard Navigation:** ConditionalButton maintains standard button accessibility
- **Screen Reader Support:** Loading states provide text for screen readers

## Performance Considerations

- **Permission Caching:** useUserPermissions hooks cache permission results
- **Conditional Rendering:** Components completely omitted from DOM when no permissions
- **Bundle Size:** Minimal - primarily logic with little UI
- **Re-rendering:** Components re-render when permissions change (appropriate)

## RBAC Integration

### Permission Actions
Common actions used with these components:
- `CREATE_CHANNEL`, `UPDATE_CHANNEL`, `DELETE_CHANNEL`
- `CREATE_MESSAGE`, `DELETE_MESSAGE`, `UPDATE_MESSAGE`
- `CREATE_MEMBER`, `DELETE_MEMBER`, `UPDATE_MEMBER`
- `UPDATE_COMMUNITY`, `DELETE_COMMUNITY`
- `MANAGE_ROLES`, `VIEW_AUDIT_LOG`

### Resource Types
- `COMMUNITY` - community-scoped permissions
- `CHANNEL` - channel-scoped permissions (future)
- `INSTANCE` - instance-scoped permissions (future)

### Permission Checking Logic
- `RoleBasedComponent` - requires ALL specified actions
- `ConditionalButton` - requires single specified action
- Loading states shown during permission resolution

## Component Behavior

### RoleBasedComponent
- Returns `null` if user lacks required permissions
- Shows loading message during permission check
- Renders children when all permissions granted

### CommunityRoleDisplay
- Shows loading state during role fetch
- Displays error message if role fetch fails
- Lists all user roles with their specific permissions
- Shows "No roles assigned" for users without roles

### ConditionalButton
- Returns `null` if user lacks required permission
- Renders standard button element when permission granted
- Maintains all button functionality and styling

## Troubleshooting

### Common Issues
1. **Components not showing despite having permissions**
   - **Cause:** Permission hooks not returning correct values
   - **Solution:** Check useUserPermissions implementation and API responses

2. **Loading states persisting**
   - **Cause:** Permission API calls failing or not completing
   - **Solution:** Verify API endpoints and error handling

3. **ConditionalButton not responding to clicks**
   - **Cause:** onClick handler not properly passed
   - **Solution:** Ensure onClick prop is provided and function is valid

## Recent Changes

- **Current:** Basic RBAC utility components with community-scoped permissions
- **Needs:** Instance and channel-scoped permissions, better error states

## Related Documentation

- [useUserPermissions Hook](../../hooks/useUserPermissions.md)
- [RBAC System](../../features/auth-rbac.md)
- [Roles API](../../api/roles.md)
- [Permission Management](../community/RoleManagement.md)