import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage.service';
import { LocalStorageProvider } from './providers/local-storage.provider';

/**
 * Storage Module
 *
 * Provides storage abstraction layer for filesystem, S3, Azure Blob, etc.
 * Currently supports LOCAL filesystem storage only.
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
    StorageService,
    // Future: S3Provider, AzureBlobProvider, etc.
  ],
  exports: [StorageService],
})
export class StorageModule {}
