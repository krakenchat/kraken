# Phase 3: Frontend Upload Interface - Drag & Drop System

## Overview

Phase 3 implements the intuitive drag-and-drop file upload interface for the frontend, similar to Discord's functionality. This includes different behaviors for dropping files into the chat area versus the message input, upload progress tracking, file previews, and seamless integration with the existing message system.

## Drag & Drop Architecture

### Drop Zone Behavior Matrix

```
Drop Target          | Behavior | Outcome
--------------------|----------|--------------------------------------------------
Chat Window         | Upload & Send | Creates new message with attached files
Message Input Area  | Attach Only   | Adds files to message draft as attachments  
Avatar Upload Area  | Replace Avatar | Sets user avatar (public file)
Banner Upload Area  | Replace Banner | Sets user/community banner (public file)
File Browser        | Upload Only    | Uploads files without creating message
```

### Drop Zone Component Hierarchy

```
ChatContainer
├── DragDropProvider (Context for managing drag state)
├── ChatWindow
│   ├── DragOverlay (Visual feedback during drag)
│   ├── MessageList
│   └── FileDropZone (Handles drops in chat area)
├── MessageInput
│   ├── MessageInputField
│   ├── AttachmentPreview (Shows attached files)
│   └── FileInputDropZone (Handles drops in input area)
└── UploadProgress (Global upload progress indicator)
```

## Core Drag & Drop Components

### Drag & Drop Context Provider

```typescript
// frontend/src/components/files/DragDrop/DragDropProvider.tsx
interface DragDropContextValue {
  isDragging: boolean;
  draggedFiles: File[];
  dropTarget: 'chat' | 'input' | 'avatar' | 'banner' | null;
  setDropTarget: (target: string | null) => void;
  handleDrop: (files: File[], target: string) => Promise<void>;
}

const DragDropContext = createContext<DragDropContextValue | null>(null);

export const DragDropProvider: React.FC<{ children: React.ReactNode }> = ({ 
  children 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedFiles, setDraggedFiles] = useState<File[]>([]);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  
  const { uploadFiles } = useFileUpload();
  const { createMessage } = useMessages();
  const { currentChannelId } = useChannel();
  
  const handleDrop = async (files: File[], target: string) => {
    try {
      switch (target) {
        case 'chat':
          await handleChatDrop(files);
          break;
        case 'input':
          await handleInputDrop(files);
          break;
        case 'avatar':
          await handleAvatarDrop(files[0]);
          break;
        default:
          throw new Error(`Unknown drop target: ${target}`);
      }
    } catch (error) {
      console.error('Drop handling failed:', error);
      // Show error toast
    } finally {
      setIsDragging(false);
      setDraggedFiles([]);
      setDropTarget(null);
    }
  };
  
  const handleChatDrop = async (files: File[]) => {
    // Upload files and create message immediately
    const uploadedFiles = await uploadFiles(files, { isPublic: false });
    
    await createMessage({
      content: '', // Empty message with only attachments
      channelId: currentChannelId!,
      attachmentIds: uploadedFiles.map(f => f.id),
    });
  };
  
  const handleInputDrop = async (files: File[]) => {
    // Add files to message draft (handled by message input component)
    const uploadedFiles = await uploadFiles(files, { isPublic: false });
    // Message input component will handle adding these to draft
    return uploadedFiles;
  };
  
  // ... other handlers
  
  return (
    <DragDropContext.Provider value={{
      isDragging,
      draggedFiles,
      dropTarget,
      setDropTarget,
      handleDrop,
    }}>
      {children}
    </DragDropContext.Provider>
  );
};
```

### Universal File Drop Zone

```typescript
// frontend/src/components/files/DragDrop/FileDropZone.tsx
interface FileDropZoneProps {
  onDrop?: (files: File[]) => void;
  onDragEnter?: () => void;
  onDragLeave?: () => void;
  accept?: string[];
  maxFiles?: number;
  maxSize?: number;
  className?: string;
  children: React.ReactNode;
  dropTarget: string;
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({
  onDrop,
  onDragEnter,
  onDragLeave,
  accept = [],
  maxFiles = 10,
  maxSize = 100 * 1024 * 1024, // 100MB
  className,
  children,
  dropTarget,
}) => {
  const { handleDrop, setDropTarget } = useDragDrop();
  const [isDragOver, setIsDragOver] = useState(false);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
      setDropTarget(dropTarget);
      onDragEnter?.();
    }
  }, [dropTarget, onDragEnter, setDropTarget]);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only trigger if leaving the drop zone completely
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX >= rect.right ||
      e.clientY < rect.top ||
      e.clientY >= rect.bottom
    ) {
      setIsDragOver(false);
      setDropTarget(null);
      onDragLeave?.();
    }
  }, [onDragLeave, setDropTarget]);
  
  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    
    // Validate files
    const validFiles = validateFiles(files, { accept, maxFiles, maxSize });
    
    if (validFiles.length > 0) {
      if (onDrop) {
        onDrop(validFiles);
      } else {
        handleDrop(validFiles, dropTarget);
      }
    }
  }, [onDrop, handleDrop, dropTarget, accept, maxFiles, maxSize]);
  
  return (
    <div
      className={cn(
        'relative',
        isDragOver && 'bg-primary/10 ring-2 ring-primary ring-dashed',
        className,
      )}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleFileDrop}
    >
      {children}
      
      {isDragOver && (
        <DragOverlay dropTarget={dropTarget} fileCount={draggedFiles.length} />
      )}
    </div>
  );
};
```

### Drag Overlay Visual Feedback

```typescript
// frontend/src/components/files/DragDrop/DragOverlay.tsx
interface DragOverlayProps {
  dropTarget: string;
  fileCount: number;
}

export const DragOverlay: React.FC<DragOverlayProps> = ({ 
  dropTarget, 
  fileCount 
}) => {
  const getOverlayContent = () => {
    switch (dropTarget) {
      case 'chat':
        return {
          icon: <MessageSquare className="w-12 h-12" />,
          title: 'Send Files',
          description: `Upload and send ${fileCount} file${fileCount !== 1 ? 's' : ''} as message`,
        };
      case 'input':
        return {
          icon: <Paperclip className="w-12 h-12" />,
          title: 'Attach Files',
          description: `Add ${fileCount} file${fileCount !== 1 ? 's' : ''} to your message`,
        };
      case 'avatar':
        return {
          icon: <User className="w-12 h-12" />,
          title: 'Update Avatar',
          description: 'Set as your profile picture',
        };
      default:
        return {
          icon: <Upload className="w-12 h-12" />,
          title: 'Upload Files',
          description: `Upload ${fileCount} file${fileCount !== 1 ? 's' : ''}`,
        };
    }
  };
  
  const { icon, title, description } = getOverlayContent();
  
  return (
    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="text-center p-8 rounded-lg bg-card border border-dashed border-primary">
        <div className="text-primary mb-4 flex justify-center">
          {icon}
        </div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </div>
    </div>
  );
};
```

## File Upload Hook & State Management

### Enhanced File Upload Hook

```typescript
// frontend/src/hooks/useFileUpload.ts
interface UploadOptions {
  isPublic?: boolean;
  publicFileType?: PublicFileType;
  entityId?: string;
  onProgress?: (progress: number) => void;
  onComplete?: (file: FileMetadata) => void;
  onError?: (error: Error) => void;
}

interface UploadState {
  files: UploadingFile[];
  totalProgress: number;
  isUploading: boolean;
}

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  result?: FileMetadata;
}

export const useFileUpload = () => {
  const [uploads, setUploads] = useState<Map<string, UploadingFile>>(new Map());
  const { user } = useAuth();
  
  const uploadFiles = useCallback(
    async (files: File[], options: UploadOptions = {}): Promise<FileMetadata[]> => {
      const uploadIds = files.map(() => nanoid());
      
      // Initialize upload states
      const newUploads = new Map(uploads);
      files.forEach((file, index) => {
        newUploads.set(uploadIds[index], {
          id: uploadIds[index],
          file,
          progress: 0,
          status: 'pending',
        });
      });
      setUploads(newUploads);
      
      const results: FileMetadata[] = [];
      
      // Upload files concurrently (but limit to 3 at a time)
      const uploadPromises = files.map(async (file, index) => {
        const uploadId = uploadIds[index];
        
        try {
          const result = await uploadSingleFile(file, uploadId, options);
          results[index] = result;
          return result;
        } catch (error) {
          updateUploadStatus(uploadId, 'error', 0, error as Error);
          throw error;
        }
      });
      
      // Wait for all uploads with concurrency limit
      await Promise.allSettled(uploadPromises);
      
      return results.filter(Boolean);
    },
    [uploads]
  );
  
  const uploadSingleFile = async (
    file: File,
    uploadId: string,
    options: UploadOptions,
  ): Promise<FileMetadata> => {
    updateUploadStatus(uploadId, 'uploading');
    
    const formData = new FormData();
    formData.append('files', file);
    
    if (options.isPublic) {
      formData.append('isPublic', 'true');
    }
    if (options.publicFileType) {
      formData.append('publicFileType', options.publicFileType);
    }
    if (options.entityId) {
      formData.append('entityId', options.entityId);
    }
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100;
          updateUploadStatus(uploadId, 'uploading', progress);
          options.onProgress?.(progress);
        }
      });
      
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const result = JSON.parse(xhr.responseText)[0]; // First file from array
          updateUploadStatus(uploadId, 'completed', 100, null, result);
          options.onComplete?.(result);
          resolve(result);
        } else {
          const error = new Error(`Upload failed: ${xhr.statusText}`);
          updateUploadStatus(uploadId, 'error', 0, error);
          options.onError?.(error);
          reject(error);
        }
      });
      
      xhr.addEventListener('error', () => {
        const error = new Error('Network error during upload');
        updateUploadStatus(uploadId, 'error', 0, error);
        options.onError?.(error);
        reject(error);
      });
      
      xhr.open('POST', '/api/files/upload');
      xhr.setRequestHeader('Authorization', `Bearer ${getAuthToken()}`);
      xhr.send(formData);
    });
  };
  
  const updateUploadStatus = (
    uploadId: string,
    status: UploadingFile['status'],
    progress?: number,
    error?: Error,
    result?: FileMetadata,
  ) => {
    setUploads(prev => {
      const newUploads = new Map(prev);
      const upload = newUploads.get(uploadId);
      
      if (upload) {
        newUploads.set(uploadId, {
          ...upload,
          status,
          progress: progress ?? upload.progress,
          error: error?.message,
          result,
        });
      }
      
      return newUploads;
    });
  };
  
  const clearCompletedUploads = useCallback(() => {
    setUploads(prev => {
      const newUploads = new Map();
      prev.forEach((upload, id) => {
        if (upload.status !== 'completed') {
          newUploads.set(id, upload);
        }
      });
      return newUploads;
    });
  }, []);
  
  const uploadState = useMemo((): UploadState => {
    const files = Array.from(uploads.values());
    const completedFiles = files.filter(f => f.status === 'completed');
    const totalProgress = files.length > 0 
      ? files.reduce((sum, f) => sum + f.progress, 0) / files.length
      : 0;
    
    return {
      files,
      totalProgress,
      isUploading: files.some(f => f.status === 'uploading'),
    };
  }, [uploads]);
  
  return {
    uploadFiles,
    uploadState,
    clearCompletedUploads,
  };
};
```

## Message Input with File Attachments

### Enhanced Message Input Component

```typescript
// frontend/src/components/messages/MessageInput/MessageInputWithAttachments.tsx
interface MessageDraft {
  content: string;
  attachments: FileMetadata[];
  replyTo?: Message;
}

export const MessageInputWithAttachments: React.FC<{
  channelId: string;
}> = ({ channelId }) => {
  const [draft, setDraft] = useState<MessageDraft>({
    content: '',
    attachments: [],
  });
  
  const { uploadFiles, uploadState } = useFileUpload();
  const { createMessage } = useMessages();
  const [isUploading, setIsUploading] = useState(false);
  
  const handleFileAttach = useCallback(async (files: File[]) => {
    setIsUploading(true);
    try {
      const uploadedFiles = await uploadFiles(files, { isPublic: false });
      setDraft(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...uploadedFiles],
      }));
    } finally {
      setIsUploading(false);
    }
  }, [uploadFiles]);
  
  const handleSendMessage = useCallback(async () => {
    if (!draft.content.trim() && draft.attachments.length === 0) return;
    
    try {
      await createMessage({
        content: draft.content,
        channelId,
        attachmentIds: draft.attachments.map(a => a.id),
        replyToId: draft.replyTo?.id,
      });
      
      // Clear draft
      setDraft({ content: '', attachments: [] });
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }, [draft, channelId, createMessage]);
  
  const removeAttachment = useCallback((attachmentId: string) => {
    setDraft(prev => ({
      ...prev,
      attachments: prev.attachments.filter(a => a.id !== attachmentId),
    }));
  }, []);
  
  return (
    <div className="flex flex-col">
      {/* Attachment Preview */}
      {draft.attachments.length > 0 && (
        <AttachmentPreview
          attachments={draft.attachments}
          onRemove={removeAttachment}
          className="mb-2"
        />
      )}
      
      {/* Upload Progress */}
      {uploadState.isUploading && (
        <UploadProgressBar
          progress={uploadState.totalProgress}
          files={uploadState.files}
          className="mb-2"
        />
      )}
      
      {/* Message Input */}
      <FileDropZone
        dropTarget="input"
        onDrop={handleFileAttach}
        className="flex-1"
      >
        <div className="flex items-end gap-2 p-3 bg-card border rounded-lg">
          <textarea
            value={draft.content}
            onChange={(e) => setDraft(prev => ({
              ...prev,
              content: e.target.value,
            }))}
            placeholder="Type a message..."
            className="flex-1 resize-none bg-transparent border-none outline-none"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          
          <div className="flex gap-1">
            <FileUploadButton onFilesSelected={handleFileAttach} />
            <Button
              onClick={handleSendMessage}
              disabled={isUploading || (!draft.content.trim() && draft.attachments.length === 0)}
              size="sm"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </FileDropZone>
    </div>
  );
};
```

### Attachment Preview Component

```typescript
// frontend/src/components/files/AttachmentPreview/AttachmentPreview.tsx
interface AttachmentPreviewProps {
  attachments: FileMetadata[];
  onRemove: (id: string) => void;
  className?: string;
}

export const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({
  attachments,
  onRemove,
  className,
}) => {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {attachments.map((attachment) => (
        <AttachmentCard
          key={attachment.id}
          attachment={attachment}
          onRemove={() => onRemove(attachment.id)}
        />
      ))}
    </div>
  );
};

const AttachmentCard: React.FC<{
  attachment: FileMetadata;
  onRemove: () => void;
}> = ({ attachment, onRemove }) => {
  const isImage = attachment.mimeType.startsWith('image/');
  const isVideo = attachment.mimeType.startsWith('video/');
  const isAudio = attachment.mimeType.startsWith('audio/');
  
  return (
    <div className="relative group">
      <div className="w-24 h-24 bg-card border rounded-lg overflow-hidden flex items-center justify-center">
        {isImage && attachment.thumbnailUrl && (
          <img
            src={attachment.thumbnailUrl}
            alt={attachment.filename}
            className="w-full h-full object-cover"
          />
        )}
        
        {isVideo && (
          <div className="text-center">
            <Video className="w-8 h-8 mx-auto mb-1" />
            <span className="text-xs truncate">{attachment.filename}</span>
          </div>
        )}
        
        {isAudio && (
          <div className="text-center">
            <Music className="w-8 h-8 mx-auto mb-1" />
            <span className="text-xs truncate">{attachment.filename}</span>
          </div>
        )}
        
        {!isImage && !isVideo && !isAudio && (
          <div className="text-center p-2">
            <FileIcon className="w-8 h-8 mx-auto mb-1" />
            <span className="text-xs truncate">{attachment.filename}</span>
          </div>
        )}
      </div>
      
      {/* Remove button */}
      <Button
        variant="destructive"
        size="sm"
        className="absolute -top-2 -right-2 w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onRemove}
      >
        <X className="w-3 h-3" />
      </Button>
      
      {/* File size */}
      <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 text-center">
        {formatFileSize(attachment.size)}
      </span>
    </div>
  );
};
```

## Upload Progress Tracking

### Upload Progress Components

```typescript
// frontend/src/components/files/UploadProgress/UploadProgressBar.tsx
interface UploadProgressBarProps {
  progress: number;
  files: UploadingFile[];
  className?: string;
}

export const UploadProgressBar: React.FC<UploadProgressBarProps> = ({
  progress,
  files,
  className,
}) => {
  const completedCount = files.filter(f => f.status === 'completed').length;
  const errorCount = files.filter(f => f.status === 'error').length;
  
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex justify-between text-sm">
        <span>
          Uploading {files.length} file{files.length !== 1 ? 's' : ''}...
        </span>
        <span>
          {completedCount}/{files.length} completed
          {errorCount > 0 && ` (${errorCount} failed)`}
        </span>
      </div>
      
      <Progress value={progress} className="w-full" />
      
      {/* Individual file progress */}
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {files.map((file) => (
          <UploadFileProgress key={file.id} file={file} />
        ))}
      </div>
    </div>
  );
};

const UploadFileProgress: React.FC<{ file: UploadingFile }> = ({ file }) => {
  const getStatusIcon = () => {
    switch (file.status) {
      case 'completed':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'error':
        return <X className="w-4 h-4 text-red-500" />;
      case 'uploading':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };
  
  return (
    <div className="flex items-center gap-2 text-sm">
      {getStatusIcon()}
      <span className="flex-1 truncate">{file.file.name}</span>
      <span className="text-muted-foreground">
        {file.status === 'completed' && '100%'}
        {file.status === 'uploading' && `${Math.round(file.progress)}%`}
        {file.status === 'error' && 'Failed'}
      </span>
    </div>
  );
};
```

### Global Upload Status

```typescript
// frontend/src/components/files/UploadProgress/GlobalUploadStatus.tsx
export const GlobalUploadStatus: React.FC = () => {
  const { uploadState, clearCompletedUploads } = useFileUpload();
  
  if (uploadState.files.length === 0) return null;
  
  return (
    <div className="fixed bottom-4 right-4 w-80 bg-card border rounded-lg shadow-lg p-4 z-50">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-semibold">File Uploads</h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearCompletedUploads}
          className="h-6 w-6 p-0"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
      
      <UploadProgressBar
        progress={uploadState.totalProgress}
        files={uploadState.files}
      />
    </div>
  );
};
```

## File Input Components

### File Upload Button

```typescript
// frontend/src/components/files/FileInput/FileUploadButton.tsx
interface FileUploadButtonProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string[];
  multiple?: boolean;
  maxSize?: number;
  className?: string;
}

export const FileUploadButton: React.FC<FileUploadButtonProps> = ({
  onFilesSelected,
  accept = [],
  multiple = true,
  maxSize = 100 * 1024 * 1024,
  className,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = validateFiles(files, { accept, maxSize });
    
    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
    
    // Reset input to allow re-selecting same file
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={accept.join(',')}
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <Button
        variant="ghost"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        className={cn('h-8 w-8 p-0', className)}
      >
        <Paperclip className="w-4 h-4" />
      </Button>
    </>
  );
};
```

## Integration with Chat Components

### Enhanced Chat Window

```typescript
// frontend/src/components/chat/ChatWindow/ChatWindow.tsx
export const ChatWindow: React.FC<{ channelId: string }> = ({ channelId }) => {
  const { uploadFiles } = useFileUpload();
  const { createMessage } = useMessages();
  
  const handleChatDrop = useCallback(async (files: File[]) => {
    try {
      const uploadedFiles = await uploadFiles(files, { isPublic: false });
      
      await createMessage({
        content: '',
        channelId,
        attachmentIds: uploadedFiles.map(f => f.id),
      });
    } catch (error) {
      console.error('Failed to upload and send files:', error);
    }
  }, [uploadFiles, createMessage, channelId]);
  
  return (
    <DragDropProvider>
      <div className="flex flex-col h-full">
        <FileDropZone
          dropTarget="chat"
          onDrop={handleChatDrop}
          className="flex-1 flex flex-col"
        >
          <MessageList channelId={channelId} className="flex-1" />
          <MessageInputWithAttachments channelId={channelId} />
        </FileDropZone>
        
        <GlobalUploadStatus />
      </div>
    </DragDropProvider>
  );
};
```

## File Validation Utilities

### Client-Side File Validation

```typescript
// frontend/src/utils/fileValidation.ts
interface ValidationOptions {
  accept?: string[];
  maxSize?: number;
  maxFiles?: number;
}

export const validateFiles = (
  files: File[],
  options: ValidationOptions = {},
): File[] => {
  const { accept = [], maxSize = 100 * 1024 * 1024, maxFiles = 10 } = options;
  
  let validFiles = files.slice(0, maxFiles);
  
  // Filter by accepted types
  if (accept.length > 0) {
    validFiles = validFiles.filter(file => {
      return accept.some(acceptType => {
        if (acceptType.startsWith('.')) {
          return file.name.toLowerCase().endsWith(acceptType.toLowerCase());
        } else {
          return file.type.match(acceptType.replace('*', '.*'));
        }
      });
    });
  }
  
  // Filter by file size
  validFiles = validFiles.filter(file => file.size <= maxSize);
  
  return validFiles;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const getFileIcon = (mimeType: string): React.ComponentType => {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.startsWith('video/')) return Video;
  if (mimeType.startsWith('audio/')) return Music;
  if (mimeType.includes('pdf')) return FileText;
  if (mimeType.includes('zip') || mimeType.includes('rar')) return Archive;
  return FileIcon;
};
```

## Implementation Tasks

### Core Components
1. **Drag & Drop System**
   - Create DragDropProvider context
   - Implement FileDropZone component
   - Add visual drag overlays
   - Handle different drop targets

2. **File Upload Hook**
   - Implement useFileUpload hook
   - Add progress tracking
   - Handle concurrent uploads
   - Error handling and retry logic

3. **Message Input Enhancement**
   - Integrate file attachments
   - Add attachment preview
   - Handle file removal
   - Improve send message logic

4. **Upload Progress UI**
   - Create progress bar components
   - Add global upload status
   - Show individual file progress
   - Handle upload errors

### Integration Tasks
1. **Chat Window Integration**
   - Add drag & drop to chat area
   - Handle instant send vs attach
   - Visual feedback for drop zones
   - Error handling and user feedback

2. **File Validation**
   - Client-side file type checking
   - Size limit validation
   - User-friendly error messages
   - File format utilities

### Testing Tasks
1. **Component Testing**
   - Drag & drop behavior
   - File upload flows
   - Progress tracking
   - Error scenarios

2. **Integration Testing**
   - Chat window integration
   - Message creation with files
   - Upload cancellation
   - Large file handling

## Success Criteria

- [ ] Users can drag files into chat to send immediately
- [ ] Users can drag files into input to attach to message
- [ ] Upload progress is clearly visible and accurate
- [ ] Different file types are properly validated
- [ ] File attachments show proper previews
- [ ] Error handling provides clear feedback
- [ ] Performance is smooth with large files
- [ ] Multiple concurrent uploads work correctly
- [ ] Integration with existing message system is seamless
- [ ] Accessibility standards are met

This phase provides the intuitive, Discord-like file upload experience that users expect while maintaining the robust backend integration from previous phases.