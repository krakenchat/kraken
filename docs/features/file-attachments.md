# File Attachments System Implementation Plan

File attachments are a **core expectation** in modern chat applications. Kraken has excellent foundational infrastructure for file handling but needs completion of the message integration and user interface components.

## 🏗️ **Current Infrastructure Status**

### ✅ **Excellent Backend Foundation**

#### **Database Schema** - Perfect Attachment Support
```prisma
// Message model already supports attachments
model Message {
  attachments Attachment[]
  // ... other fields
}

type Attachment {
  url      String  // File URL/path
  filename String  // Original filename
  filetype String  // MIME type
  size     Int     // File size in bytes
}
```

#### **Upload Directory Structure** - Organized Storage
```
backend/uploads/
├── channel/     # Channel message attachments
├── community/   # Community assets (avatars, banners)  
├── dm/          # Direct message attachments
├── profile/     # User avatars and profile images
└── temp/        # Temporary upload staging
```

#### **Existing Upload Functionality** - Avatar/Banner System Working
- Community avatar/banner uploads functional
- User profile picture uploads working
- File validation and processing patterns established
- Proper error handling for upload failures

### ✅ **Frontend Upload Components** - Reusable Patterns
```typescript
// Existing working upload components:
// - CommunityAvatarUpload.tsx
// - CommunityBannerUpload.tsx
// - ProfileImageUpload.tsx (implied from avatarUrl support)
```

### ❌ **Missing Message Integration** - 70% Complete Foundation

#### **No Message Attachments UI**:
- No drag & drop file upload in message input
- No attachment preview in message display
- No file download/open functionality
- No progress indicators for uploads

#### **Missing Backend Endpoints**:
- File upload endpoint for message attachments
- File serving/download endpoints
- Attachment metadata endpoints
- File cleanup/garbage collection

## 📋 **Complete Implementation Plan**

### **Phase 1: Backend File API (3-4 hours)**

#### **1.1 File Upload Controller**
**File**: `backend/src/attachments/attachments.controller.ts` (New Module)

```typescript
@Controller('attachments')
@UseGuards(JwtAuthGuard)
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = this.attachmentsService.getUploadPath(req.body.context);
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueName = this.attachmentsService.generateUniqueFilename(file.originalname);
          cb(null, uniqueName);
        },
      }),
      fileFilter: (req, file, cb) => {
        // File type validation
        const allowed = this.attachmentsService.isFileTypeAllowed(file.mimetype);
        cb(null, allowed);
      },
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
        files: 10, // Max 10 files per upload
      },
    })
  )
  async uploadFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() uploadDto: FileUploadDto,
    @Request() req,
  ): Promise<FileUploadResponse[]> {
    return this.attachmentsService.processUploadedFiles(
      files,
      uploadDto,
      req.user.id,
    );
  }

  @Get(':fileId')
  async getFile(
    @Param('fileId') fileId: string,
    @Response() res,
  ) {
    const file = await this.attachmentsService.getFileById(fileId);
    if (!file) {
      throw new NotFoundException('File not found');
    }
    
    // Security: Check user has access to this file
    // Implementation depends on file context (channel membership, DM access, etc.)
    
    return res.sendFile(file.path, { root: './' });
  }

  @Get(':fileId/download')
  async downloadFile(
    @Param('fileId') fileId: string,
    @Response() res,
  ) {
    const file = await this.attachmentsService.getFileById(fileId);
    if (!file) {
      throw new NotFoundException('File not found');
    }
    
    res.download(file.path, file.originalName);
  }

  @Delete(':fileId')
  async deleteFile(
    @Param('fileId') fileId: string,
    @Request() req,
  ) {
    return this.attachmentsService.deleteFile(fileId, req.user.id);
  }
}
```

#### **1.2 Attachment Service**
**File**: `backend/src/attachments/attachments.service.ts`

```typescript
@Injectable()
export class AttachmentsService {
  constructor(private readonly prisma: DatabaseService) {}

  async processUploadedFiles(
    files: Express.Multer.File[],
    uploadDto: FileUploadDto,
    userId: string,
  ): Promise<FileUploadResponse[]> {
    const processedFiles: FileUploadResponse[] = [];

    for (const file of files) {
      try {
        // Validate file
        this.validateFile(file);
        
        // Generate thumbnail if image
        const thumbnailPath = await this.generateThumbnailIfImage(file);
        
        // Create database record
        const fileRecord = await this.prisma.fileAttachment.create({
          data: {
            originalName: file.originalname,
            filename: file.filename,
            mimetype: file.mimetype,
            size: file.size,
            path: file.path,
            thumbnailPath,
            uploadedById: userId,
            context: uploadDto.context,
            contextId: uploadDto.contextId,
          },
        });

        processedFiles.push({
          id: fileRecord.id,
          url: `/api/attachments/${fileRecord.id}`,
          filename: file.originalname,
          filetype: file.mimetype,
          size: file.size,
          thumbnailUrl: thumbnailPath ? `/api/attachments/${fileRecord.id}/thumbnail` : undefined,
        });
      } catch (error) {
        // Clean up failed upload
        if (file.path && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
        throw error;
      }
    }

    return processedFiles;
  }

  private validateFile(file: Express.Multer.File): void {
    // File type restrictions
    const allowedTypes = [
      // Images
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      // Documents  
      'application/pdf', 'text/plain', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      // Archives
      'application/zip', 'application/x-rar-compressed',
      // Code files
      'text/javascript', 'text/css', 'application/json',
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(`File type ${file.mimetype} not allowed`);
    }

    // Size validation (handled by multer, but double-check)
    if (file.size > 50 * 1024 * 1024) {
      throw new BadRequestException('File too large (max 50MB)');
    }
  }

  private async generateThumbnailIfImage(file: Express.Multer.File): Promise<string | null> {
    if (!file.mimetype.startsWith('image/')) {
      return null;
    }

    try {
      const sharp = require('sharp');
      const thumbnailPath = file.path.replace(/\.[^/.]+$/, '_thumb.webp');
      
      await sharp(file.path)
        .resize(200, 200, { 
          fit: 'inside',
          withoutEnlargement: true 
        })
        .webp({ quality: 80 })
        .toFile(thumbnailPath);
        
      return thumbnailPath;
    } catch (error) {
      console.warn('Failed to generate thumbnail:', error);
      return null;
    }
  }

  getUploadPath(context: 'channel' | 'dm' | 'community' | 'profile'): string {
    const basePath = 'uploads';
    const datePath = new Date().toISOString().slice(0, 7); // YYYY-MM format
    
    switch (context) {
      case 'channel':
        return path.join(basePath, 'channel', datePath);
      case 'dm':
        return path.join(basePath, 'dm', datePath);
      case 'community':
        return path.join(basePath, 'community');
      case 'profile':
        return path.join(basePath, 'profile');
      default:
        return path.join(basePath, 'temp');
    }
  }

  generateUniqueFilename(originalName: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    const extension = path.extname(originalName);
    const baseName = path.basename(originalName, extension);
    
    return `${baseName}_${timestamp}_${random}${extension}`;
  }

  async cleanupTempFiles(): Promise<void> {
    // Cleanup files older than 24 hours in temp directory
    const tempDir = path.join('uploads', 'temp');
    const files = await fs.promises.readdir(tempDir);
    const now = Date.now();
    
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stats = await fs.promises.stat(filePath);
      const ageHours = (now - stats.mtime.getTime()) / (1000 * 60 * 60);
      
      if (ageHours > 24) {
        await fs.promises.unlink(filePath);
      }
    }
  }
}
```

#### **1.3 File Database Model**
**File**: `backend/prisma/schema.prisma` (Add to existing)

```prisma
model FileAttachment {
  id           String   @id @default(auto()) @map("_id") @db.ObjectId
  originalName String
  filename     String
  mimetype     String
  size         Int
  path         String
  thumbnailPath String?
  uploadedById String   @db.ObjectId
  context      String   // 'channel', 'dm', 'community', 'profile'
  contextId    String   // channelId, dmGroupId, communityId, userId
  createdAt    DateTime @default(now())
  
  uploadedBy   User     @relation(fields: [uploadedById], references: [id])
}
```

### **Phase 2: Frontend File Upload Components (4-6 hours)**

#### **2.1 File Upload Hook**
**File**: `frontend/src/hooks/useFileUpload.ts`

```typescript
interface FileUploadOptions {
  context: 'channel' | 'dm' | 'community' | 'profile';
  contextId: string;
  maxFiles?: number;
  maxSize?: number;
  allowedTypes?: string[];
  onProgress?: (progress: number) => void;
  onComplete?: (files: FileUploadResponse[]) => void;
  onError?: (error: string) => void;
}

export function useFileUpload(options: FileUploadOptions) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<FileUploadResponse[]>([]);

  const uploadFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    
    // Validate files
    const validationError = validateFiles(files, options);
    if (validationError) {
      options.onError?.(validationError);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      
      files.forEach((file) => {
        formData.append('files', file);
      });
      
      formData.append('context', options.context);
      formData.append('contextId', options.contextId);

      const response = await fetch('/api/attachments/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        // Progress tracking
        onUploadProgress: (progressEvent) => {
          const progress = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(progress);
          options.onProgress?.(progress);
        },
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const uploadedFiles: FileUploadResponse[] = await response.json();
      setUploadedFiles(uploadedFiles);
      options.onComplete?.(uploadedFiles);
      
    } catch (error) {
      console.error('File upload error:', error);
      options.onError?.(error.message);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [options]);

  return {
    uploadFiles,
    isUploading,
    uploadProgress,
    uploadedFiles,
  };
}

function validateFiles(files: File[], options: FileUploadOptions): string | null {
  if (files.length > (options.maxFiles || 10)) {
    return `Too many files (max ${options.maxFiles || 10})`;
  }

  for (const file of files) {
    if (file.size > (options.maxSize || 50 * 1024 * 1024)) {
      return `File "${file.name}" is too large (max ${formatFileSize(options.maxSize || 50 * 1024 * 1024)})`;
    }

    if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
      return `File type "${file.type}" not allowed for "${file.name}"`;
    }
  }

  return null;
}
```

#### **2.2 Drag & Drop File Upload**
**File**: `frontend/src/components/Message/FileUploadZone.tsx`

```typescript
interface FileUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  isUploading?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function FileUploadZone({ 
  onFilesSelected, 
  isUploading, 
  className, 
  children 
}: FileUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFilesSelected(files);
    }
  }, [onFilesSelected]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesSelected(files);
    }
    // Clear input to allow same file selection
    e.target.value = '';
  }, [onFilesSelected]);

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <>
      <Box
        className={className}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFileDialog}
        sx={{
          position: 'relative',
          cursor: isUploading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          opacity: isUploading ? 0.6 : 1,
          ...(isDragOver && {
            backgroundColor: 'action.hover',
            transform: 'scale(1.02)',
          }),
        }}
      >
        {children}
        
        {isDragOver && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'primary.main',
              opacity: 0.1,
              borderRadius: 1,
              border: '2px dashed',
              borderColor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1,
            }}
          >
            <Typography variant="h6" color="primary">
              Drop files here
            </Typography>
          </Box>
        )}
      </Box>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={handleFileInputChange}
        accept="image/*,application/pdf,text/plain,.doc,.docx,.zip,.rar"
      />
    </>
  );
}
```

#### **2.3 Enhanced Message Input with File Support**
**File**: `frontend/src/components/Message/MessageInput.tsx` (Enhance existing)

```typescript
export default function MessageInput({ channelId, authorId }: MessageInputProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedAttachments, setUploadedAttachments] = useState<FileUploadResponse[]>([]);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const sendMessage = useSendMessageSocket(() => setSending(false));

  const { uploadFiles, isUploading, uploadProgress } = useFileUpload({
    context: 'channel',
    contextId: channelId,
    onComplete: (files) => {
      setUploadedAttachments(prev => [...prev, ...files]);
      setSelectedFiles([]);
    },
    onError: (error) => {
      console.error('Upload failed:', error);
      // Show error notification
    },
  });

  const handleFilesSelected = useCallback((files: File[]) => {
    setSelectedFiles(prev => [...prev, ...files]);
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleRemoveAttachment = useCallback((index: number) => {
    setUploadedAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSend = async () => {
    if (!text.trim() && selectedFiles.length === 0 && uploadedAttachments.length === 0) {
      return;
    }

    setSending(true);

    try {
      // Upload any pending files first
      if (selectedFiles.length > 0) {
        await uploadFiles(selectedFiles);
        // Wait for upload completion
        return; // Send will be called again after upload completion
      }

      const msg: NewMessagePayload = {
        channelId,
        authorId,
        spans: [{ type: SpanType.PLAINTEXT, text }],
        attachments: uploadedAttachments,
        reactions: [],
        sentAt: new Date().toISOString(),
      };

      sendMessage(msg);
      setText("");
      setUploadedAttachments([]);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <Box sx={{ width: "100%" }}>
      {/* File Previews */}
      {(selectedFiles.length > 0 || uploadedAttachments.length > 0) && (
        <Box sx={{ mb: 1 }}>
          <FilePreviewList
            files={selectedFiles}
            attachments={uploadedAttachments}
            onRemoveFile={handleRemoveFile}
            onRemoveAttachment={handleRemoveAttachment}
            uploadProgress={isUploading ? uploadProgress : undefined}
          />
        </Box>
      )}

      <form onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
        <FileUploadZone onFilesSelected={handleFilesSelected} isUploading={isUploading}>
          <StyledPaper elevation={2}>
            <StyledTextField
              fullWidth
              size="small"
              variant="outlined"
              placeholder="Type a message or drag files here..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              sx={{ flex: 1 }}
              inputRef={inputRef}
              multiline
              maxRows={4}
            />
            
            <IconButton
              onClick={() => handleFilesSelected([])}
              disabled={isUploading}
            >
              <AttachFileIcon />
            </IconButton>
            
            <IconButton
              color="primary"
              type="submit"
              disabled={sending || isUploading || (!text.trim() && selectedFiles.length === 0 && uploadedAttachments.length === 0)}
            >
              {sending || isUploading ? (
                <CircularProgress size={24} />
              ) : (
                <SendIcon />
              )}
            </IconButton>
          </StyledPaper>
        </FileUploadZone>
      </form>
    </Box>
  );
}
```

### **Phase 3: File Display Components (3-4 hours)**

#### **3.1 Attachment Display in Messages**
**File**: `frontend/src/components/Message/MessageAttachments.tsx`

```typescript
interface MessageAttachmentsProps {
  attachments: Attachment[];
}

export function MessageAttachments({ attachments }: MessageAttachmentsProps) {
  if (attachments.length === 0) return null;

  return (
    <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {attachments.map((attachment, index) => (
        <AttachmentItem key={index} attachment={attachment} />
      ))}
    </Box>
  );
}

function AttachmentItem({ attachment }: { attachment: Attachment }) {
  const isImage = attachment.filetype.startsWith('image/');
  const [imageError, setImageError] = useState(false);

  const handleDownload = () => {
    window.open(`${attachment.url}/download`, '_blank');
  };

  if (isImage && !imageError) {
    return (
      <Box sx={{ maxWidth: 400 }}>
        <img
          src={attachment.url}
          alt={attachment.filename}
          style={{
            maxWidth: '100%',
            height: 'auto',
            borderRadius: 8,
            cursor: 'pointer',
          }}
          onClick={() => window.open(attachment.url, '_blank')}
          onError={() => setImageError(true)}
        />
        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.7 }}>
          {attachment.filename} • {formatFileSize(attachment.size)}
        </Typography>
      </Box>
    );
  }

  return (
    <Paper
      sx={{
        p: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        maxWidth: 400,
        cursor: 'pointer',
        '&:hover': { backgroundColor: 'action.hover' },
      }}
      onClick={handleDownload}
    >
      <FileIcon filetype={attachment.filetype} />
      
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-all' }}>
          {attachment.filename}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {formatFileSize(attachment.size)}
        </Typography>
      </Box>
      
      <IconButton size="small">
        <GetAppIcon />
      </IconButton>
    </Paper>
  );
}

function FileIcon({ filetype }: { filetype: string }) {
  if (filetype.startsWith('image/')) return <ImageIcon color="primary" />;
  if (filetype === 'application/pdf') return <PictureAsPdfIcon color="error" />;
  if (filetype.includes('word') || filetype.includes('document')) return <DescriptionIcon color="info" />;
  if (filetype.includes('zip') || filetype.includes('rar')) return <ArchiveIcon color="warning" />;
  return <InsertDriveFileIcon color="action" />;
}

function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}
```

#### **3.2 File Preview Component**
**File**: `frontend/src/components/Message/FilePreviewList.tsx`

```typescript
interface FilePreviewListProps {
  files: File[];
  attachments: FileUploadResponse[];
  onRemoveFile: (index: number) => void;
  onRemoveAttachment: (index: number) => void;
  uploadProgress?: number;
}

export function FilePreviewList({
  files,
  attachments,
  onRemoveFile,
  onRemoveAttachment,
  uploadProgress,
}: FilePreviewListProps) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
      {/* Pending files */}
      {files.map((file, index) => (
        <FilePreviewItem
          key={`file-${index}`}
          file={file}
          onRemove={() => onRemoveFile(index)}
          uploadProgress={uploadProgress}
        />
      ))}
      
      {/* Uploaded attachments */}
      {attachments.map((attachment, index) => (
        <AttachmentPreviewItem
          key={`attachment-${index}`}
          attachment={attachment}
          onRemove={() => onRemoveAttachment(index)}
        />
      ))}
    </Box>
  );
}

function FilePreviewItem({ 
  file, 
  onRemove, 
  uploadProgress 
}: { 
  file: File; 
  onRemove: () => void; 
  uploadProgress?: number;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
    
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [file]);

  return (
    <Box sx={{ position: 'relative', width: 100, height: 100 }}>
      <Paper
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {preview ? (
          <img
            src={preview}
            alt={file.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Box sx={{ textAlign: 'center', p: 1 }}>
            <FileIcon filetype={file.type} />
            <Typography variant="caption" sx={{ display: 'block', wordBreak: 'break-all' }}>
              {file.name.length > 10 ? file.name.substring(0, 10) + '...' : file.name}
            </Typography>
          </Box>
        )}
        
        {/* Upload Progress */}
        {uploadProgress !== undefined && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CircularProgress
              variant="determinate"
              value={uploadProgress}
              size={40}
              sx={{ color: 'white' }}
            />
            <Typography
              variant="caption"
              sx={{
                position: 'absolute',
                color: 'white',
                fontWeight: 600,
              }}
            >
              {uploadProgress}%
            </Typography>
          </Box>
        )}
      </Paper>
      
      {/* Remove Button */}
      <IconButton
        size="small"
        onClick={onRemove}
        sx={{
          position: 'absolute',
          top: -8,
          right: -8,
          backgroundColor: 'error.main',
          color: 'white',
          '&:hover': { backgroundColor: 'error.dark' },
        }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
```

### **Phase 4: Security & Optimization (2-3 hours)**

#### **4.1 File Security Measures**
```typescript
// File type validation
const ALLOWED_FILE_TYPES = {
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  documents: ['application/pdf', 'text/plain', 'application/msword'],
  archives: ['application/zip', 'application/x-rar-compressed'],
  code: ['text/javascript', 'text/css', 'application/json'],
};

// File size limits by type
const FILE_SIZE_LIMITS = {
  'image/*': 10 * 1024 * 1024, // 10MB for images
  'application/pdf': 25 * 1024 * 1024, // 25MB for PDFs
  'default': 50 * 1024 * 1024, // 50MB default
};

// Virus scanning integration (future)
async function scanFileForViruses(filePath: string): Promise<boolean> {
  // Integration with ClamAV or similar
  return true;
}
```

#### **4.2 Performance Optimizations**
```typescript
// Image compression before upload
async function compressImage(file: File, maxWidth = 1920, quality = 0.8): Promise<File> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob(resolve, 'image/jpeg', quality);
    };
    
    img.src = URL.createObjectURL(file);
  });
}

// Lazy loading for image attachments
const LazyImage = ({ src, alt, ...props }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { threshold: 0.1 }
    );
    
    if (imgRef.current) observer.observe(imgRef.current);
    
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef}>
      {isInView && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setIsLoaded(true)}
          style={{ opacity: isLoaded ? 1 : 0 }}
          {...props}
        />
      )}
    </div>
  );
};
```

## 📊 **Implementation Timeline**

| Phase | Duration | Complexity | Priority |
|-------|----------|------------|----------|
| **Phase 1: Backend API** | 3-4 hours | Medium | Critical |
| **Phase 2: Upload Components** | 4-6 hours | High | Critical |
| **Phase 3: Display Components** | 3-4 hours | Medium | High |
| **Phase 4: Security & Polish** | 2-3 hours | Medium | High |

**Total Implementation Time: 12-17 hours**

## 🎯 **Success Metrics**

### **MVP Complete (Phase 1-2)**:
- ✅ Users can drag & drop files into message input
- ✅ Files upload with progress indicators
- ✅ Uploaded files appear as message attachments
- ✅ Basic file type validation and size limits

### **Full Feature Complete (All Phases)**:
- ✅ Images display inline with thumbnails
- ✅ Files downloadable with proper MIME types
- ✅ Security measures prevent malicious uploads
- ✅ Performance optimized for large files

## 🚀 **Future Enhancements**

### **Advanced Features**:
1. **Cloud Storage Integration** - S3, CloudFlare, etc.
2. **Advanced Image Processing** - EXIF removal, format conversion
3. **File Versioning** - Track file edits and versions
4. **Collaborative Editing** - Google Docs-like functionality
5. **File Organization** - Folders, tags, search

### **Mobile Optimizations**:
1. **Camera Integration** - Take photos directly
2. **File Picker** - Access device files
3. **Offline Queue** - Upload when connection restored

This file attachment system would bring Kraken to full parity with Discord's file sharing capabilities while providing a solid foundation for future enhancements and integrations.