# File Upload Module

> **Location:** `backend/src/file-upload/file-upload.module.ts`
> **Type:** Feature Module
> **Domain:** file management

## Overview

The File Upload module handles secure file uploads with multi-tier validation, automatic file type detection, checksum generation, and resource-based access control. It integrates with Multer for handling multipart/form-data uploads and implements a strategy pattern for validating different file types based on their intended use (avatars, attachments, etc.).

## Module Structure

```
file-upload/
├── file-upload.module.ts              # Module definition with Multer configuration
├── file-upload.service.ts             # Core upload logic, validation, and cleanup
├── file-upload.controller.ts          # HTTP upload endpoint
├── dto/
│   └── create-file-upload.dto.ts      # Client-provided upload metadata
└── validators/
    ├── mime-type-aware-size.validator.ts    # Decorator-level size validation
    ├── resource-type-file.validator.ts      # Service-level business logic validation
    └── strategies/
        ├── file-validation-strategy.interface.ts
        ├── message-attachment-validation.strategy.ts
        ├── user-avatar-validation.strategy.ts
        ├── user-banner-validation.strategy.ts
        ├── community-avatar-validation.strategy.ts
        └── community-banner-validation.strategy.ts
```

## Services

### FileUploadService

**Purpose:** Handles file uploads with validation, metadata extraction, checksum generation, and database persistence

#### Key Methods

```typescript
class FileUploadService {
  async uploadFile(
    file: Express.Multer.File,
    createFileUploadDto: CreateFileUploadDto,
    user: UserEntity
  ): Promise<File> {
    // 1. Validates file against resource type constraints
    // 2. Generates SHA-256 checksum for integrity
    // 3. Detects file type from MIME type
    // 4. Creates database record
    // 5. Cleans up file on any failure
  }

  private async generateChecksum(filePath: string): Promise<string> {
    // Creates SHA-256 hash of file contents for integrity verification
  }

  private getFileTypeFromMimeType(mimeType: string): FileType {
    // Maps MIME types to FileType enum (IMAGE, VIDEO, AUDIO, DOCUMENT, OTHER)
  }

  private async cleanupFile(filePath: string): Promise<void> {
    // Deletes file from disk to prevent storage abuse
  }
}
```

#### Database Queries

```typescript
// Create file record with all metadata
const file = await this.databaseService.file.create({
  data: {
    filename: file.originalname,
    mimeType: file.mimetype,
    fileType: this.getFileTypeFromMimeType(file.mimetype),
    size: file.size,
    checksum: checksum,
    uploadedById: user.id,
    resourceType: createFileUploadDto.resourceType,
    resourceId: createFileUploadDto.resourceId,
    storageType: StorageType.LOCAL,
    storagePath: file.path,
  },
});
```

## Controllers

### FileUploadController

**Base Route:** `/api/file-upload`

#### Endpoints

| Method | Endpoint | Description | Auth Required | RBAC Actions |
|--------|----------|-------------|---------------|--------------|
| POST | `/` | Upload file with validation | ✅ | None (user context only) |

#### Upload Endpoint

```typescript
@Post()
@UseInterceptors(FileInterceptor('file'))
@UseGuards(JwtAuthGuard)
uploadFile(
  @UploadedFile(
    new ParseFilePipe({
      validators: [
        new MimeTypeAwareSizeValidator({}),
        new FileTypeValidator({
          fileType: /(image|video|audio|application|text)\//
        }),
      ],
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    }),
  )
  file: Express.Multer.File,
  @Body() body: CreateFileUploadDto,
  @Req() req: { user: UserEntity },
): Promise<File> {
  return this.fileUploadService.uploadFile(file, body, req.user);
}
```

## DTOs (Data Transfer Objects)

### CreateFileUploadDto

```typescript
export class CreateFileUploadDto {
  @IsEnum(ResourceType)
  resourceType: ResourceType;  // USER_AVATAR, MESSAGE_ATTACHMENT, etc.

  @IsOptional()
  @IsString()
  resourceId?: string | null;  // ID of the resource this file is for
}
```

**Note:** Server-generated fields (filename, mimeType, size, checksum, etc.) are NOT in the DTO - they're extracted from the uploaded file.

## Validation Strategy Pattern

### Three-Tier Validation

1. **Multer Level (500MB hard limit)** - Prevents DOS attacks
2. **Decorator Level (MimeTypeAwareSizeValidator)** - MIME-aware size limits
3. **Service Level (ResourceTypeFileValidator)** - Business logic validation

### MimeTypeAwareSizeValidator

Decorator-level validator that enforces different size limits based on MIME type:

```typescript
class MimeTypeAwareSizeValidator extends FileValidator {
  private readonly MAX_VIDEO_SIZE = 500 * 1024 * 1024;  // 500MB
  private readonly MAX_IMAGE_SIZE = 25 * 1024 * 1024;   // 25MB
  private readonly MAX_AUDIO_SIZE = 100 * 1024 * 1024;  // 100MB
  private readonly MAX_DOCUMENT_SIZE = 50 * 1024 * 1024; // 50MB

  isValid(file: Express.Multer.File): boolean {
    return file.size <= this.getMaxSizeForMimeType(file.mimetype);
  }
}
```

### ResourceTypeFileValidator

Service-level validator that uses strategies for resource-specific validation:

```typescript
class ResourceTypeFileValidator extends FileValidator {
  private strategies: Map<ResourceType, IFileValidationStrategy> = new Map([
    [ResourceType.MESSAGE_ATTACHMENT, new MessageAttachmentValidationStrategy()],
    [ResourceType.USER_AVATAR, new UserAvatarValidationStrategy()],
    [ResourceType.USER_BANNER, new UserBannerValidationStrategy()],
    [ResourceType.COMMUNITY_AVATAR, new CommunityAvatarValidationStrategy()],
    [ResourceType.COMMUNITY_BANNER, new CommunityBannerValidationStrategy()],
  ]);
}
```

### Validation Strategies

Each strategy implements specific rules for a resource type:

**MessageAttachmentValidationStrategy:**
```typescript
isValid(file: Express.Multer.File): boolean {
  // Allows: images, videos, audio, documents, archives
  // Max sizes: 500MB video, 25MB image, 100MB audio, 50MB document
}
```

**UserAvatarValidationStrategy:**
```typescript
isValid(file: Express.Multer.File): boolean {
  // Allows: images only (image/jpeg, image/png, image/gif, image/webp)
  // Max size: 10MB
}
```

## Multer Configuration

```typescript
MulterModule.registerAsync({
  useFactory: (configService: ConfigService) => ({
    dest: configService.get<string>('FILE_UPLOAD_DEST') || './uploads',
    limits: {
      fileSize: 500 * 1024 * 1024, // 500MB hard limit for DOS protection
    },
  }),
  inject: [ConfigService],
})
```

## Database Schema

### File Model

```prisma
model File {
  id           String    @id @default(auto()) @map("_id") @db.ObjectId
  filename     String    // Original filename from client
  mimeType     String    // MIME type (image/jpeg, video/mp4, etc.)
  fileType     FileType  // Enum: IMAGE, VIDEO, AUDIO, DOCUMENT, OTHER
  size         Int       // File size in bytes
  checksum     String    // SHA-256 hash for integrity/deduplication
  uploadedBy   User?     @relation(fields: [uploadedById], references: [id])
  uploadedById String?   @db.ObjectId
  uploadedAt   DateTime  @default(now())
  deletedAt    DateTime? // Soft delete timestamp
  resourceType ResourceType  // What this file is used for
  resourceId   String?   // ID of the resource (messageId, userId, etc.)

  // Storage configuration
  storageType  StorageType @default(LOCAL)
  storagePath  String    // Local path or cloud storage key

  @@index([uploadedById])
  @@index([deletedAt])
  @@index([resourceType, resourceId])
}

enum FileType {
  IMAGE
  VIDEO
  AUDIO
  DOCUMENT
  OTHER
}

enum ResourceType {
  USER_AVATAR
  USER_BANNER
  COMMUNITY_BANNER
  COMMUNITY_AVATAR
  MESSAGE_ATTACHMENT
  CUSTOM_EMOJI
}

enum StorageType {
  LOCAL
  S3
  AZURE_BLOB
}
```

## Dependencies

### Internal Dependencies
- `@/database/database.service` - File metadata persistence
- `@/auth/jwt-auth.guard` - User authentication

### External Dependencies
- `@nestjs/platform-express` - Multer integration
- `@nestjs/common` - Decorators and exceptions
- `class-validator` - DTO validation
- `crypto` - SHA-256 checksum generation
- `fs/promises` - File system operations

## Authentication & Authorization

### Guards Used
- `JwtAuthGuard` - Requires authenticated user for uploads

### User Context
The authenticated user is injected via `@Req() req: { user: UserEntity }` and associated with the uploaded file for audit trail and access control.

## File Cleanup & Error Handling

### Automatic Cleanup

Files are automatically deleted from disk if:
1. Validation fails at service level
2. Database insertion fails
3. Any error occurs during processing

```typescript
try {
  // Validation and DB operations
} catch (error) {
  await this.cleanupFile(file.path);  // Delete file from disk
  throw error;
}
```

### Error Scenarios

1. **File too large** - Rejected at Multer or validator level
2. **Invalid MIME type** - Rejected by FileTypeValidator
3. **Resource type mismatch** - Strategy validation fails
4. **Database error** - File cleaned up, error propagated
5. **Invalid resource type** - Unknown ResourceType enum value

## Performance Considerations

- **Checksum Generation:** Uses streaming SHA-256 to avoid loading entire file into memory
- **File Cleanup:** Async cleanup doesn't block response when successful
- **Validation Order:** Cheap validations (MIME, size) before expensive (checksum)
- **DOS Protection:** 500MB Multer hard limit prevents memory exhaustion

## Common Usage Patterns

### Pattern 1: Upload Message Attachment

```typescript
// Client uploads file with resourceType
POST /api/file-upload
Content-Type: multipart/form-data

file: <binary>
resourceType: MESSAGE_ATTACHMENT
resourceId: null

// Returns File object with ID
{ id: "...", filename: "...", mimeType: "...", ... }

// Client then creates message with pendingAttachments
POST /api/messages
{
  channelId: "...",
  spans: [...],
  attachments: [],
  pendingAttachments: 1
}

// Client confirms upload
POST /api/messages/:messageId/attachments
{
  fileId: "..."  // Decrements pendingAttachments and adds to attachments[]
}
```

### Pattern 2: Upload User Avatar

```typescript
POST /api/file-upload
Content-Type: multipart/form-data

file: <image binary>
resourceType: USER_AVATAR
resourceId: <userId>

// Returns File object
// User service updates user.avatarUrl with returned file ID
```

## Related Modules

- **File Module** - Handles file retrieval with access control
- **Messages Module** - Integrates attachments via pendingAttachments pattern
- **User Module** - Uses for avatar/banner uploads
- **Community Module** - Uses for community avatar/banner uploads

## Security Considerations

### File Type Validation
- **MIME Type Check:** First-pass validation via FileTypeValidator
- **Extension Validation:** Implicitly validated via MIME type
- **Magic Byte Validation:** Future enhancement for additional security

### Storage Isolation
- **Local Storage:** Files stored in configured upload directory
- **Path Traversal Prevention:** Multer handles filename sanitization
- **Access Control:** File access validated via FileAccessGuard (see File Module)

### DOS Prevention
- **Hard Limit:** 500MB Multer limit prevents memory exhaustion
- **Rate Limiting:** Should be configured at reverse proxy level
- **File Cleanup:** Prevents disk space abuse from failed uploads

## Troubleshooting

### Common Issues

1. **"File too large" error**
   - **Symptoms:** 422 Unprocessable Entity on upload
   - **Cause:** File exceeds size limit for resource type
   - **Solution:** Check MimeTypeAwareSizeValidator limits for the MIME type

2. **"Invalid file type" error**
   - **Symptoms:** Validation error mentioning MIME type
   - **Cause:** File type not allowed for the resource type
   - **Solution:** Check validation strategy for allowed MIME types

3. **Files not cleaned up**
   - **Symptoms:** Disk usage grows with failed uploads
   - **Cause:** Exception thrown before cleanup
   - **Solution:** Ensure try/catch wraps all operations with cleanup in catch

## Related Documentation

- [File Module](./file.md) - File retrieval and access control
- [File Access Guard](../api/file-access-guard.md) - Access control strategies
- [Messages Module](./messages.md) - Attachment integration
- [Database Schema](../architecture/database.md#file) - File model details
