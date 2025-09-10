# File Upload System - Implementation Overview

## Project Goals

Implement a comprehensive file upload system for the Kraken chat application that provides:

1. **Message Attachments**: Permission-controlled file uploads attached to messages
2. **Public Instance Files**: Avatars, banners, and other instance-wide assets
3. **Drag & Drop Interface**: Intuitive file upload UX similar to Discord
4. **Multimedia Support**: Embedded media players for images, videos, and audio
5. **Security & Access Control**: Robust permission checking and file validation
6. **File Management**: Efficient storage, retrieval, and cleanup

## Architecture Overview

### Backend Components (NestJS)

```
backend/src/
├── files/                      # Core file management module
│   ├── files.controller.ts     # Upload & download endpoints
│   ├── files.service.ts        # File business logic
│   ├── files.module.ts         # File module configuration
│   ├── entities/
│   │   ├── file.entity.ts      # Base file metadata
│   │   ├── attachment.entity.ts # Message attachment links
│   │   └── public-file.entity.ts # Instance public files
│   ├── dto/
│   │   ├── upload-file.dto.ts  # File upload validation
│   │   └── file-metadata.dto.ts # File info responses
│   ├── guards/
│   │   └── file-access.guard.ts # Permission checking
│   ├── interceptors/
│   │   └── file-upload.interceptor.ts # Upload processing
│   └── processors/
│       ├── image.processor.ts   # Image processing & thumbnails
│       ├── video.processor.ts   # Video processing
│       └── metadata.processor.ts # File metadata extraction
├── storage/                    # File storage abstraction
│   ├── storage.service.ts      # Storage interface
│   ├── local-storage.service.ts # Local filesystem storage
│   └── cloud-storage.service.ts # Future cloud storage
└── middleware/
    └── file-access.middleware.ts # Route-level file access control
```

### Frontend Components (React)

```
frontend/src/
├── components/files/
│   ├── FileUpload/
│   │   ├── DragDropZone.tsx    # Drag & drop handling
│   │   ├── FileUploadProgress.tsx # Upload progress
│   │   └── FileUploadQueue.tsx # Multiple upload management
│   ├── MediaPlayer/
│   │   ├── ImageViewer.tsx     # Image display
│   │   ├── VideoPlayer.tsx     # Video playback
│   │   ├── AudioPlayer.tsx     # Audio playback
│   │   └── MediaEmbed.tsx      # Unified media component
│   ├── FilePreview/
│   │   ├── FileThumbnail.tsx   # File preview thumbnails
│   │   ├── FileInfo.tsx        # File metadata display
│   │   └── AttachmentList.tsx  # Message attachment display
│   └── FileManagement/
│       ├── FileBrowser.tsx     # File browsing (admin)
│       └── FileSettings.tsx    # File upload settings
├── hooks/
│   ├── useFileUpload.ts        # File upload logic
│   ├── useFileAccess.ts        # File permission checking
│   └── useMediaPlayer.ts       # Media playback state
└── features/files/
    ├── filesApi.ts             # RTK Query file API
    └── filesSlice.ts           # File-related state
```

## Implementation Phases

### Phase 1: Core Infrastructure
- Database schema and entities
- File storage service abstraction
- Basic upload/download endpoints
- File validation and security

### Phase 2: Permission System
- File access middleware
- RBAC integration for file permissions
- Message attachment linking
- Public file management

### Phase 3: Frontend Upload Interface
- Drag & drop components
- Upload progress tracking
- File preview and thumbnails
- Integration with message system

### Phase 4: Multimedia Support
- Image/video/audio processing
- Embedded media players
- Thumbnail generation
- Metadata extraction

### Phase 5: Advanced Features
- File management interfaces
- Upload quotas and limits
- File cleanup and maintenance
- Performance optimizations

## Technical Specifications

### File Types Supported
- **Images**: JPG, PNG, GIF, WebP, SVG
- **Videos**: MP4, WebM, MOV, AVI
- **Audio**: MP3, WAV, OGG, AAC
- **Documents**: PDF, TXT, DOC, DOCX
- **Archives**: ZIP, RAR, 7Z
- **Code**: Various source code files

### Size Limits (Hardcoded Initially)
- **Message Attachments**: 100MB per file, 200MB total per message
- **Public Files**: 
  - Avatars: 10MB
  - Banners: 25MB
  - Custom Emojis: 5MB

### Security Features
- File type validation (MIME type + magic bytes)
- Malware scanning (future enhancement)
- Access control middleware
- Rate limiting on uploads
- Content Security Policy headers
- Secure file serving with proper headers

### Performance Considerations
- Streaming uploads for large files
- Progressive image loading
- Lazy loading for media players
- CDN-ready file serving
- Efficient thumbnail generation
- File cleanup and garbage collection

## Integration Points

### Message System Integration
- Extend message entities to support attachments
- WebSocket events for file upload progress
- Message creation with attached files
- File deletion when messages are deleted

### User System Integration
- User avatar and banner management
- File upload permissions based on roles
- User file quotas and usage tracking

### Community System Integration
- Community-specific file permissions
- Custom emoji uploads for communities
- Community banners and assets

## Next Steps

1. Review and approve this design document
2. Implement Phase 1 (Core Infrastructure)
3. Set up database migrations for file entities
4. Create basic file upload/download endpoints
5. Implement security and validation layers
6. Begin frontend drag & drop interface development

This design provides a solid foundation for a scalable, secure file upload system that can grow with the application's needs while maintaining Discord-like functionality and user experience.