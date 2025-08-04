# Authentication & Role-Based Access Control (RBAC)

Kraken implements a comprehensive authentication and authorization system with JWT tokens and granular role-based permissions.

## 🔐 Authentication System

### JWT-Based Authentication

#### Token Structure
```typescript
interface JwtPayload {
  sub: string;        // User ID
  username: string;   // Username
  role: InstanceRole; // Instance-level role (OWNER, USER)
  iat: number;        // Issued at
  exp: number;        // Expires at
}
```

#### Authentication Flow
1. **Registration/Login**: User provides credentials
2. **Token Generation**: Backend creates JWT with user info
3. **Token Storage**: Frontend stores token securely
4. **Request Authentication**: Token sent in Authorization header
5. **Token Validation**: Guards validate and extract user info

#### Refresh Token System
- **Purpose**: Secure token renewal without re-authentication
- **Storage**: Hashed tokens stored in database with expiration
- **Rotation**: New refresh token issued on each use
- **Security**: Prevents token reuse attacks

### Authentication Guards

#### **JwtAuthGuard** (`jwt-auth.guard.ts`)
- **Purpose**: Validates JWT tokens on HTTP requests
- **Implementation**: Passport.js strategy
- **Usage**: Applied globally or per controller/route

#### **WsJwtAuthGuard** (`ws-jwt-auth.guard.ts`)
- **Purpose**: Validates JWT tokens for WebSocket connections
- **Implementation**: Custom WebSocket guard
- **User Attachment**: Attaches user to socket handshake

```typescript
@UseGuards(WsJwtAuthGuard, RbacGuard)
export class MessagesGateway {
  @SubscribeMessage(ClientEvents.SEND_MESSAGE)
  async handleMessage(
    @ConnectedSocket() client: Socket & { handshake: { user: UserEntity } }
  ) {
    // User available from handshake
  }
}
```

## 🛡️ Role-Based Access Control (RBAC)

### RBAC Architecture

Kraken implements a sophisticated RBAC system with:
- **Actions**: 57 granular permissions
- **Resources**: Entity types (Community, Channel, Message, etc.)
- **Roles**: Collections of actions
- **Context**: Instance-level and community-level roles

### Permission Actions

#### **Complete Action List** (57 permissions)
```typescript
enum RbacActions {
  // Message Management
  CREATE_MESSAGE,
  DELETE_MESSAGE,
  READ_MESSAGE,
  
  // Channel Management
  CREATE_CHANNEL,
  UPDATE_CHANNEL,
  DELETE_CHANNEL,
  READ_CHANNEL,
  JOIN_CHANNEL,
  
  // Community Management
  CREATE_COMMUNITY,
  UPDATE_COMMUNITY,
  DELETE_COMMUNITY,
  READ_COMMUNITY,
  READ_ALL_COMMUNITIES,
  
  // Member Management
  CREATE_MEMBER,
  UPDATE_MEMBER,
  DELETE_MEMBER,
  READ_MEMBER,
  
  // Role Management
  CREATE_ROLE,
  UPDATE_ROLE,
  DELETE_ROLE,
  READ_ROLE,
  
  // User Management
  CREATE_USER,
  DELETE_USER,
  READ_USER,
  UPDATE_USER,
  
  // Invite Management
  CREATE_INVITE,
  DELETE_INVITE,
  CREATE_INSTANCE_INVITE,
  DELETE_INSTANCE_INVITE,
  READ_INSTANCE_INVITE,
  UPDATE_INSTANCE_INVITE,
  
  // Alias/Mention Groups
  CREATE_ALIAS_GROUP,
  UPDATE_ALIAS_GROUP,
  DELETE_ALIAS_GROUP,
  READ_ALIAS_GROUP,
  CREATE_ALIAS_GROUP_MEMBER,
  DELETE_ALIAS_GROUP_MEMBER,
  READ_ALIAS_GROUP_MEMBER,
  UPDATE_ALIAS_GROUP_MEMBER,
  
  // Reactions & Attachments
  CREATE_REACTION,
  DELETE_REACTION,
  CREATE_ATTACHMENT,
  DELETE_ATTACHMENT,
}
```

### Resource Types

```typescript
enum RbacResourceType {
  INSTANCE = 'INSTANCE',
  COMMUNITY = 'COMMUNITY',
  CHANNEL = 'CHANNEL',
  MESSAGE = 'MESSAGE',
  USER = 'USER',
  DM_GROUP = 'DM_GROUP',
}
```

### Default Roles

#### **Community Admin Role**
```typescript
export const DEFAULT_ADMIN_ROLE: DefaultRoleConfig = {
  name: 'Community Admin',
  actions: [
    // Full community management
    RbacActions.UPDATE_COMMUNITY,
    RbacActions.DELETE_COMMUNITY,
    RbacActions.READ_COMMUNITY,
    
    // Channel management
    RbacActions.CREATE_CHANNEL,
    RbacActions.UPDATE_CHANNEL,
    RbacActions.DELETE_CHANNEL,
    RbacActions.READ_CHANNEL,
    
    // Member & role management
    RbacActions.CREATE_MEMBER,
    RbacActions.UPDATE_MEMBER,
    RbacActions.DELETE_MEMBER,
    RbacActions.CREATE_ROLE,
    RbacActions.UPDATE_ROLE,
    RbacActions.DELETE_ROLE,
    
    // Message & content moderation
    RbacActions.DELETE_MESSAGE,
    RbacActions.DELETE_REACTION,
    
    // Invite management
    RbacActions.CREATE_INVITE,
    RbacActions.DELETE_INVITE,
    
    // ... (see full list in default-roles.config.ts)
  ],
};
```

#### **Moderator Role**
```typescript
export const DEFAULT_MODERATOR_ROLE: DefaultRoleConfig = {
  name: 'Moderator',
  actions: [
    // Read permissions
    RbacActions.READ_COMMUNITY,
    RbacActions.READ_CHANNEL,
    RbacActions.READ_MEMBER,
    RbacActions.READ_MESSAGE,
    
    // Limited moderation
    RbacActions.DELETE_MESSAGE,
    RbacActions.CREATE_CHANNEL,
    RbacActions.UPDATE_CHANNEL,
    
    // Basic member management
    RbacActions.CREATE_MEMBER,
    RbacActions.UPDATE_MEMBER,
    
    // Content management
    RbacActions.CREATE_REACTION,
    RbacActions.DELETE_REACTION,
    RbacActions.CREATE_ATTACHMENT,
    RbacActions.DELETE_ATTACHMENT,
  ],
};
```

### RBAC Implementation

#### **Backend Guards**

##### **RbacGuard** (`rbac.guard.ts`)
```typescript
@Injectable()
export class RbacGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredActions = this.getRequiredRbacActions(context);
    const resourceOptions = this.getResourceOptions(context);
    const user = this.getUser(context);
    
    // Instance owners bypass all checks
    if (user.role === InstanceRole.OWNER) return true;
    
    return this.rolesService.verifyActionsForUserAndResource(
      user.id,
      resourceId,
      resourceType,
      requiredActions,
    );
  }
}
```

##### **RBAC Decorators**
```typescript
// Action requirements
@RequiredActions(RbacActions.CREATE_MESSAGE, RbacActions.READ_CHANNEL)

// Resource context
@RbacResource({
  type: RbacResourceType.CHANNEL,
  idKey: 'channelId',
  source: ResourceIdSource.PAYLOAD,
})
```

#### **Frontend Integration**

##### **Permission Hooks**
```typescript
// Check if user has specific permissions
export const useUserPermissions = ({
  resourceType,
  resourceId,
  actions,
}) => {
  const { data: userRoles } = useMyRolesForResourceQuery({
    resourceType,
    resourceId,
  });
  
  const hasPermissions = useMemo(() => {
    return actions.every(action => 
      userRoles?.some(role => role.actions.includes(action))
    );
  }, [userRoles, actions]);
  
  return { hasPermissions, isLoading: !userRoles };
};

// Check single action
export const useCanPerformAction = (
  resourceType: string,
  resourceId: string,
  action: string
) => {
  const { hasPermissions } = useUserPermissions({
    resourceType,
    resourceId,
    actions: [action],
  });
  
  return hasPermissions;
};
```

##### **Permission-Based Components**
```typescript
// Conditional rendering based on permissions
export function RoleBasedComponent({
  communityId,
  children,
  requiredActions,
}: RoleBasedComponentProps) {
  const { hasPermissions, isLoading } = useUserPermissions({
    resourceType: "COMMUNITY",
    resourceId: communityId,
    actions: requiredActions,
  });

  if (isLoading) return <div>Loading permissions...</div>;
  if (!hasPermissions) return null;
  
  return <>{children}</>;
}

// Permission-based buttons
export function ConditionalButton({
  communityId,
  action,
  onClick,
  children,
}: ConditionalButtonProps) {
  const canPerformAction = useCanPerformAction(
    "COMMUNITY",
    communityId,
    action
  );

  if (!canPerformAction) return null;
  
  return <button onClick={onClick}>{children}</button>;
}
```

### Role Management System

#### **Database Schema**
```prisma
model Role {
  id        String        @id @default(auto()) @map("_id") @db.ObjectId
  name      String        @unique
  actions   RbacActions[] @default([])
  createdAt DateTime      @default(now())
  
  UserRoles UserRoles[]
}

model UserRoles {
  id             String     @id @default(auto()) @map("_id") @db.ObjectId
  userId         String     @db.ObjectId
  communityId    String?    @db.ObjectId // Null for instance-level roles
  roleId         String     @db.ObjectId
  isInstanceRole Boolean    @default(false)
  
  user           User       @relation(fields: [userId], references: [id])
  community      Community? @relation(fields: [communityId], references: [id])
  role           Role       @relation(fields: [roleId], references: [id])
  
  @@unique([userId, communityId, roleId])
}
```

#### **Role Assignment**
```typescript
// Assign role to user in community
await prisma.userRoles.create({
  data: {
    userId: user.id,
    communityId: community.id,
    roleId: role.id,
    isInstanceRole: false,
  },
});

// Instance-level role assignment
await prisma.userRoles.create({
  data: {
    userId: user.id,
    communityId: null,
    roleId: role.id,
    isInstanceRole: true,
  },
});
```

### Permission Verification

#### **Backend Service**
```typescript
async verifyActionsForUserAndResource(
  userId: string,
  resourceId: string | undefined,
  resourceType: RbacResourceType | undefined,
  requiredActions: RbacActions[],
): Promise<boolean> {
  // Get user's roles for the resource context
  const userRoles = await this.getUserRolesForResource(
    userId,
    resourceId,
    resourceType,
  );
  
  // Check if user has all required actions
  const userActions = userRoles.flatMap(role => role.actions);
  
  return requiredActions.every(action => 
    userActions.includes(action)
  );
}
```

## 🔧 Current Implementation Status

### ✅ Fully Implemented
- JWT authentication system
- Refresh token management
- WebSocket authentication
- RBAC guard system
- Permission decorators
- Default role definitions
- Permission verification logic

### 🔧 Partially Implemented
- **Role Management UI**: Backend complete, needs admin interface
- **Permission Matrix**: Need visual permission management
- **Bulk Operations**: Role assignment for multiple users
- **Role Templates**: Community-specific role templates

### ❌ Missing Features
- **Two-Factor Authentication**: Enhanced security
- **OAuth Integration**: Social login options
- **Session Management**: Active session tracking
- **Audit Logging**: Permission change tracking
- **Advanced Role Hierarchy**: Role inheritance system

## 🚀 Next Steps for Completion

### Phase 1: Admin Interface (2-3 weeks)
1. Role management dashboard
2. Permission matrix visualization
3. User role assignment interface
4. Bulk role operations

### Phase 2: Enhanced Security (Future)
1. Two-factor authentication
2. OAuth provider integration
3. Session management system
4. Advanced audit logging

This RBAC system provides a solid foundation for Discord-like permission management with room for future enhancements and customization.