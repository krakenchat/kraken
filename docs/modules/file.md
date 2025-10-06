# File Module

> **Location:** `backend/src/file/file.module.ts`
> **Type:** Feature Module
> **Domain:** file management

## Overview

The File module handles secure file retrieval with resource-based access control. It implements a strategy pattern to validate user access based on the file's resource type (e.g., community avatars require membership, message attachments require channel access, user avatars are public).

## Module Structure

```
file/
├── file.module.ts              # Module definition
├── file.service.ts             # File retrieval logic
├── file.controller.ts          # HTTP file serving endpoint
└── file-access/
    ├── file-access.guard.ts    # Access control guard
    └── strategies/
        ├── file-access-strategy.interface.ts
        ├── public-access.strategy.ts
        ├── community-membership.strategy.ts
        ├── message-attachment.strategy.ts
        ├── user-ownership.strategy.ts
        └── community-ownership.strategy.ts
```

## Services

### FileService

**Purpose:** Retrieves file metadata and creates readable streams for file delivery

#### Key Methods

```typescript
class FileService {
  async findOne(id: string): Promise<File> {
    // Retrieves file metadata from database
    // Throws NotFoundException if file doesn't exist or is soft-deleted
  }

  async findByResourceTypeAndId(
    resourceType: ResourceType,
    resourceId: string
  ): Promise<File> {
    // Finds file by resource type and ID (e.g., user's avatar)
  }

  createReadStream(storagePath: string): ReadStream {
    // Creates a stream for efficient file delivery
  }
}
```

#### Database Queries

```typescript
// Find file by ID (excluding soft-deleted)
const file = await this.databaseService.file.findFirst({
  where: {
    id,
    deletedAt: null,
  },
});

// Find by resource type and ID
const file = await this.databaseService.file.findFirst({
  where: {
    resourceType,
    resourceId,
    deletedAt: null,
  },
  orderBy: { uploadedAt: 'desc' },  // Get most recent
});
```

## Controllers

### FileController

**Base Route:** `/api/file`

#### Endpoints

| Method | Endpoint | Description | Auth Required | Access Control |
|--------|----------|-------------|---------------|----------------|
| GET | `/:id` | Stream file contents | ✅ | FileAccessGuard (strategy-based) |

#### File Serving Endpoint

```typescript
@Get(':id')
@UseGuards(JwtAuthGuard, FileAccessGuard)
async getFile(
  @Param('id', ParseObjectIdPipe) id: string,
  @Res({ passthrough: true }) res: Response,
): Promise<StreamableFile> {
  const file = await this.fileService.findOne(id);
  const stream = this.fileService.createReadStream(file.storagePath);

  res.set({
    'Content-Type': file.mimeType,
    'Content-Disposition': `inline; filename="${file.filename}"`,
  });

  return new StreamableFile(stream);
}
```

## File Access Control

### FileAccessGuard

**Purpose:** Validates user access to files based on resource type and ownership/membership

The guard uses a strategy pattern to delegate access validation to resource-specific strategies.

#### Strategy Registry

```typescript
@Injectable()
export class FileAccessGuard implements CanActivate {
  private strategies: Map<ResourceType, IFileAccessStrategy>;

  constructor(
    private databaseService: DatabaseService,
    private membershipService: MembershipService,
    private channelMembershipService: ChannelMembershipService,
  ) {
    this.strategies = this.buildStrategyRegistry();
  }

  private buildStrategyRegistry(): Map<ResourceType, IFileAccessStrategy> {
    return new Map([
      [ResourceType.USER_AVATAR, new PublicAccessStrategy()],
      [ResourceType.USER_BANNER, new PublicAccessStrategy()],
      [ResourceType.COMMUNITY_AVATAR, new CommunityMembershipStrategy(...)],
      [ResourceType.COMMUNITY_BANNER, new CommunityMembershipStrategy(...)],
      [ResourceType.MESSAGE_ATTACHMENT, new MessageAttachmentStrategy(...)],
      [ResourceType.CUSTOM_EMOJI, new CommunityOwnershipStrategy(...)],
    ]);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { id } = request.params;
    const user = request.user;

    // Fetch file metadata
    const file = await this.databaseService.file.findUnique({ where: { id } });

    // Get appropriate strategy
    const strategy = this.strategies.get(file.resourceType);

    // Validate access
    return await strategy.canAccess(user, file);
  }
}
```

### Access Strategies

#### IFileAccessStrategy Interface

```typescript
export interface IFileAccessStrategy {
  canAccess(user: UserEntity, file: File): Promise<boolean>;
}
```

#### PublicAccessStrategy

```typescript
export class PublicAccessStrategy implements IFileAccessStrategy {
  async canAccess(user: UserEntity, file: File): Promise<boolean> {
    return true;  // Anyone can access (avatars, banners)
  }
}
```

#### CommunityMembershipStrategy

```typescript
export class CommunityMembershipStrategy implements IFileAccessStrategy {
  constructor(
    private databaseService: DatabaseService,
    private membershipService: MembershipService,
  ) {}

  async canAccess(user: UserEntity, file: File): Promise<boolean> {
    // User must be a member of the community
    return await this.membershipService.isMember(
      user.id,
      file.resourceId  // communityId
    );
  }
}
```

#### MessageAttachmentStrategy

```typescript
export class MessageAttachmentStrategy implements IFileAccessStrategy {
  constructor(
    private databaseService: DatabaseService,
    private membershipService: MembershipService,
    private channelMembershipService: ChannelMembershipService,
  ) {}

  async canAccess(user: UserEntity, file: File): Promise<boolean> {
    // 1. Get message by ID (file.resourceId)
    const message = await this.databaseService.message.findUnique({
      where: { id: file.resourceId },
    });

    // 2. Check if message is in a channel or DM group
    if (message.channelId) {
      // Channel message: check channel membership
      const channel = await this.databaseService.channel.findUnique({
        where: { id: message.channelId },
      });

      // Check community membership
      const isMember = await this.membershipService.isMember(
        user.id,
        channel.communityId
      );

      if (!isMember) return false;

      // If private channel, check channel-specific membership
      if (channel.isPrivate) {
        return await this.channelMembershipService.isMember(
          user.id,
          message.channelId
        );
      }

      return true;
    }

    // 3. DM group message: check DM group membership
    if (message.directMessageGroupId) {
      const membership = await this.databaseService.directMessageGroupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: message.directMessageGroupId,
            userId: user.id,
          },
        },
      });

      return !!membership;
    }

    return false;
  }
}
```

#### UserOwnershipStrategy

```typescript
export class UserOwnershipStrategy implements IFileAccessStrategy {
  async canAccess(user: UserEntity, file: File): Promise<boolean> {
    // User can only access their own files
    return user.id === file.resourceId;
  }
}
```

#### CommunityOwnershipStrategy

```typescript
export class CommunityOwnershipStrategy implements IFileAccessStrategy {
  constructor(
    private databaseService: DatabaseService,
    private membershipService: MembershipService,
  ) {}

  async canAccess(user: UserEntity, file: File): Promise<boolean> {
    // Check if user is admin/owner of the community
    const community = await this.databaseService.community.findUnique({
      where: { id: file.resourceId },
    });

    // Implementation depends on admin/owner check logic
    return await this.membershipService.isAdmin(user.id, file.resourceId);
  }
}
```

## Dependencies

### Internal Dependencies
- `@/database/database.service` - Database operations
- `@/auth/jwt-auth.guard` - Authentication
- `@/membership/membership.service` - Community membership checks
- `@/channel-membership/channel-membership.service` - Private channel access

### External Dependencies
- `@nestjs/common` - Core decorators, StreamableFile
- `fs` - File system streams
- `express` - Response object for headers

## Authentication & Authorization

### Two-Layer Security

1. **JwtAuthGuard** - Validates user is authenticated
2. **FileAccessGuard** - Validates user can access this specific file

### Access Control Matrix

| Resource Type | Access Rule |
|--------------|-------------|
| `USER_AVATAR` | Public |
| `USER_BANNER` | Public |
| `COMMUNITY_AVATAR` | Community members only |
| `COMMUNITY_BANNER` | Community members only |
| `MESSAGE_ATTACHMENT` | Channel/DM group members only (respects private channels) |
| `CUSTOM_EMOJI` | Community admins/owners only |

## Error Handling

### Custom Exceptions

```typescript
// File not found
throw new NotFoundException('File not found');

// Access denied
throw new ForbiddenException('Access denied to this file');

// File deleted
throw new NotFoundException('File has been deleted');
```

### Error Scenarios

1. **File Not Found** - Invalid ID or soft-deleted file → 404
2. **Access Denied** - User doesn't have permission → 403
3. **Not Authenticated** - Missing/invalid JWT → 401
4. **Invalid Resource Type** - Unknown enum value → 500

## Performance Considerations

- **Streaming:** Uses Node.js streams for efficient large file delivery
- **Single Query:** FileAccessGuard fetches file once, strategies reuse data
- **Caching:** Consider adding Redis cache for file metadata
- **CDN Integration:** Future enhancement for static assets

## Security Considerations

### Path Traversal Prevention
- File paths validated and sanitized by Multer during upload
- Direct file path access not exposed to clients (only IDs)

### Access Control
- Strategy pattern ensures consistent permission checks
- Private channel support prevents unauthorized access
- DM group membership validated before serving attachments

### Content Type Headers
- MIME type set from database (validated during upload)
- `Content-Disposition: inline` for browser rendering
- Future: Add `Content-Security-Policy` headers

## Common Usage Patterns

### Pattern 1: Serving User Avatar

```typescript
// Public access - no membership required
GET /api/file/:fileId
Authorization: Bearer <jwt>

// Returns image with appropriate Content-Type
// Browser renders inline
```

### Pattern 2: Serving Message Attachment

```typescript
// Requires:
// 1. User is authenticated
// 2. User is member of community
// 3. If private channel, user has channel membership

GET /api/file/:fileId
Authorization: Bearer <jwt>

// FileAccessGuard validates all conditions
// Returns file if all checks pass
```

### Pattern 3: Community Emoji Access

```typescript
// Requires user to be admin/owner of community
GET /api/file/:fileId
Authorization: Bearer <jwt>

// CommunityOwnershipStrategy validates admin status
```

## Related Modules

- **FileUpload Module** - Creates files with metadata
- **Messages Module** - References files in attachments[]
- **User Module** - References avatarUrl and bannerUrl
- **Community Module** - References community avatars/banners
- **Membership Module** - Validates community access
- **ChannelMembership Module** - Validates private channel access

## Troubleshooting

### Common Issues

1. **403 Forbidden on public files**
   - **Symptoms:** User gets 403 trying to view avatar
   - **Cause:** Wrong strategy assigned to resource type
   - **Solution:** Verify strategy registry maps resource type correctly

2. **Files download instead of displaying**
   - **Symptoms:** Browser downloads image instead of showing it
   - **Cause:** Wrong Content-Disposition header
   - **Solution:** Ensure `inline` disposition, check MIME type

3. **Slow file serving**
   - **Symptoms:** Large files take long to load
   - **Cause:** Not using streaming or inefficient access checks
   - **Solution:** Verify StreamableFile usage, optimize strategy queries

## Related Documentation

- [File Upload Module](./file-upload.md) - Upload and validation
- [File Access Strategies](../api/file-access-strategies.md) - Strategy details
- [Messages Module](./messages.md) - Attachment integration
- [Database Schema](../architecture/database.md#file) - File model
