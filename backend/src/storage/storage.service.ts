import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReadStream } from 'fs';
import { LocalStorageProvider } from './providers/local-storage.provider';
import {
  IStorageProvider,
  FileStats,
  DeleteDirectoryOptions,
  ListFilesOptions,
} from './interfaces/storage-provider.interface';

/**
 * Storage Type Enumeration
 * Matches the StorageType in Prisma schema
 */
export enum StorageType {
  LOCAL = 'LOCAL',
  S3 = 'S3',
  AZURE_BLOB = 'AZURE_BLOB',
}

/**
 * Storage Service
 *
 * Main service for storage operations. Uses provider pattern to support
 * multiple storage backends (filesystem, S3, Azure Blob, etc.).
 *
 * Currently implements LOCAL storage only. Future providers can be added
 * by implementing IStorageProvider interface and updating getProvider().
 *
 * @example
 * ```typescript
 * // Use default provider (LOCAL)
 * await this.storageService.ensureDirectory('/path/to/dir');
 *
 * // Specify provider type explicitly
 * const provider = this.storageService.getProvider(StorageType.LOCAL);
 * await provider.deleteOldFiles('/path/to/dir', new Date());
 * ```
 */
@Injectable()
export class StorageService implements IStorageProvider {
  private readonly logger = new Logger(StorageService.name);
  private readonly defaultStorageType: StorageType;

  constructor(
    private readonly configService: ConfigService,
    private readonly localStorageProvider: LocalStorageProvider,
    // Future: inject S3Provider, AzureBlobProvider, etc.
  ) {
    // Default to LOCAL storage, configurable via environment
    this.defaultStorageType =
      (this.configService.get<string>('STORAGE_TYPE') as StorageType) ||
      StorageType.LOCAL;

    this.logger.log(
      `StorageService initialized with default type: ${this.defaultStorageType}`,
    );
  }

  /**
   * Gets the appropriate storage provider based on type
   * @param type - Storage type (defaults to configured default)
   * @returns Storage provider instance
   */
  getProvider(type?: StorageType): IStorageProvider {
    const storageType = type || this.defaultStorageType;

    switch (storageType) {
      case StorageType.LOCAL:
        return this.localStorageProvider;

      case StorageType.S3:
        // Future: return this.s3Provider;
        throw new Error('S3 storage provider not yet implemented');

      case StorageType.AZURE_BLOB:
        // Future: return this.azureBlobProvider;
        throw new Error('Azure Blob storage provider not yet implemented');

      default:
        this.logger.warn(
          `Unknown storage type: ${storageType as string}, falling back to LOCAL`,
        );
        return this.localStorageProvider;
    }
  }

  // ==========================================
  // Convenience methods that delegate to the default provider
  // These allow services to inject StorageService and call methods directly
  // without needing to call getProvider() explicitly
  // ==========================================

  async ensureDirectory(path: string): Promise<void> {
    return this.getProvider().ensureDirectory(path);
  }

  async directoryExists(path: string): Promise<boolean> {
    return this.getProvider().directoryExists(path);
  }

  async deleteDirectory(
    path: string,
    options?: DeleteDirectoryOptions,
  ): Promise<void> {
    return this.getProvider().deleteDirectory(path, options);
  }

  async deleteFile(path: string): Promise<void> {
    return this.getProvider().deleteFile(path);
  }

  async fileExists(path: string): Promise<boolean> {
    return this.getProvider().fileExists(path);
  }

  async listFiles(
    dirPath: string,
    options?: ListFilesOptions,
  ): Promise<string[]> {
    return this.getProvider().listFiles(dirPath, options);
  }

  async getFileStats(path: string): Promise<FileStats> {
    return this.getProvider().getFileStats(path);
  }

  async readFile(path: string): Promise<Buffer> {
    return this.getProvider().readFile(path);
  }

  async writeFile(path: string, data: Buffer | string): Promise<void> {
    return this.getProvider().writeFile(path, data);
  }

  async deleteOldFiles(dirPath: string, olderThan: Date): Promise<number> {
    return this.getProvider().deleteOldFiles(dirPath, olderThan);
  }

  createReadStream(path: string): ReadStream {
    return this.getProvider().createReadStream(path);
  }

  async getFileUrl(path: string): Promise<string> {
    return this.getProvider().getFileUrl(path);
  }
}
