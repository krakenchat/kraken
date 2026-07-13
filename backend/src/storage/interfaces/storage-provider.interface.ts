import { Readable } from 'stream';

/**
 * Storage Provider Interface
 *
 * Object-store-shaped contract for storage backends (filesystem, S3, Azure
 * Blob, etc.). Operates on opaque `key` strings rather than filesystem
 * paths — for LocalStorageProvider a key happens to be a filesystem path
 * (absolute or relative), for S3StorageProvider it is the S3 object key.
 *
 * This is deliberately narrow: it covers exactly what a `File` DB record
 * needs (write once, read back — optionally ranged —, stat, delete, exists,
 * URL). Directory-oriented filesystem operations (ensureDirectory,
 * deleteDirectory, listFiles, deleteOldFiles, resolvePath, ...) are NOT part
 * of this interface — S3 has no directory concept, and those operations are
 * used exclusively by the LiveKit replay/egress pipeline and thumbnail
 * generation, which inherently require a local scratch filesystem (ffmpeg
 * reads/writes real files on disk). That surface stays local-only: see
 * `LocalStorageProvider`'s additional public methods, which `StorageService`
 * addresses directly (not through this interface).
 */

export interface FileStats {
  size: number;
  mtime: Date;
  ctime: Date;
  /** Populated by object-store providers (e.g. S3 HeadObject); undefined for local files. */
  contentType?: string;
  /** Populated by object-store providers; undefined for local files. */
  etag?: string;
}

export interface WriteMeta {
  contentType?: string;
}

export interface WriteResult {
  size: number;
  etag?: string;
}

export interface ReadRange {
  /** Inclusive start byte offset. */
  start: number;
  /** Inclusive end byte offset. */
  end: number;
}

export interface IStorageProvider {
  /**
   * Streams `source` to the object identified by `key`. Implementations
   * MUST stream — never buffer the whole object in memory.
   * @param key - Object key (local: filesystem path; S3: object key)
   * @param source - Readable source (e.g. a local temp-file read stream)
   * @param meta - Optional metadata (e.g. Content-Type)
   * @returns The written object's size and, when available, its etag
   */
  writeStream(
    key: string,
    source: Readable,
    meta?: WriteMeta,
  ): Promise<WriteResult>;

  /**
   * Returns a readable stream for the object, optionally scoped to a byte
   * range (used for HTTP Range request support in the file serve path).
   * @param key - Object key
   * @param range - Optional inclusive byte range
   */
  getReadStream(key: string, range?: ReadRange): Promise<Readable>;

  /**
   * Deletes the object identified by `key`.
   */
  deleteFile(key: string): Promise<void>;

  /**
   * Checks whether the object identified by `key` exists.
   */
  fileExists(key: string): Promise<boolean>;

  /**
   * Gets object metadata (HeadObject-style for S3).
   */
  getFileStats(key: string): Promise<FileStats>;

  /**
   * Gets a URL for accessing the object.
   * For local storage: returns the key/path as-is.
   * For S3: currently also returns the key as-is — presigned direct-to-S3
   * URLs are a possible later optimization, not wired into any serve path
   * in this task (the backend always streams object bytes through
   * FileAuthGuard-protected routes).
   */
  getFileUrl(key: string): Promise<string>;
}

/**
 * Local-filesystem-only types. Kept out of IStorageProvider (see module
 * doc). Used by LocalStorageProvider's directory-oriented methods, which
 * StorageService exposes as local-only convenience methods for the
 * LiveKit replay/egress pipeline.
 */
export interface DeleteDirectoryOptions {
  recursive?: boolean;
  force?: boolean;
}

export interface ListFilesOptions {
  filter?: (filename: string) => boolean;
}
