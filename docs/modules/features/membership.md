# Membership Module

> **Location:** `backend/src/membership/membership.module.ts`  
> **Type:** Feature Module  
> **Domain:** community membership management

## Overview

The Membership Module manages user memberships within communities in the Kraken application. It provides comprehensive functionality for joining/leaving communities, member management, and automatic integration with channel access and role assignments. The module ensures data consistency by handling cascading deletions of channel memberships and role assignments when users leave communities.

## Module Structure

```
membership/
├── membership.module.ts          # Module definition
├── membership.service.ts         # Core membership business logic  
├── membership.controller.ts      # HTTP endpoints with RBAC protection
├── membership.service.spec.ts    # Service unit tests
├── membership.controller.spec.ts # Controller unit tests
├── dto/
│   ├── create-membership.dto.ts  # Membership creation DTO
│   ├── update-membership.dto.ts  # Membership update DTO
│   └── membership-response.dto.ts # Membership response DTO
└── entities/
    └── membership.entity.ts      # Membership entity definition
```

## Services

### MembershipService

**Purpose:** Manages community membership lifecycle, automatic channel integration, and cascading cleanup operations.

#### Key Methods

```typescript
class MembershipService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly communityService: CommunityService,
  ) {}

  // Core membership operations
  async create(createMembershipDto: CreateMembershipDto): Promise<MembershipResponseDto> {
    // Creates membership with validation and automatic integrations:
    // 1. Validates user and community existence
    // 2. Checks for duplicate membership
    // 3. Creates membership record
    // 4. Adds user to general channel automatically
    // 5. Graceful error handling for channel integration
  }

  async findAllForCommunity(communityId: string): Promise<MembershipResponseDto[]> {
    // Returns all members of a specific community
    // Includes user details via database relations
  }

  async findAllForUser(userId: string): Promise<MembershipResponseDto[]> {
    // Returns all communities a user is a member of
    // Includes community details for user's dashboard
  }

  async findOne(userId: string, communityId: string): Promise<MembershipResponseDto> {
    // Retrieves specific membership record
    // Uses compound unique key for efficient lookup
  }

  async remove(userId: string, communityId: string): Promise<void> {
    // Atomically removes membership and all related data:
    // 1. Validates membership exists
    // 2. Removes all channel memberships in community
    // 3. Removes all community role assignments
    // 4. Removes base membership record
    // Uses database transaction for consistency
  }

  // Helper methods
  async isMember(userId: string, communityId: string): Promise<boolean> {
    // Quick membership validation for authorization checks
    // Returns boolean without throwing exceptions
  }
}
```

#### Membership Creation with Integration

```typescript
async create(createMembershipDto: CreateMembershipDto): Promise<MembershipResponseDto> {
  const { userId, communityId } = createMembershipDto;

  // Multi-step validation process
  await this.databaseService.community.findUniqueOrThrow({ where: { id: communityId } });
  await this.databaseService.user.findUniqueOrThrow({ where: { id: userId } });

  // Check for existing membership
  const existingMembership = await this.databaseService.membership.findUnique({
    where: { userId_communityId: { userId, communityId } }
  });

  if (existingMembership) {
    throw new ConflictException('User is already a member of this community');
  }

  // Create membership
  const membership = await this.databaseService.membership.create({
    data: { userId, communityId }
  });

  // Automatic general channel integration (graceful failure)
  try {
    await this.communityService.addMemberToGeneralChannel(communityId, userId);
  } catch (error) {
    this.logger.warn('Failed to add user to general channel', error);
    // Don't fail membership creation for this
  }

  return new MembershipResponseDto(membership);
}
```

#### Cascading Membership Removal

```typescript
async remove(userId: string, communityId: string): Promise<void> {
  await this.databaseService.$transaction(async (tx) => {
    // 1. Remove all channel memberships in this community
    await tx.channelMembership.deleteMany({
      where: {
        userId,
        channel: { communityId }
      }
    });

    // 2. Remove all community role assignments
    await tx.userRoles.deleteMany({
      where: { userId, communityId }
    });

    // 3. Remove the base membership
    await tx.membership.delete({
      where: { userId_communityId: { userId, communityId } }
    });
  });
}
```

## Controllers

### MembershipController

**Base Route:** `/api/membership`

#### Endpoints

| Method | Endpoint | Description | Auth Required | RBAC Actions |
|--------|----------|-------------|---------------|--------------|
| POST | `/` | Create membership (join community) | ✅ | `CREATE_MEMBER` |
| GET | `/community/:communityId` | List community members | ✅ | `READ_MEMBER` |
| GET | `/user/:userId` | List user's memberships | ✅ | `READ_MEMBER` |
| GET | `/my` | List current user's memberships | ✅ | `READ_MEMBER` |
| GET | `/community/:communityId/user/:userId` | Get specific membership | ✅ | `READ_MEMBER` |
| DELETE | `/community/:communityId/user/:userId` | Remove member (admin) | ✅ | `DELETE_MEMBER` |
| DELETE | `/leave/:communityId` | Leave community (self) | ✅ | None |

#### Example Endpoint Implementation

```typescript
@Post()
@HttpCode(201)
@RequiredActions(RbacActions.CREATE_MEMBER)
@RbacResource({
  type: RbacResourceType.COMMUNITY,
  idKey: 'communityId',
  source: ResourceIdSource.BODY,
})
create(@Body() createMembershipDto: CreateMembershipDto): Promise<MembershipResponseDto> {
  return this.membershipService.create(createMembershipDto);
}

@Get('/user/:userId')
@RequiredActions(RbacActions.READ_MEMBER)
findAllForUser(
  @Param('userId', ParseObjectIdPipe) userId: string,
  @Req() req: { user: UserEntity },
): Promise<MembershipResponseDto[]> {
  // Privacy protection - users can only view their own memberships
  if (userId !== req.user.id) {
    throw new ForbiddenException('Cannot view other users memberships');
  }
  return this.membershipService.findAllForUser(userId);
}
```

#### Self-Service vs Admin Operations

```typescript
// Self-service: leave community (no RBAC required)
@Delete('/leave/:communityId')
@HttpCode(204)
leaveCommunity(
  @Param('communityId', ParseObjectIdPipe) communityId: string,
  @Req() req: { user: UserEntity },
): Promise<void> {
  return this.membershipService.remove(req.user.id, communityId);
}

// Admin operation: remove member (requires DELETE_MEMBER permission)
@Delete('/community/:communityId/user/:userId')
@HttpCode(204)
@RequiredActions(RbacActions.DELETE_MEMBER)
@RbacResource({
  type: RbacResourceType.COMMUNITY,
  idKey: 'communityId',
  source: ResourceIdSource.PARAM,
})
remove(
  @Param('userId', ParseObjectIdPipe) userId: string,
  @Param('communityId', ParseObjectIdPipe) communityId: string,
): Promise<void> {
  return this.membershipService.remove(userId, communityId);
}
```

## DTOs (Data Transfer Objects)

### CreateMembershipDto

```typescript
export class CreateMembershipDto {
  @IsString()
  @IsNotEmpty()
  userId: string;           // User joining the community
  
  @IsString()
  @IsNotEmpty()
  communityId: string;      // Community being joined
}
```

### MembershipResponseDto

```typescript
export class MembershipResponseDto {
  id: string;               // Membership record ID
  userId: string;           // Member user ID
  communityId: string;      // Community ID
  joinedAt: Date;          // Timestamp of membership creation
  
  // Optional included relations
  user?: {                 // User details (when included)
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
  };
  
  community?: {            // Community details (when included)
    id: string;
    name: string;
    description?: string;
    avatar?: string;
  };
  
  constructor(membership: Membership & { user?: User; community?: Community }) {
    // Transforms database record to response format
    // Selectively includes relations based on query
  }
}
```

## Database Schema

### Membership Model

```prisma
model Membership {
  id          String    @id @default(auto()) @map("_id") @db.ObjectId
  userId      String    @db.ObjectId
  communityId String    @db.ObjectId
  joinedAt    DateTime  @default(now())
  
  // Relations
  user        User      @relation("UserMemberships", fields: [userId], references: [id])
  community   Community @relation("CommunityMemberships", fields: [communityId], references: [id])
  
  // Constraints
  @@unique([userId, communityId])  // One membership per user per community
  @@map("memberships")
}
```

### Related Schema Impact

```prisma
// User model - one-to-many memberships
model User {
  memberships Membership[] @relation("UserMemberships")
  // ... other fields
}

// Community model - one-to-many memberships  
model Community {
  memberships Membership[] @relation("CommunityMemberships")
  // ... other fields
}

// Channel membership - cascade deleted when community membership removed
model ChannelMembership {
  userId    String @db.ObjectId
  channelId String @db.ObjectId
  // Automatically deleted via transaction when user leaves community
}

// User roles - cascade deleted when community membership removed
model UserRoles {
  userId      String  @db.ObjectId
  communityId String? @db.ObjectId
  // Automatically deleted via transaction when user leaves community
}
```

## Dependencies

### Internal Dependencies
- `@/database/database.module` - Database operations via Prisma
- `@/community/community.module` - General channel integration
- `@/auth/auth.module` - Authentication and RBAC protection

### External Dependencies
- `@nestjs/common` - NestJS decorators and exceptions
- `nestjs-object-id` - MongoDB ObjectId validation pipes
- `class-validator` - DTO validation decorators
- `class-transformer` - DTO serialization control

## Authentication & Authorization

### Guards Used
- `JwtAuthGuard` - Ensures user authentication
- `RbacGuard` - Enforces role-based access control

### RBAC Permissions

```typescript
// Membership management permissions
CREATE_MEMBER    // Add members to communities (typically admin/moderator)
READ_MEMBER      // View membership information
DELETE_MEMBER    // Remove members from communities (admin/moderator)
UPDATE_MEMBER    // Modify membership details (planned)
```

### Resource Context

```typescript
// Community-scoped membership operations
@RbacResource({
  type: RbacResourceType.COMMUNITY,
  idKey: 'communityId',
  source: ResourceIdSource.BODY | ResourceIdSource.PARAM
})
```

### Privacy Controls

```typescript
// Users can only view their own membership lists
if (userId !== req.user.id) {
  throw new ForbiddenException('Cannot view other users memberships');
}

// Alternative: convenience endpoint for current user
@Get('/my')
findMyMemberships(@Req() req: { user: UserEntity }) {
  return this.membershipService.findAllForUser(req.user.id);
}
```

## Integration with Other Modules

### Community Module Integration
```typescript
// Automatic general channel access on join
await this.communityService.addMemberToGeneralChannel(communityId, userId);

// Graceful handling if general channel access fails
// Membership creation succeeds even if channel integration fails
```

### Channel Module Integration
```typescript
// Cascading deletion of channel memberships
await tx.channelMembership.deleteMany({
  where: {
    userId,
    channel: { communityId }  // All channels in the community
  }
});
```

### Roles Module Integration
```typescript
// Cascading deletion of community role assignments
await tx.userRoles.deleteMany({
  where: { userId, communityId }
});
```

## Error Handling

### Custom Exception Scenarios
```typescript
// Duplicate membership prevention
if (existingMembership) {
  throw new ConflictException('User is already a member of this community');
}

// Entity validation
if (prismaError.code === 'P2025') {
  throw new NotFoundException('User or community not found');
}

// Database constraint violations
if (prismaError.code === 'P2002') {
  throw new ConflictException('User is already a member of this community');
}
```

### Graceful Integration Failures
```typescript
// General channel integration doesn't break membership creation
try {
  await this.communityService.addMemberToGeneralChannel(communityId, userId);
} catch (error) {
  this.logger.warn('Failed to add user to general channel', error);
  // Continue with successful membership creation
}
```

## Performance Considerations

- **Compound Unique Index:** Efficient lookups using (userId, communityId) composite key
- **Cascading Deletions:** Single transaction removes all related data efficiently
- **Selective Includes:** Only load user/community relations when needed
- **Membership Validation:** Quick boolean checks for authorization without exceptions

## Testing

### Service Tests
```typescript
describe('MembershipService', () => {
  describe('create', () => {
    it('should create membership and add to general channel', async () => {
      const membershipDto = { userId: 'user-123', communityId: 'community-456' };
      
      const membership = await service.create(membershipDto);
      
      expect(membership.userId).toBe('user-123');
      expect(membership.communityId).toBe('community-456');
      expect(mockCommunityService.addMemberToGeneralChannel).toHaveBeenCalled();
    });
    
    it('should handle duplicate membership', async () => {
      mockDatabaseService.membership.findUnique.mockResolvedValue({ id: 'existing' });
      
      await expect(service.create(membershipDto))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should cascade delete all related memberships and roles', async () => {
      await service.remove('user-123', 'community-456');
      
      expect(mockTransaction).toHaveBeenCalled();
      expect(mockChannelMembershipDeleteMany).toHaveBeenCalled();
      expect(mockUserRolesDeleteMany).toHaveBeenCalled();
      expect(mockMembershipDelete).toHaveBeenCalled();
    });
  });
});
```

### Controller Tests  
```typescript
describe('MembershipController', () => {
  describe('findAllForUser', () => {
    it('should allow users to view own memberships', async () => {
      const memberships = await controller.findAllForUser('user-123', { user: { id: 'user-123' } });
      expect(memberships).toBeDefined();
    });
    
    it('should forbid viewing other users memberships', async () => {
      await expect(
        controller.findAllForUser('user-456', { user: { id: 'user-123' } })
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
```

## Common Usage Patterns

### Pattern 1: User Joining Community
```typescript
// User joins community (requires invitation or public access)
const membership = await membershipService.create({
  userId: 'user-123',
  communityId: 'community-456'
});

// User automatically gains:
// - Base community membership
// - Access to general channel  
// - Default member role (if configured)
```

### Pattern 2: Community Member Management
```typescript
// Get all community members for admin dashboard
const members = await membershipService.findAllForCommunity('community-456');

// Response includes user details for display
members.forEach(member => {
  console.log(`${member.user.username} joined ${member.joinedAt}`);
});
```

### Pattern 3: User Community Dashboard
```typescript
// Get all communities user belongs to
const userMemberships = await membershipService.findAllForUser('user-123');

// Response includes community details for navigation
userMemberships.forEach(membership => {
  console.log(`Member of ${membership.community.name}`);
});
```

### Pattern 4: Graceful Community Leaving
```typescript
// User leaves community - all data cleaned up
await membershipService.remove('user-123', 'community-456');

// Automatically removes:
// - All channel memberships in community
// - All community role assignments  
// - Base community membership
// User loses all access to community resources
```

## Related Modules

- **Community Module** - Community context and general channel integration
- **Channels Module** - Channel membership lifecycle
- **Roles Module** - Community role assignment management
- **Auth Module** - Authentication and authorization enforcement
- **User Module** - User data and validation

## Migration Notes

### Membership Model Evolution
- **Version 1.x:** Basic user-community relationship
- **Future:** Enhanced membership with roles, permissions, join methods

### Channel Integration
- **Current:** Automatic general channel membership
- **Future:** Configurable default channel sets per community

## Troubleshooting

### Common Issues
1. **Membership Creation Failures**
   - **Symptoms:** ConflictException on duplicate membership
   - **Cause:** User already member or database constraint violation
   - **Solution:** Check existing membership before creation

2. **General Channel Integration Failures**
   - **Symptoms:** Membership created but user not in general channel
   - **Cause:** General channel not found or channel service unavailable
   - **Solution:** Check community default channel setup

3. **Cascading Deletion Issues**
   - **Symptoms:** Membership removal fails with constraint errors
   - **Cause:** Related data (roles, channel memberships) not properly cleaned up
   - **Solution:** Verify transaction handling and related entity cleanup

4. **Permission Denied on Member Operations**
   - **Symptoms:** 403 Forbidden on membership operations
   - **Cause:** User lacks required community permissions
   - **Solution:** Verify user has appropriate community role and permissions

## Related Documentation

- [Community Module](community.md)
- [Channels Module](channels.md)
- [Channel Membership Module](channel-membership.md)
- [Roles Module](../auth/roles.md)
- [Membership API](../../api/membership.md)
- [RBAC System](../../features/auth-rbac.md)