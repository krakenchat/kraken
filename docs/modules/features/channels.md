# Channels Module

> **Location:** `backend/src/channels/channels.module.ts`  
> **Type:** Feature Module  
> **Domain:** channel management

## Overview

The Channels Module manages text and voice channels within communities in the Kraken application. It provides comprehensive channel lifecycle management, automatic membership handling, and supports both public and private channels. This module is tightly integrated with the LiveKit system for voice/video functionality and includes special handling for default "general" channels that are automatically created with new communities.

## Module Structure

```
channels/
├── channels.module.ts          # Module definition
├── channels.service.ts         # Core channel operations and business logic
├── channels.controller.ts      # HTTP endpoints with RBAC protection
├── channels.service.spec.ts    # Service unit tests
├── channels.controller.spec.ts # Controller unit tests
├── dto/
│   ├── create-channel.dto.ts   # Channel creation DTO with validation
│   └── update-channel.dto.ts   # Channel update DTO
└── entities/
    └── channel.entity.ts       # Channel entity definition
```

## Services

### ChannelsService

**Purpose:** Manages channel lifecycle operations, membership handling, and integration with community setup workflows.

#### Key Methods

```typescript
class ChannelsService {
  constructor(private readonly databaseService: DatabaseService) {}

  // Core CRUD operations
  async create(createChannelDto: CreateChannelDto, user: UserEntity): Promise<Channel> {
    // Atomically creates channel and adds creator as member
    // Handles duplicate name conflicts within community scope
  }
  
  findAll(communityId: string): Promise<Channel[]> {
    // Returns all channels for a specific community
    // No user filtering - access control handled at API level
  }
  
  async findOne(id: string): Promise<Channel> {
    // Retrieves single channel by ID with error handling
  }
  
  async update(id: string, updateChannelDto: UpdateChannelDto): Promise<Channel> {
    // Updates channel metadata with conflict detection
  }
  
  remove(id: string): Promise<Channel> {
    // Deletes channel (memberships cascade deleted via DB constraints)
  }

  // Special integration methods
  async createDefaultGeneralChannel(
    communityId: string, 
    userId: string, 
    tx?: Prisma.TransactionClient
  ): Promise<Channel> {
    // Creates default "general" text channel during community setup
    // Automatically adds creator as member
    // Used by CommunityService during community creation
  }
  
  async addUserToGeneralChannel(communityId: string, userId: string): Promise<void> {
    // Adds new community member to default general channel
    // Includes duplicate membership checking
    // Called when users join communities
  }
}
```

#### Database Transaction Usage

```typescript
// Channel creation with membership
const result = await this.databaseService.$transaction(async (prisma) => {
  // 1. Create the channel
  const channel = await prisma.channel.create({
    data: createChannelDto
  });
  
  // 2. Add creator as member
  await prisma.channelMembership.create({
    data: {
      userId: user.id,
      channelId: channel.id
    }
  });
  
  return channel;
});
```

#### Error Handling Patterns

```typescript
// Duplicate channel name handling
catch (error) {
  if (error.code === 'P2002') {
    throw new ConflictException(
      'Channel with this name already exists in the community'
    );
  }
  throw error;
}
```

## Controllers

### ChannelsController

**Base Route:** `/api/channels`

#### Endpoints

| Method | Endpoint | Description | Auth Required | RBAC Actions |
|--------|----------|-------------|---------------|--------------|
| POST | `/` | Create new channel | ✅ | `CREATE_CHANNEL` |
| GET | `/community/:communityId` | List channels in community | ✅ | `READ_CHANNEL` |
| GET | `/:id` | Get channel by ID | ✅ | `READ_CHANNEL` |
| PATCH | `/:id` | Update channel | ✅ | `UPDATE_CHANNEL` |
| DELETE | `/:id` | Delete channel | ✅ | `DELETE_CHANNEL` |

#### Example Endpoint Implementation

```typescript
@Post()
@HttpCode(201)
@RequiredActions(RbacActions.CREATE_CHANNEL)
@RbacResource({ 
  type: RbacResourceType.COMMUNITY, 
  idKey: 'communityId',
  source: ResourceIdSource.BODY 
})
create(
  @Body() createChannelDto: CreateChannelDto,
  @Req() req: { user: UserEntity },
) {
  return this.channelsService.create(createChannelDto, req.user);
}

@Get(':id')
@RequiredActions(RbacActions.READ_CHANNEL)
@RbacResource({ 
  type: RbacResourceType.CHANNEL, 
  idKey: 'id',
  source: ResourceIdSource.PARAM 
})
findOne(@Param('id', ParseObjectIdPipe) id: string) {
  return this.channelsService.findOne(id);
}
```

## DTOs (Data Transfer Objects)

### CreateChannelDto

```typescript
export class CreateChannelDto implements Channel {
  @IsString()
  @IsNotEmpty()
  name: string;                    // Channel name (unique within community)
  
  @IsString()
  @IsNotEmpty()
  communityId: string;            // Parent community ID
  
  @IsEnum($Enums.ChannelType)
  type: $Enums.ChannelType;       // TEXT or VOICE
  
  @IsBoolean()
  @IsNotEmpty()
  isPrivate: boolean;             // Private channels require explicit membership
  
  @Exclude()
  id: string;                     // Generated by database
  
  @Exclude()
  createdAt: Date;               // Managed by database
}
```

### UpdateChannelDto

```typescript
export class UpdateChannelDto extends PartialType(CreateChannelDto) {
  // All fields from CreateChannelDto made optional
  // name?: string;
  // type?: ChannelType;
  // isPrivate?: boolean;
  // Note: communityId typically not updated after creation
}
```

### Validation Rules

```typescript
// Channel name validation
@IsString()
@IsNotEmpty()
name: string;  // Required, non-empty string

// Channel type validation  
@IsEnum($Enums.ChannelType)
type: $Enums.ChannelType;  // Must be 'TEXT' or 'VOICE'

// Privacy setting validation
@IsBoolean()
@IsNotEmpty()
isPrivate: boolean;  // Explicit boolean required
```

## Database Schema

### Channel Model

```prisma
model Channel {
  id          String      @id @default(auto()) @map("_id") @db.ObjectId
  name        String                          // Channel name
  communityId String      @db.ObjectId        // Parent community
  type        ChannelType @default(TEXT)      // TEXT or VOICE
  isPrivate   Boolean     @default(false)     // Private channel flag
  createdAt   DateTime    @default(now())
  
  // Relations
  community         Community           @relation(fields: [communityId], references: [id], onDelete: Cascade)
  messages          Message[]           // Channel messages
  channelMembership ChannelMembership[] @relation("ChannelMembership")
  
  // Constraints
  @@unique([communityId, name])  // Unique name within community
  @@map("channels")
}

enum ChannelType {
  TEXT   // Text-based messaging channels
  VOICE  // Voice/video channels (integrated with LiveKit)
}
```

### Channel Membership Model

```prisma
model ChannelMembership {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  userId    String   @db.ObjectId
  channelId String   @db.ObjectId
  joinedAt  DateTime @default(now())
  addedBy   String?  @db.ObjectId        // Who added this user (for private channels)
  
  // Relations
  user    User    @relation("UserChannelMemberships", fields: [userId], references: [id], onDelete: Cascade)
  channel Channel @relation("ChannelMembership", fields: [channelId], references: [id], onDelete: Cascade)
  
  @@unique([userId, channelId])  // One membership per user per channel
}
```

## Dependencies

### Internal Dependencies
- `@/database/database.module` - Database operations via Prisma
- `@/auth/auth.module` - JWT authentication and RBAC guards

### External Dependencies
- `@nestjs/common` - NestJS decorators and exceptions
- `@nestjs/mapped-types` - DTO inheritance utilities
- `nestjs-object-id` - MongoDB ObjectId validation pipes
- `class-validator` - DTO validation decorators
- `class-transformer` - DTO serialization control

## Authentication & Authorization

### Guards Used
- `JwtAuthGuard` - Ensures user authentication for all endpoints
- `RbacGuard` - Enforces role-based access control

### RBAC Permissions

```typescript
// Channel management permissions
CREATE_CHANNEL    // Create channels in communities
READ_CHANNEL      // View channel details and content  
UPDATE_CHANNEL    // Modify channel settings
DELETE_CHANNEL    // Delete channels
JOIN_CHANNEL      // Join private channels (planned)
```

### Resource Context Patterns

```typescript
// Community-scoped channel creation
@RbacResource({ 
  type: RbacResourceType.COMMUNITY, 
  idKey: 'communityId',
  source: ResourceIdSource.BODY 
})

// Channel-specific operations
@RbacResource({ 
  type: RbacResourceType.CHANNEL, 
  idKey: 'id',
  source: ResourceIdSource.PARAM 
})
```

## Channel Types & Functionality

### Text Channels
```typescript
{
  type: ChannelType.TEXT,
  // Used for:
  // - Real-time messaging via WebSocket
  // - Message history storage
  // - File attachments
  // - Message reactions
  // - User mentions and formatting
}
```

### Voice Channels  
```typescript
{
  type: ChannelType.VOICE,
  // Used for:
  // - Voice/video calls via LiveKit
  // - Screen sharing
  // - Channel ID serves as LiveKit room ID
  // - Persistent connection across page navigation
  // - User presence tracking
}
```

### Private vs Public Channels
```typescript
// Public channels (isPrivate: false)
// - All community members can see and join
// - Automatic membership for general channels
// - Standard RBAC permissions apply

// Private channels (isPrivate: true)  
// - Explicit membership required
// - Managed via ChannelMembership module
// - Additional JOIN_CHANNEL permission required
```

## Integration with Other Modules

### Community Module Integration
```typescript
// During community creation:
await this.channelsService.createDefaultGeneralChannel(
  communityId, 
  creatorId, 
  tx
);

// When user joins community:
await this.communityService.addMemberToGeneralChannel(
  communityId, 
  userId
);
```

### LiveKit Integration (Voice Channels)
```typescript
// Voice channels use channel ID as LiveKit room ID
const livekitRoomId = voiceChannel.id;

// Users join voice channels through LiveKit service
// Channel provides the room context for voice/video
```

### Message Module Integration
```typescript
// Messages belong to channels
const messages = await messagesService.findByChannel(channelId);

// Channel deletion cascades to messages via database constraints
```

## Error Handling

### Custom Exception Scenarios
```typescript
// Duplicate channel name in community
if (error.code === 'P2002') {
  throw new ConflictException(
    'Channel with this name already exists in the community'
  );
}

// Channel not found
throw new NotFoundException('Channel not found');

// General channel operations (graceful handling)
// Errors in general channel operations don't break membership creation
```

### Database Constraint Handling
```typescript
// Unique constraint: community + name
@@unique([communityId, name])

// Cascade deletions:
// Community deleted → channels deleted → memberships deleted → messages deleted
```

## Testing

### Service Tests
- **Location:** `backend/src/channels/channels.service.spec.ts`
- **Coverage:** CRUD operations, default channel creation, membership handling

```typescript
describe('ChannelsService', () => {
  describe('create', () => {
    it('should create channel and add creator as member', async () => {
      const createDto = {
        name: 'test-channel',
        communityId: 'community-123',
        type: ChannelType.TEXT,
        isPrivate: false
      };
      
      const channel = await service.create(createDto, mockUser);
      
      expect(channel.name).toBe('test-channel');
      expect(mockTransaction).toHaveBeenCalled();
    });
  });

  describe('createDefaultGeneralChannel', () => {
    it('should create general channel with creator membership', async () => {
      const channel = await service.createDefaultGeneralChannel(
        'community-123', 
        'user-123'
      );
      
      expect(channel.name).toBe('general');
      expect(channel.type).toBe(ChannelType.TEXT);
      expect(channel.isPrivate).toBe(false);
    });
  });
});
```

### Controller Tests
- **Location:** `backend/src/channels/channels.controller.spec.ts`
- **Coverage:** HTTP endpoints, RBAC integration, DTO validation

## Performance Considerations

- **Community-scoped Queries:** Channels queries filtered by communityId for efficiency
- **Transaction Usage:** Atomic channel + membership creation prevents inconsistent state
- **Cascade Deletions:** Database-level cascading for efficient cleanup
- **Index Strategy:** Compound unique index on (communityId, name) for fast lookups

## Common Usage Patterns

### Pattern 1: Channel Creation with Automatic Membership
```typescript
// User creates channel → automatically becomes member
const channel = await channelsService.create({
  name: 'announcements',
  communityId: 'community-123', 
  type: ChannelType.TEXT,
  isPrivate: false
}, user);
```

### Pattern 2: Community Channel Listing
```typescript
// Get all channels for community (respects private channel visibility)
const channels = await channelsService.findAll(communityId);
```

### Pattern 3: Voice Channel for LiveKit
```typescript
// Voice channel creation
const voiceChannel = await channelsService.create({
  name: 'Voice Chat',
  communityId: communityId,
  type: ChannelType.VOICE,
  isPrivate: false
}, user);

// Channel ID becomes LiveKit room ID
const livekitRoom = voiceChannel.id;
```

### Pattern 4: Default Channel Setup (Internal)
```typescript
// Called during community creation
await channelsService.createDefaultGeneralChannel(
  communityId, 
  creatorId, 
  transaction  // Reuses existing transaction
);
```

## Related Modules

- **Community Module** - Parent community relationship and default channel creation
- **Messages Module** - Channel-based message storage and retrieval
- **Channel Membership Module** - Private channel access control
- **LiveKit Module** - Voice/video functionality for VOICE channels
- **Auth Module** - Authentication and RBAC enforcement

## Migration Notes

### Channel Types Evolution
- **Version 1.x:** Basic TEXT and VOICE channel support
- **Future:** Potential for additional channel types (FORUM, ANNOUNCEMENT, etc.)

### Private Channel Access
- **Current:** Basic private channel flag support
- **In Development:** Full private channel membership management via ChannelMembership module

## Troubleshooting

### Common Issues
1. **Duplicate Channel Names**
   - **Symptoms:** ConflictException during creation/update
   - **Cause:** Channel name already exists within the same community
   - **Solution:** Enforce unique naming at client level or suggest alternatives

2. **General Channel Creation Failures**
   - **Symptoms:** Community creation partially succeeds but general channel missing
   - **Cause:** Transaction rollback in default channel creation
   - **Solution:** Check database constraints and transaction handling

3. **Voice Channel LiveKit Integration**
   - **Symptoms:** Users cannot join voice channels
   - **Cause:** LiveKit service unavailable or misconfigured
   - **Solution:** Verify LiveKit module configuration and service health

4. **Channel Access Permissions**
   - **Symptoms:** 403 Forbidden on channel operations
   - **Cause:** User lacks required RBAC permissions
   - **Solution:** Verify community membership and role assignments

## Related Documentation

- [Channel Membership Module](channel-membership.md)
- [Messages Module](messages.md)
- [LiveKit Module](../voice/livekit.md)
- [Community Module](community.md)
- [Channels API](../../api/channels.md)
- [RBAC System](../../features/auth-rbac.md)