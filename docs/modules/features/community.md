# Community Module

> **Location:** `backend/src/community/community.module.ts`  
> **Type:** Feature Module  
> **Domain:** community management

## Overview

The Community Module provides comprehensive management capabilities for Discord-like communities (servers) within the Kraken application. It handles community creation, membership management, default channel/role setup, and community lifecycle operations. This module is central to the multi-tenant nature of Kraken, where users can create and manage multiple isolated communities.

## Module Structure

```
community/
├── community.module.ts          # Module definition with dependencies
├── community.service.ts         # Core business logic for community operations
├── community.controller.ts      # HTTP endpoints with RBAC protection
├── community.service.spec.ts    # Service unit tests
├── community.controller.spec.ts # Controller unit tests
├── dto/
│   ├── create-community.dto.ts  # Community creation data transfer object
│   └── update-community.dto.ts  # Community update data transfer object
└── entities/
    └── community.entity.ts      # Community entity definition
```

## Services

### CommunityService

**Purpose:** Manages community lifecycle, membership operations, and integration with channels and roles systems.

#### Key Methods

```typescript
class CommunityService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly channelsService: ChannelsService,
    private readonly rolesService: RolesService
  ) {}

  // Community lifecycle management
  async create(createCommunityDto: CreateCommunityDto, creatorId: string): Promise<Community> {
    // Creates community with atomic setup:
    // 1. Creates community record
    // 2. Adds creator as member
    // 3. Creates default "general" channel
    // 4. Creates default community roles (admin, member)
    // 5. Assigns creator as admin
  }
  
  async findAll(userId?: string): Promise<Community[]> {
    // Returns all communities (admin) or user's communities (filtered by membership)
  }
  
  async findOne(id: string): Promise<Community> {
    // Retrieves single community by ID with error handling
  }
  
  async update(id: string, updateCommunityDto: UpdateCommunityDto): Promise<Community> {
    // Updates community metadata (name, description, avatar, banner)
  }
  
  async remove(id: string): Promise<void> {
    // Atomically removes community and all associated memberships
    // Note: Channels are cascade-deleted via database constraints
  }

  // Helper methods
  async addMemberToGeneralChannel(communityId: string, userId: string): Promise<void> {
    // Adds new community member to default general channel
    // Graceful error handling to avoid breaking membership creation
  }
}
```

#### Database Transaction Patterns

```typescript
// Community creation with full setup
return await this.databaseService.$transaction(async (tx) => {
  // 1. Create community
  const community = await tx.community.create({ data: createCommunityDto });
  
  // 2. Add creator as member
  await tx.membership.create({
    data: { userId: creatorId, communityId: community.id }
  });
  
  // 3. Create default channel and add creator
  await this.channelsService.createDefaultGeneralChannel(
    community.id, creatorId, tx
  );
  
  // 4. Setup default roles and assign admin
  const adminRoleId = await this.rolesService.createDefaultCommunityRoles(
    community.id, tx
  );
  
  await this.rolesService.assignUserToCommunityRole(
    creatorId, community.id, adminRoleId, tx
  );
  
  return community;
});
```

## Controllers

### CommunityController

**Base Route:** `/api/community`

#### Endpoints

| Method | Endpoint | Description | Auth Required | RBAC Actions |
|--------|----------|-------------|---------------|--------------|
| POST | `/` | Create new community | ✅ | `CREATE_COMMUNITY` |
| GET | `/` | List all communities (admin) | ✅ | `READ_ALL_COMMUNITIES` |
| GET | `/mine` | List user's communities | ✅ | `READ_COMMUNITY` |
| GET | `/:id` | Get community by ID | ✅ | `READ_COMMUNITY` |
| PATCH | `/:id` | Update community | ✅ | `UPDATE_COMMUNITY` |
| DELETE | `/:id` | Delete community | ✅ | `DELETE_COMMUNITY` |

#### Example Endpoint Implementation

```typescript
@Post()
@HttpCode(201)
@RequiredActions(RbacActions.CREATE_COMMUNITY)
async create(
  @Body() createCommunityDto: CreateCommunityDto,
  @Req() req: { user: UserEntity },
) {
  return this.communityService.create(createCommunityDto, req.user.id);
}

@Get(':id')
@RequiredActions(RbacActions.READ_COMMUNITY)
@RbacResource({
  type: RbacResourceType.COMMUNITY,
  idKey: 'id',
  source: ResourceIdSource.PARAM
})
findOne(@Param('id', ParseObjectIdPipe) id: string) {
  return this.communityService.findOne(id);
}
```

## DTOs (Data Transfer Objects)

### CreateCommunityDto

```typescript
export class CreateCommunityDto implements Community {
  name: string;                    // Required: Community display name
  description: string | null;      // Optional: Community description
  avatar: string | null;          // Optional: Avatar image URL
  banner: string | null;          // Optional: Banner image URL
  
  @Exclude()
  id: string;                     // Excluded: Generated by database
  
  @Exclude()
  createdAt: Date;               // Excluded: Managed by database
}
```

### UpdateCommunityDto

```typescript
export class UpdateCommunityDto extends PartialType(CreateCommunityDto) {
  // All fields from CreateCommunityDto made optional for updates
  // name?: string;
  // description?: string | null;
  // avatar?: string | null;
  // banner?: string | null;
}
```

## Database Schema

### Community Model

```prisma
model Community {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  name        String   @unique  // Globally unique community names
  description String?             // Optional community description
  avatar      String?             // Avatar image URL/path
  banner      String?             // Banner image URL/path
  createdAt   DateTime @default(now())
  
  // Relations
  memberships Membership[]        // Community members
  channels    Channel[]           // Community channels
  UserRoles   UserRoles[]         // Community role assignments
  
  @@map("communities")
}
```

### Related Models

```prisma
model Membership {
  id          String    @id @default(auto()) @map("_id") @db.ObjectId
  userId      String    @db.ObjectId
  communityId String    @db.ObjectId
  joinedAt    DateTime  @default(now())
  
  user        User      @relation("UserMemberships", fields: [userId], references: [id])
  community   Community @relation("CommunityMemberships", fields: [communityId], references: [id])
  
  @@unique([userId, communityId])  // One membership per user per community
}
```

## Dependencies

### Internal Dependencies
- `@/auth/auth.module` - JWT authentication and RBAC guards
- `@/roles/roles.module` - Community role creation and management
- `@/database/database.module` - Database operations via Prisma
- `@/channels/channels.module` - Default channel creation integration

### External Dependencies
- `@nestjs/common` - NestJS decorators and exceptions
- `@nestjs/mapped-types` - DTO inheritance utilities
- `nestjs-object-id` - MongoDB ObjectId validation pipes
- `class-transformer` - DTO serialization control

## Authentication & Authorization

### Guards Used
- `JwtAuthGuard` - Ensures user authentication for all endpoints
- `RbacGuard` - Enforces role-based access control

### RBAC Permissions
```typescript
// Community management permissions
CREATE_COMMUNITY      // Create new communities (typically instance-level)
READ_COMMUNITY        // View community details (member-level access)
READ_ALL_COMMUNITIES  // List all communities (admin-level access)  
UPDATE_COMMUNITY      // Modify community settings (admin/owner level)
DELETE_COMMUNITY      // Delete communities (owner/admin level)
```

### Resource Context
```typescript
@RbacResource({
  type: RbacResourceType.COMMUNITY,
  idKey: 'id',                    // URL parameter containing community ID
  source: ResourceIdSource.PARAM  // Extract from URL parameters
})
```

## Error Handling

### Custom Exceptions
```typescript
// Database constraint violations
if (error.code === 'P2002') {
  throw new ConflictException('Duplicate community name');
}

// Community not found scenarios
throw new NotFoundException('Community not found');
```

### Common Error Scenarios
1. **Duplicate Community Names** - Handled by unique constraint and ConflictException
2. **Community Not Found** - NotFoundException for invalid IDs
3. **Authorization Failures** - Handled by RbacGuard returning 403 Forbidden
4. **Transaction Failures** - Database rollback on community setup failures

## Testing

### Service Tests
- **Location:** `backend/src/community/community.service.spec.ts`
- **Coverage:** Community CRUD operations, transaction handling, integration with channels/roles

```typescript
describe('CommunityService', () => {
  describe('create', () => {
    it('should create community with full setup', async () => {
      const createDto = { name: 'Test Community', description: 'Test' };
      const creatorId = 'user-123';
      
      const community = await service.create(createDto, creatorId);
      
      expect(community.name).toBe(createDto.name);
      expect(mockChannelsService.createDefaultGeneralChannel).toHaveBeenCalled();
      expect(mockRolesService.createDefaultCommunityRoles).toHaveBeenCalled();
    });
    
    it('should handle duplicate name error', async () => {
      mockDatabaseService.$transaction.mockRejectedValue({ code: 'P2002' });
      
      await expect(service.create(createDto, creatorId))
        .rejects.toThrow(ConflictException);
    });
  });
});
```

### Controller Tests
- **Location:** `backend/src/community/community.controller.spec.ts`
- **Coverage:** HTTP endpoint behavior, RBAC integration, DTO validation

## Performance Considerations

- **Transaction Usage:** Atomic community setup prevents partial state inconsistencies
- **Membership Queries:** Filtered queries for user-specific community lists
- **Cascade Deletions:** Database-level cascading for efficient cleanup
- **Unique Constraints:** Database-enforced uniqueness for community names

## Integration Patterns

### Community Creation Flow
```typescript
// 1. User creates community via POST /community
// 2. CommunityService.create() executes transaction:
//    a. Creates community record
//    b. Adds creator membership
//    c. Creates default "general" channel
//    d. Sets up default roles (admin, member)
//    e. Assigns creator as admin
// 3. Returns complete community setup
```

### New Member Integration
```typescript
// When user joins community (via MembershipService):
// 1. Membership record created
// 2. CommunityService.addMemberToGeneralChannel() called
// 3. User automatically added to default general channel
// 4. Default member role assigned (via RolesService)
```

## Common Usage Patterns

### Pattern 1: Community Creation with Setup
```typescript
// Controller automatically passes authenticated user
const community = await this.communityService.create(
  { name: 'Gaming Community', description: 'For gamers' },
  req.user.id
);
// Returns fully configured community with channels and roles
```

### Pattern 2: User Community Listing
```typescript
// Get communities user is a member of
const userCommunities = await this.communityService.findAll(userId);

// Admin view - all communities
const allCommunities = await this.communityService.findAll();
```

### Pattern 3: Community Resource Access
```typescript
@RequiredActions(RbacActions.UPDATE_COMMUNITY)
@RbacResource({ type: RbacResourceType.COMMUNITY, idKey: 'id' })
async updateCommunity(@Param('id') id: string, @Body() data: UpdateCommunityDto) {
  // RBAC automatically validates user has UPDATE_COMMUNITY permission
  // for the specific community identified by 'id'
  return this.communityService.update(id, data);
}
```

## Related Modules

- **Channels Module** - Default channel creation and management
- **Membership Module** - Community membership management
- **Roles Module** - Community role setup and permissions
- **Messages Module** - Community-scoped messaging
- **Auth Module** - Authentication and RBAC enforcement

## Migration Notes

### Community Name Uniqueness
- **Version 1.x:** Community names are globally unique
- **Future:** May implement namespace-based uniqueness (e.g., per-instance)

### Default Setup Evolution
- **Current:** Creates single "general" text channel and basic roles
- **Future:** Configurable default channel/role templates

## Troubleshooting

### Common Issues
1. **Community Creation Failures**
   - **Symptoms:** Transaction rollback, incomplete community setup
   - **Cause:** Dependency service failures (channels, roles)
   - **Solution:** Check channels and roles service availability, review transaction logs

2. **Duplicate Name Errors**
   - **Symptoms:** ConflictException on community creation
   - **Cause:** Community name already exists in database
   - **Solution:** Implement client-side name validation or suggest alternatives

3. **Permission Denied on Community Operations**
   - **Symptoms:** 403 Forbidden responses
   - **Cause:** User lacks required RBAC permissions for community
   - **Solution:** Verify user role assignments and community membership

## Related Documentation

- [Membership Module](membership.md)
- [Channels Module](channels.md)
- [Roles Module](../auth/roles.md)
- [Community API](../../api/community.md)
- [RBAC System](../../features/auth-rbac.md)