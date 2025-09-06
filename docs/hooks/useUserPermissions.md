# useUserPermissions

> **Location:** `frontend/src/features/roles/useUserPermissions.ts`  
> **Type:** Permission Hook  
> **Category:** auth

## Overview

A comprehensive hook for managing role-based access control (RBAC) permissions in Kraken. It provides multiple functions to check user permissions across different resource types (instance, community, channel) and includes helper hooks for specific permission scenarios. This hook is essential for implementing secure, role-based UI rendering and action authorization.

## Hook Signatures

This file exports multiple hooks for different permission use cases:

### Main Permission Hook

```typescript
function useUserPermissions({
  resourceType,
  resourceId,
  actions,
}: UseUserPermissionsOptions): UseUserPermissionsResult
```

### Convenience Hooks

```typescript
function useMyRolesForCommunity(communityId: string): QueryResult<UserRoles>
function useMyRolesForChannel(channelId: string): QueryResult<UserRoles>  
function useMyInstanceRoles(): QueryResult<UserRoles>
function useHasAnyPermission(resourceType: ResourceType, resourceId: string | undefined, actions: string[]): boolean
function useCanPerformAction(resourceType: ResourceType, resourceId: string | undefined, action: string): boolean
```

## Parameters and Types

### Main Hook Parameters

```typescript
interface UseUserPermissionsOptions {
  resourceType: ResourceType;      // 'INSTANCE' | 'COMMUNITY' | 'CHANNEL'
  resourceId?: string;             // Required for COMMUNITY and CHANNEL, unused for INSTANCE
  actions: string[];               // Array of required permission actions
}

type ResourceType = 'INSTANCE' | 'COMMUNITY' | 'CHANNEL';
```

### Return Types

```typescript
interface UseUserPermissionsResult {
  hasPermissions: boolean;         // True if user has ALL required actions
  isLoading: boolean;              // Loading state from RTK Query
  roles: UserRoles | undefined;    // User's roles for the resource
}

interface UserRoles {
  roles: Role[];                   // Array of user's roles for the resource
}

interface Role {
  id: string;
  name: string;
  actions: string[];               // Permissions granted by this role
  resourceType: ResourceType;
  resourceId?: string;
}
```

## Usage Examples

### Basic Permission Checking

```tsx
import { useUserPermissions } from '@/features/roles/useUserPermissions';

function AdminPanel({ communityId }: { communityId: string }) {
  const {
    hasPermissions,
    isLoading,
    roles
  } = useUserPermissions({
    resourceType: 'COMMUNITY',
    resourceId: communityId,
    actions: ['MANAGE_COMMUNITY', 'DELETE_MESSAGES']
  });

  if (isLoading) {
    return <div>Checking permissions...</div>;
  }

  if (!hasPermissions) {
    return <div>Access denied. Insufficient permissions.</div>;
  }

  return (
    <div className="admin-panel">
      <h3>Community Administration</h3>
      <p>You have {roles?.roles.length} administrative roles</p>
      
      <div className="admin-actions">
        <button>Manage Community Settings</button>
        <button>Moderate Messages</button>
        <button>Manage Members</button>
      </div>
    </div>
  );
}
```

### Channel-Specific Permissions

```tsx
import { useUserPermissions } from '@/features/roles/useUserPermissions';

function ChannelControls({ channelId }: { channelId: string }) {
  const {
    hasPermissions: canModerate,
    isLoading: moderateLoading
  } = useUserPermissions({
    resourceType: 'CHANNEL',
    resourceId: channelId,
    actions: ['DELETE_MESSAGES', 'BAN_MEMBERS']
  });

  const {
    hasPermissions: canManage,
    isLoading: manageLoading
  } = useUserPermissions({
    resourceType: 'CHANNEL', 
    resourceId: channelId,
    actions: ['MANAGE_CHANNELS']
  });

  if (moderateLoading || manageLoading) {
    return <div>Loading permissions...</div>;
  }

  return (
    <div className="channel-controls">
      {canModerate && (
        <div className="moderation-controls">
          <button>Delete Messages</button>
          <button>Ban Member</button>
          <button>Timeout Member</button>
        </div>
      )}
      
      {canManage && (
        <div className="management-controls">
          <button>Edit Channel</button>
          <button>Manage Permissions</button>
          <button>Delete Channel</button>
        </div>
      )}
      
      {!canModerate && !canManage && (
        <div>No management permissions for this channel</div>
      )}
    </div>
  );
}
```

### Instance-Level Permissions

```tsx
import { useUserPermissions } from '@/features/roles/useUserPermissions';

function InstanceSettings() {
  const {
    hasPermissions: isInstanceAdmin,
    isLoading,
    roles
  } = useUserPermissions({
    resourceType: 'INSTANCE',
    actions: ['MANAGE_INSTANCE', 'CREATE_INVITES']
  });

  const adminRole = roles?.roles.find(role => role.name === 'Instance Admin');

  if (isLoading) {
    return <div>Checking instance permissions...</div>;
  }

  return (
    <div className="instance-settings">
      <h2>Instance Settings</h2>
      
      {isInstanceAdmin ? (
        <div>
          <p>Welcome, Instance Administrator!</p>
          <p>Role: {adminRole?.name}</p>
          <p>Permissions: {adminRole?.actions.length} actions</p>
          
          <div className="admin-sections">
            <button>Server Configuration</button>
            <button>User Management</button>
            <button>Invite Management</button>
            <button>System Maintenance</button>
          </div>
        </div>
      ) : (
        <div>
          <p>You don't have instance administration permissions.</p>
          <p>Contact an administrator for access.</p>
        </div>
      )}
    </div>
  );
}
```

### Using Convenience Hooks

```tsx
import {
  useCanPerformAction,
  useHasAnyPermission,
  useMyRolesForCommunity
} from '@/features/roles/useUserPermissions';

function CommunityHeader({ communityId }: { communityId: string }) {
  // Simple single action check
  const canEditCommunity = useCanPerformAction('COMMUNITY', communityId, 'EDIT_COMMUNITY');
  
  // Multiple action check (user needs ANY of these)
  const hasModeratorPermissions = useHasAnyPermission(
    'COMMUNITY',
    communityId,
    ['DELETE_MESSAGES', 'MANAGE_MEMBERS', 'MANAGE_CHANNELS']
  );

  // Get full role data
  const { data: roles, isLoading } = useMyRolesForCommunity(communityId);

  const userRoleNames = roles?.roles.map(role => role.name) || [];

  return (
    <div className="community-header">
      <div className="community-info">
        <h1>Community Name</h1>
        {isLoading ? (
          <span>Loading roles...</span>
        ) : (
          <span>Your roles: {userRoleNames.join(', ') || 'Member'}</span>
        )}
      </div>

      <div className="community-actions">
        {canEditCommunity && (
          <button>Edit Community</button>
        )}
        
        {hasModeratorPermissions && (
          <button>Moderation Tools</button>
        )}
      </div>
    </div>
  );
}
```

### Role-Based Component Rendering

```tsx
import { useUserPermissions } from '@/features/roles/useUserPermissions';

function MessageComponent({ message, channelId }) {
  const {
    hasPermissions: canDeleteAny
  } = useUserPermissions({
    resourceType: 'CHANNEL',
    resourceId: channelId,
    actions: ['DELETE_MESSAGES']
  });

  const canDeleteOwn = message.authorId === currentUserId;
  const canEdit = canDeleteOwn; // Users can edit their own messages
  const canDelete = canDeleteOwn || canDeleteAny;

  return (
    <div className="message">
      <div className="message-content">
        {message.content}
      </div>
      
      <div className="message-actions">
        {canEdit && (
          <button onClick={() => editMessage(message.id)}>
            Edit
          </button>
        )}
        
        {canDelete && (
          <button onClick={() => deleteMessage(message.id)}>
            Delete
          </button>
        )}
        
        {canDeleteAny && (
          <button onClick={() => moderateMessage(message.id)}>
            Moderate
          </button>
        )}
      </div>
    </div>
  );
}
```

## Implementation Details

### Internal Logic

The main hook uses conditional RTK Query hooks to fetch appropriate role data:

```typescript
// Conditionally call the appropriate query based on resource type
const { data: communityRoles, isLoading: isCommunityLoading } =
  useGetMyRolesForCommunityQuery(resourceId!, {
    skip: resourceType !== "COMMUNITY" || !resourceId,
  });

const { data: channelRoles, isLoading: isChannelLoading } =
  useGetMyRolesForChannelQuery(resourceId!, {
    skip: resourceType !== "CHANNEL" || !resourceId,
  });

const { data: instanceRoles, isLoading: isInstanceLoading } =
  useGetMyInstanceRolesQuery(undefined, {
    skip: resourceType !== "INSTANCE",
  });
```

### Permission Calculation

```typescript
const hasPermissions = useMemo(() => {
  if (!roles || isLoading) return false;

  // Get all actions from all roles
  const allActions = roles.roles.flatMap((role) => role.actions);

  // Check if user has all required actions
  return actions.every((action) => allActions.includes(action));
}, [roles, actions, isLoading]);
```

### Dependencies

#### Internal Hooks
- `useMemo` - Memoizes permission calculations and role selection
- RTK Query hooks - Fetches role data from backend

#### External Hooks  
- `useGetMyRolesForCommunityQuery` - Fetches community roles
- `useGetMyRolesForChannelQuery` - Fetches channel roles
- `useGetMyInstanceRolesQuery` - Fetches instance roles

#### Types and Enums
- `ResourceType` - Enum for resource types
- `UserRoles` - Interface for role data structure

## RTK Query Integration

### API Endpoints Used

```typescript
// Community roles
useGetMyRolesForCommunityQuery(communityId) // GET /roles/my-roles/community/:id

// Channel roles
useGetMyRolesForChannelQuery(channelId) // GET /roles/my-roles/channel/:id

// Instance roles
useGetMyInstanceRolesQuery() // GET /roles/my-roles/instance
```

### Caching and Optimization

- **Automatic Caching:** RTK Query automatically caches role data
- **Skip Logic:** Queries are skipped when resource type doesn't match
- **Background Refetching:** Roles are refetched when they become stale
- **Optimistic Updates:** Role changes can update cache optimistically

## Permission System Architecture

### Resource Hierarchy

```
Instance (Top Level)
├── Community 1
│   ├── Channel 1
│   ├── Channel 2
│   └── Private Channel 1
├── Community 2
│   └── Channel 3
└── Direct Messages
```

### Permission Inheritance

- **Instance permissions** apply globally across all communities
- **Community permissions** apply to that community and its channels
- **Channel permissions** apply only to that specific channel
- **No automatic inheritance** - permissions must be explicitly granted at each level

### Common Permission Actions

```typescript
// Instance actions
const INSTANCE_ACTIONS = [
  'MANAGE_INSTANCE',
  'CREATE_INVITES',
  'MANAGE_GLOBAL_USERS',
  'VIEW_AUDIT_LOGS'
];

// Community actions
const COMMUNITY_ACTIONS = [
  'MANAGE_COMMUNITY',
  'EDIT_COMMUNITY',
  'DELETE_COMMUNITY',
  'MANAGE_MEMBERS',
  'MANAGE_CHANNELS',
  'CREATE_CHANNELS',
  'DELETE_MESSAGES',
  'BAN_MEMBERS'
];

// Channel actions  
const CHANNEL_ACTIONS = [
  'VIEW_CHANNEL',
  'SEND_MESSAGES',
  'DELETE_MESSAGES',
  'MANAGE_CHANNELS',
  'MANAGE_WEBHOOKS'
];
```

## Performance Considerations

### Optimization Strategies

- **Conditional Queries:** Only queries for relevant resource type are executed
- **Memoized Calculations:** Permission checks are memoized to prevent recalculation
- **Stable Hook References:** Convenience hooks return stable boolean values
- **Skip Patterns:** Queries are skipped when resourceId is undefined

### Re-render Prevention

```typescript
// Good: Stable permission check
const canDelete = useCanPerformAction('CHANNEL', channelId, 'DELETE_MESSAGES');

// Better: Use convenience hooks for simple checks
const hasModeratorAccess = useHasAnyPermission('COMMUNITY', communityId, [
  'DELETE_MESSAGES', 
  'BAN_MEMBERS'
]);
```

## Error Handling

### Loading States

```typescript
function ProtectedComponent({ resourceId }) {
  const { hasPermissions, isLoading, roles } = useUserPermissions({
    resourceType: 'COMMUNITY',
    resourceId,
    actions: ['MANAGE_COMMUNITY']
  });

  if (isLoading) {
    return <PermissionLoadingSpinner />;
  }

  if (!hasPermissions) {
    return <AccessDeniedMessage requiredActions={['MANAGE_COMMUNITY']} />;
  }

  return <AdminInterface />;
}
```

### Error Boundaries

```tsx
function withPermissionErrorBoundary(Component) {
  return function ProtectedComponent(props) {
    return (
      <ErrorBoundary 
        fallback={<div>Permission system error. Please refresh.</div>}
      >
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
```

### Graceful Degradation

```typescript
function ConditionalFeature({ channelId }) {
  const canModerate = useCanPerformAction('CHANNEL', channelId, 'DELETE_MESSAGES');
  
  // Gracefully degrade if permissions can't be determined
  return (
    <div>
      <RegularFeatures />
      {canModerate && <ModerationFeatures />}
    </div>
  );
}
```

## Testing

### Test Examples

```typescript
import { renderHook } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { useUserPermissions } from '../useUserPermissions';

describe('useUserPermissions', () => {
  const mockStore = {
    // Mock RTK Query state
  };

  const wrapper = ({ children }) => (
    <Provider store={mockStore}>
      {children}
    </Provider>
  );

  it('should return true when user has all required permissions', () => {
    // Mock API response with required roles
    const mockRoles = {
      roles: [
        {
          id: 'role1',
          name: 'Moderator',
          actions: ['DELETE_MESSAGES', 'BAN_MEMBERS'],
          resourceType: 'COMMUNITY'
        }
      ]
    };

    const { result } = renderHook(() =>
      useUserPermissions({
        resourceType: 'COMMUNITY',
        resourceId: 'community-123',
        actions: ['DELETE_MESSAGES']
      }), { wrapper });

    expect(result.current.hasPermissions).toBe(true);
  });

  it('should return false when user lacks required permissions', () => {
    const mockRoles = {
      roles: [
        {
          id: 'role1', 
          name: 'Member',
          actions: ['SEND_MESSAGES'],
          resourceType: 'COMMUNITY'
        }
      ]
    };

    const { result } = renderHook(() =>
      useUserPermissions({
        resourceType: 'COMMUNITY',
        resourceId: 'community-123',
        actions: ['DELETE_MESSAGES']  // Not in user's actions
      }), { wrapper });

    expect(result.current.hasPermissions).toBe(false);
  });
});
```

### Testing Permission Components

```typescript
import { render, screen } from '@testing-library/react';
import { useUserPermissions } from '../useUserPermissions';

// Mock the hook
jest.mock('../useUserPermissions');
const mockUseUserPermissions = useUserPermissions as jest.MockedFunction<typeof useUserPermissions>;

describe('AdminPanel', () => {
  it('should show admin controls when user has permissions', () => {
    mockUseUserPermissions.mockReturnValue({
      hasPermissions: true,
      isLoading: false,
      roles: { roles: [{ id: '1', name: 'Admin', actions: ['MANAGE_COMMUNITY'] }] }
    });

    render(<AdminPanel communityId="community-123" />);

    expect(screen.getByText('Community Administration')).toBeInTheDocument();
    expect(screen.getByText('Manage Community Settings')).toBeInTheDocument();
  });

  it('should show access denied when user lacks permissions', () => {
    mockUseUserPermissions.mockReturnValue({
      hasPermissions: false,
      isLoading: false,
      roles: undefined
    });

    render(<AdminPanel communityId="community-123" />);

    expect(screen.getByText('Access denied. Insufficient permissions.')).toBeInTheDocument();
  });
});
```

## Common Patterns

### Pattern 1: Multi-Level Permission Checks

```tsx
function NestedPermissionComponent() {
  // Check instance-level permissions
  const { hasPermissions: isInstanceAdmin } = useUserPermissions({
    resourceType: 'INSTANCE',
    actions: ['MANAGE_INSTANCE']
  });

  // Check community-level permissions  
  const { hasPermissions: isCommunityAdmin } = useUserPermissions({
    resourceType: 'COMMUNITY',
    resourceId: communityId,
    actions: ['MANAGE_COMMUNITY']
  });

  // Check channel-level permissions
  const { hasPermissions: canManageChannel } = useUserPermissions({
    resourceType: 'CHANNEL',
    resourceId: channelId,
    actions: ['MANAGE_CHANNELS']
  });

  return (
    <div>
      {isInstanceAdmin && <InstanceControls />}
      {isCommunityAdmin && <CommunityControls />}
      {canManageChannel && <ChannelControls />}
    </div>
  );
}
```

### Pattern 2: Permission-Based Navigation

```tsx
function NavigationMenu() {
  const { hasPermissions: canAccessAdmin } = useUserPermissions({
    resourceType: 'INSTANCE',
    actions: ['MANAGE_INSTANCE']
  });

  const { hasPermissions: canModerateCommunity } = useUserPermissions({
    resourceType: 'COMMUNITY', 
    resourceId: currentCommunityId,
    actions: ['DELETE_MESSAGES', 'MANAGE_MEMBERS']
  });

  return (
    <nav>
      <NavLink to="/channels">Channels</NavLink>
      <NavLink to="/messages">Messages</NavLink>
      
      {canModerateCommunity && (
        <NavLink to="/moderation">Moderation</NavLink>
      )}
      
      {canAccessAdmin && (
        <NavLink to="/admin">Instance Admin</NavLink>
      )}
    </nav>
  );
}
```

### Pattern 3: Conditional Form Fields

```tsx
function CommunitySettingsForm() {
  const canEditBasics = useCanPerformAction('COMMUNITY', communityId, 'EDIT_COMMUNITY');
  const canManageAdvanced = useCanPerformAction('COMMUNITY', communityId, 'MANAGE_COMMUNITY');
  const canDeleteCommunity = useCanPerformAction('COMMUNITY', communityId, 'DELETE_COMMUNITY');

  return (
    <form>
      <div>
        <label>Community Name:</label>
        <input disabled={!canEditBasics} />
      </div>
      
      <div>
        <label>Description:</label>
        <textarea disabled={!canEditBasics} />
      </div>

      {canManageAdvanced && (
        <div className="advanced-settings">
          <h3>Advanced Settings</h3>
          <label>
            <input type="checkbox" />
            Enable invites
          </label>
          <label>
            <input type="checkbox" />
            Require approval for new members
          </label>
        </div>
      )}

      {canDeleteCommunity && (
        <div className="danger-zone">
          <h3>Danger Zone</h3>
          <button type="button" className="danger">
            Delete Community
          </button>
        </div>
      )}
    </form>
  );
}
```

## Related Hooks

- **useMyRolesForCommunity** - Convenience hook for community role data
- **useMyRolesForChannel** - Convenience hook for channel role data  
- **useMyInstanceRoles** - Convenience hook for instance role data
- **useCanPerformAction** - Simple single-action permission check
- **useHasAnyPermission** - Check for any of multiple required actions

## Troubleshooting

### Common Issues

1. **Permissions not updating**
   - **Symptoms:** UI doesn't reflect permission changes after role updates
   - **Cause:** RTK Query cache not invalidated after role changes
   - **Solution:** Invalidate cache or use optimistic updates

   ```typescript
   // After role change, invalidate relevant queries
   dispatch(rolesApi.util.invalidateTags(['UserRoles']));
   ```

2. **Hook returns stale permissions**
   - **Symptoms:** Permissions reflect old state after resource changes
   - **Cause:** Hook dependencies not properly updated
   - **Solution:** Ensure resourceId is stable and correctly passed

   ```tsx
   // Good: Stable resourceId
   const canManage = useCanPerformAction('CHANNEL', channelId, 'MANAGE_CHANNELS');

   // Bad: Changing object reference
   const canManage = useCanPerformAction('CHANNEL', { id: channelId }.id, 'MANAGE_CHANNELS');
   ```

3. **Loading state never resolves**
   - **Symptoms:** isLoading remains true indefinitely
   - **Cause:** Query fails silently or invalid resourceId
   - **Solution:** Check network requests and resourceId validity

4. **TypeScript errors with permission actions**
   - **Symptoms:** TS errors when passing action strings
   - **Cause:** Actions not typed correctly or mismatched
   - **Solution:** Use proper action constants and type definitions

### Best Practices

- **Use convenience hooks** for simple permission checks to improve readability
- **Memoize permission arrays** to prevent unnecessary re-renders
- **Handle loading states** explicitly to provide good user experience
- **Fail securely** by defaulting to no permissions when in doubt
- **Use TypeScript** with proper action type definitions
- **Test permissions thoroughly** with unit tests and integration tests

## Version History

- **1.0.0:** Initial implementation with basic RBAC support
- **1.1.0:** Added convenience hooks for common use cases
- **1.2.0:** Improved TypeScript support and error handling
- **1.3.0:** Enhanced performance with better memoization

## Related Documentation

- [RBAC System Overview](../features/rbac-system.md)
- [Roles API](../api/roles.md) 
- [Permission Types](../types/permissions.md)
- [Role Management Components](../components/roles/README.md)