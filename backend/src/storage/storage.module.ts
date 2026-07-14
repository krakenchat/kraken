import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage.service';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';

/**
 * Storage Module
 *
 * Provides storage abstraction layer for filesystem, S3, Azure Blob, etc.
 * Supports LOCAL filesystem and S3-compatible object storage (AWS S3,
 * MinIO). Azure Blob is not yet implemented.
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [StorageModule],
 *   // ... your module config
 * })
 * export class YourModule {}
 *
 * // In your service:
 * constructor(private readonly storageService: StorageService) {}
 *
 * async someMethod() {
 *   await this.storageService.deleteOldFiles('/path/to/dir', new Date());
 * }
 * ```
 */
@Module({
  imports: [ConfigModule],
  providers: [
    LocalStorageProvider,
    S3StorageProvider,
    StorageService,
    // Future: AzureBlobProvider, etc.
  ],
  exports: [StorageService],
})
export class StorageModule {}
