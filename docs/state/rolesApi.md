# Roles Redux API Slice

> **Location:** `frontend/src/features/roles/rolesApiSlice.ts`  
> **Type:** RTK Query API  
> **Domain:** Role-based access control (RBAC) system

## Overview

The Roles API slice manages role-based access control (RBAC) queries for determining user permissions across different contexts in the application. It provides endpoints for checking user roles and permissions at instance, community, and channel levels, enabling fine-grained access control throughout the Kraken application.

## API Configuration

```typescript
export const rolesApi = createApi({
  reducerPath: "rolesApi",
  baseQuery: getBaseAuthedQuery(
    fetchBaseQuery({
      baseUrl: "/api/roles",
      prepareHeaders,
    })
  ),
  tagTypes: ["UserRoles"],
  endpoints: (builder) => ({
    // Endpoints defined below
  }),
});
```

### Base Configuration
- **Reducer Path:** `rolesApi`
- **Base Query:** `getBaseAuthedQuery` (includes JWT authentication and token refresh)
- **Base URL:** `/api/roles`
- **Tag Types:** `["UserRoles"]`

## Endpoints

### Query Endpoints (Permission Checking)

#### getMyRolesForCommunity
```typescript
getMyRolesForCommunity: builder.query<UserRoles, string>({
  query: (communityId) => ({
    url: `/my/community/${communityId}`,
    method: "GET",
  }),
  providesTags: (_result, _error, communityId) => [
    { type: "UserRoles", id: `my-community-${communityId}` },
  ],
})
```

**Purpose:** Fetches the current user's roles and permissions for a specific community.

**Usage:**
```typescript
const { 
  data: userRoles, 
  error, 
  isLoading 
} = useRolesApi.useGetMyRolesForCommunityQuery(communityId, {
  skip: !communityId,
});

// Check specific permissions
const canCreateChannels = userRoles?.actions.includes('CREATE_CHANNELS');
const canManageMembers = userRoles?.actions.includes('MANAGE_MEMBERS');
```

#### getMyRolesForChannel
```typescript
getMyRolesForChannel: builder.query<UserRoles, string>({
  query: (channelId) => ({
    url: `/my/channel/${channelId}`,
    method: "GET",
  }),
  providesTags: (_result, _error, channelId) => [
    { type: "UserRoles", id: `my-channel-${channelId}` },
  ],
})
```

**Purpose:** Fetches the current user's roles and permissions for a specific channel.

**Usage:**
```typescript
const { 
  data: channelRoles, 
  error, 
  isLoading 
} = useRolesApi.useGetMyRolesForChannelQuery(channelId);

// Check channel-specific permissions
const canSendMessages = channelRoles?.actions.includes('SEND_MESSAGES');
const canManageChannel = channelRoles?.actions.includes('MANAGE_CHANNELS');
```

#### getMyInstanceRoles
```typescript
getMyInstanceRoles: builder.query<UserRoles, void>({
  query: () => ({
    url: "/my/instance",
    method: "GET",
  }),
  providesTags: [{ type: "UserRoles", id: "my-instance" }],
})
```

**Purpose:** Fetches the current user's instance-level roles and permissions.

**Usage:**
```typescript
const { 
  data: instanceRoles, 
  error, 
  isLoading 
} = useRolesApi.useGetMyInstanceRolesQuery();

// Check instance-wide permissions
const canCreateCommunities = instanceRoles?.actions.includes('CREATE_COMMUNITIES');
const isInstanceAdmin = instanceRoles?.roles.includes('INSTANCE_ADMIN');
```

#### getUserRolesForCommunity
```typescript
getUserRolesForCommunity: builder.query<
  UserRoles,
  { userId: string; communityId: string }
>({
  query: ({ userId, communityId }) => ({
    url: `/user/${userId}/community/${communityId}`,
    method: "GET",
  }),
  providesTags: (_result, _error, { userId, communityId }) => [
    { type: "UserRoles", id: `${userId}-community-${communityId}` },
  ],
})
```

**Purpose:** Fetches another user's roles and permissions for a specific community (admin functionality).

**Usage:**
```typescript
const { 
  data: userCommunityRoles, 
  error, 
  isLoading 
} = useRolesApi.useGetUserRolesForCommunityQuery({ 
  userId: targetUserId, 
  communityId 
}, {
  skip: !targetUserId || !communityId,
});
```

#### getUserRolesForChannel
```typescript
getUserRolesForChannel: builder.query<
  UserRoles,
  { userId: string; channelId: string }
>({
  query: ({ userId, channelId }) => ({
    url: `/user/${userId}/channel/${channelId}`,
    method: "GET",
  }),
  providesTags: (_result, _error, { userId, channelId }) => [
    { type: "UserRoles", id: `${userId}-channel-${channelId}` },
  ],
})
```

**Purpose:** Fetches another user's roles and permissions for a specific channel (admin functionality).

#### getUserInstanceRoles
```typescript
getUserInstanceRoles: builder.query<UserRoles, string>({
  query: (userId) => ({
    url: `/user/${userId}/instance`,
    method: "GET",
  }),
  providesTags: (_result, _error, userId) => [
    { type: "UserRoles", id: `${userId}-instance` },
  ],
})
```

**Purpose:** Fetches another user's instance-level roles and permissions (admin functionality).

## Type Definitions

### Response Types

```typescript
interface UserRoles {
  userId: string;
  instanceRoles: string[];        // Instance-level role names
  communityRoles?: string[];      // Community-specific role names
  channelRoles?: string[];        // Channel-specific role names
  actions: string[];              // Combined permissions/actions from all roles
  effectivePermissions: {
    instance: string[];           // Instance-level permissions
    community?: string[];         // Community-level permissions
    channel?: string[];           // Channel-level permissions
  };
}
```

### Common Permission Actions

```typescript
// Instance-level permissions
const INSTANCE_PERMISSIONS = [
  'CREATE_COMMUNITIES',
  'MANAGE_INSTANCE',
  'INVITE_USERS',
  'BAN_USERS',
  'VIEW_AUDIT_LOGS'
];

// Community-level permissions  
const COMMUNITY_PERMISSIONS = [
  'MANAGE_COMMUNITY',
  'MANAGE_MEMBERS',
  'CREATE_CHANNELS',
  'DELETE_CHANNELS',
  'MANAGE_ROLES',
  'CREATE_INVITES',
  'KICK_MEMBERS',
  'BAN_MEMBERS'
];

// Channel-level permissions
const CHANNEL_PERMISSIONS = [
  'VIEW_CHANNEL',
  'SEND_MESSAGES',
  'EDIT_MESSAGES',
  'DELETE_MESSAGES',
  'MANAGE_CHANNELS',
  'CONNECT_VOICE',
  'SPEAK_VOICE',
  'MUTE_MEMBERS',
  'MANAGE_MESSAGES'
];
```

## Caching Strategy

### Cache Tags

```typescript
tagTypes: ["UserRoles"]

// Tagging patterns:
// - My roles for community: { type: "UserRoles", id: `my-community-${communityId}` }
// - My roles for channel: { type: "UserRoles", id: `my-channel-${channelId}` }
// - My instance roles: { type: "UserRoles", id: "my-instance" }
// - Other user roles: { type: "UserRoles", id: `${userId}-community-${communityId}` }
```

### Cache Invalidation

Role data is typically cached for the duration of the session since role changes are infrequent. Cache invalidation occurs when:

- User roles are modified by administrators
- User joins/leaves communities
- Channel permissions are updated
- Instance roles are modified

### Long-term Caching

```typescript
// Roles are cached longer than typical API data
const { data: userRoles } = useGetMyRolesForCommunityQuery(communityId, {
  staleTime: 1000 * 60 * 15, // 15 minutes
  cacheTime: 1000 * 60 * 30, // 30 minutes
});
```

## State Management

### Generated Hooks

```typescript
export const {
  // My roles queries
  useGetMyRolesForCommunityQuery,
  useGetMyRolesForChannelQuery,
  useGetMyInstanceRolesQuery,
  
  // Other users' roles queries (admin functionality)
  useGetUserRolesForCommunityQuery,
  useGetUserRolesForChannelQuery,
  useGetUserInstanceRolesQuery,
  
  // Utility hooks
  usePrefetch,
} = rolesApi;
```

### Permission Checking Hook

```typescript
// Custom hook for permission checking
export function useUserPermissions(
  context: 'instance' | 'community' | 'channel',
  contextId?: string
) {
  const { data: instanceRoles } = useGetMyInstanceRolesQuery();
  const { data: communityRoles } = useGetMyRolesForCommunityQuery(
    contextId || '', 
    { skip: context !== 'community' || !contextId }
  );
  const { data: channelRoles } = useGetMyRolesForChannelQuery(
    contextId || '', 
    { skip: context !== 'channel' || !contextId }
  );

  const roles = context === 'instance' ? instanceRoles :
                context === 'community' ? communityRoles :
                channelRoles;

  const hasPermission = (action: string) => {
    return roles?.actions.includes(action) || false;
  };

  const hasRole = (roleName: string) => {
    return roles?.instanceRoles.includes(roleName) ||
           roles?.communityRoles?.includes(roleName) ||
           roles?.channelRoles?.includes(roleName) || false;
  };

  return {
    roles,
    hasPermission,
    hasRole,
    isLoading: !roles,
  };
}
```

## Component Integration

### Role-Based Component Rendering

```typescript
import { useRolesApi } from '@/features/roles/rolesApiSlice';

function CommunityManagementPanel({ communityId }: { communityId: string }) {
  const { 
    data: userRoles, 
    isLoading 
  } = useRolesApi.useGetMyRolesForCommunityQuery(communityId);

  if (isLoading) return <div>Loading permissions...</div>;

  const canManageMembers = userRoles?.actions.includes('MANAGE_MEMBERS');
  const canCreateChannels = userRoles?.actions.includes('CREATE_CHANNELS');
  const canManageCommunity = userRoles?.actions.includes('MANAGE_COMMUNITY');

  return (
    <div className="community-management">
      {canManageCommunity && (
        <section>
          <h3>Community Settings</h3>
          <EditCommunityButton communityId={communityId} />
        </section>
      )}
      
      {canCreateChannels && (
        <section>
          <h3>Channel Management</h3>
          <CreateChannelButton communityId={communityId} />
        </section>
      )}
      
      {canManageMembers && (
        <section>
          <h3>Member Management</h3>
          <MemberManagementPanel communityId={communityId} />
        </section>
      )}
      
      {!canManageMembers && !canCreateChannels && !canManageCommunity && (
        <div>You don't have management permissions for this community.</div>
      )}
    </div>
  );
}
```

### Permission-Based UI Components

```typescript
function MessageActions({ message, channelId }: { 
  message: Message; 
  channelId: string; 
}) {
  const { data: channelRoles } = useRolesApi.useGetMyRolesForChannelQuery(channelId);
  const { data: user } = useProfileQuery();

  const canEditMessages = channelRoles?.actions.includes('EDIT_MESSAGES');
  const canDeleteMessages = channelRoles?.actions.includes('DELETE_MESSAGES');
  const isMessageAuthor = message.authorId === user?.id;

  return (
    <div className="message-actions">
      {/* Users can always edit their own messages */}
      {(isMessageAuthor || canEditMessages) && (
        <button onClick={() => handleEditMessage(message.id)}>
          Edit
        </button>
      )}
      
      {/* Users can delete own messages or if they have permission */}
      {(isMessageAuthor || canDeleteMessages) && (
        <button onClick={() => handleDeleteMessage(message.id)}>
          Delete
        </button>
      )}
      
      <button onClick={() => handleReplyToMessage(message.id)}>
        Reply
      </button>
    </div>
  );
}
```

### Voice Channel Access Control

```typescript
function VoiceChannelJoinButton({ channel }: { channel: Channel }) {
  const { data: channelRoles } = useRolesApi.useGetMyRolesForChannelQuery(channel.id);
  
  const canConnectVoice = channelRoles?.actions.includes('CONNECT_VOICE');
  const canSpeakVoice = channelRoles?.actions.includes('SPEAK_VOICE');

  if (!canConnectVoice) {
    return <div>No permission to join this voice channel</div>;
  }

  return (
    <div className="voice-controls">
      <button onClick={() => handleJoinVoice(channel.id)}>
        Join Voice
      </button>
      
      {!canSpeakVoice && (
        <p className="permission-warning">
          You can listen but not speak in this channel
        </p>
      )}
    </div>
  );
}
```

### Admin User Management

```typescript
function UserRoleManager({ userId, communityId }: { 
  userId: string; 
  communityId: string; 
}) {
  const { 
    data: userRoles, 
    isLoading 
  } = useRolesApi.useGetUserRolesForCommunityQuery({ userId, communityId });
  
  const { data: myRoles } = useRolesApi.useGetMyRolesForCommunityQuery(communityId);
  
  const canManageRoles = myRoles?.actions.includes('MANAGE_ROLES');

  if (isLoading) return <div>Loading user roles...</div>;
  if (!canManageRoles) return <div>No permission to manage roles</div>;

  return (
    <div className="user-role-manager">
      <h4>User Roles</h4>
      
      <div className="current-roles">
        <h5>Current Roles:</h5>
        {userRoles?.communityRoles?.map(role => (
          <span key={role} className="role-badge">
            {role}
          </span>
        ))}
      </div>
      
      <div className="current-permissions">
        <h5>Permissions:</h5>
        <ul>
          {userRoles?.actions.map(action => (
            <li key={action}>{action}</li>
          ))}
        </ul>
      </div>
      
      <div className="role-actions">
        <button onClick={() => handleEditUserRoles(userId)}>
          Edit Roles
        </button>
      </div>
    </div>
  );
}
```

## Performance Optimization

### Permission Caching Strategy

```typescript
// Cache permissions for frequently checked actions
const usePermissionCache = (communityId: string) => {
  const { data: roles } = useGetMyRolesForCommunityQuery(communityId);
  
  const permissions = useMemo(() => {
    if (!roles) return {};
    
    return {
      canManageMembers: roles.actions.includes('MANAGE_MEMBERS'),
      canCreateChannels: roles.actions.includes('CREATE_CHANNELS'),
      canDeleteChannels: roles.actions.includes('DELETE_CHANNELS'),
      canManageCommunity: roles.actions.includes('MANAGE_COMMUNITY'),
      canCreateInvites: roles.actions.includes('CREATE_INVITES'),
    };
  }, [roles]);
  
  return permissions;
};
```

### Conditional Role Queries

```typescript
// Only fetch roles when needed
const ConditionalRoleCheck = ({ communityId, children }) => {
  const [needsRoleCheck, setNeedsRoleCheck] = useState(false);
  
  const { data: roles } = useGetMyRolesForCommunityQuery(communityId, {
    skip: !needsRoleCheck,
  });

  useEffect(() => {
    // Only fetch roles when component needs to show role-dependent content
    setNeedsRoleCheck(true);
  }, []);

  return children(roles);
};
```

## Error Handling

### Permission Errors

```typescript
const { data: roles, error } = useGetMyRolesForCommunityQuery(communityId);

if (error) {
  if ('status' in error) {
    switch (error.status) {
      case 403:
        // User doesn't have permission to view roles
        return <div>Access denied</div>;
      case 404:
        // Community or user not found
        return <div>Community not found</div>;
      default:
        return <div>Error loading permissions</div>;
    }
  }
}
```

### Graceful Permission Degradation

```typescript
function RoleBasedComponent({ communityId }: { communityId: string }) {
  const { data: roles, error, isLoading } = useGetMyRolesForCommunityQuery(communityId);

  // Show loading state
  if (isLoading) return <ComponentSkeleton />;
  
  // Handle errors gracefully - show basic view without advanced features
  if (error) {
    return <BasicCommunityView communityId={communityId} />;
  }
  
  // Show role-appropriate interface
  const canManage = roles?.actions.includes('MANAGE_COMMUNITY');
  return canManage ? <AdminCommunityView /> : <MemberCommunityView />;
}
```

## Testing

### Role Testing

```typescript
import { renderHook } from '@testing-library/react-hooks';
import { rolesApi } from '../rolesApiSlice';

describe('rolesApi', () => {
  it('should fetch user community roles successfully', async () => {
    const { result } = renderHook(
      () => rolesApi.useGetMyRolesForCommunityQuery('community-123'),
      { wrapper: TestProvider }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.actions).toBeInstanceOf(Array);
  });
});
```

### Permission Hook Testing

```typescript
describe('useUserPermissions', () => {
  it('should return correct permission checks', async () => {
    const mockRoles = {
      actions: ['MANAGE_MEMBERS', 'CREATE_CHANNELS'],
      communityRoles: ['ADMIN']
    };

    const { result } = renderHook(
      () => useUserPermissions('community', 'community-123'),
      { wrapper: createTestWrapper(mockRoles) }
    );

    expect(result.current.hasPermission('MANAGE_MEMBERS')).toBe(true);
    expect(result.current.hasPermission('DELETE_COMMUNITY')).toBe(false);
    expect(result.current.hasRole('ADMIN')).toBe(true);
  });
});
```

## Related Documentation

- [RBAC System Architecture](../features/auth-rbac.md) - Complete RBAC system overview
- [Role-Based Components](./RoleBasedComponents.md) - UI components with role-based rendering
- [User Permissions Hook](../hooks/useUserPermissions.md) - Permission checking utilities
- [Community API](./communityApi.md) - Community management with role checks
- [Channel API](./channelApi.md) - Channel management with permission validation
- [Membership API](./membershipApi.md) - Member management with role considerations