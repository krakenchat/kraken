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
- **Tag Types:** `["UserRoles", "CommunityRoles", "RoleUsers"]`

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

### Community Role Management Endpoints

#### getCommunityRoles
```typescript
getCommunityRoles: builder.query<CommunityRolesResponse, string>({
  query: (communityId) => ({
    url: `/community/${communityId}`,
    method: "GET",
  }),
  providesTags: (_result, _error, communityId) => [
    { type: "CommunityRoles", id: communityId },
  ],
})
```

**Purpose:** Fetches all custom roles for a specific community.

**Usage:**
```typescript
const { 
  data: communityRoles, 
  error, 
  isLoading 
} = useGetCommunityRolesQuery(communityId, {
  skip: !communityId,
});

// Access role data
const roles = communityRoles?.roles || [];
const adminRole = roles.find(role => role.name === 'Admin');
```

#### createCommunityRole
```typescript
createCommunityRole: builder.mutation<
  RoleDto,
  { communityId: string; data: CreateRoleDto }
>({
  query: ({ communityId, data }) => ({
    url: `/community/${communityId}`,
    method: "POST",
    body: data,
  }),
  invalidatesTags: (_result, _error, { communityId }) => [
    { type: "CommunityRoles", id: communityId },
  ],
})
```

**Purpose:** Creates a new custom role for a community.

**Usage:**
```typescript
const [createRole, { isLoading, error }] = useCreateCommunityRoleMutation();

const handleCreateRole = async (roleData: { name: string; actions: string[] }) => {
  try {
    await createRole({
      communityId,
      data: roleData,
    }).unwrap();
    // Role created successfully
  } catch (error) {
    // Handle error
  }
};
```

#### updateRole
```typescript
updateRole: builder.mutation<
  RoleDto,
  { roleId: string; data: UpdateRoleDto }
>({
  query: ({ roleId, data }) => ({
    url: `/${roleId}`,
    method: "PUT",
    body: data,
  }),
  invalidatesTags: (_result, _error, { roleId }) => [
    { type: "CommunityRoles", id: "LIST" },
    { type: "UserRoles", id: "LIST" },
  ],
})
```

**Purpose:** Updates an existing role's name and permissions.

**Usage:**
```typescript
const [updateRole, { isLoading, error }] = useUpdateRoleMutation();

const handleUpdateRole = async (roleId: string, updates: { name?: string; actions?: string[] }) => {
  try {
    await updateRole({
      roleId,
      data: updates,
    }).unwrap();
    // Role updated successfully
  } catch (error) {
    // Handle error
  }
};
```

#### deleteRole
```typescript
deleteRole: builder.mutation<void, string>({
  query: (roleId) => ({
    url: `/${roleId}`,
    method: "DELETE",
  }),
  invalidatesTags: () => [
    { type: "CommunityRoles", id: "LIST" },
    { type: "UserRoles", id: "LIST" },
  ],
})
```

**Purpose:** Deletes a custom role and removes it from all users.

**Usage:**
```typescript
const [deleteRole, { isLoading, error }] = useDeleteRoleMutation();

const handleDeleteRole = async (roleId: string) => {
  try {
    await deleteRole(roleId).unwrap();
    // Role deleted successfully
  } catch (error) {
    // Handle error
  }
};
```

### User-Role Assignment Endpoints

#### assignRoleToUser
```typescript
assignRoleToUser: builder.mutation<
  void,
  { communityId: string; data: { userId: string; roleId: string } }
>({
  query: ({ communityId, data }) => ({
    url: `/community/${communityId}/assign`,
    method: "POST",
    body: data,
  }),
  invalidatesTags: (_result, _error, { communityId, data }) => [
    { type: "UserRoles", id: `${data.userId}-community-${communityId}` },
    { type: "RoleUsers", id: data.roleId },
  ],
})
```

**Purpose:** Assigns a role to a user within a community.

**Usage:**
```typescript
const [assignRole, { isLoading, error }] = useAssignRoleToUserMutation();

const handleAssignRole = async (userId: string, roleId: string) => {
  try {
    await assignRole({
      communityId,
      data: { userId, roleId },
    }).unwrap();
    // Role assigned successfully
  } catch (error) {
    // Handle error
  }
};
```

#### removeRoleFromUser
```typescript
removeRoleFromUser: builder.mutation<
  void,
  { communityId: string; userId: string; roleId: string }
>({
  query: ({ communityId, userId, roleId }) => ({
    url: `/community/${communityId}/user/${userId}/role/${roleId}`,
    method: "DELETE",
  }),
  invalidatesTags: (_result, _error, { communityId, userId, roleId }) => [
    { type: "UserRoles", id: `${userId}-community-${communityId}` },
    { type: "RoleUsers", id: roleId },
  ],
})
```

**Purpose:** Removes a role from a user within a community.

**Usage:**
```typescript
const [removeRole, { isLoading, error }] = useRemoveRoleFromUserMutation();

const handleRemoveRole = async (userId: string, roleId: string) => {
  try {
    await removeRole({
      communityId,
      userId,
      roleId,
    }).unwrap();
    // Role removed successfully
  } catch (error) {
    // Handle error
  }
};
```

#### getUsersForRole
```typescript
getUsersForRole: builder.query<
  RoleUsersResponse,
  { communityId: string; roleId: string }
>({
  query: ({ communityId, roleId }) => ({
    url: `/community/${communityId}/role/${roleId}/users`,
    method: "GET",
  }),
  providesTags: (_result, _error, { roleId }) => [
    { type: "RoleUsers", id: roleId },
  ],
})
```

**Purpose:** Fetches all users who have a specific role within a community.

**Usage:**
```typescript
const { 
  data: roleUsers, 
  error, 
  isLoading 
} = useGetUsersForRoleQuery({ 
  communityId, 
  roleId 
}, {
  skip: !communityId || !roleId,
});

// Access user data
const users = roleUsers?.users || [];
const userCount = roleUsers?.totalCount || 0;
```

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

interface RoleDto {
  id: string;
  name: string;                   // Display name (without community suffix)
  actions: string[];              // Array of permission actions
  createdAt: Date;
}

interface CommunityRolesResponse {
  roles: RoleDto[];               // Array of community roles
  totalCount: number;             // Total number of roles
}

interface RoleUsersResponse {
  users: Array<{
    userId: string;
    user?: {
      username: string;
      displayName?: string;
      avatarUrl?: string;
    };
  }>;
  totalCount: number;             // Total number of users with this role
}

interface CreateRoleDto {
  name: string;                   // Role name (max 50 characters)
  actions: string[];              // Array of permissions (min 1 required)
}

interface UpdateRoleDto {
  name?: string;                  // Optional role name update
  actions?: string[];             // Optional permissions update
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
tagTypes: ["UserRoles", "CommunityRoles", "RoleUsers"]

// Tagging patterns:
// - My roles for community: { type: "UserRoles", id: `my-community-${communityId}` }
// - My roles for channel: { type: "UserRoles", id: `my-channel-${channelId}` }
// - My instance roles: { type: "UserRoles", id: "my-instance" }
// - Other user roles: { type: "UserRoles", id: `${userId}-community-${communityId}` }
// - Community roles list: { type: "CommunityRoles", id: communityId }
// - Users with specific role: { type: "RoleUsers", id: roleId }
```

### Cache Invalidation

Role data is typically cached for the duration of the session since role changes are infrequent. Cache invalidation occurs when:

- User roles are modified by administrators
- User joins/leaves communities
- Channel permissions are updated
- Instance roles are modified

**Role Management Cache Invalidation:**
- **Role Creation**: Invalidates `CommunityRoles` for the community
- **Role Update**: Invalidates `CommunityRoles` and all `UserRoles` (broad invalidation due to permission changes)
- **Role Deletion**: Invalidates `CommunityRoles` and all `UserRoles` 
- **Role Assignment**: Invalidates specific user's `UserRoles` and the role's `RoleUsers` cache
- **Role Removal**: Invalidates specific user's `UserRoles` and the role's `RoleUsers` cache

**Invalidation Strategy Examples:**
```typescript
// Creating a role invalidates community roles list
invalidatesTags: [{ type: "CommunityRoles", id: communityId }]

// Updating a role affects all users (broad invalidation)
invalidatesTags: [
  { type: "CommunityRoles", id: "LIST" },
  { type: "UserRoles", id: "LIST" }
]

// Assigning a role to a user (targeted invalidation)
invalidatesTags: [
  { type: "UserRoles", id: `${userId}-community-${communityId}` },
  { type: "RoleUsers", id: roleId }
]
```

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
  
  // ===== NEW ROLE MANAGEMENT HOOKS =====
  
  // Role CRUD operations
  useGetCommunityRolesQuery,
  useCreateCommunityRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  
  // User-role assignment operations
  useAssignRoleToUserMutation,
  useRemoveRoleFromUserMutation,
  useGetUsersForRoleQuery,
  
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

### Complete Role Management Dashboard

```typescript
function RoleManagementDashboard({ communityId }: { communityId: string }) {
  const [selectedRole, setSelectedRole] = useState<RoleDto | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Role queries and mutations
  const { data: communityRoles, isLoading: loadingRoles } = useGetCommunityRolesQuery(communityId);
  const { data: myRoles } = useGetMyRolesForCommunityQuery(communityId);
  const [createRole] = useCreateCommunityRoleMutation();
  const [updateRole] = useUpdateRoleMutation();
  const [deleteRole] = useDeleteRoleMutation();

  const canManageRoles = myRoles?.actions.includes('MANAGE_ROLES');

  if (!canManageRoles) {
    return <div>You don't have permission to manage roles.</div>;
  }

  const handleCreateRole = async (roleData: CreateRoleDto) => {
    try {
      await createRole({ communityId, data: roleData }).unwrap();
      setIsCreating(false);
    } catch (error) {
      console.error('Failed to create role:', error);
    }
  };

  const handleUpdateRole = async (roleId: string, updates: UpdateRoleDto) => {
    try {
      await updateRole({ roleId, data: updates }).unwrap();
      setSelectedRole(null);
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (confirm('Are you sure you want to delete this role?')) {
      try {
        await deleteRole(roleId).unwrap();
      } catch (error) {
        console.error('Failed to delete role:', error);
      }
    }
  };

  return (
    <div className="role-management-dashboard">
      <div className="dashboard-header">
        <h2>Role Management</h2>
        <button onClick={() => setIsCreating(true)}>
          Create New Role
        </button>
      </div>

      {loadingRoles ? (
        <div>Loading roles...</div>
      ) : (
        <div className="roles-grid">
          {communityRoles?.roles.map(role => (
            <div key={role.id} className="role-card">
              <h3>{role.name}</h3>
              <p>{role.actions.length} permissions</p>
              <div className="role-actions">
                <button onClick={() => setSelectedRole(role)}>
                  Edit
                </button>
                <button onClick={() => handleDeleteRole(role.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Role Editor Modal/Dialog */}
      {(isCreating || selectedRole) && (
        <RoleEditorModal
          role={selectedRole}
          onSave={selectedRole ? 
            (data) => handleUpdateRole(selectedRole.id, data) : 
            handleCreateRole
          }
          onClose={() => {
            setIsCreating(false);
            setSelectedRole(null);
          }}
        />
      )}
    </div>
  );
}
```

### User-Role Assignment Component

```typescript
function RoleAssignmentDialog({ 
  userId, 
  userName, 
  communityId, 
  open, 
  onClose 
}: {
  userId: string;
  userName: string;
  communityId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());

  // Queries
  const { data: communityRoles } = useGetCommunityRolesQuery(communityId, { skip: !open });
  const { data: userRoles } = useGetUserRolesForCommunityQuery(
    { userId, communityId }, 
    { skip: !open }
  );

  // Mutations
  const [assignRole] = useAssignRoleToUserMutation();
  const [removeRole] = useRemoveRoleFromUserMutation();

  // Initialize selected roles when user roles load
  useEffect(() => {
    if (userRoles?.roles) {
      const currentRoleIds = new Set(userRoles.roles.map(role => role.id));
      setSelectedRoles(currentRoleIds);
    }
  }, [userRoles]);

  const handleRoleToggle = (roleId: string) => {
    setSelectedRoles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(roleId)) {
        newSet.delete(roleId);
      } else {
        newSet.add(roleId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    const currentRoleIds = new Set(userRoles?.roles?.map(r => r.id) || []);
    
    // Find roles to add and remove
    const rolesToAdd = Array.from(selectedRoles).filter(id => !currentRoleIds.has(id));
    const rolesToRemove = Array.from(currentRoleIds).filter(id => !selectedRoles.has(id));

    try {
      // Add new roles
      for (const roleId of rolesToAdd) {
        await assignRole({ communityId, data: { userId, roleId } }).unwrap();
      }

      // Remove old roles  
      for (const roleId of rolesToRemove) {
        await removeRole({ communityId, userId, roleId }).unwrap();
      }

      onClose();
    } catch (error) {
      console.error('Failed to update user roles:', error);
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Manage Roles for {userName}</DialogTitle>
      <DialogContent>
        <FormGroup>
          {communityRoles?.roles.map(role => (
            <FormControlLabel
              key={role.id}
              control={
                <Checkbox
                  checked={selectedRoles.has(role.id)}
                  onChange={() => handleRoleToggle(role.id)}
                />
              }
              label={
                <div>
                  <Typography variant="body2">{role.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {role.actions.length} permissions
                  </Typography>
                </div>
              }
            />
          ))}
        </FormGroup>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
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

### Core RBAC System
- **[RBAC System Architecture](../features/auth-rbac.md)** - Complete RBAC system overview
- **[Roles Backend Module](../modules/auth/roles.md)** - Backend role management service and business logic
- **[Roles API Endpoints](../api/roles.md)** - REST API documentation for role management

### Frontend Components  
- **[RoleEditor Component](../components/community/RoleEditor.md)** - Role creation and editing interface
- **[RoleAssignmentDialog Component](../components/community/RoleAssignmentDialog.md)** - User-role assignment interface  
- **[RoleManagement Component](../components/community/RoleManagement.md)** - Complete role management dashboard

### State Management
- **[Community API Slice](./communityApi.md)** - Community management with role checks
- **[Channel API Slice](./channelApi.md)** - Channel management with permission validation
- **[Membership API Slice](./membershipApi.md)** - Member management with role considerations

### Utilities and Hooks
- **[User Permissions Hook](../hooks/useUserPermissions.md)** - Permission checking utilities
- **[Role-Based Components](./RoleBasedComponents.md)** - UI components with role-based rendering
- **[RBAC Actions Constants](../constants/rbacActions.md)** - Permission system constants and labels