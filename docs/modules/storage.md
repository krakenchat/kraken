# Storage Module

> **Location:** `backend/src/storage/storage.module.ts`
> **Type:** Shared Module
> **Domain:** Infrastructure / Storage Abstraction

## Overview

The Storage Module provides a unified abstraction layer for storage operations across different backends (filesystem, S3, Azure Blob, etc.). It decouples business logic from storage implementation details, allowing seamless migration between storage providers without modifying application code.

Currently implements **LOCAL** filesystem storage only, with architecture ready for cloud storage providers (S3, Azure Blob) to be added in the future.

## Module Structure

```
storage/
├── storage.module.ts                           # Module definition
├── storage.service.ts                          # Main service with provider selection
├── interfaces/
│   └── storage-provider.interface.ts          # Provider contract interface
└── providers/
    └── local-storage.provider.ts              # Filesystem implementation
    # Future: s3-storage.provider.ts
    # Future: azure-blob-storage.provider.ts
```

## Architecture Pattern

The module uses the **Provider Pattern** (Strategy Pattern):

1. **IStorageProvider Interface** - Defines storage operations contract
2. **Concrete Providers** - Implement interface for specific backends (LocalStorageProvider, S3Provider, etc.)
3. **StorageService** - Facade that selects appropriate provider based on configuration

```
┌─────────────────────────┐
│   StorageService        │  ← Services inject this
│  (Facade + Selector)    │
└────────────┬────────────┘
             │
             ├─── getProvider(StorageType) ───┐
             │                                 │
     ┌───────▼────────┐              ┌────────▼────────┐
     │ LocalStorage   │              │  S3Provider     │
     │   Provider     │              │  (Future)       │
     └────────────────┘              └─────────────────┘
             │                                 │
      implements IStorageProvider      implements IStorageProvider
```

## Services

### StorageService

**Purpose:** Main service that provides storage operations and manages provider selection

#### Key Methods

```typescript
class StorageService implements IStorageProvider {
  /**
   * Gets the appropriate storage provider based on type
   * Defaults to LOCAL if not specified
   */
  getProvider(type?: StorageType): IStorageProvider

  // Convenience methods that delegate to the default provider
  // These allow direct injection and usage without calling getProvider()

  // Directory operations
  async ensureDirectory(path: string): Promise<void>
  async directoryExists(path: string): Promise<boolean>
  async deleteDirectory(path: string, options?: DeleteDirectoryOptions): Promise<void>

  // File operations
  async deleteFile(path: string): Promise<void>
  async fileExists(path: string): Promise<boolean>
  async readFile(path: string): Promise<Buffer>
  async writeFile(path: string, data: Buffer | string): Promise<void>

  // File metadata
  async getFileStats(path: string): Promise<FileStats>

  // Directory listing
  async listFiles(dirPath: string, options?: ListFilesOptions): Promise<string[]>

  // Bulk operations
  async deleteOldFiles(dirPath: string, olderThan: Date): Promise<number>
}
```

#### Provider Selection

The service selects providers based on `STORAGE_TYPE` environment variable:

```typescript
// In constructor
this.defaultStorageType =
  (this.configService.get<string>('STORAGE_TYPE') as StorageType) ||
  StorageType.LOCAL;

// Provider selection logic
switch (storageType) {
  case StorageType.LOCAL:
    return this.localStorageProvider;
  case StorageType.S3:
    throw new Error('S3 storage provider not yet implemented');
  case StorageType.AZURE_BLOB:
    throw new Error('Azure Blob storage provider not yet implemented');
  default:
    this.logger.warn(`Unknown storage type: ${storageType}, falling back to LOCAL`);
    return this.localStorageProvider;
}
```

### LocalStorageProvider

**Purpose:** Implements storage operations using Node.js filesystem (`fs/promises`)

#### Key Methods

```typescript
class LocalStorageProvider implements IStorageProvider {
  // Creates directory with recursive option
  async ensureDirectory(path: string): Promise<void> {
    await fs.mkdir(path, { recursive: true });
  }

  // Checks directory existence using fs.access
  async directoryExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  // Deletes directory with options
  async deleteDirectory(path: string, options?: DeleteDirectoryOptions): Promise<void> {
    const { recursive = false, force = false } = options;
    await fs.rm(path, { recursive, force });
  }

  // Lists files with optional filter function
  async listFiles(dirPath: string, options?: ListFilesOptions): Promise<string[]> {
    const files = await fs.readdir(dirPath);
    if (options.filter) {
      return files.filter(options.filter);
    }
    return files;
  }

  // Bulk cleanup operation (combines listing, stat checking, and deletion)
  async deleteOldFiles(dirPath: string, olderThan: Date): Promise<number> {
    // Returns count of deleted files
    // Handles missing directories gracefully
    // Continues on individual file errors
  }
}
```

## Interfaces

### IStorageProvider

**Contract for all storage providers**

```typescript
export interface IStorageProvider {
  ensureDirectory(path: string): Promise<void>;
  directoryExists(path: string): Promise<boolean>;
  deleteDirectory(path: string, options?: DeleteDirectoryOptions): Promise<void>;
  deleteFile(path: string): Promise<void>;
  fileExists(path: string): Promise<boolean>;
  listFiles(dirPath: string, options?: ListFilesOptions): Promise<string[]>;
  getFileStats(path: string): Promise<FileStats>;
  readFile(path: string): Promise<Buffer>;
  writeFile(path: string, data: Buffer | string): Promise<void>;
  deleteOldFiles(dirPath: string, olderThan: Date): Promise<number>;
}
```

### Supporting Types

```typescript
export interface FileStats {
  size: number;
  mtime: Date;  // Modification time
  ctime: Date;  // Creation time
}

export interface DeleteDirectoryOptions {
  recursive?: boolean;
  force?: boolean;
}

export interface ListFilesOptions {
  filter?: (filename: string) => boolean;
}

export enum StorageType {
  LOCAL = 'LOCAL',
  S3 = 'S3',
  AZURE_BLOB = 'AZURE_BLOB',
}
```

## Dependencies

### Internal Dependencies
- `@/database/database.service` - Not used (no database operations)
- ConfigModule - Used for `STORAGE_TYPE` configuration

### External Dependencies
- `@nestjs/common` - Decorators, Logger, Injectable
- `@nestjs/config` - ConfigService for environment variables
- `fs/promises` - Node.js filesystem operations (LocalStorageProvider only)
- `path` - Path utilities (consumers of StorageService)

## Integration with Other Modules

The Storage Module is consumed by:

### 1. LiveKit Replay Service
**Module:** `backend/src/livekit/livekit.module.ts`
**Service:** `LivekitReplayService`

**Usage:**
- `ensureDirectory()` - Create segment directories for egress sessions
- `deleteDirectory()` - Cleanup failed egress directories
- `directoryExists()` - Check if session directories exist
- `listFiles()` - List segment files with filter
- `getFileStats()` - Check file modification times
- `deleteFile()` - Remove old segments during cleanup cron job

**Pattern:**
```typescript
// Before storage abstraction
await fs.mkdir(segmentPath, { recursive: true });

// After storage abstraction
await this.storageService.ensureDirectory(segmentPath);
```

### 2. File Service
**Module:** `backend/src/file/file.module.ts`
**Service:** `FileService`

**Usage:**
- `deleteFile()` - Cleanup files marked for deletion (cron job every 10 minutes)

**Pattern:**
```typescript
// Before
await unlink(filePath);

// After
await this.storageService.deleteFile(filePath);
```

### 3. File Upload Service
**Module:** `backend/src/file-upload/file-upload.module.ts`
**Service:** `FileUploadService`

**Usage:**
- `deleteFile()` - Cleanup failed uploads
- `readFile()` - Generate SHA-256 checksums for uploaded files

**Pattern:**
```typescript
// Before
const fileBuffer = await readFile(filePath);

// After
const fileBuffer = await this.storageService.readFile(filePath);
```

## Configuration

### Environment Variables

```bash
# Storage backend type (defaults to LOCAL)
STORAGE_TYPE=LOCAL  # Options: LOCAL, S3, AZURE_BLOB

# For LOCAL storage (used by consumers, not StorageService itself)
FILE_UPLOAD_DEST=./uploads
REPLAY_SEGMENTS_PATH=/app/storage/replay-segments

# Future: S3 configuration
# AWS_S3_BUCKET=my-bucket
# AWS_REGION=us-east-1
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...

# Future: Azure Blob configuration
# AZURE_STORAGE_ACCOUNT=...
# AZURE_STORAGE_KEY=...
# AZURE_CONTAINER_NAME=...
```

### Default Provider

If `STORAGE_TYPE` is not set or invalid, the service defaults to `LOCAL`:

```typescript
this.logger.warn(`Unknown storage type: ${storageType}, falling back to LOCAL`);
return this.localStorageProvider;
```

## Error Handling

### LocalStorageProvider Error Handling

All methods catch errors and re-throw with context:

```typescript
try {
  await fs.mkdir(path, { recursive: true });
  this.logger.debug(`Directory ensured: ${path}`);
} catch (error) {
  this.logger.error(`Failed to ensure directory ${path}:`, error);
  throw error;  // Re-throw for caller to handle
}
```

### Graceful Degradation

The `deleteOldFiles()` method continues on individual file errors:

```typescript
for (const file of files) {
  try {
    // Process file
  } catch (error) {
    this.logger.warn(`Failed to process file ${filePath}:`, error);
    // Continue with next file
  }
}
```

### Missing Directory Handling

```typescript
async deleteOldFiles(dirPath: string, olderThan: Date): Promise<number> {
  const exists = await this.directoryExists(dirPath);
  if (!exists) {
    this.logger.debug(`Directory does not exist, skipping cleanup: ${dirPath}`);
    return 0;  // Not an error, just nothing to clean
  }
  // ... proceed with cleanup
}
```

## Performance Considerations

### File System Operations

- **Recursive Directory Creation:** Uses `{ recursive: true }` to avoid multiple calls
- **Batch Operations:** `deleteOldFiles()` performs bulk cleanup in single method call
- **Filter in Memory:** `listFiles()` filters in application layer (not filesystem)

### Future Optimizations

When adding cloud storage providers:

1. **Parallel Operations:** Use `Promise.all()` for batch deletes in S3
2. **Pagination:** Implement pagination for large directory listings
3. **Streaming:** Consider streaming for large file reads/writes
4. **Caching:** Cache file existence checks for frequently accessed files

## Common Usage Patterns

### Pattern 1: Ensure Directory Before Writing

```typescript
constructor(private readonly storageService: StorageService) {}

async saveSegments(userId: string, timestamp: number) {
  const segmentPath = path.join(this.segmentsPath, userId, `${timestamp}`);

  // Ensure directory exists before egress writes to it
  await this.storageService.ensureDirectory(segmentPath);

  return segmentPath;
}
```

### Pattern 2: Cleanup Old Files (Cron Job)

```typescript
@Cron('*/5 * * * *')
async cleanupOldSegments() {
  const cutoffDate = new Date(Date.now() - 20 * 60 * 1000);  // 20 minutes ago

  // Storage service handles directory checking, listing, stat checking, deletion
  const deletedCount = await this.storageService.deleteOldFiles(
    sessionPath,
    cutoffDate
  );

  this.logger.log(`Deleted ${deletedCount} old segments`);
}
```

### Pattern 3: Cleanup Failed Operations

```typescript
try {
  await this.egressClient.startEgress(...);
} catch (error) {
  // Clean up directory if egress failed
  await this.storageService.deleteDirectory(segmentPath, {
    recursive: true,
    force: true
  }).catch(() => {
    // Ignore cleanup errors
  });
  throw error;
}
```

### Pattern 4: File Validation with Checksum

```typescript
async generateChecksum(filePath: string): Promise<string> {
  // Storage service handles cross-platform file reading
  const fileBuffer = await this.storageService.readFile(filePath);
  return createHash('sha256').update(fileBuffer).digest('hex');
}
```

## Adding New Storage Providers

### Step 1: Implement IStorageProvider

```typescript
// backend/src/storage/providers/s3-storage.provider.ts
import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { IStorageProvider, FileStats } from '../interfaces/storage-provider.interface';

@Injectable()
export class S3StorageProvider implements IStorageProvider {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    this.s3Client = new S3Client({
      region: configService.get('AWS_REGION'),
      credentials: {
        accessKeyId: configService.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: configService.get('AWS_SECRET_ACCESS_KEY'),
      },
    });
    this.bucketName = configService.get('AWS_S3_BUCKET');
  }

  async ensureDirectory(path: string): Promise<void> {
    // S3 doesn't have directories, no-op or create placeholder
  }

  async deleteFile(path: string): Promise<void> {
    await this.s3Client.send(new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: path,
    }));
  }

  // ... implement other interface methods
}
```

### Step 2: Register Provider in StorageModule

```typescript
@Module({
  imports: [ConfigModule],
  providers: [
    LocalStorageProvider,
    S3StorageProvider,  // Add new provider
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
```

### Step 3: Update Provider Selection in StorageService

```typescript
constructor(
  private readonly configService: ConfigService,
  private readonly localStorageProvider: LocalStorageProvider,
  private readonly s3Provider: S3StorageProvider,  // Inject new provider
) { }

getProvider(type?: StorageType): IStorageProvider {
  switch (storageType) {
    case StorageType.LOCAL:
      return this.localStorageProvider;
    case StorageType.S3:
      return this.s3Provider;  // Use new provider
    case StorageType.AZURE_BLOB:
      throw new Error('Azure Blob storage provider not yet implemented');
    default:
      this.logger.warn(`Unknown storage type: ${storageType}, falling back to LOCAL`);
      return this.localStorageProvider;
  }
}
```

### Step 4: Update Database Schema (if needed)

The Prisma `File` model already supports multiple storage types:

```prisma
model File {
  storageType StorageType  // LOCAL, S3, AZURE_BLOB
  storagePath String       // Filesystem path or S3 key
  // ...
}
```

## Testing

### Service Tests

Testing strategies for storage operations:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { ConfigService } from '@nestjs/config';

describe('StorageService', () => {
  let service: StorageService;
  let localProvider: LocalStorageProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        LocalStorageProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'STORAGE_TYPE') return 'LOCAL';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    localProvider = module.get<LocalStorageProvider>(LocalStorageProvider);
  });

  it('should return LocalStorageProvider for LOCAL type', () => {
    expect(service.getProvider(StorageType.LOCAL)).toBe(localProvider);
  });

  it('should delegate ensureDirectory to provider', async () => {
    const spy = jest.spyOn(localProvider, 'ensureDirectory').mockResolvedValue();
    await service.ensureDirectory('/test/path');
    expect(spy).toHaveBeenCalledWith('/test/path');
  });
});
```

### Provider Tests

```typescript
describe('LocalStorageProvider', () => {
  let provider: LocalStorageProvider;

  beforeEach(() => {
    provider = new LocalStorageProvider();
  });

  describe('deleteOldFiles', () => {
    it('should return 0 for non-existent directory', async () => {
      const count = await provider.deleteOldFiles('/nonexistent', new Date());
      expect(count).toBe(0);
    });

    it('should delete files older than cutoff date', async () => {
      // Mock filesystem operations
      // Test deletion logic
    });
  });
});
```

## Migration from Direct FS Usage

If you find code using `fs/promises` directly, migrate it:

### Before (Direct FS Usage)

```typescript
import { unlink, readFile, mkdir, stat } from 'fs/promises';

class MyService {
  async cleanup(filePath: string) {
    await unlink(filePath);
  }

  async readConfig(configPath: string) {
    return await readFile(configPath);
  }
}
```

### After (Storage Service)

```typescript
import { StorageService } from '@/storage/storage.service';

class MyService {
  constructor(private readonly storageService: StorageService) {}

  async cleanup(filePath: string) {
    await this.storageService.deleteFile(filePath);
  }

  async readConfig(configPath: string) {
    return await this.storageService.readFile(configPath);
  }
}
```

**Don't forget to:**
1. Add `StorageModule` to your module's imports
2. Inject `StorageService` in constructor
3. Replace all direct `fs` calls with storage service methods

## Related Modules

- **LiveKit Module** - Uses for replay buffer segment management
- **File Module** - Uses for file cleanup operations
- **File Upload Module** - Uses for upload validation and cleanup

## Troubleshooting

### Common Issues

1. **"Failed to ensure directory" errors**
   - **Symptoms:** Directory creation fails with permission errors
   - **Cause:** Insufficient filesystem permissions or invalid path
   - **Solution:**
     - Check container user permissions
     - Verify volume mounts in docker-compose.yml
     - Ensure parent directories exist

2. **Provider not found errors**
   - **Symptoms:** `Error: S3 storage provider not yet implemented`
   - **Cause:** `STORAGE_TYPE` env var set to unimplemented provider
   - **Solution:**
     - Set `STORAGE_TYPE=LOCAL` or implement the provider
     - Check environment variable spelling

3. **Files not being deleted in cleanup jobs**
   - **Symptoms:** Old segments persist after cleanup runs
   - **Cause:** Cutoff date calculation or filter logic issues
   - **Solution:**
     - Check cron job logs for errors
     - Verify `olderThan` date is calculated correctly
     - Ensure filter function matches expected filenames

## Related Documentation

- [LiveKit Module](./livekit.md)
- [File Module](./file.md)
- [File Upload Module](./file-upload.md)
- [Database Schema](../architecture/database.md#file)
- [Environment Configuration](../architecture/backend.md#environment-variables)
