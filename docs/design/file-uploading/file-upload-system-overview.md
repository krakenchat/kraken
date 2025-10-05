# File Upload System - Backend Implementation Overview

## Project Goals

Implement a comprehensive file upload system for the Kraken chat application backend that provides:

1. **Message Attachments**: Permission-controlled file uploads attached to messages
2. **User Assets**: Avatars and banners for user profiles
3. **Community Assets**: Community banners, avatars, and custom emojis
4. **Security & Access Control**: Robust permission checking and file validation
5. **File Management**: Efficient storage, retrieval, and cleanup
6. **Future Extensibility**: Easy migration to cloud storage (S3, Azure Blob)

## Backend Architecture

### Module Structure

```
backend/src/
├── files/                      # Core file management module
│   ├── files.controller.ts     # Upload & download endpoints
│   ├── files.service.ts        # File business logic
│   ├── files.module.ts         # File module configuration
│   ├── dto/
│   │   ├── upload-file.dto.ts  # File upload validation
│   │   └── file-metadata.dto.ts # File info responses
│   ├── guards/
│   │   └── file-access.guard.ts # Permission checking
│   └── processors/
│       ├── file-validator.service.ts # File validation & security
│       └── metadata-extractor.service.ts # File metadata extraction
└── storage/                    # File storage abstraction
    ├── storage.interface.ts    # Storage abstraction interface
    ├── local-storage.service.ts # Local filesystem storage
    └── storage.module.ts       # Dynamic storage provider
```

## Database Schema Design

### Junction Table Approach

Using separate junction tables for each file relationship type to maintain clear separation of concerns and allow for relationship-specific metadata.

```prisma
model File {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  filename    String   // Original filename
  storedName  String   // UUID-based stored filename
  mimeType    String   // MIME type (image/jpeg, etc.)
  size        Int      // File size in bytes
  checksum    String   // SHA-256 hash for integrity
  uploadedBy  String?  @db.ObjectId // Nullable if user deleted
  uploadedAt  DateTime @default(now())
  deletedAt   DateTime? // Soft delete

  // Storage configuration
  storageType StorageType @default(LOCAL)
  storagePath String      // Local path or cloud key

  // Thumbnail configuration (for images)
  thumbnailPath      String?  // Path to thumbnail directory
  thumbnailGenerated Boolean  @default(false)
  thumbnailError     String?  // Error message if generation failed
  thumbnailSizes     Json?    // { small: "150px", medium: "400px", large: "800px" }

  // Relations
  uploader           User?               @relation("UploadedFiles", fields: [uploadedBy], references: [id], onDelete: SetNull)
  messageAttachments MessageAttachment[]
  userFiles          UserFile[]
  communityFiles     CommunityFile[]

  @@index([uploadedBy])
  @@index([uploadedAt])
  @@index([thumbnailGenerated]) // For cron job to find pending thumbnails
}

model MessageAttachment {
  id        String  @id @default(auto()) @map("_id") @db.ObjectId
  messageId String  @db.ObjectId
  fileId    String  @db.ObjectId

  message   Message @relation(fields: [messageId], references: [id], onDelete: Cascade)
  file      File    @relation(fields: [fileId], references: [id], onDelete: Cascade)

  @@unique([messageId, fileId])
}

model UserFile {
  id     String       @id @default(auto()) @map("_id") @db.ObjectId
  userId String       @db.ObjectId
  fileId String       @db.ObjectId
  type   UserFileType // AVATAR, BANNER

  user   User         @relation("UserFiles", fields: [userId], references: [id], onDelete: Cascade)
  file   File         @relation(fields: [fileId], references: [id], onDelete: Cascade)

  @@unique([userId, type]) // Only one avatar per user, etc.
}

model CommunityFile {
  id          String            @id @default(auto()) @map("_id") @db.ObjectId
  communityId String            @db.ObjectId
  fileId      String            @db.ObjectId
  type        CommunityFileType // BANNER, AVATAR, EMOJI
  name        String?           // For custom emojis (required for EMOJI type)

  community   Community         @relation(fields: [communityId], references: [id], onDelete: Cascade)
  file        File             @relation(fields: [fileId], references: [id], onDelete: Cascade)

  @@index([communityId, type])
}

enum StorageType {
  LOCAL
  S3
  AZURE_BLOB
}

enum UserFileType {
  AVATAR
  BANNER
}

enum CommunityFileType {
  BANNER
  AVATAR
  EMOJI
}
```

### Schema Updates to Existing Models

```prisma
model Message {
  // ... existing fields
  attachments MessageAttachment[]
}

model User {
  // ... existing fields
  uploadedFiles File[] @relation("UploadedFiles")
  userFiles     UserFile[] @relation("UserFiles")
}

model Community {
  // ... existing fields
  files CommunityFile[]
}
```

## Access Control Strategy

### Authentication Requirements

**ALL file endpoints require authentication with a valid JWT token and instance membership verification.** This includes files that are "publicly viewable" within the instance (avatars, banners, etc.).

### Permission-Based File Access

Files inherit permissions from their parent resources:

- **Message Attachments**: User must have READ_MESSAGE permission for the associated message's channel
- **User Files**:
  - Avatars: Any authenticated instance user can view
  - Banners: Any authenticated instance user can view
- **Community Files**:
  - Community avatars/banners: Any authenticated instance user can view
  - Custom emojis: Require community membership to view

### RBAC Integration

New RBAC actions to be added:
```prisma
enum RbacActions {
  // ... existing actions
  DELETE_FILE           // Delete own files
  DELETE_ANY_FILE       // Delete any file (admin)
  UPLOAD_COMMUNITY_ASSETS // Upload community banner/avatar
  MANAGE_COMMUNITY_EMOJIS // Add/remove custom emojis
}
```

### Permission Hierarchy & Implied Permissions

- **Message Attachments**: `CREATE_MESSAGE` permission automatically grants ability to upload file attachments to that message
- **User Assets**: All authenticated instance users can upload their own avatar and banner (no specific permission required)
- **Community Assets**: Requires `UPLOAD_COMMUNITY_ASSETS` permission (typically granted to community admins)
- **Custom Emojis**: Requires `MANAGE_COMMUNITY_EMOJIS` permission (typically granted to community admins and moderators)
- **File Deletion**: Users can delete their own files, admins with `DELETE_ANY_FILE` can delete any file

## Technical Specifications

### File Types Supported
- **Images**: JPG, PNG, GIF, WebP, SVG
- **Videos**: MP4, WebM, MOV, AVI
- **Audio**: MP3, WAV, OGG, AAC
- **Documents**: PDF, TXT, DOC, DOCX
- **Archives**: ZIP, RAR, 7Z
- **Code**: Various source code files

### Size Limits (Environment Configurable)
- **Message Attachments**: 100MB per file, 200MB total per message
- **User Assets**:
  - Avatars: 10MB
  - Banners: 25MB
- **Community Assets**:
  - Banners: 25MB
  - Custom Emojis: 5MB

### Security Features
- File type validation (MIME type + magic bytes)
- File size validation
- Access control based on parent resource permissions
- SHA-256 checksum for file integrity
- Secure file serving with proper headers (Content-Security-Policy, X-Content-Type-Options)
- Virus scanning for uploaded files (future enhancement)

### Rate Limiting

Per-user upload limits to prevent abuse:
- **Upload frequency**: 50 uploads per hour per user
- **Upload quota**: 500MB total per day per user
- **Concurrent uploads**: Maximum 3 simultaneous uploads per user
- **Cooldown on failures**: 1-minute cooldown after 5 consecutive failed uploads

#### Implementation: Hybrid Approach

**1. NestJS Throttler Module** - Basic request rate limiting
```typescript
// files.controller.ts
@UseGuards(ThrottlerGuard)
@Throttle(50, 3600) // 50 requests per hour
@Post('upload/message')
async uploadMessageAttachment() { ... }
```

**2. Custom FileRateLimitGuard** - Quota and concurrent upload tracking
```typescript
// guards/file-rate-limit.guard.ts
@Injectable()
export class FileRateLimitGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const userId = context.switchToHttp().getRequest().user.id;

    // Check daily quota (500MB)
    const dailyUsage = await this.redis.get(`upload:quota:${userId}:${today}`);
    if (dailyUsage && parseInt(dailyUsage) >= 500 * 1024 * 1024) {
      throw new HttpException('Daily upload quota exceeded', 429);
    }

    // Check concurrent uploads (max 3)
    const concurrent = await this.redis.get(`upload:concurrent:${userId}`);
    if (concurrent && parseInt(concurrent) >= 3) {
      throw new HttpException('Too many concurrent uploads', 429);
    }

    // Check failure cooldown
    const failures = await this.redis.get(`upload:failures:${userId}`);
    if (failures && parseInt(failures) >= 5) {
      const ttl = await this.redis.ttl(`upload:failures:${userId}`);
      if (ttl > 0) {
        throw new HttpException('Upload cooldown active', 429);
      }
    }

    return true;
  }
}
```

**3. Redis Keys** - Rolling window tracking
```typescript
// On upload start
await redis.incr(`upload:concurrent:${userId}`);

// On upload complete/failure
await redis.decr(`upload:concurrent:${userId}`);

// On upload success - track daily quota
const fileSize = uploadedFile.size;
await redis.incrby(`upload:quota:${userId}:${today}`, fileSize);
await redis.expire(`upload:quota:${userId}:${today}`, 86400); // 24 hour expiry

// On upload failure - track consecutive failures
await redis.incr(`upload:failures:${userId}`);
await redis.expire(`upload:failures:${userId}`, 60); // 1 minute cooldown

// On upload success - reset failure counter
await redis.del(`upload:failures:${userId}`);
```

**4. Apply Guards**
```typescript
@UseGuards(ThrottlerGuard, FileRateLimitGuard)
@Post('upload/*')
async uploadFile() { ... }
```

Rate limit counters are stored in Redis with TTL-based expiration for rolling windows.

## Storage Configuration

### Environment Variables

```env
# File Upload Limits
FILE_UPLOAD_MAX_SIZE_MB=100
FILE_UPLOAD_MAX_TOTAL_SIZE_MB=200
FILE_UPLOAD_ALLOWED_TYPES=image/*,video/*,audio/*,application/pdf,text/*

# Asset-Specific Limits
AVATAR_MAX_SIZE_MB=10
BANNER_MAX_SIZE_MB=25
EMOJI_MAX_SIZE_MB=5

# Storage Configuration
FILE_STORAGE_TYPE=LOCAL
FILE_STORAGE_PATH=/app/uploads
FILE_PUBLIC_URL_BASE=http://localhost:3000/files

# Future Cloud Storage (not implemented yet)
# AWS_S3_BUCKET=
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# AZURE_STORAGE_CONNECTION_STRING=
```

### Docker Configuration

```yaml
# docker-compose.yml updates
backend:
  volumes:
    - ./backend:/app
    - /app/node_modules
    - file-uploads:/app/uploads  # Persistent file storage

volumes:
  file-uploads:
```

## API Endpoints

### File Upload
- `POST /files/upload/message` - Upload message attachment
- `POST /files/upload/avatar` - Upload user avatar
- `POST /files/upload/banner` - Upload user banner
- `POST /files/upload/community` - Upload community assets

### File Access
- `GET /files/:id` - Secure file download with access control
- `GET /files/public/:id` - Public file access (avatars, banners)
- `DELETE /files/:id` - Delete file (owner or admin)
- `GET /files/:id/metadata` - Get file information

### File Management
- `GET /files/user/:userId` - List user's files
- `GET /files/community/:communityId` - List community files
- `GET /files/message/:messageId` - List message attachments

## WebSocket Events

Real-time file-related events to keep clients synchronized:

### Server Events (Backend → Frontend)

```typescript
enum ServerEvents {
  // ... existing events

  // File upload events
  MESSAGE_ATTACHMENT_UPLOADED = 'messageAttachmentUploaded',  // File attached to message
  USER_AVATAR_UPDATED = 'userAvatarUpdated',                  // User avatar changed
  USER_BANNER_UPDATED = 'userBannerUpdated',                  // User banner changed
  COMMUNITY_AVATAR_UPDATED = 'communityAvatarUpdated',        // Community avatar changed
  COMMUNITY_BANNER_UPDATED = 'communityBannerUpdated',        // Community banner changed
  EMOJI_ADDED = 'emojiAdded',                                 // Custom emoji added
  EMOJI_REMOVED = 'emojiRemoved',                             // Custom emoji removed
  FILE_DELETED = 'fileDeleted',                               // File deleted by user/admin
}
```

### Event Payloads

```typescript
// MESSAGE_ATTACHMENT_UPLOADED
{
  messageId: string;
  channelId: string;
  fileId: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: Date;
}

// USER_AVATAR_UPDATED / USER_BANNER_UPDATED
{
  userId: string;
  fileId: string;
  fileUrl: string;
}

// COMMUNITY_AVATAR_UPDATED / COMMUNITY_BANNER_UPDATED
{
  communityId: string;
  fileId: string;
  fileUrl: string;
}

// EMOJI_ADDED
{
  communityId: string;
  emojiId: string;
  name: string;
  fileId: string;
  fileUrl: string;
}

// EMOJI_REMOVED
{
  communityId: string;
  emojiId: string;
  name: string;
}

// FILE_DELETED
{
  fileId: string;
  resourceType: 'message' | 'user' | 'community';
  resourceId: string;
}
```

### Event Targeting

- **Message attachments**: Broadcast to channel room (`channel:${channelId}`)
- **User avatar/banner**: Broadcast to all communities the user is a member of
- **Community assets**: Broadcast to community room (`community:${communityId}`)
- **Custom emojis**: Broadcast to community room (`community:${communityId}`)
- **File deletion**: Broadcast to relevant resource room based on `resourceType`

## Error Handling Strategy

### Upload Transaction Flow

File uploads follow a two-phase commit pattern to ensure data consistency:

1. **Validation Phase**
   - Validate file type, size, permissions
   - Check rate limits and quotas
   - Generate UUID for stored filename

2. **Storage Phase**
   - Write file to disk/storage
   - Calculate SHA-256 checksum
   - If storage fails: return error immediately (no DB write)

3. **Database Phase**
   - Create File record in database
   - Create junction table record (MessageAttachment, UserFile, etc.)
   - If DB write fails: Delete file from storage, return error

### Error Recovery

- **Orphaned files** (file exists, no DB record): Cleaned by hourly orphan detection job
- **Missing files** (DB record exists, file missing): Marked with error flag, file re-upload required
- **Partial uploads**: Client receives error, must retry upload from beginning
- **Thumbnail generation failures**: Retry 3 times with exponential backoff, then mark with `thumbnailError`

### Rollback Procedures

```typescript
try {
  // Write file to storage
  const storagePath = await storageService.upload(file, storedName);

  // Create database record
  const fileRecord = await prisma.file.create({ ... });

  return fileRecord;
} catch (error) {
  // Rollback: delete file from storage if DB write failed
  if (storagePath) {
    await storageService.delete(storagePath).catch(err =>
      logger.error('Failed to cleanup file after DB error', err)
    );
  }
  throw error;
}
```

## Background Jobs & Cron

### File Cleanup Job
**Schedule**: Every hour (`@Cron(CronExpression.EVERY_HOUR)`)

**Tasks**:
- Find files with `deletedAt < (now() - 7 days)`
- Delete file from storage
- Permanently delete DB record
- Log cleanup statistics

```typescript
@Cron(CronExpression.EVERY_HOUR)
async cleanupDeletedFiles() {
  const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const filesToDelete = await prisma.file.findMany({
    where: { deletedAt: { lt: cutoffDate } }
  });

  for (const file of filesToDelete) {
    await storageService.delete(file.storagePath);
    await prisma.file.delete({ where: { id: file.id } });
  }
}
```

### Thumbnail Generation Job
**Schedule**: Every 5 minutes (`@Cron(CronExpression.EVERY_5_MINUTES)`)

**Tasks**:
- Find image files with `thumbnailGenerated = false AND mimeType LIKE 'image/%' AND thumbnailError IS NULL`
- Generate 3 thumbnail sizes: 150px, 400px, 800px
- Store thumbnails with suffixes: `_thumb_150`, `_thumb_400`, `_thumb_800`
- Update `thumbnailGenerated = true` and set `thumbnailSizes` JSON
- On failure: Increment retry counter, set `thumbnailError` after 3 failures

```typescript
@Cron(CronExpression.EVERY_5_MINUTES)
async generateThumbnails() {
  const pendingFiles = await prisma.file.findMany({
    where: {
      thumbnailGenerated: false,
      mimeType: { startsWith: 'image/' },
      thumbnailError: null,
    },
    take: 10, // Process 10 at a time
  });

  for (const file of pendingFiles) {
    try {
      const thumbnails = await thumbnailService.generate(file.storagePath, {
        sizes: [150, 400, 800],
      });

      await prisma.file.update({
        where: { id: file.id },
        data: {
          thumbnailGenerated: true,
          thumbnailPath: thumbnails.basePath,
          thumbnailSizes: { small: '150px', medium: '400px', large: '800px' },
        },
      });
    } catch (error) {
      await prisma.file.update({
        where: { id: file.id },
        data: { thumbnailError: error.message },
      });
    }
  }
}
```

### Orphan Detection Job
**Schedule**: Daily at 3 AM (`@Cron(CronExpression.EVERY_DAY_AT_3AM)`)

**Tasks**:
- **Orphaned files**: Scan storage directory, find files without DB records, delete
- **Missing files**: Find DB records where file doesn't exist on disk, mark with error
- Generate orphan detection report and log statistics

```typescript
@Cron(CronExpression.EVERY_DAY_AT_3AM)
async detectOrphans() {
  // Find files in storage without DB records
  const storageFiles = await storageService.listAll();
  const dbFileNames = await prisma.file.findMany({ select: { storedName: true } });
  const dbFileNameSet = new Set(dbFileNames.map(f => f.storedName));

  for (const storageFile of storageFiles) {
    if (!dbFileNameSet.has(storageFile)) {
      await storageService.delete(storageFile);
      logger.warn('Deleted orphaned file', { file: storageFile });
    }
  }

  // Find DB records without files on disk
  for (const dbFile of dbFileNames) {
    const exists = await storageService.exists(dbFile.storedName);
    if (!exists) {
      await prisma.file.update({
        where: { storedName: dbFile.storedName },
        data: { thumbnailError: 'File missing from storage' },
      });
      logger.error('File missing from storage', { file: dbFile.storedName });
    }
  }
}
```

## Avatar Migration Strategy

### Current State
- User model has `avatarUrl String?` field storing external URLs
- No file management system for user assets

### Migration Approach: Proxy Pattern (No Data Migration)

Instead of migrating existing avatar URLs to the new file system, use a proxy endpoint that provides backward compatibility:

#### Proxy Endpoint
```typescript
// GET /files/user/:userId/avatar
async getUserAvatar(userId: string) {
  // 1. Check if user has uploaded avatar in new system
  const userFile = await prisma.userFile.findFirst({
    where: { userId, type: 'AVATAR' },
    include: { file: true },
  });

  if (userFile) {
    // Return file from new file system
    return this.serveFile(userFile.file);
  }

  // 2. Fall back to legacy avatarUrl
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });

  if (user?.avatarUrl) {
    // Redirect to external URL or proxy it
    return { redirect: user.avatarUrl };
  }

  // 3. Return default avatar
  return this.serveDefaultAvatar();
}
```

#### Frontend Updates
```typescript
// Old: Direct avatarUrl usage
<Avatar src={user.avatarUrl} />

// New: Use proxy endpoint
<Avatar src={`/api/files/user/${user.id}/avatar`} />
```

#### Benefits
- **No data migration required**: Existing avatar URLs continue working
- **Gradual migration**: Users naturally migrate when they upload new avatars
- **Backward compatible**: Old URLs still work during transition period
- **Clean API**: Frontend uses consistent endpoint for all avatars

#### Community Assets Migration
Same proxy pattern applies:
- `GET /files/community/:communityId/avatar`
- `GET /files/community/:communityId/banner`

#### Timeline
1. **Phase 1**: Deploy proxy endpoints, keep existing `avatarUrl` field
2. **Phase 2**: Update frontend to use proxy endpoints
3. **Phase 3**: After 6 months, archive `avatarUrl` field (mark as deprecated)
4. **Phase 4**: After 12 months, remove `avatarUrl` field if all users migrated

## Implementation Plan

### Phase 1: Core Infrastructure
1. **Database Schema**
   - Update Prisma schema with File model including thumbnail fields
   - Add MessageAttachment, UserFile, CommunityFile junction tables
   - Add indexes for performance (uploadedBy, uploadedAt, thumbnailGenerated)
   - Generate Prisma client and push schema to database

2. **Storage Module**
   - Create storage abstraction interface (StorageService)
   - Implement LocalStorageService for filesystem storage
   - Add file validation service (MIME type, magic bytes, size limits)
   - Implement SHA-256 checksum calculation

3. **Files Module**
   - Create FilesModule, FilesService, FilesController
   - Implement file upload endpoints with multipart/form-data
   - Add file download/serving with proper security headers
   - Implement file deletion with soft delete

4. **Access Control**
   - Add RBAC actions: DELETE_FILE, DELETE_ANY_FILE, UPLOAD_COMMUNITY_ASSETS, MANAGE_COMMUNITY_EMOJIS
   - Implement FileAccessGuard for permission checking
   - Add JWT authentication requirement for all file endpoints
   - Install and configure @nestjs/throttler for basic rate limiting (50 uploads/hour)
   - Implement custom FileRateLimitGuard for quota tracking (500MB/day) and concurrent uploads (max 3)

### Phase 2: Integration & Real-time
1. **Message Attachments**
   - Update message creation to support file attachments
   - Add WebSocket event: MESSAGE_ATTACHMENT_UPLOADED
   - Integrate with messages module for attachment display
   - Implement file access based on READ_MESSAGE permission

2. **User Assets**
   - Add avatar and banner upload endpoints
   - Implement proxy endpoints for backward compatibility: `/files/user/:userId/avatar`
   - Add WebSocket events: USER_AVATAR_UPDATED, USER_BANNER_UPDATED
   - Update frontend to use proxy endpoints instead of direct avatarUrl

3. **Community Assets**
   - Add community banner/avatar upload with UPLOAD_COMMUNITY_ASSETS permission
   - Implement custom emoji management with MANAGE_COMMUNITY_EMOJIS permission
   - Add WebSocket events: COMMUNITY_AVATAR_UPDATED, COMMUNITY_BANNER_UPDATED, EMOJI_ADDED, EMOJI_REMOVED
   - Implement proxy endpoints: `/files/community/:communityId/avatar`, `/files/community/:communityId/banner`

4. **Error Handling**
   - Implement two-phase commit pattern (storage → database)
   - Add rollback procedures for failed uploads
   - Add error recovery for orphaned files and missing files

### Phase 3: Background Jobs & Optimization
1. **Cron Jobs**
   - File cleanup job (hourly): Delete files with deletedAt > 7 days
   - Thumbnail generation job (every 5 minutes): Generate thumbnails for images
   - Orphan detection job (daily at 3 AM): Find and cleanup orphaned files

2. **Thumbnail System**
   - Implement ThumbnailService with sharp library
   - Generate 3 sizes: 150px, 400px, 800px
   - Store thumbnails with naming convention: `_thumb_150`, `_thumb_400`, `_thumb_800`
   - Add thumbnail endpoints for optimized image serving

3. **Monitoring & Logging**
   - Add file upload/download metrics
   - Log cleanup and orphan detection statistics
   - Monitor rate limit violations
   - Track storage usage per user and community

### Phase 4: Advanced Features (Future)
1. **Cloud Storage Migration**
   - Implement S3StorageService using AWS SDK
   - Implement AzureBlobStorageService
   - Add configuration for storage provider selection
   - Migrate existing files to cloud storage (if needed)

2. **Advanced Security**
   - Add virus scanning integration (ClamAV)
   - Implement content moderation for uploaded images
   - Add watermarking for community-uploaded content
   - Enhanced audit logging for file access

3. **Performance Optimization**
   - Implement CDN integration for file serving
   - Add image optimization and format conversion (WebP)
   - Implement progressive image loading
   - Add file deduplication using checksum

### Testing Strategy
- **Unit Tests**: File validation, access control, storage operations
- **Integration Tests**: Upload/download flows, permission checks, rate limiting
- **E2E Tests**: Complete file upload workflows for messages, avatars, emojis
- **Load Tests**: Concurrent uploads, rate limit enforcement, storage performance

## Future Extensibility

The storage interface design allows for easy migration to cloud storage:

```typescript
interface StorageService {
  upload(file: Buffer, path: string): Promise<string>;
  download(path: string): Promise<Buffer>;
  delete(path: string): Promise<void>;
  getUrl(path: string): string;
}
```

This abstraction will support:
- Local filesystem storage (current)
- AWS S3 storage (future)
- Azure Blob storage (future)
- Google Cloud Storage (future)

The junction table approach provides clean separation of file relationships and supports Discord-like functionality with higher default upload limits.