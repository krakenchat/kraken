import { ReadStream } from 'fs';

/**
 * Storage Provider Interface
 *
 * Defines the contract for storage providers (filesystem, S3, Azure Blob, etc.)
 * This abstraction allows swapping storage backends without changing business logic.
 */

export interface FileStats {
  size: number;
  mtime: Date;
  ctime: Date;
}

export interface DeleteDirectoryOptions {
  recursive?: boolean;
  force?: boolean;
}

export interface ListFilesOptions {
  filter?: (filename: string) => boolean;
}

export interface IStorageProvider {
  /**
   * Ensures a directory exists, creating it if necessary
   * @param path - Directory path
   */
  ensureDirectory(path: string): Promise<void>;

  /**
   * Checks if a directory exists
   * @param path - Directory path
   * @returns true if directory exists, false otherwise
   */
  directoryExists(path: string): Promise<boolean>;

  /**
   * Deletes a directory
   * @param path - Directory path
   * @param options - Deletion options (recursive, force)
   */
  deleteDirectory(
    path: string,
    options?: DeleteDirectoryOptions,
  ): Promise<void>;

  /**
   * Deletes a file
   * @param path - File path
   */
  deleteFile(path: string): Promise<void>;

  /**
   * Checks if a file exists
   * @param path - File path
   * @returns true if file exists, false otherwise
   */
  fileExists(path: string): Promise<boolean>;

  /**
   * Lists files in a directory
   * @param dirPath - Directory path
   * @param options - List options (filter function)
   * @returns Array of filenames (not full paths)
   */
  listFiles(dirPath: string, options?: ListFilesOptions): Promise<string[]>;

  /**
   * Gets file metadata
   * @param path - File path
   * @returns File statistics
   */
  getFileStats(path: string): Promise<FileStats>;

  /**
   * Reads file contents
   * @param path - File path
   * @returns File contents as Buffer
   */
  readFile(path: string): Promise<Buffer>;

  /**
   * Writes file contents
   * @param path - File path
   * @param data - Data to write
   */
  writeFile(path: string, data: Buffer | string): Promise<void>;

  /**
   * Deletes files older than a specified date in a directory
   * @param dirPath - Directory path
   * @param olderThan - Delete files with mtime before this date
   * @returns Number of files deleted
   */
  deleteOldFiles(dirPath: string, olderThan: Date): Promise<number>;

  /**
   * Creates a readable stream for a file
   * Note: For local storage, this is a direct stream. For cloud storage,
   * implementations may need to download to temp file first.
   * @param path - File path
   * @returns ReadStream for the file
   */
  createReadStream(path: string): ReadStream;

  /**
   * Gets a URL for accessing the file
   * For local storage: returns the file path
   * For S3: returns a signed URL
   * For Azure Blob: returns a SAS URL
   * @param path - File path or key
   * @returns URL or path to access the file
   */
  getFileUrl(path: string): Promise<string>;

  /**
   * Resolves a relative path with a prefix
   * For local storage: uses path.join(prefix, relativePath)
   * For S3: concatenates bucket prefix and key
   * @param relativePath - Relative path (e.g., "sessionId/")
   * @param prefix - Base path prefix (e.g., "/app/storage/replay-segments")
   * @returns Full resolved path
   */
  resolvePath(relativePath: string, prefix: string): string;

  /**
   * Lists files in a directory with prefix resolution
   * @param relativeDir - Relative directory path
   * @param prefix - Base path prefix
   * @param options - List options (filter function)
   * @returns Array of filenames (not full paths)
   */
  listFilesWithPrefix(
    relativeDir: string,
    prefix: string,
    options?: ListFilesOptions,
  ): Promise<string[]>;

  /**
   * Reads file contents with prefix resolution
   * @param relativePath - Relative file path
   * @param prefix - Base path prefix
   * @returns File contents as Buffer
   */
  readFileWithPrefix(relativePath: string, prefix: string): Promise<Buffer>;

  /**
   * Deletes a directory with prefix resolution
   * @param relativeDir - Relative directory path
   * @param prefix - Base path prefix
   * @param options - Deletion options (recursive, force)
   */
  deleteDirectoryWithPrefix(
    relativeDir: string,
    prefix: string,
    options?: DeleteDirectoryOptions,
  ): Promise<void>;

  /**
   * Gets file stats with prefix resolution
   * @param relativePath - Relative file path
   * @param prefix - Base path prefix
   * @returns File statistics
   */
  getFileStatsWithPrefix(
    relativePath: string,
    prefix: string,
  ): Promise<FileStats>;

  /**
   * Checks if directory exists with prefix resolution
   * @param relativeDir - Relative directory path
   * @param prefix - Base path prefix
   * @returns true if directory exists, false otherwise
   */
  directoryExistsWithPrefix(
    relativeDir: string,
    prefix: string,
  ): Promise<boolean>;
}
