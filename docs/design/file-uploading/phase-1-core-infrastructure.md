# Phase 1: Core Infrastructure - File Upload System

## Overview

Phase 1 establishes the foundational infrastructure for the file upload system, including database schema, file storage abstraction, basic endpoints, and security validation. This phase provides the core building blocks that all subsequent phases will build upon.

## Database Schema Design

### File Entity (Base File Metadata)

```typescript
// backend/src/files/entities/file.entity.ts
export class File {
  id: string;                    // UUID primary key
  filename: string;              // Original filename
  mimeType: string;             // File MIME type
  size: number;                 // File size in bytes
  hash: string;                 // File content hash (SHA-256)
  
  // Storage info
  storagePath: string;          // Internal storage path
  storageProvider: string;      // 'local' | 'aws-s3' | etc.
  
  // Metadata
  width?: number;               // Image/video width
  height?: number;              // Image/video height
  duration?: number;            // Audio/video duration in seconds
  metadata: Record<string, any>; // Additional file metadata
  
  // Thumbnails
  thumbnailPath?: string;       // Thumbnail storage path
  thumbnailMimeType?: string;   // Thumbnail MIME type
  
  // Security
  isPublic: boolean;            // Public access flag
  uploadedById: string;         // User who uploaded
  uploadedBy: User;             // Relation to user
  
  // Lifecycle
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;            // Optional expiration
}
```

### Attachment Entity (Message-File Linking)

```typescript
// backend/src/files/entities/attachment.entity.ts
export class Attachment {
  id: string;                   // UUID primary key
  
  // File reference
  fileId: string;               // Foreign key to File
  file: File;                   // File relation
  
  // Message reference
  messageId: string;            // Foreign key to Message
  message: Message;             // Message relation
  
  // Attachment metadata
  order: number;                // Order within message attachments
  description?: string;         // Alt text / description
  
  createdAt: Date;
}
```

### PublicFile Entity (Instance-wide Public Files)

```typescript
// backend/src/files/entities/public-file.entity.ts
export enum PublicFileType {
  AVATAR = 'avatar',
  BANNER = 'banner', 
  EMOJI = 'emoji',
  INSTANCE_LOGO = 'instance_logo',
  COMMUNITY_ICON = 'community_icon',
  COMMUNITY_BANNER = 'community_banner'
}

export class PublicFile {
  id: string;                   // UUID primary key
  
  // File reference
  fileId: string;               // Foreign key to File
  file: File;                   // File relation
  
  // Public file metadata
  type: PublicFileType;         // Type of public file
  entityId?: string;            // ID of associated entity (user, community, etc.)
  entityType?: string;          // Type of associated entity
  
  // Display properties
  displayName?: string;         // Display name for file
  isActive: boolean;            // Whether file is currently active
  
  createdAt: Date;
  updatedAt: Date;
}
```

## File Storage Service Architecture

### Storage Service Interface

```typescript
// backend/src/storage/interfaces/storage.interface.ts
export interface IStorageService {
  // Core operations
  upload(file: Express.Multer.File, path: string): Promise<StorageResult>;
  download(path: string): Promise<Buffer>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  
  // Metadata operations
  getMetadata(path: string): Promise<FileMetadata>;
  getUrl(path: string, expiresIn?: number): Promise<string>;
  
  // Utility operations
  generatePath(filename: string, folder?: string): string;
  validateFile(file: Express.Multer.File): Promise<ValidationResult>;
}

export interface StorageResult {
  path: string;
  size: number;
  hash: string;
  metadata?: Record<string, any>;
}
```

### Local Storage Implementation

```typescript
// backend/src/storage/local-storage.service.ts
@Injectable()
export class LocalStorageService implements IStorageService {
  private readonly uploadPath: string;
  private readonly publicPath: string;
  
  constructor(private configService: ConfigService) {
    this.uploadPath = this.configService.get('UPLOAD_PATH', './uploads');
    this.publicPath = this.configService.get('PUBLIC_UPLOAD_PATH', './public/uploads');
  }
  
  // Implementation methods...
}
```

## File Upload Controller & Endpoints

### File Upload DTOs

```typescript
// backend/src/files/dto/upload-file.dto.ts
export class UploadFileDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
  
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
  
  @IsOptional()
  @IsEnum(PublicFileType)
  publicFileType?: PublicFileType;
  
  @IsOptional()
  @IsString()
  entityId?: string;
}

export class FileMetadataDto {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  duration?: number;
  thumbnailUrl?: string;
  downloadUrl: string;
  uploadedAt: Date;
}
```

### Files Controller

```typescript
// backend/src/files/files.controller.ts
@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private filesService: FilesService) {}
  
  // Upload file(s)
  @Post('upload')
  @UseInterceptors(FilesInterceptor('files', 10, {
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
    fileFilter: fileFilterFunction,
  }))
  async uploadFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() uploadDto: UploadFileDto,
    @GetCurrentUser() user: User,
  ): Promise<FileMetadataDto[]>;
  
  // Get file metadata
  @Get(':id/metadata')
  @UseGuards(FileAccessGuard)
  async getFileMetadata(
    @Param('id') fileId: string,
  ): Promise<FileMetadataDto>;
  
  // Download file
  @Get(':id/download')
  @UseGuards(FileAccessGuard)
  async downloadFile(
    @Param('id') fileId: string,
    @Res() res: Response,
  ): Promise<void>;
  
  // Serve public files (no auth required)
  @Get('public/:id')
  async servePublicFile(
    @Param('id') fileId: string,
    @Res() res: Response,
  ): Promise<void>;
  
  // Delete file
  @Delete(':id')
  @UseGuards(FileAccessGuard)
  async deleteFile(
    @Param('id') fileId: string,
    @GetCurrentUser() user: User,
  ): Promise<void>;
}
```

## File Validation & Security

### File Validation Service

```typescript
// backend/src/files/services/file-validation.service.ts
@Injectable()
export class FileValidationService {
  private readonly maxFileSizes = {
    [PublicFileType.AVATAR]: 10 * 1024 * 1024,      // 10MB
    [PublicFileType.BANNER]: 25 * 1024 * 1024,      // 25MB
    [PublicFileType.EMOJI]: 5 * 1024 * 1024,        // 5MB
    default: 100 * 1024 * 1024,                     // 100MB
  };
  
  private readonly allowedMimeTypes = [
    // Images
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    // Videos
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
    // Audio
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac',
    // Documents
    'application/pdf', 'text/plain', 'application/msword',
    // Archives
    'application/zip', 'application/x-rar-compressed',
  ];
  
  async validateFile(
    file: Express.Multer.File,
    type?: PublicFileType,
  ): Promise<ValidationResult>;
  
  async scanFileContent(filePath: string): Promise<SecurityScanResult>;
  
  private validateMimeType(file: Express.Multer.File): boolean;
  private validateFileSize(file: Express.Multer.File, type?: PublicFileType): boolean;
  private validateMagicBytes(file: Express.Multer.File): Promise<boolean>;
}
```

### File Access Guard

```typescript
// backend/src/files/guards/file-access.guard.ts
@Injectable()
export class FileAccessGuard implements CanActivate {
  constructor(
    private filesService: FilesService,
    private rbacService: RbacService,
  ) {}
  
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const fileId = request.params.id;
    
    const file = await this.filesService.findById(fileId);
    if (!file) {
      throw new NotFoundException('File not found');
    }
    
    // Public files are accessible to all authenticated users
    if (file.isPublic) {
      return true;
    }
    
    // Check if user owns the file
    if (file.uploadedById === user.id) {
      return true;
    }
    
    // Check message attachment permissions
    const attachment = await this.filesService.findAttachmentByFileId(fileId);
    if (attachment) {
      return this.checkMessagePermissions(user, attachment.message);
    }
    
    return false;
  }
  
  private async checkMessagePermissions(user: User, message: Message): Promise<boolean> {
    // Implement message access checking logic
    // This will integrate with existing RBAC system
  }
}
```

## File Processing Pipeline

### File Metadata Processor

```typescript
// backend/src/files/processors/metadata.processor.ts
@Injectable()
export class FileMetadataProcessor {
  async extractMetadata(file: Express.Multer.File): Promise<FileMetadata> {
    const metadata: FileMetadata = {
      filename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
    
    if (this.isImage(file.mimetype)) {
      const imageMetadata = await this.extractImageMetadata(file.path);
      Object.assign(metadata, imageMetadata);
    }
    
    if (this.isVideo(file.mimetype)) {
      const videoMetadata = await this.extractVideoMetadata(file.path);
      Object.assign(metadata, videoMetadata);
    }
    
    if (this.isAudio(file.mimetype)) {
      const audioMetadata = await this.extractAudioMetadata(file.path);
      Object.assign(metadata, audioMetadata);
    }
    
    return metadata;
  }
}
```

## Configuration & Environment

### File Upload Configuration

```typescript
// backend/src/files/config/file-upload.config.ts
export const fileUploadConfig = {
  // Storage configuration
  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local',
    local: {
      uploadPath: process.env.UPLOAD_PATH || './uploads',
      publicPath: process.env.PUBLIC_UPLOAD_PATH || './public/uploads',
    },
    aws: {
      bucket: process.env.AWS_S3_BUCKET,
      region: process.env.AWS_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  },
  
  // File size limits
  limits: {
    fileSize: 100 * 1024 * 1024,        // 100MB default
    files: 10,                          // Max files per upload
    avatar: 10 * 1024 * 1024,          // 10MB
    banner: 25 * 1024 * 1024,          // 25MB
    emoji: 5 * 1024 * 1024,            // 5MB
  },
  
  // Security settings
  security: {
    enableVirusScanning: process.env.ENABLE_VIRUS_SCANNING === 'true',
    allowedMimeTypes: [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'audio/mpeg', 'audio/wav',
      'application/pdf', 'text/plain',
    ],
    blockedExtensions: ['.exe', '.bat', '.cmd', '.scr', '.vbs'],
  },
};
```

## Testing Strategy

### Unit Tests
- File validation service tests
- Storage service tests
- Metadata extraction tests
- Permission guard tests

### Integration Tests
- File upload flow tests
- File download with permissions
- File deletion tests
- Public file serving tests

### E2E Tests
- Complete file upload workflow
- Permission enforcement
- File serving with authentication

## Implementation Tasks

### Backend Tasks
1. **Database Setup**
   - Create File, Attachment, and PublicFile entities
   - Set up Prisma schema
   - Run database migrations

2. **Storage Service**
   - Implement IStorageService interface
   - Create LocalStorageService
   - Add storage configuration

3. **File Validation**
   - Implement FileValidationService
   - Add MIME type and magic byte checking
   - Create file size validation

4. **Controllers & Services**
   - Create FilesController with all endpoints
   - Implement FilesService business logic
   - Add file upload interceptors

5. **Security & Guards**
   - Implement FileAccessGuard
   - Add file access middleware
   - Integrate with existing RBAC system

6. **File Processing**
   - Create metadata extraction service
   - Add image/video/audio metadata processing
   - Implement file hashing

### Configuration Tasks
1. **Environment Variables**
   - Add file upload configuration
   - Set up storage paths
   - Configure file size limits

2. **Module Setup**
   - Create FilesModule
   - Configure Multer integration
   - Set up dependency injection

## Success Criteria

- [ ] File entities created and migrated to database
- [ ] File upload endpoints functional with validation
- [ ] File download with permission checking works
- [ ] Public file serving works without authentication
- [ ] File metadata extraction and storage working
- [ ] File validation (size, type, security) implemented
- [ ] All unit and integration tests passing
- [ ] File storage abstraction allows for future cloud storage

This phase establishes the solid foundation needed for all subsequent file upload functionality.