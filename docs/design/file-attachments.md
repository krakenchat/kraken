# File Attachments in Messages Implementation Plan

## 🎯 Overview

Implement a comprehensive file attachment system allowing users to upload, share, and manage files within messages. This includes drag & drop upload, file previews, security controls, and proper storage management.

## 📊 Current State

**Backend**: 🔧 Partial Implementation
- Prisma schema has `Attachment` type in Message model
- Upload directory structure exists (`backend/uploads/`)
- Basic file upload for avatars/banners working

**Frontend**: ❌ Missing
- No drag & drop file upload in message input
- No file attachment display in messages
- No file management interface
- No file type validation or previews

## 🏗️ Architecture

### Database Schema (Already Complete)

```prisma
type Attachment {
  url      String    # File URL/path
  filename String    # Original filename
  filetype String    # MIME type
  size     Int       # File size in bytes
}

model Message {
  // ... existing fields
  attachments Attachment[]  # Array of file attachments
}
```

### Storage Architecture

```typescript
// File storage abstraction layer
interface FileStorageProvider {
  upload(file: Buffer, path: string): Promise<string>;
  delete(path: string): Promise<void>;
  getUrl(path: string): string;
  generateSignedUrl(path: string, expiresIn: number): Promise<string>;
}

// Local filesystem provider
class LocalStorageProvider implements FileStorageProvider {
  // Implementation for local file storage
}

// Future: S3/CloudStorage provider
class CloudStorageProvider implements FileStorageProvider {
  // Implementation for cloud storage
}
```

### File Organization

```
backend/uploads/
├── attachments/
│   ├── YYYY/MM/DD/          # Date-based organization
│   │   ├── [messageId]/     # Message-specific folders
│   │   │   ├── [uuid]-original-filename.ext
│   │   │   └── thumbnails/  # Generated thumbnails
│   │   │       └── [uuid]-thumb.jpg
├── temp/                    # Temporary upload staging
└── thumbnails/              # Generated thumbnails cache
```

## 🔧 Implementation Details

### Backend Implementation

#### 1. File Upload Service

```typescript
// backend/src/storage/storage.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp'; // For image processing

@Injectable()
export class StorageService {
  constructor(private configService: ConfigService) {}

  private readonly uploadDir = this.configService.get('UPLOAD_DIR', 'uploads');
  private readonly maxFileSize = 50 * 1024 * 1024; // 50MB
  private readonly allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'text/plain', 'text/markdown',
    'application/json',
    'video/mp4', 'video/webm',
    'audio/mp3', 'audio/wav', 'audio/ogg',
    'application/zip', 'application/x-rar-compressed',
  ];

  async uploadFile(
    file: Express.Multer.File,
    messageId: string,
    userId: string,
  ): Promise<Attachment> {
    // Validate file
    this.validateFile(file);

    // Generate unique filename
    const fileId = uuidv4();
    const ext = path.extname(file.originalname);
    const filename = `${fileId}-${file.originalname}`;
    
    // Create date-based directory structure
    const now = new Date();
    const dateDir = `${now.getFullYear()}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}`;
    const messageDir = path.join(this.uploadDir, 'attachments', dateDir, messageId);
    
    // Ensure directory exists
    await fs.mkdir(messageDir, { recursive: true });
    
    // Save file
    const filePath = path.join(messageDir, filename);
    await fs.writeFile(filePath, file.buffer);
    
    // Generate thumbnail for images
    let thumbnailPath: string | null = null;
    if (this.isImage(file.mimetype)) {
      thumbnailPath = await this.generateThumbnail(filePath, messageDir, fileId);
    }
    
    // Return attachment metadata
    return {
      url: this.getFileUrl(filePath),
      filename: file.originalname,
      filetype: file.mimetype,
      size: file.size,
      thumbnailUrl: thumbnailPath ? this.getFileUrl(thumbnailPath) : null,
    };
  }

  private validateFile(file: Express.Multer.File): void {
    // Size validation
    if (file.size > this.maxFileSize) {
      throw new BadRequestException('File too large');
    }

    // Type validation
    if (!this.allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('File type not allowed');
    }

    // Filename validation
    if (!/^[a-zA-Z0-9._\-\s]+$/.test(file.originalname)) {
      throw new BadRequestException('Invalid filename');
    }
  }

  private async generateThumbnail(
    originalPath: string,
    messageDir: string,
    fileId: string,
  ): Promise<string> {
    const thumbnailDir = path.join(messageDir, 'thumbnails');
    await fs.mkdir(thumbnailDir, { recursive: true });
    
    const thumbnailPath = path.join(thumbnailDir, `${fileId}-thumb.jpg`);
    
    await sharp(originalPath)
      .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(thumbnailPath);
    
    return thumbnailPath;
  }

  private isImage(mimetype: string): boolean {
    return mimetype.startsWith('image/');
  }

  private getFileUrl(filePath: string): string {
    // Convert absolute path to URL
    const relativePath = path.relative(this.uploadDir, filePath);
    return `/uploads/${relativePath.replace(/\\/g, '/')}`;
  }

  async deleteFile(url: string): Promise<void> {
    const filePath = path.join(this.uploadDir, url.replace('/uploads/', ''));
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  }
}
```

#### 2. File Upload Controller

```typescript
// backend/src/attachments/attachments.controller.ts

import { 
  Controller, 
  Post, 
  Delete, 
  UseGuards, 
  UseInterceptors, 
  UploadedFiles,
  Body,
  Param,
  BadRequestException
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RbacGuard } from '@/auth/rbac.guard';
import { RequiredActions } from '@/auth/rbac-action.decorator';
import { RbacResource } from '@/auth/rbac-resource.decorator';
import { StorageService } from '@/storage/storage.service';
import { MessagesService } from '@/messages/messages.service';

@Controller('attachments')
@UseGuards(JwtAuthGuard, RbacGuard)
export class AttachmentsController {
  constructor(
    private readonly storageService: StorageService,
    private readonly messagesService: MessagesService,
  ) {}

  @Post(':messageId')
  @RequiredActions(RbacActions.CREATE_ATTACHMENT)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    idKey: 'messageId',
    source: ResourceIdSource.PARAM,
  })
  @UseInterceptors(FilesInterceptor('files', 5)) // Max 5 files per message
  async uploadAttachments(
    @Param('messageId') messageId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    // Process all files
    const attachments = await Promise.all(
      files.map(file => 
        this.storageService.uploadFile(file, messageId, req.user.id)
      )
    );

    // Add attachments to message
    const message = await this.messagesService.findOne(messageId);
    const updatedAttachments = [...(message.attachments || []), ...attachments];
    
    const updatedMessage = await this.messagesService.update(messageId, {
      attachments: updatedAttachments
    });

    return { attachments, message: updatedMessage };
  }

  @Delete(':messageId/:attachmentIndex')
  @RequiredActions(RbacActions.DELETE_ATTACHMENT)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    idKey: 'messageId',
    source: ResourceIdSource.PARAM,
  })
  async deleteAttachment(
    @Param('messageId') messageId: string,
    @Param('attachmentIndex') attachmentIndex: string,
  ) {
    const message = await this.messagesService.findOne(messageId);
    const index = parseInt(attachmentIndex);
    
    if (!message.attachments || index >= message.attachments.length) {
      throw new BadRequestException('Attachment not found');
    }

    // Delete physical file
    await this.storageService.deleteFile(message.attachments[index].url);

    // Remove from message
    const updatedAttachments = message.attachments.filter((_, i) => i !== index);
    const updatedMessage = await this.messagesService.update(messageId, {
      attachments: updatedAttachments
    });

    return updatedMessage;
  }
}
```

#### 3. Enhanced Message Service

```typescript
// backend/src/messages/messages.service.ts (Enhanced)

async createWithAttachments(
  createMessageDto: CreateMessageDto,
  files?: Express.Multer.File[]
): Promise<Message> {
  // Create message first
  const message = await this.create(createMessageDto);

  // Process attachments if provided
  if (files && files.length > 0) {
    const attachments = await Promise.all(
      files.map(file => 
        this.storageService.uploadFile(file, message.id, createMessageDto.userId)
      )
    );

    // Update message with attachments
    return this.update(message.id, { attachments });
  }

  return message;
}
```

### Frontend Implementation

#### 1. File Upload Hook

```typescript
// frontend/src/hooks/useFileUpload.ts

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface FileUploadState {
  files: File[];
  uploading: boolean;
  progress: number;
  error: string | null;
}

export const useFileUpload = (onUpload: (files: File[]) => Promise<void>) => {
  const [state, setState] = useState<FileUploadState>({
    files: [],
    uploading: false,
    progress: 0,
    error: null,
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setState(prev => ({
      ...prev,
      files: [...prev.files, ...acceptedFiles],
      error: null,
    }));
  }, []);

  const removeFile = useCallback((index: number) => {
    setState(prev => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
    }));
  }, []);

  const uploadFiles = useCallback(async () => {
    if (state.files.length === 0) return;

    setState(prev => ({ ...prev, uploading: true, progress: 0 }));

    try {
      await onUpload(state.files);
      setState(prev => ({ ...prev, files: [], uploading: false, progress: 100 }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        uploading: false,
        error: error.message || 'Upload failed',
      }));
    }
  }, [state.files, onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 50 * 1024 * 1024, // 50MB
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
      'text/*': ['.txt', '.md'],
      'video/*': ['.mp4', '.webm'],
      'audio/*': ['.mp3', '.wav', '.ogg'],
    },
  });

  return {
    ...state,
    isDragActive,
    getRootProps,
    getInputProps,
    removeFile,
    uploadFiles,
  };
};
```

#### 2. File Attachment Display Component

```typescript
// frontend/src/components/Message/MessageAttachments.tsx

import React from 'react';
import { Box, Card, CardMedia, Typography, IconButton, Chip } from '@mui/material';
import { 
  Download as DownloadIcon,
  Image as ImageIcon,
  Description as DocumentIcon,
  VideoFile as VideoIcon,
  AudioFile as AudioIcon,
} from '@mui/icons-material';

interface MessageAttachmentsProps {
  attachments: Attachment[];
  onDownload?: (attachment: Attachment) => void;
}

export const MessageAttachments: React.FC<MessageAttachmentsProps> = ({ 
  attachments, 
  onDownload 
}) => {
  if (!attachments || attachments.length === 0) return null;

  const getFileIcon = (filetype: string) => {
    if (filetype.startsWith('image/')) return <ImageIcon />;
    if (filetype.startsWith('video/')) return <VideoIcon />;
    if (filetype.startsWith('audio/')) return <AudioIcon />;
    return <DocumentIcon />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Box mt={1} display="flex" flexDirection="column" gap={1}>
      {attachments.map((attachment, index) => (
        <Card key={index} variant="outlined" sx={{ maxWidth: 400 }}>
          {/* Image preview */}
          {attachment.filetype.startsWith('image/') && (
            <CardMedia
              component="img"
              height="200"
              image={attachment.thumbnailUrl || attachment.url}
              alt={attachment.filename}
              sx={{ objectFit: 'contain', cursor: 'pointer' }}
              onClick={() => window.open(attachment.url, '_blank')}
            />
          )}
          
          {/* File info */}
          <Box p={2} display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1} flex={1} minWidth={0}>
              {getFileIcon(attachment.filetype)}
              <Box minWidth={0}>
                <Typography 
                  variant="body2" 
                  fontWeight="medium"
                  noWrap
                  title={attachment.filename}
                >
                  {attachment.filename}
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="caption" color="text.secondary">
                    {formatFileSize(attachment.size)}
                  </Typography>
                  <Chip 
                    label={attachment.filetype.split('/')[1].toUpperCase()} 
                    size="small" 
                    variant="outlined"
                  />
                </Box>
              </Box>
            </Box>
            
            <IconButton 
              size="small" 
              onClick={() => onDownload?.(attachment)}
              href={attachment.url}
              download={attachment.filename}
            >
              <DownloadIcon />
            </IconButton>
          </Box>
        </Card>
      ))}
    </Box>
  );
};
```

#### 3. Enhanced Message Input with File Upload

```typescript
// frontend/src/components/Message/MessageInput.tsx (Enhanced)

import { useFileUpload } from '../../hooks/useFileUpload';
import { AttachFile as AttachIcon } from '@mui/icons-material';

export const MessageInput: React.FC<MessageInputProps> = ({ channelId }) => {
  const [content, setContent] = useState('');
  const [sendMessage] = useSendMessageMutation();
  
  const handleFileUpload = useCallback(async (files: File[]) => {
    const formData = new FormData();
    formData.append('content', JSON.stringify(parseMessageContent(content)));
    files.forEach(file => formData.append('files', file));

    await sendMessage({ channelId, formData }).unwrap();
    setContent('');
  }, [content, channelId, sendMessage]);

  const {
    files,
    uploading,
    isDragActive,
    getRootProps,
    getInputProps,
    removeFile,
    uploadFiles,
  } = useFileUpload(handleFileUpload);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (files.length > 0) {
      await uploadFiles();
    } else if (content.trim()) {
      await sendMessage({
        channelId,
        content: parseMessageContent(content.trim()),
      }).unwrap();
      setContent('');
    }
  };

  return (
    <Box
      {...getRootProps()}
      sx={{
        p: 2,
        border: 2,
        borderColor: isDragActive ? 'primary.main' : 'transparent',
        borderRadius: 1,
        transition: 'border-color 0.2s',
      }}
    >
      <input {...getInputProps()} />
      
      {/* File preview area */}
      {files.length > 0 && (
        <Box mb={2} display="flex" flexWrap="wrap" gap={1}>
          {files.map((file, index) => (
            <Chip
              key={index}
              label={`${file.name} (${formatFileSize(file.size)})`}
              onDelete={() => removeFile(index)}
              deleteIcon={<CloseIcon />}
            />
          ))}
        </Box>
      )}

      <Box display="flex" alignItems="flex-end" gap={1}>
        <TextField
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={isDragActive ? "Drop files here..." : "Type a message..."}
          multiline
          maxRows={4}
          fullWidth
          disabled={uploading}
        />
        
        <input
          type="file"
          multiple
          style={{ display: 'none' }}
          id="file-input"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length > 0) {
              onDrop(files);
            }
          }}
        />
        
        <IconButton
          component="label"
          htmlFor="file-input"
          disabled={uploading}
        >
          <AttachIcon />
        </IconButton>
        
        <IconButton
          type="submit"
          color="primary"
          disabled={uploading || (!content.trim() && files.length === 0)}
          onClick={handleSubmit}
        >
          {uploading ? <CircularProgress size={20} /> : <SendIcon />}
        </IconButton>
      </Box>
    </Box>
  );
};
```

#### 4. File Upload Progress Component

```typescript
// frontend/src/components/Message/FileUploadProgress.tsx

import React from 'react';
import { Box, LinearProgress, Typography, Alert } from '@mui/material';

interface FileUploadProgressProps {
  uploading: boolean;
  progress: number;
  error: string | null;
}

export const FileUploadProgress: React.FC<FileUploadProgressProps> = ({ 
  uploading, 
  progress, 
  error 
}) => {
  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 1 }}>
        {error}
      </Alert>
    );
  }

  if (!uploading) return null;

  return (
    <Box mt={1}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
        <Typography variant="caption" color="text.secondary">
          Uploading files...
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {Math.round(progress)}%
        </Typography>
      </Box>
      <LinearProgress variant="determinate" value={progress} />
    </Box>
  );
};
```

## 🔒 Security & Validation

### File Type Restrictions

```typescript
const ALLOWED_MIME_TYPES = {
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  documents: ['application/pdf', 'text/plain', 'text/markdown'],
  videos: ['video/mp4', 'video/webm'],
  audio: ['audio/mp3', 'audio/wav', 'audio/ogg'],
  archives: ['application/zip', 'application/x-rar-compressed'],
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILES_PER_MESSAGE = 5;
```

### Malware Scanning (Future)

```typescript
// Integration with antivirus scanning service
const scanFile = async (filePath: string): Promise<boolean> => {
  // Integration with ClamAV or cloud-based scanning
  return true; // File is clean
};
```

## 📁 File Structure

### New Files
```
backend/src/storage/
├── storage.service.ts         # File storage abstraction
├── storage.module.ts          # Storage module configuration
└── providers/
    ├── local-storage.provider.ts    # Local filesystem provider
    └── cloud-storage.provider.ts    # Cloud storage provider (future)

backend/src/attachments/
├── attachments.controller.ts  # File upload/delete endpoints
├── attachments.service.ts     # Attachment business logic
└── attachments.module.ts      # Attachments module

frontend/src/components/Message/
├── MessageAttachments.tsx     # Display file attachments
├── FileUploadProgress.tsx     # Upload progress indicator
└── AttachmentPreview.tsx      # File preview modal

frontend/src/hooks/
├── useFileUpload.ts           # File upload state management
└── useAttachmentDownload.ts   # File download handling
```

### Modified Files
```
backend/src/messages/
├── messages.service.ts        # Add attachment handling
├── messages.controller.ts     # Support file uploads
└── messages.gateway.ts        # WebSocket file events

frontend/src/components/Message/
├── MessageInput.tsx           # Add file upload interface
├── MessageComponent.tsx       # Display attachments
└── MessageList.tsx            # Handle attachment display

backend/src/auth/rbac/
└── rbac-actions.enum.ts       # Add file permissions
```

## 🧪 Testing Strategy

### Unit Tests
- File validation logic
- Storage service methods
- Upload progress tracking
- Attachment display components

### Integration Tests
- File upload end-to-end flow
- File deletion and cleanup
- Permission enforcement
- Large file handling

### Manual Testing Checklist
- [ ] Drag & drop file upload works
- [ ] Multiple file selection works
- [ ] File type validation enforced
- [ ] File size limits respected
- [ ] Thumbnail generation for images
- [ ] File download works correctly
- [ ] File deletion removes physical files
- [ ] Upload progress shows correctly
- [ ] Error handling for failed uploads

## ⏱️ Implementation Timeline

**Estimated Time: 2-3 weeks**

### Week 1: Backend Foundation
- [ ] Create storage service and providers
- [ ] Implement file upload controller
- [ ] Add attachment endpoints
- [ ] Set up file validation and security

### Week 2: Frontend Implementation  
- [ ] Build file upload components
- [ ] Create attachment display components
- [ ] Integrate with message input/display
- [ ] Add drag & drop functionality

### Week 3: Polish & Optimization
- [ ] Add thumbnail generation
- [ ] Implement upload progress
- [ ] Error handling and validation
- [ ] Performance optimization and testing

## 🚀 Success Metrics

- File upload success rate >95%
- Upload progress updates smoothly
- Thumbnails generate within 2 seconds
- No memory leaks during large uploads
- Proper file cleanup when messages deleted
- Fast file preview loading (<500ms)

## 🔗 Dependencies

- Multer (Node.js file upload)
- Sharp (Image processing)
- react-dropzone (Drag & drop upload)
- Material-UI (UI components)
- RBAC system (existing)

## 🎯 Future Enhancements

### Advanced Features
- Cloud storage integration (S3, GCS, Azure)
- Video/audio file previews
- File sharing permissions
- File version history
- Advanced image editing tools
- OCR for document searchability

### Performance Optimizations
- Progressive upload for large files
- CDN integration for file delivery
- Image optimization and compression
- Lazy loading for attachment previews

## 📝 Notes

- Start with local storage, add cloud storage later
- Focus on images first, expand to other file types
- Consider bandwidth limits for video files
- Implement proper CORS for file serving
- Add rate limiting for upload endpoints
- Consider file encryption for sensitive attachments