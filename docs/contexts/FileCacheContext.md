# FileCacheContext

> **Location:** `frontend/src/contexts/AvatarCacheContext.tsx`
> **Type:** React Context (Caching System)
> **Original Name:** `AvatarCacheContext` (now `FileCacheContext` with backward compatibility)

## Overview

`FileCacheContext` is a centralized caching system for authenticated file blobs. It prevents duplicate network requests when the same file ID is requested multiple times across the application, implements promise deduplication to eliminate race conditions, and provides a singleton cache shared across all components.

**Critical Performance Fix:**
- **Before:** 50 messages with same avatar = 50 network requests
- **After:** 50 messages with same avatar = 1 network request

**Key Features:**
- **Centralized Cache**: Single Map storing file ID → blob URL mappings
- **Promise Deduplication**: Prevents race conditions when multiple components request same file simultaneously
- **Automatic Cleanup**: Revokes blob URLs on unmount to prevent memory leaks
- **Authentication**: All fetches use JWT token from localStorage
- **Backward Compatibility**: Exports both `FileCacheContext` and `AvatarCacheContext` (deprecated name)

## Context API

```typescript
interface FileCacheContextType {
  getBlob: (fileId: string) => string | null;
  setBlob: (fileId: string, blobUrl: string) => void;
  hasBlob: (fileId: string) => boolean;
  fetchBlob: (fileId: string) => Promise<string>;
}
```

### Methods

#### getBlob

```typescript
getBlob(fileId: string): string | null
```

**Purpose:** Synchronously retrieve cached blob URL

**Parameters:**
- `fileId` - File ID to look up

**Returns:**
- Blob URL string if cached
- `null` if not in cache

**Example:**
```typescript
const { getBlob } = useFileCache();
const blobUrl = getBlob("file-abc-123");
if (blobUrl) {
  console.log("Cache hit:", blobUrl);
} else {
  console.log("Cache miss");
}
```

#### setBlob

```typescript
setBlob(fileId: string, blobUrl: string): void
```

**Purpose:** Manually add blob URL to cache

**Parameters:**
- `fileId` - File ID key
- `blobUrl` - Blob URL value

**Use Case:** Rarely used directly; `fetchBlob` handles caching automatically

**Example:**
```typescript
const { setBlob } = useFileCache();
const blobUrl = URL.createObjectURL(blob);
setBlob("file-abc-123", blobUrl);
```

#### hasBlob

```typescript
hasBlob(fileId: string): boolean
```

**Purpose:** Check if file ID is in cache

**Parameters:**
- `fileId` - File ID to check

**Returns:**
- `true` if cached
- `false` if not cached

**Example:**
```typescript
const { hasBlob } = useFileCache();
if (hasBlob("file-abc-123")) {
  console.log("File already cached");
}
```

#### fetchBlob

```typescript
fetchBlob(fileId: string): Promise<string>
```

**Purpose:** Fetch file blob with automatic caching and deduplication

**Parameters:**
- `fileId` - File ID to fetch

**Returns:**
- Promise resolving to blob URL string

**Behavior:**
1. **Cache hit**: Returns cached blob URL instantly
2. **In-flight request**: Returns existing promise (deduplication)
3. **Cache miss**: Starts new fetch, caches result, returns promise

**Example:**
```typescript
const { fetchBlob } = useFileCache();

try {
  const blobUrl = await fetchBlob("file-abc-123");
  console.log("Blob URL:", blobUrl);
} catch (error) {
  console.error("Fetch failed:", error);
}
```

## Usage Examples

### Basic Usage with Hook

```tsx
import { useFileCache } from '@/contexts/AvatarCacheContext';

function ImageDisplay({ fileId }: { fileId: string }) {
  const { fetchBlob } = useFileCache();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!fileId) return;

    setIsLoading(true);
    fetchBlob(fileId)
      .then(url => {
        setBlobUrl(url);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Failed to load image:", err);
        setIsLoading(false);
      });
  }, [fileId, fetchBlob]);

  if (isLoading) return <Skeleton />;
  if (!blobUrl) return null;

  return <img src={blobUrl} alt="File" />;
}
```

### Integration with useAuthenticatedImage Hook

```tsx
// frontend/src/hooks/useAuthenticatedImage.ts
import { useFileCache } from '@/contexts/AvatarCacheContext';

export function useAuthenticatedImage(fileId: string | null) {
  const { fetchBlob } = useFileCache();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!fileId) {
      setBlobUrl(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetchBlob(fileId)
      .then(url => {
        setBlobUrl(url);
        setIsLoading(false);
      })
      .catch(err => {
        setError(err);
        setIsLoading(false);
      });
  }, [fileId, fetchBlob]);

  return { blobUrl, isLoading, error };
}
```

### Application Setup

```tsx
// frontend/src/App.tsx
import { FileCacheProvider } from './contexts/AvatarCacheContext';

function App() {
  return (
    <FileCacheProvider>
      <Router>
        <Routes>
          {/* Application routes */}
        </Routes>
      </Router>
    </FileCacheProvider>
  );
}
```

## Implementation Details

### Internal State

```typescript
// Stores file ID → blob URL mappings
const cacheRef = useRef<Map<string, string>>(new Map());

// Tracks in-flight requests to prevent duplicates
const pendingRef = useRef<Map<string, Promise<string>>>(new Map());
```

**Why useRef?**
- Doesn't trigger re-renders when cache updates
- Persists across component re-renders
- Shared across all consumers via context

### Promise Deduplication Logic

```typescript
const fetchBlob = useCallback(async (fileId: string): Promise<string> => {
  // 1. Return cached blob URL if exists
  const cached = cacheRef.current.get(fileId);
  if (cached) {
    return cached;
  }

  // 2. Return in-flight promise if already fetching (CRITICAL!)
  const pending = pendingRef.current.get(fileId);
  if (pending) {
    return pending;
  }

  // 3. Start new fetch and track it
  const fetchPromise = (async () => {
    try {
      // Get auth token
      const tokenRaw = localStorage.getItem("accessToken");
      let token: string | null = null;

      if (tokenRaw) {
        try {
          const parsed = JSON.parse(tokenRaw);
          token = parsed && typeof parsed === "object" && parsed.value
            ? parsed.value
            : parsed;
        } catch {
          token = tokenRaw;
        }
      }

      if (!token) {
        throw new Error("No authentication token found");
      }

      // Fetch file
      const response = await fetch(`/api/file/${fileId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status}`);
      }

      // Create blob URL
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Store in cache
      cacheRef.current.set(fileId, blobUrl);

      // Clean up pending tracker
      pendingRef.current.delete(fileId);

      return blobUrl;
    } catch (error) {
      // Clean up pending tracker on error
      pendingRef.current.delete(fileId);
      throw error;
    }
  })();

  // Store promise so concurrent requesters can await the same fetch
  pendingRef.current.set(fileId, fetchPromise);

  return fetchPromise;
}, []);
```

### Race Condition Prevention

**Problem (Before Fix):**
```
Component A calls fetchBlob("file-123") at t=0ms
Component B calls fetchBlob("file-123") at t=5ms
Component C calls fetchBlob("file-123") at t=10ms

Without deduplication:
- 3 simultaneous HTTP requests to /api/file/file-123
- All create separate blob URLs
- Memory waste, network waste
```

**Solution (After Fix):**
```
Component A calls fetchBlob("file-123") at t=0ms
  → Starts fetch, stores promise in pendingRef

Component B calls fetchBlob("file-123") at t=5ms
  → Finds promise in pendingRef, returns same promise

Component C calls fetchBlob("file-123") at t=10ms
  → Finds promise in pendingRef, returns same promise

Result:
- 1 HTTP request to /api/file/file-123
- All components await same promise
- Single blob URL created and cached
- 50+ requests reduced to 1
```

### Cleanup on Unmount

```typescript
useEffect(() => {
  return () => {
    // Revoke all blob URLs to prevent memory leaks
    cacheRef.current.forEach((blobUrl) => {
      URL.revokeObjectURL(blobUrl);
    });
    cacheRef.current.clear();
    pendingRef.current.clear();
  };
}, []);
```

**Purpose:**
- Blob URLs consume memory until revoked
- Cleanup prevents memory leaks when app unmounts or reloads
- Clears both cache and pending request tracking

## Authentication Integration

### Token Retrieval Logic

```typescript
const tokenRaw = localStorage.getItem("accessToken");
let token: string | null = null;

if (tokenRaw) {
  try {
    // Handle both JSON and plain string tokens
    const parsed = JSON.parse(tokenRaw);
    token = parsed && typeof parsed === "object" && parsed.value
      ? parsed.value  // { value: "token" } format
      : parsed;       // Direct token string
  } catch {
    token = tokenRaw;  // Fallback to raw string
  }
}
```

**Token Format Handling:**
- Supports `{ value: "jwt-token" }` object format
- Supports direct `"jwt-token"` string format
- Gracefully falls back if JSON parsing fails

### Authenticated Fetch

```typescript
const response = await fetch(`/api/file/${fileId}`, {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

**Security:**
- All file fetches require valid JWT
- Backend validates token and file access
- No unauthenticated file access possible

## Performance Impact

### Before FileCacheContext

**Scenario:** Message list with 50 messages from same user

```
useAuthenticatedImage called 50 times
  ↓
50 HTTP requests to /api/file/avatar-123
  ↓
50 blob URLs created
  ↓
Network: 50 × ~10KB = 500KB transferred
Time: 50 × ~100ms = 5000ms total
```

### After FileCacheContext

**Scenario:** Same message list

```
useAuthenticatedImage called 50 times
  ↓
First call: HTTP request to /api/file/avatar-123
Remaining 49 calls: Return cached blob URL or await pending promise
  ↓
1 blob URL created and cached
  ↓
Network: 1 × ~10KB = 10KB transferred
Time: 1 × ~100ms = 100ms total (49 calls instant)

Performance Improvement:
- Network: 98% reduction (500KB → 10KB)
- Time: 98% reduction (5000ms → 100ms)
- Memory: 98% reduction (50 blobs → 1 blob)
```

## Backward Compatibility

### Deprecated Exports

```typescript
// Old name (deprecated but still works)
export const AvatarCacheProvider = FileCacheProvider;
export const useAvatarCache = useFileCache;
```

**Migration Path:**
```typescript
// ❌ Old (still works, but deprecated)
import { useAvatarCache } from '@/contexts/AvatarCacheContext';
const { fetchBlob } = useAvatarCache();

// ✅ New (preferred)
import { useFileCache } from '@/contexts/AvatarCacheContext';
const { fetchBlob } = useFileCache();
```

**Why Renamed?**
- Context now used for all file types (avatars, banners, attachments)
- "AvatarCache" was too specific
- "FileCache" better reflects current usage

## Error Handling

### Error Scenarios

1. **No Authentication Token**
   ```typescript
   throw new Error("No authentication token found");
   ```
   - User not logged in
   - Token expired or removed

2. **HTTP Error Response**
   ```typescript
   throw new Error(`Failed to fetch file: ${response.status}`);
   ```
   - 401: Authentication failure
   - 404: File not found
   - 403: Access denied
   - 500: Server error

3. **Network Error**
   - Fetch throws automatically
   - No internet connection
   - Server unreachable

### Error Recovery

```typescript
try {
  const blobUrl = await fetchBlob(fileId);
  // Use blobUrl
} catch (error) {
  console.error("Failed to load file:", error);
  // Show error UI or fallback
}
```

**Best Practice:**
- Always wrap `fetchBlob` calls in try/catch
- Provide fallback UI for failed images
- Log errors for debugging

## Common Patterns

### Pattern 1: Direct Context Usage

```tsx
function DirectUsage() {
  const { fetchBlob } = useFileCache();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchBlob("file-abc-123").then(setBlobUrl);
  }, [fetchBlob]);

  return blobUrl ? <img src={blobUrl} /> : <Skeleton />;
}
```

### Pattern 2: Via useAuthenticatedImage Hook (Recommended)

```tsx
function ViaHook({ fileId }: { fileId: string }) {
  const { blobUrl, isLoading } = useAuthenticatedImage(fileId);

  if (isLoading) return <Skeleton />;
  return <img src={blobUrl || undefined} />;
}
```

### Pattern 3: Preloading Images

```tsx
function PreloadImages({ fileIds }: { fileIds: string[] }) {
  const { fetchBlob } = useFileCache();

  useEffect(() => {
    // Preload all images in background
    fileIds.forEach(id => {
      fetchBlob(id).catch(err => console.error("Preload failed:", err));
    });
  }, [fileIds, fetchBlob]);

  return null; // No UI needed
}
```

## Testing

### Test Examples

```typescript
import { render, waitFor } from '@testing-library/react';
import { FileCacheProvider, useFileCache } from './AvatarCacheContext';

describe('FileCacheContext', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = jest.fn();
  });

  it('should cache blob URLs', async () => {
    const TestComponent = () => {
      const { fetchBlob, hasBlob } = useFileCache();
      const [result, setResult] = useState<any>(null);

      useEffect(() => {
        fetchBlob('file-123').then(() => {
          setResult(hasBlob('file-123'));
        });
      }, [fetchBlob, hasBlob]);

      return <div>{result ? 'Cached' : 'Not cached'}</div>;
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob()),
    });

    const { getByText } = render(
      <FileCacheProvider>
        <TestComponent />
      </FileCacheProvider>
    );

    await waitFor(() => {
      expect(getByText('Cached')).toBeInTheDocument();
    });
  });

  it('should deduplicate simultaneous requests', async () => {
    const TestComponent = () => {
      const { fetchBlob } = useFileCache();

      useEffect(() => {
        // Request same file 3 times simultaneously
        fetchBlob('file-123');
        fetchBlob('file-123');
        fetchBlob('file-123');
      }, [fetchBlob]);

      return null;
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob()),
    });

    render(
      <FileCacheProvider>
        <TestComponent />
      </FileCacheProvider>
    );

    await waitFor(() => {
      // Only 1 fetch should be made
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  it('should revoke blob URLs on unmount', () => {
    const { unmount } = render(
      <FileCacheProvider>
        <div>Test</div>
      </FileCacheProvider>
    );

    unmount();

    expect(global.URL.revokeObjectURL).toHaveBeenCalled();
  });
});
```

## Troubleshooting

### Common Issues

1. **Images not loading**
   - **Cause:** FileCacheProvider not wrapping application
   - **Solution:** Ensure provider is at root level

   ```tsx
   // ❌ Wrong - context not available
   <Router>
     <Routes>
       <Route path="/" element={<ComponentUsingCache />} />
     </Routes>
   </Router>

   // ✅ Correct - provider wraps entire app
   <FileCacheProvider>
     <Router>
       <Routes>
         <Route path="/" element={<ComponentUsingCache />} />
       </Routes>
     </Router>
   </FileCacheProvider>
   ```

2. **"No authentication token found" error**
   - **Cause:** User not logged in or token expired
   - **Solution:** Check auth state before fetching files

3. **Multiple requests for same file**
   - **Cause:** Promise deduplication not working (rare)
   - **Solution:** Verify FileCacheContext version, check pendingRef logic

4. **Memory leaks**
   - **Cause:** Blob URLs not revoked
   - **Solution:** FileCacheContext handles cleanup automatically; no action needed

## Related Hooks & Components

- **useAuthenticatedImage** - Primary hook for fetching images
- **useAuthenticatedFile** - Similar hook for non-image files
- **UserAvatar** - Uses FileCacheContext via useAuthenticatedImage
- **ProfileHeader** - Uses FileCacheContext for avatar and banner
- **UserAvatarUpload** - Uses context for existing avatar preview
- **UserBannerUpload** - Uses context for existing banner preview

## Related Documentation

- [useAuthenticatedImage Hook](../hooks/useAuthenticatedImage.md)
- [useAuthenticatedFile Hook](../hooks/useAuthenticatedFile.md)
- [UserAvatar Component](../components/common/UserAvatar.md)
- [User Profiles Feature](../features/user-profiles.md)
- [File API](../api/file.md)
