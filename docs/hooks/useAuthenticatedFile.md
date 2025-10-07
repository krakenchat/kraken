# useAuthenticatedFile

> **Location:** `frontend/src/hooks/useAuthenticatedFile.ts`
> **Type:** Effect Hook / API Hook
> **Category:** files, download, metadata, caching

## Overview

`useAuthenticatedFile` is an advanced React hook for fetching files requiring authentication. Unlike `useAuthenticatedImage` which only fetches the file blob, this hook can optionally fetch file metadata (filename, size, MIME type, etc.) in addition to or instead of the blob. It uses the centralized caching system for blob URLs while independently fetching metadata when needed. This hook is ideal for file attachments in messages, downloadable files, and any scenario where file information is needed.

## Hook Signature

```typescript
function useAuthenticatedFile(
  fileId: string | null | undefined,
  options?: {
    fetchBlob?: boolean;      // Default: true
    fetchMetadata?: boolean;  // Default: false
  }
): UseAuthenticatedFileReturn
```

### Parameters

```typescript
interface UseAuthenticatedFileParams {
  fileId: string | null | undefined;  // File ID to fetch
  options?: {
    fetchBlob?: boolean;              // Whether to fetch blob URL for download/display
    fetchMetadata?: boolean;          // Whether to fetch file metadata (name, size, etc.)
  };
}
```

**Parameter Details:**
- **`fileId`** - MongoDB ObjectId of the file
  - When `null` or `undefined`, no fetch occurs
  - Changes trigger re-fetch
- **`options.fetchBlob`** - Default: `true`
  - Fetches file blob and converts to blob URL
  - Uses centralized cache with promise deduplication
- **`options.fetchMetadata`** - Default: `false`
  - Fetches file metadata from `/api/file/${fileId}/metadata`
  - Independent from blob fetching

### Return Value

```typescript
interface UseAuthenticatedFileReturn {
  blobUrl: string | null;            // Blob URL for download/display
  metadata: FileMetadata | null;     // File metadata (if requested)
  isLoading: boolean;                // True if any fetch is in progress
  isLoadingBlob: boolean;            // True while fetching blob
  isLoadingMetadata: boolean;        // True while fetching metadata
  error: Error | null;               // Error if any fetch failed
}

interface FileMetadata {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
}
```

## Usage Examples

### Basic Usage - Blob Only (Like useAuthenticatedImage)

```tsx
import { useAuthenticatedFile } from '@/hooks/useAuthenticatedFile';

function FileDownloadButton({ fileId }: { fileId: string }) {
  const { blobUrl, isLoading, error } = useAuthenticatedFile(fileId);

  if (isLoading) return <CircularProgress size={20} />;
  if (error) return <ErrorIcon />;

  return (
    <a href={blobUrl!} download>
      <Button>Download File</Button>
    </a>
  );
}
```

### Advanced Usage - Metadata Only

```tsx
import { useAuthenticatedFile } from '@/hooks/useAuthenticatedFile';

function FileInfo({ fileId }: { fileId: string }) {
  const { metadata, isLoadingMetadata, error } = useAuthenticatedFile(fileId, {
    fetchBlob: false,      // Don't fetch blob - only metadata
    fetchMetadata: true,   // Fetch metadata
  });

  if (isLoadingMetadata) return <Skeleton width={200} />;
  if (error || !metadata) return <span>Unknown file</span>;

  return (
    <div>
      <p><strong>Name:</strong> {metadata.filename}</p>
      <p><strong>Size:</strong> {(metadata.size / 1024).toFixed(2)} KB</p>
      <p><strong>Type:</strong> {metadata.mimeType}</p>
    </div>
  );
}
```

### Complete Usage - Both Blob and Metadata

```tsx
import { useAuthenticatedFile } from '@/hooks/useAuthenticatedFile';
import { formatBytes } from '@/utils/formatters';

function MessageAttachment({ fileId }: { fileId: string }) {
  const {
    blobUrl,
    metadata,
    isLoadingBlob,
    isLoadingMetadata,
    error
  } = useAuthenticatedFile(fileId, {
    fetchBlob: true,
    fetchMetadata: true,
  });

  if (error) {
    return (
      <Paper sx={{ p: 2, bgcolor: 'error.light' }}>
        <ErrorIcon /> Failed to load attachment
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
      {/* File Icon based on MIME type */}
      <FileIcon mimeType={metadata?.mimeType} />

      {/* File Info */}
      <Box sx={{ flex: 1 }}>
        {isLoadingMetadata ? (
          <Skeleton width={150} />
        ) : (
          <>
            <Typography variant="body2">{metadata?.filename || 'Unknown'}</Typography>
            <Typography variant="caption" color="text.secondary">
              {metadata && formatBytes(metadata.size)}
            </Typography>
          </>
        )}
      </Box>

      {/* Download Button */}
      {isLoadingBlob ? (
        <CircularProgress size={20} />
      ) : (
        <IconButton
          component="a"
          href={blobUrl!}
          download={metadata?.filename}
          disabled={!blobUrl}
        >
          <DownloadIcon />
        </IconButton>
      )}
    </Paper>
  );
}
```

### Conditional Fetching

```tsx
function ExpandableFilePreview({ fileId }: { fileId: string }) {
  const [expanded, setExpanded] = useState(false);

  // Only fetch blob when expanded
  const { blobUrl, metadata, isLoading } = useAuthenticatedFile(fileId, {
    fetchBlob: expanded,       // Conditional blob fetch
    fetchMetadata: true,       // Always fetch metadata
  });

  return (
    <div>
      <Button onClick={() => setExpanded(!expanded)}>
        {expanded ? 'Hide' : 'Show'} Preview
      </Button>

      {/* Metadata always available */}
      {metadata && <p>{metadata.filename}</p>}

      {/* Preview only when expanded */}
      {expanded && (
        <>
          {isLoading ? (
            <Skeleton height={200} />
          ) : blobUrl ? (
            <img src={blobUrl} alt={metadata?.filename} />
          ) : null}
        </>
      )}
    </div>
  );
}
```

## Implementation Details

### Internal State

```typescript
const [blobUrl, setBlobUrl] = useState<string | null>(null);
const [metadata, setMetadata] = useState<FileMetadata | null>(null);
const [isLoadingBlob, setIsLoadingBlob] = useState(false);
const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
const [error, setError] = useState<Error | null>(null);
```

**State Management:**
- **Separate Loading States**: Independent tracking for blob and metadata
- **Shared Error State**: Single error for both fetch operations
- **Cancellation Token**: Prevents state updates after unmount

### Dependencies

#### Internal Hooks
- `useState` - Manages blob, metadata, loading, and error states
- `useEffect` - Triggers fetches when fileId or options change
- `useFileCache` - Accesses centralized blob caching

#### External Dependencies
- `FileCacheContext` - Centralized blob caching with promise deduplication
- `getCachedItem` - Retrieves JWT token from localStorage
- Browser Fetch API - Downloads files and metadata

### Fetch Flow

```typescript
useEffect(() => {
  if (!fileId) {
    // Clear all state
    return;
  }

  let isCancelled = false;

  const fetchData = async () => {
    try {
      // Fetch blob using centralized cache (if requested)
      if (fetchBlob) {
        setIsLoadingBlob(true);
        const url = await fileCache.fetchBlob(fileId); // Cached + deduplicated
        if (!isCancelled) {
          setBlobUrl(url);
          setIsLoadingBlob(false);
        }
      }

      // Fetch metadata independently (if requested)
      if (fetchMetadata) {
        setIsLoadingMetadata(true);
        const token = getCachedItem<string>("accessToken");
        const response = await fetch(`/api/file/${fileId}/metadata`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!isCancelled) {
          setMetadata(data);
          setIsLoadingMetadata(false);
        }
      }
    } catch (err) {
      if (!isCancelled) {
        setError(err);
        // Clear both on error
      }
    }
  };

  fetchData();

  return () => {
    isCancelled = true;
  };
}, [fileId, fetchBlob, fetchMetadata, fileCache]);
```

## Blob Caching vs Metadata Fetching

### Blob Fetching (Cached)

```typescript
// Uses FileCacheContext.fetchBlob
// - Memory cache: fileId → blob URL
// - Promise deduplication: multiple requests → 1 network call
// - Persistent across component mounts
const url = await fileCache.fetchBlob(fileId);
```

**Benefits:**
- No duplicate fetches for same file
- Instant return for cached blobs
- Shared cache across entire app

### Metadata Fetching (Not Cached)

```typescript
// Independent fetch to metadata endpoint
// - No caching (metadata is small and changes rarely)
// - Separate from blob fetch
// - Can be fetched without blob
const response = await fetch(`/api/file/${fileId}/metadata`);
```

**Why Not Cached:**
- Metadata is small (~200 bytes)
- Changes infrequently
- Simpler to re-fetch than maintain cache
- Different lifecycle than blobs

## API Integration

### Blob Endpoint

```
GET /api/file/:fileId
Authorization: Bearer <token>

Response: <binary file data>
```

**Handled by:** `FileCacheContext.fetchBlob()`

### Metadata Endpoint

```
GET /api/file/:fileId/metadata
Authorization: Bearer <token>

Response:
{
  "id": "64f7b1234567890abcdef123",
  "filename": "document.pdf",
  "mimeType": "application/pdf",
  "size": 1048576,
  "uploadedAt": "2025-01-06T12:00:00.000Z",
  "uploadedBy": "user-id-123"
}
```

**Handled by:** Direct fetch in hook

## Performance Considerations

### Optimization Strategies

1. **Selective Fetching**
   - Fetch only what you need (blob, metadata, or both)
   - Defer blob fetch for collapsed UI elements
   - Always fetch metadata first if needed for display

2. **Blob Caching Benefits**
   - Same as `useAuthenticatedImage`
   - Multiple components sharing same file = 1 fetch
   - Promise deduplication prevents race conditions

3. **Metadata Efficiency**
   - Small payload (~200 bytes)
   - Fast response time
   - No caching overhead

4. **Loading State Granularity**
   - Separate loading states for blob and metadata
   - Show filename immediately while blob loads
   - Progressive enhancement

### Example: Progressive Loading

```tsx
function ProgressiveFileDisplay({ fileId }: { fileId: string }) {
  const { blobUrl, metadata, isLoadingMetadata, isLoadingBlob } = useAuthenticatedFile(fileId, {
    fetchBlob: true,
    fetchMetadata: true,
  });

  // Phase 1: Show filename immediately (metadata loads faster)
  return (
    <div>
      <p>{metadata?.filename || (isLoadingMetadata ? 'Loading...' : 'Unknown file')}</p>

      {/* Phase 2: Show blob when available */}
      {isLoadingBlob && <CircularProgress />}
      {blobUrl && <img src={blobUrl} alt={metadata?.filename} />}
    </div>
  );
}
```

## Error Handling

### Error Scenarios

```typescript
// Blob fetch error (from FileCacheContext)
error.message = "Failed to fetch file: 404"
error.message = "No authentication token found"

// Metadata fetch error
error.message = "Failed to fetch metadata: 401"
error.message = "Failed to fetch metadata: 500"
```

### Error Recovery Patterns

```tsx
function FileWithFallback({ fileId }: { fileId: string }) {
  const { blobUrl, metadata, error } = useAuthenticatedFile(fileId, {
    fetchBlob: true,
    fetchMetadata: true,
  });

  if (error) {
    // Determine which fetch failed
    if (error.message.includes('metadata')) {
      // Metadata failed, show blob with generic name
      return (
        <div>
          <p>Attachment (name unavailable)</p>
          {blobUrl && <a href={blobUrl} download>Download</a>}
        </div>
      );
    } else {
      // Blob failed, show metadata without download
      return (
        <div>
          <p>{metadata?.filename || 'Attachment'} (unavailable)</p>
          <ErrorIcon /> Failed to load file
        </div>
      );
    }
  }

  // Normal rendering
  return <FileDisplay blobUrl={blobUrl} metadata={metadata} />;
}
```

## Use Cases

### Use Case 1: Message Attachments

```tsx
// Fetch metadata first, blob on demand
function MessageAttachmentList({ attachments }: { attachments: Attachment[] }) {
  return (
    <>
      {attachments.map(attachment => (
        <AttachmentItem key={attachment.id} fileId={attachment.fileId} />
      ))}
    </>
  );
}

function AttachmentItem({ fileId }: { fileId: string }) {
  const [downloadClicked, setDownloadClicked] = useState(false);

  const { blobUrl, metadata, isLoadingBlob } = useAuthenticatedFile(fileId, {
    fetchBlob: downloadClicked, // Only fetch when user clicks download
    fetchMetadata: true,        // Always show filename/size
  });

  return (
    <div>
      <p>{metadata?.filename}</p>
      <Button
        onClick={() => setDownloadClicked(true)}
        disabled={isLoadingBlob}
      >
        {isLoadingBlob ? 'Downloading...' : 'Download'}
      </Button>
      {blobUrl && <a href={blobUrl} download={metadata?.filename} hidden />}
    </div>
  );
}
```

### Use Case 2: Image Gallery with Metadata

```tsx
function ImageGalleryItem({ fileId }: { fileId: string }) {
  const { blobUrl, metadata, isLoading } = useAuthenticatedFile(fileId, {
    fetchBlob: true,
    fetchMetadata: true,
  });

  return (
    <Card>
      <CardMedia
        component="img"
        image={blobUrl || undefined}
        alt={metadata?.filename}
        sx={{ height: 200, objectFit: 'cover' }}
      />
      {isLoading && <Skeleton variant="rectangular" height={200} />}
      <CardContent>
        <Typography variant="caption">{metadata?.filename}</Typography>
        <Typography variant="caption" color="text.secondary">
          {metadata && formatBytes(metadata.size)}
        </Typography>
      </CardContent>
    </Card>
  );
}
```

### Use Case 3: File Type Detection

```tsx
function FilePreview({ fileId }: { fileId: string }) {
  const { blobUrl, metadata } = useAuthenticatedFile(fileId, {
    fetchBlob: true,
    fetchMetadata: true,
  });

  if (!metadata || !blobUrl) return <Skeleton />;

  // Render different preview based on MIME type
  if (metadata.mimeType.startsWith('image/')) {
    return <img src={blobUrl} alt={metadata.filename} />;
  }

  if (metadata.mimeType === 'application/pdf') {
    return <embed src={blobUrl} type="application/pdf" width="100%" height="600px" />;
  }

  if (metadata.mimeType.startsWith('video/')) {
    return <video src={blobUrl} controls />;
  }

  // Generic download for other types
  return (
    <a href={blobUrl} download={metadata.filename}>
      <FileIcon /> {metadata.filename}
    </a>
  );
}
```

## Testing

### Unit Tests

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useAuthenticatedFile } from '../useAuthenticatedFile';
import { FileCacheProvider } from '../../contexts/AvatarCacheContext';

describe('useAuthenticatedFile', () => {
  const wrapper = ({ children }) => (
    <FileCacheProvider>{children}</FileCacheProvider>
  );

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('should fetch only blob when metadata not requested', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['test'])),
    });

    const { result } = renderHook(
      () => useAuthenticatedFile('file-123', { fetchBlob: true, fetchMetadata: false }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.blobUrl).toBeTruthy());

    expect(result.current.metadata).toBeNull();
    expect(result.current.isLoadingMetadata).toBe(false);
  });

  it('should fetch only metadata when blob not requested', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'file-123',
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        size: 1024,
      }),
    });

    const { result } = renderHook(
      () => useAuthenticatedFile('file-123', { fetchBlob: false, fetchMetadata: true }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.metadata).toBeTruthy());

    expect(result.current.blobUrl).toBeNull();
    expect(result.current.metadata?.filename).toBe('test.pdf');
  });

  it('should fetch both blob and metadata', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(new Blob(['test'])),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'file-123',
          filename: 'test.pdf',
          size: 1024,
        }),
      });

    const { result } = renderHook(
      () => useAuthenticatedFile('file-123', { fetchBlob: true, fetchMetadata: true }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.blobUrl).toBeTruthy();
      expect(result.current.metadata).toBeTruthy();
    });

    expect(result.current.metadata?.filename).toBe('test.pdf');
  });

  it('should handle separate loading states', async () => {
    const { result } = renderHook(
      () => useAuthenticatedFile('file-123', { fetchBlob: true, fetchMetadata: true }),
      { wrapper }
    );

    // Initially both loading
    expect(result.current.isLoadingBlob).toBe(true);
    expect(result.current.isLoadingMetadata).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });
});
```

## Common Patterns

### Pattern 1: Download Button with Progress

```tsx
function DownloadButton({ fileId, filename }: Props) {
  const [startDownload, setStartDownload] = useState(false);

  const { blobUrl, isLoadingBlob } = useAuthenticatedFile(fileId, {
    fetchBlob: startDownload,
    fetchMetadata: false,
  });

  useEffect(() => {
    if (blobUrl && startDownload) {
      // Trigger download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.click();
      setStartDownload(false);
    }
  }, [blobUrl, startDownload, filename]);

  return (
    <Button
      onClick={() => setStartDownload(true)}
      disabled={isLoadingBlob}
    >
      {isLoadingBlob ? <CircularProgress size={20} /> : 'Download'}
    </Button>
  );
}
```

### Pattern 2: File List with Metadata

```tsx
function FileList({ fileIds }: { fileIds: string[] }) {
  return (
    <List>
      {fileIds.map(fileId => (
        <FileListItem key={fileId} fileId={fileId} />
      ))}
    </List>
  );
}

function FileListItem({ fileId }: { fileId: string }) {
  // Only fetch metadata for list view
  const { metadata, isLoadingMetadata } = useAuthenticatedFile(fileId, {
    fetchBlob: false,
    fetchMetadata: true,
  });

  return (
    <ListItem>
      {isLoadingMetadata ? (
        <Skeleton width="100%" />
      ) : (
        <>
          <FileIcon mimeType={metadata?.mimeType} />
          <ListItemText
            primary={metadata?.filename}
            secondary={formatBytes(metadata?.size)}
          />
        </>
      )}
    </ListItem>
  );
}
```

## Related Hooks

- **useAuthenticatedImage** - Simplified version for images only
- **useFileUpload** - Upload files with authentication
- **useFileCache** - Direct access to blob cache
- **useAddAttachmentMutation** - Attach files to messages

## Related Components

- **MessageAttachment** - File attachments in messages
- **FilePreview** - Preview component for various file types
- **DownloadButton** - Download button with progress

## Troubleshooting

### Common Issues

1. **Metadata not loading**
   - **Cause:** `fetchMetadata` option not set to `true`
   - **Solution:** `useAuthenticatedFile(fileId, { fetchMetadata: true })`

2. **Blob loads but metadata doesn't**
   - **Cause:** Metadata endpoint returning error
   - **Solution:** Check network tab, verify `/api/file/:id/metadata` endpoint

3. **Both return errors**
   - **Cause:** Authentication issue
   - **Solution:** Check token in localStorage, verify user is logged in

## Version History

- **1.0.0:** Initial implementation with blob-only fetching
- **1.1.0:** Added metadata fetching capability
- **2.0.0:** 2025-01-06 - Integrated with FileCacheContext for blob deduplication

## Related Documentation

- [useAuthenticatedImage Hook](./useAuthenticatedImage.md)
- [FileCacheContext](../contexts/FileCacheContext.md)
- [useFileUpload Hook](./useFileUpload.md)
- [File API Documentation](../api/file.md)
- [Message Attachments Feature](../features/file-attachments.md)
