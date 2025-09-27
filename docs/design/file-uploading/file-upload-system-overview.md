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
  uploadedBy  String   @db.ObjectId
  uploadedAt  DateTime @default(now())
  deletedAt   DateTime? // Soft delete

  // Storage configuration
  storageType StorageType @default(LOCAL)
  storagePath String      // Local path or cloud key

  // Relations
  uploader           User                @relation("UploadedFiles", fields: [uploadedBy], references: [id])
  messageAttachments MessageAttachment[]
  userFiles          UserFile[]
  communityFiles     CommunityFile[]
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
  name        String?           // For custom emojis

  community   Community         @relation(fields: [communityId], references: [id], onDelete: Cascade)
  file        File             @relation(fields: [fileId], references: [id], onDelete: Cascade)

  @@unique([communityId, type, name]) // Unique emoji names per community
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

### Permission-Based File Access

Files inherit permissions from their parent resources:

- **Message Attachments**: User must have READ_MESSAGE permission for the associated message
- **User Files**:
  - Avatars: Public access (no authentication required)
  - Banners: Public access
- **Community Files**:
  - Community avatars/banners: Public access
  - Custom emojis: Require community membership to view

### RBAC Integration

New RBAC actions to be added:
```prisma
enum RbacActions {
  // ... existing actions
  UPLOAD_FILE           // General file upload permission
  DELETE_FILE           // Delete own files
  DELETE_ANY_FILE       // Delete any file (admin)
  UPLOAD_AVATAR         // Upload user avatar
  UPLOAD_BANNER         // Upload user banner
  UPLOAD_COMMUNITY_ASSETS // Upload community files
  MANAGE_COMMUNITY_EMOJIS // Add/remove custom emojis
}
```

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
- Rate limiting on uploads
- Secure file serving with proper headers
- SHA-256 checksum for file integrity

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

## Implementation Plan

### Phase 1: Core Infrastructure
1. Update Prisma schema with File model and junction tables
2. Create Files module with basic CRUD operations
3. Implement local storage service with file validation
4. Add file upload endpoints with proper access control
5. Update existing models to support file relationships

### Phase 2: Integration & Security
1. Integrate with RBAC system for file permissions
2. Add file access middleware and guards
3. Implement file serving with proper security headers
4. Add file cleanup and maintenance tasks
5. Update message creation to support attachments

### Phase 3: Advanced Features
1. Add file metadata extraction
2. Implement file thumbnail generation
3. Add file usage tracking and quotas
4. Prepare cloud storage interface for future migration

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