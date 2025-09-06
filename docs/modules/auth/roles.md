# Roles Module

> **Location:** `backend/src/roles/roles.module.ts`  
> **Type:** Core Module  
> **Domain:** authorization (RBAC)

## Overview

The Roles Module implements the Role-Based Access Control (RBAC) system for Kraken. It manages user roles, permissions, and provides the core authorization logic used throughout the application. This module defines 57+ granular permissions, handles default role creation for communities, and provides services for permission verification across different resource contexts.

## Module Structure

```
roles/
├── roles.module.ts              # Module definition
├── roles.service.ts             # RBAC logic and role management  
├── roles.controller.ts          # HTTP endpoints for role management
├── roles.service.spec.ts        # Service unit tests
├── roles.controller.spec.ts     # Controller unit tests
├── default-roles.config.ts      # Default role definitions
└── dto/
    └── user-roles-response.dto.ts # Role data transfer objects
```

## Services

### RolesService

**Purpose:** Core RBAC service that handles permission verification, role assignment, and default role management for communities.

#### Key Methods

```typescript
class RolesService {
  // Core RBAC verification
  async verifyActionsForUserAndResource(
    userId: string,
    resourceId: string | undefined,
    resourceType: RbacResourceType | undefined,
    actions: RbacActions[],
  ): Promise<boolean> {
    // Main authorization method - verifies if user has required permissions
    // Handles instance-level and community-level permissions
    // Returns true if user has ALL required actions
  }

  // User role queries by resource type
  async getUserRolesForCommunity(userId: string, communityId: string): Promise<UserRolesResponseDto> {
    // Retrieves all user roles within a specific community
  }

  async getUserRolesForChannel(userId: string, channelId: string): Promise<UserRolesResponseDto> {
    // Retrieves user roles for channel (inherits from community)
  }

  async getUserInstanceRoles(userId: string): Promise<UserRolesResponseDto> {
    // Retrieves instance-level roles for user
  }

  // Community role management
  async createDefaultCommunityRoles(communityId: string, tx?: Prisma.TransactionClient): Promise<string> {
    // Creates default Admin and Moderator roles for new community
    // Returns admin role ID for assignment to community creator
  }

  async assignUserToCommunityRole(
    userId: string,
    communityId: string,
    roleId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    // Assigns user to a role within a community
  }

  // Role lookup utilities
  async getCommunityAdminRole(communityId: string): Promise<RoleDto | null> {
    // Finds the admin role for a specific community
  }

  async getCommunityModeratorRole(communityId: string): Promise<RoleDto | null> {
    // Finds the moderator role for a specific community
  }
}
```

#### Permission Verification Logic

```typescript
async verifyActionsForUserAndResource(
  userId: string,
  resourceId: string | undefined,
  resourceType: RbacResourceType | undefined,
  actions: RbacActions[],
): Promise<boolean> {
  // Query user roles based on resource context
  const userRoles = await this.database.userRoles.findMany({
    where: {
      userId,
      communityId: resourceId, // Community-specific permissions
      isInstanceRole: resourceId === undefined || resourceType === RbacResourceType.INSTANCE,
    },
    include: { role: true },
  });

  // Extract all permissions from user's roles
  const allActions = userRoles
    .map(ur => ur.role)
    .flatMap(role => role.actions);

  // User must have ALL required actions
  return actions.every(action => allActions.includes(action));
}
```

## Controllers

### RolesController

**Base Route:** `/api/roles`

#### Endpoints

| Method | Endpoint | Description | Auth Required | RBAC Actions |
|--------|----------|-------------|---------------|--------------|
| GET | `/community/:communityId/user/:userId` | Get user roles in community | ✅ | `READ_ROLE` |
| GET | `/channel/:channelId/user/:userId` | Get user roles for channel | ✅ | `READ_ROLE` |  
| GET | `/instance/user/:userId` | Get user instance roles | ✅ | `READ_ROLE` |

#### Example Endpoint

```typescript
@Get('community/:communityId/user/:userId')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequiredActions(RbacActions.READ_ROLE)
@RbacResource({
  type: RbacResourceType.COMMUNITY,
  idKey: 'communityId',
  source: ResourceIdSource.PARAM,
})
async getUserRolesForCommunity(
  @Param('communityId') communityId: string,
  @Param('userId') userId: string,
): Promise<UserRolesResponseDto> {
  return this.rolesService.getUserRolesForCommunity(userId, communityId);
}
```

## DTOs (Data Transfer Objects)

### UserRolesResponseDto

```typescript
export interface UserRolesResponseDto {
  userId: string;
  resourceId: string | null;     // Community/channel/instance ID
  resourceType: 'COMMUNITY' | 'CHANNEL' | 'INSTANCE' | 'DM_GROUP';
  roles: RoleDto[];
}

export interface RoleDto {
  id: string;
  name: string;
  actions: RbacActions[];        // Array of permissions
  createdAt: Date;
}
```

## Default Roles Configuration

### Community Admin Role

Full administrative control within a community:

```typescript
export const DEFAULT_ADMIN_ROLE: DefaultRoleConfig = {
  name: 'Community Admin',
  actions: [
    // Community management
    RbacActions.UPDATE_COMMUNITY,
    RbacActions.DELETE_COMMUNITY,
    RbacActions.READ_COMMUNITY,

    // Channel management  
    RbacActions.CREATE_CHANNEL,
    RbacActions.UPDATE_CHANNEL,
    RbacActions.DELETE_CHANNEL,
    RbacActions.READ_CHANNEL,

    // Member management
    RbacActions.CREATE_MEMBER,
    RbacActions.UPDATE_MEMBER,
    RbacActions.DELETE_MEMBER,
    RbacActions.READ_MEMBER,

    // Message management
    RbacActions.CREATE_MESSAGE,
    RbacActions.DELETE_MESSAGE,
    RbacActions.READ_MESSAGE,

    // Role management within community
    RbacActions.CREATE_ROLE,
    RbacActions.UPDATE_ROLE,
    RbacActions.DELETE_ROLE,
    RbacActions.READ_ROLE,

    // Invite management
    RbacActions.CREATE_INVITE,
    RbacActions.DELETE_INVITE,
    RbacActions.READ_INSTANCE_INVITE,

    // Alias group management
    RbacActions.CREATE_ALIAS_GROUP,
    RbacActions.UPDATE_ALIAS_GROUP,
    RbacActions.DELETE_ALIAS_GROUP,
    RbacActions.READ_ALIAS_GROUP,
    RbacActions.CREATE_ALIAS_GROUP_MEMBER,
    RbacActions.DELETE_ALIAS_GROUP_MEMBER,
    RbacActions.READ_ALIAS_GROUP_MEMBER,

    // Content management
    RbacActions.CREATE_REACTION,
    RbacActions.DELETE_REACTION,
    RbacActions.CREATE_ATTACHMENT,
    RbacActions.DELETE_ATTACHMENT,
  ],
};
```

### Community Moderator Role

Limited moderation capabilities:

```typescript
export const DEFAULT_MODERATOR_ROLE: DefaultRoleConfig = {
  name: 'Moderator',
  actions: [
    // Read permissions
    RbacActions.READ_COMMUNITY,
    RbacActions.READ_CHANNEL,
    RbacActions.READ_MEMBER,
    RbacActions.READ_MESSAGE,
    RbacActions.READ_ROLE,

    // Message moderation
    RbacActions.CREATE_MESSAGE,
    RbacActions.DELETE_MESSAGE,

    // Basic channel management
    RbacActions.CREATE_CHANNEL,
    RbacActions.UPDATE_CHANNEL,

    // Member management (limited)
    RbacActions.CREATE_MEMBER,
    RbacActions.UPDATE_MEMBER,

    // Content management
    RbacActions.CREATE_REACTION,
    RbacActions.DELETE_REACTION,
    RbacActions.CREATE_ATTACHMENT,
    RbacActions.DELETE_ATTACHMENT,

    // Limited alias group access
    RbacActions.READ_ALIAS_GROUP,
    RbacActions.READ_ALIAS_GROUP_MEMBER,
  ],
};
```

## RBAC Actions (Permissions)

The system defines 57+ granular permissions across different domains:

### Community Management
- `CREATE_COMMUNITY`, `READ_COMMUNITY`, `UPDATE_COMMUNITY`, `DELETE_COMMUNITY`

### Channel Management  
- `CREATE_CHANNEL`, `READ_CHANNEL`, `UPDATE_CHANNEL`, `DELETE_CHANNEL`

### Member Management
- `CREATE_MEMBER`, `READ_MEMBER`, `UPDATE_MEMBER`, `DELETE_MEMBER`

### Message Management
- `CREATE_MESSAGE`, `READ_MESSAGE`, `UPDATE_MESSAGE`, `DELETE_MESSAGE`

### Role Management
- `CREATE_ROLE`, `READ_ROLE`, `UPDATE_ROLE`, `DELETE_ROLE`

### Content & Interactions
- `CREATE_REACTION`, `DELETE_REACTION`
- `CREATE_ATTACHMENT`, `DELETE_ATTACHMENT`  

### Invitation Management
- `CREATE_INVITE`, `DELETE_INVITE`, `READ_INSTANCE_INVITE`

### Alias Groups (Mentions)
- `CREATE_ALIAS_GROUP`, `READ_ALIAS_GROUP`, `UPDATE_ALIAS_GROUP`, `DELETE_ALIAS_GROUP`
- `CREATE_ALIAS_GROUP_MEMBER`, `DELETE_ALIAS_GROUP_MEMBER`, `READ_ALIAS_GROUP_MEMBER`

## Database Schema

### Role Model
```prisma
model Role {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  name      String   
  actions   RbacActions[] // Array of permission enums
  
  // Relations
  userRoles UserRoles[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@map("roles")
}
```

### UserRoles Model  
```prisma
model UserRoles {
  id             String  @id @default(auto()) @map("_id") @db.ObjectId
  userId         String  @db.ObjectId
  roleId         String  @db.ObjectId  
  communityId    String? @db.ObjectId  // Null for instance roles
  isInstanceRole Boolean @default(false)
  
  // Relations
  user      User      @relation(fields: [userId], references: [id])
  role      Role      @relation(fields: [roleId], references: [id])
  community Community? @relation(fields: [communityId], references: [id])
  
  createdAt DateTime @default(now())
  
  @@map("user_roles")
}
```

## Community Role Creation Process

### Automatic Role Creation

When a community is created, default roles are automatically generated:

```typescript
async createDefaultCommunityRoles(communityId: string, tx?: Prisma.TransactionClient): Promise<string> {
  const database = tx || this.database;
  const defaultRoles = getDefaultCommunityRoles(); // Admin + Moderator
  
  let adminRoleId: string;
  
  for (const defaultRole of defaultRoles) {
    const role = await database.role.create({
      data: {
        name: `${defaultRole.name} - ${communityId}`, // Unique per community
        actions: defaultRole.actions,
      },
    });
    
    if (defaultRole.name === DEFAULT_ADMIN_ROLE.name) {
      adminRoleId = role.id;
    }
  }
  
  return adminRoleId; // Return admin role for creator assignment
}
```

### Creator Role Assignment

```typescript
// In CommunityService.create()
const adminRoleId = await this.rolesService.createDefaultCommunityRoles(community.id, tx);

await this.rolesService.assignUserToCommunityRole(
  creatorUserId,
  community.id,
  adminRoleId,
  tx
);
```

## Permission Verification Flow

### 1. Request with RBAC Decorators
```typescript
@RequiredActions(RbacActions.CREATE_MESSAGE, RbacActions.READ_CHANNEL)
@RbacResource({
  type: RbacResourceType.CHANNEL,
  idKey: 'channelId',
  source: ResourceIdSource.BODY,
})
@Post('messages')
async createMessage(@Body() data: { channelId: string; content: string }) {
  // Protected endpoint
}
```

### 2. RbacGuard Processes Request
```typescript
// RbacGuard extracts metadata and calls RolesService
const hasPermission = await this.rolesService.verifyActionsForUserAndResource(
  user.id,
  resourceId,    // channelId from request body
  resourceType,  // RbacResourceType.CHANNEL
  [RbacActions.CREATE_MESSAGE, RbacActions.READ_CHANNEL]
);
```

### 3. Database Permission Check
```typescript
// RolesService queries user roles for the channel's community
const userRoles = await this.database.userRoles.findMany({
  where: {
    userId: user.id,
    communityId: resourceId, // Channel's community ID
    isInstanceRole: false,
  },
  include: { role: true },
});

// Check if user has all required actions
const allUserActions = userRoles.flatMap(ur => ur.role.actions);
return requiredActions.every(action => allUserActions.includes(action));
```

## Dependencies

### Internal Dependencies
- `@/database/database.module` - Database access for roles and permissions
- `@/auth/auth.module` - Integration with RBAC guard system

### External Dependencies
- `@nestjs/common` - NestJS decorators and dependency injection
- `@prisma/client` - Database models and RbacActions enum

## Performance Considerations

- **Role Caching:** Consider caching user roles to reduce database queries
- **Permission Aggregation:** Roles are flattened to permission arrays for fast checking
- **Database Indexes:** Ensure indexes on userId, communityId, and roleId columns
- **Batch Permission Checks:** Single query retrieves all user roles for resource

## Testing

### Service Tests
- **Location:** `backend/src/roles/roles.service.spec.ts`
- **Coverage:** Permission verification, role creation, role assignment

```typescript
describe('RolesService - verifyActionsForUserAndResource', () => {
  it('should return true when user has all required permissions', async () => {
    // Setup user with admin role in community
    const result = await service.verifyActionsForUserAndResource(
      'user-id',
      'community-id',
      RbacResourceType.COMMUNITY,
      [RbacActions.CREATE_CHANNEL, RbacActions.READ_COMMUNITY]
    );
    
    expect(result).toBe(true);
  });
  
  it('should return false when user lacks required permissions', async () => {
    // Setup user with limited permissions
    const result = await service.verifyActionsForUserAndResource(
      'user-id',
      'community-id', 
      RbacResourceType.COMMUNITY,
      [RbacActions.DELETE_COMMUNITY] // User doesn't have this
    );
    
    expect(result).toBe(false);
  });
});
```

## Common Usage Patterns

### Pattern 1: Service Integration
```typescript
@Injectable()
export class MessageService {
  constructor(private readonly rolesService: RolesService) {}
  
  async createMessage(userId: string, channelId: string, content: string) {
    // Manual permission check (when not using guards)
    const hasPermission = await this.rolesService.verifyActionsForUserAndResource(
      userId,
      channelId,
      RbacResourceType.CHANNEL,
      [RbacActions.CREATE_MESSAGE]
    );
    
    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permissions');
    }
    
    // Proceed with message creation
  }
}
```

### Pattern 2: Dynamic Permission Checking
```typescript
async getUserAvailableActions(userId: string, communityId: string): Promise<RbacActions[]> {
  const userRoles = await this.rolesService.getUserRolesForCommunity(userId, communityId);
  return userRoles.roles.flatMap(role => role.actions);
}
```

### Pattern 3: Role-Based UI Rendering
```typescript
// Frontend integration
const userRoles = await this.rolesService.getUserRolesForCommunity(userId, communityId);
const canManageChannels = userRoles.roles.some(role => 
  role.actions.includes(RbacActions.CREATE_CHANNEL)
);
```

## Error Handling

### Common Error Scenarios
1. **Permission Denied** - User lacks required actions for resource
2. **Resource Not Found** - Channel/community doesn't exist during permission check  
3. **Role Assignment Failures** - Invalid role or user IDs during assignment

```typescript
// Permission verification returns false (not exception)
// RbacGuard converts false result to 403 Forbidden HTTP response
```

## Related Modules

- **Auth Module** - RBAC guard and decorator integration
- **Community Module** - Default role creation and admin assignment
- **User Module** - Role assignment and user context
- **Channel Module** - Channel-specific permission inheritance
- **Database Module** - Role and permission data storage

## Migration Notes

### Role System Updates
- **Adding New Permissions:** Add to RbacActions enum and update default roles
- **Role Migration:** Update existing communities when default roles change
- **Permission Restructuring:** May require data migration for role assignments

## Troubleshooting

### Common Issues
1. **Permission Denied for Valid Actions**
   - **Symptoms:** 403 errors for authorized users
   - **Cause:** Missing role assignments or incorrect resource context
   - **Solution:** Verify user role assignments and RBAC decorators

2. **Default Roles Not Created**
   - **Symptoms:** New communities lack admin/moderator roles
   - **Cause:** Role creation not called during community creation
   - **Solution:** Ensure createDefaultCommunityRoles is called in transaction

3. **Channel Permission Issues**
   - **Symptoms:** Channel permissions not working correctly  
   - **Cause:** Channel permissions inherit from community, not direct assignment
   - **Solution:** Verify community-level role assignments for channel access

## Related Documentation

- [Auth Module](auth.md)
- [RBAC System Documentation](../../features/auth-rbac.md)
- [Community Role Management](../features/community.md#role-management)
- [API Role Endpoints](../../api/roles.md)