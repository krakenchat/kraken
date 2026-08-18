import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReadStream } from 'fs';
import { StorageType } from '@prisma/client';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';
import {
  IStorageProvider,
  FileStats,
  DeleteDirectoryOptions,
  ListFilesOptions,
} from './interfaces/storage-provider.interface';

/**
 * Storage Type re-export.
 *
 * IMPORTANT: this MUST be the same `StorageType` as the Prisma `File` model's
 * `storageType` column (re-exported here, not redeclared) — per-record
 * provider resolution passes `file.storageType` straight into
 * `getProvider()`. A locally-redeclared enum with identical string values
 * would still be a structurally-identical-but-nominally-distinct TS type,
 * breaking that call at every File-record call site.
 */
export { StorageType };

/**
 * Storage Service
 *
 * Resolves the `IStorageProvider` (LOCAL or S3) appropriate for a given
 * `File` DB record, and additionally exposes a local-only filesystem
 * convenience surface used exclusively by the LiveKit replay/egress
 * pipeline and thumbnail generation.
 *
 * Two distinct usage patterns:
 *
 * 1. Per-record object-store operations (file upload/serve/delete/backfill):
 *    ALWAYS resolve the provider explicitly for the record in hand —
 *    `getProvider(file.storageType)` — never rely on the default. A mixed
 *    local/S3 instance must keep serving old LOCAL rows correctly even
 *    after STORAGE_TYPE is switched to S3 for new uploads.
 *
 *      const provider = this.storageService.getProvider(file.storageType);
 *      const stream = await provider.getReadStream(file.storagePath);
 *
 *    `getProvider()` with no argument resolves the *configured default*
 *    (STORAGE_TYPE), which is the right choice exactly once: deciding where
 *    a brand-new upload should land.
 *
 * 2. Local-only filesystem convenience methods (ensureDirectory,
 *    directoryExists, deleteDirectory, listFiles, readFile, writeFile,
 *    deleteOldFiles, createReadStream, resolvePath, the *WithPrefix
 *    variants, and the segment-* helpers): these hard-delegate to
 *    `LocalStorageProvider` directly, independent of STORAGE_TYPE. They
 *    exist for the LiveKit replay/egress pipeline and ffmpeg thumbnail
 *    generation, which require a genuine local scratch filesystem
 *    regardless of where `File` records themselves are stored — S3 has no
 *    directory concept, so these are intentionally NOT part of
 *    `IStorageProvider` and are not affected by the configured default
 *    storage type. `deleteFile`, `fileExists`, `getFileStats`, and
 *    `getFileUrl` also have ambient (no-arg-type) convenience wrappers here
 *    for the same reason — their only current ambient call sites (LiveKit
 *    clip cleanup, ffmpeg temp-file stats) are inherently local-disk
 *    operations. Any File-record call site MUST use `getProvider(type)`
 *    explicitly instead of these ambient wrappers.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly defaultStorageType: StorageType;
  private readonly segmentsPrefix: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly localStorageProvider: LocalStorageProvider,
    private readonly s3StorageProvider: S3StorageProvider,
    // Future: inject AzureBlobProvider, etc.
  ) {
    // Default to LOCAL storage, configurable via environment
    this.defaultStorageType =
      (this.configService.get<string>('STORAGE_TYPE') as StorageType) ||
      StorageType.LOCAL;

    // Load segments prefix for egress segment operations
    this.segmentsPrefix =
      this.configService.get<string>('REPLAY_SEGMENTS_PATH') ||
      '/app/storage/replay-segments';

    this.logger.log(
      `StorageService initialized with default type: ${this.defaultStorageType}`,
    );
    this.logger.log(`Segments prefix: ${this.segmentsPrefix}`);
  }

  /**
   * Gets the appropriate storage provider based on type.
   * @param type - Storage type. ALWAYS pass the specific `File` record's
   *   `storageType` for read/delete/backfill operations. Omit only to
   *   resolve the configured default (i.e. where a brand-new upload
   *   should land).
   * @returns Storage provider instance
   */
  getProvider(type?: StorageType): IStorageProvider {
    const storageType = type || this.defaultStorageType;

    switch (storageType) {
      case StorageType.LOCAL:
        return this.localStorageProvider;

      case StorageType.S3:
        return this.s3StorageProvider;

      case StorageType.AZURE_BLOB:
        // Future: return this.azureBlobProvider;
        throw new NotImplementedException(
          'Azure Blob storage provider not yet implemented',
        );

      default:
        this.logger.warn(
          `Unknown storage type: ${storageType as string}, falling back to LOCAL`,
        );
        return this.localStorageProvider;
    }
  }

  /**
   * The configured default storage type (STORAGE_TYPE env var). Used to
   * decide where a brand-new upload should land.
   */
  getDefaultStorageType(): StorageType {
    return this.defaultStorageType;
  }

  // ==========================================
  // Local-only filesystem convenience methods
  // Hard-pinned to LocalStorageProvider — see class doc. NOT affected by
  // the configured default storage type.
  // ==========================================

  async ensureDirectory(path: string): Promise<void> {
    return this.localStorageProvider.ensureDirectory(path);
  }

  async directoryExists(path: string): Promise<boolean> {
    return this.localStorageProvider.directoryExists(path);
  }

  async deleteDirectory(
    path: string,
    options?: DeleteDirectoryOptions,
  ): Promise<void> {
    return this.localStorageProvider.deleteDirectory(path, options);
  }

  async deleteFile(path: string): Promise<void> {
    return this.localStorageProvider.deleteFile(path);
  }

  async fileExists(path: string): Promise<boolean> {
    return this.localStorageProvider.fileExists(path);
  }

  async listFiles(
    dirPath: string,
    options?: ListFilesOptions,
  ): Promise<string[]> {
    return this.localStorageProvider.listFiles(dirPath, options);
  }

  async getFileStats(path: string): Promise<FileStats> {
    return this.localStorageProvider.getFileStats(path);
  }

  async readFile(path: string): Promise<Buffer> {
    return this.localStorageProvider.readFile(path);
  }

  async writeFile(path: string, data: Buffer | string): Promise<void> {
    return this.localStorageProvider.writeFile(path, data);
  }

  async deleteOldFiles(dirPath: string, olderThan: Date): Promise<number> {
    return this.localStorageProvider.deleteOldFiles(dirPath, olderThan);
  }

  createReadStream(path: string): ReadStream {
    return this.localStorageProvider.createReadStream(path);
  }

  async getFileUrl(path: string): Promise<string> {
    return this.localStorageProvider.getFileUrl(path);
  }

  // ==========================================
  // Prefix-aware delegation methods (local-only, see above)
  // ==========================================

  resolvePath(relativePath: string, prefix: string): string {
    return this.localStorageProvider.resolvePath(relativePath, prefix);
  }

  async listFilesWithPrefix(
    relativeDir: string,
    prefix: string,
    options?: ListFilesOptions,
  ): Promise<string[]> {
    return this.localStorageProvider.listFilesWithPrefix(
      relativeDir,
      prefix,
      options,
    );
  }

  async readFileWithPrefix(
    relativePath: string,
    prefix: string,
  ): Promise<Buffer> {
    return this.localStorageProvider.readFileWithPrefix(relativePath, prefix);
  }

  async deleteDirectoryWithPrefix(
    relativeDir: string,
    prefix: string,
    options?: DeleteDirectoryOptions,
  ): Promise<void> {
    return this.localStorageProvider.deleteDirectoryWithPrefix(
      relativeDir,
      prefix,
      options,
    );
  }

  async getFileStatsWithPrefix(
    relativePath: string,
    prefix: string,
  ): Promise<FileStats> {
    return this.localStorageProvider.getFileStatsWithPrefix(
      relativePath,
      prefix,
    );
  }

  async directoryExistsWithPrefix(
    relativeDir: string,
    prefix: string,
  ): Promise<boolean> {
    return this.localStorageProvider.directoryExistsWithPrefix(
      relativeDir,
      prefix,
    );
  }

  // ==========================================
  // Segment-specific convenience methods (local-only, see above)
  // These auto-apply the REPLAY_SEGMENTS_PATH prefix
  // ==========================================

  /**
   * Gets the configured segments prefix
   * @returns The REPLAY_SEGMENTS_PATH value
   */
  getSegmentsPrefix(): string {
    return this.segmentsPrefix;
  }

  /**
   * Resolves a relative segment path to full path using the configured prefix
   * @param relativePath - Relative path (e.g., "sessionId/file.ts")
   * @returns Full resolved path
   */
  resolveSegmentPath(relativePath: string): string {
    return this.resolvePath(relativePath, this.segmentsPrefix);
  }

  /**
   * Lists files in a segment directory
   * @param relativeDir - Relative directory path (e.g., "sessionId/")
   * @param options - List options
   * @returns Array of filenames
   */
  async listSegmentFiles(
    relativeDir: string,
    options?: ListFilesOptions,
  ): Promise<string[]> {
    return this.listFilesWithPrefix(relativeDir, this.segmentsPrefix, options);
  }

  /**
   * Reads a segment file
   * @param relativePath - Relative file path (e.g., "sessionId/segment.ts")
   * @returns File contents as Buffer
   */
  async readSegmentFile(relativePath: string): Promise<Buffer> {
    return this.readFileWithPrefix(relativePath, this.segmentsPrefix);
  }

  /**
   * Deletes a segment directory
   * @param relativeDir - Relative directory path (e.g., "sessionId/")
   * @param options - Deletion options
   */
  async deleteSegmentDirectory(
    relativeDir: string,
    options?: DeleteDirectoryOptions,
  ): Promise<void> {
    return this.deleteDirectoryWithPrefix(
      relativeDir,
      this.segmentsPrefix,
      options,
    );
  }

  /**
   * Gets stats for a segment file
   * @param relativePath - Relative file path (e.g., "sessionId/segment.ts")
   * @returns File statistics
   */
  async getSegmentFileStats(relativePath: string): Promise<FileStats> {
    return this.getFileStatsWithPrefix(relativePath, this.segmentsPrefix);
  }

  /**
   * Checks if a segment directory exists
   * @param relativeDir - Relative directory path (e.g., "sessionId/")
   * @returns true if exists, false otherwise
   */
  async segmentDirectoryExists(relativeDir: string): Promise<boolean> {
    return this.directoryExistsWithPrefix(relativeDir, this.segmentsPrefix);
  }

  /**
   * Lists the first-level directory names directly under the segments root
   * (REPLAY_SEGMENTS_PATH). Used by the orphaned-segment-directory sweep to
   * discover session directories on disk independent of the `egressSession`
   * DB rows. Returns `[]` when the segments root itself does not exist yet.
   * @returns Directory names (e.g. session IDs), not full paths
   */
  async listSegmentDirectories(): Promise<string[]> {
    return this.localStorageProvider.listDirectories(this.segmentsPrefix);
  }

  /**
   * Stats a segment directory (not a file — `fs.stat` works identically for
   * both) resolved against the segments prefix. Used by the orphaned sweep
   * to read a directory's mtime.
   * @param relativeDir - Relative directory path (e.g., "sessionId")
   * @returns Directory statistics, notably `mtime`
   */
  async getSegmentDirectoryStats(relativeDir: string): Promise<FileStats> {
    return this.getFileStatsWithPrefix(relativeDir, this.segmentsPrefix);
  }
}
