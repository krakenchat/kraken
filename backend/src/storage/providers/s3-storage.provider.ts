import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import {
  IStorageProvider,
  FileStats,
  WriteMeta,
  WriteResult,
  ReadRange,
} from '../interfaces/storage-provider.interface';

/**
 * S3-compatible Object Storage Provider
 *
 * Implements `IStorageProvider` against any S3-compatible API (AWS S3,
 * MinIO, etc.) via `@aws-sdk/client-s3`. Writes always go through
 * `@aws-sdk/lib-storage`'s `Upload` helper, which performs a streamed
 * multipart upload — the object body is never buffered whole in memory,
 * regardless of file size.
 *
 * Config is read directly from ConfigService (validated in
 * env.validation.ts, required only when STORAGE_TYPE=S3):
 *   S3_BUCKET, S3_REGION, S3_ENDPOINT (optional, e.g. MinIO),
 *   S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_FORCE_PATH_STYLE (optional).
 */
@Injectable()
export class S3StorageProvider implements IStorageProvider {
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(configService: ConfigService) {
    const region = configService.get<string>('S3_REGION') || 'us-east-1';
    const endpoint = configService.get<string>('S3_ENDPOINT') || undefined;
    const forcePathStyle = this.parseBool(
      configService.get<string>('S3_FORCE_PATH_STYLE'),
    );
    const accessKeyId = configService.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = configService.get<string>('S3_SECRET_ACCESS_KEY');
    this.bucket = configService.get<string>('S3_BUCKET') || '';

    this.client = new S3Client({
      region,
      ...(endpoint ? { endpoint, forcePathStyle } : {}),
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });

    this.logger.log(
      `S3StorageProvider initialized (bucket=${this.bucket || '<unset>'}, region=${region}${
        endpoint ? `, endpoint=${endpoint}` : ''
      })`,
    );
  }

  private parseBool(value?: string): boolean {
    if (!value) return false;
    return ['true', '1', 'yes'].includes(value.trim().toLowerCase());
  }

  private isNotFound(error: unknown): boolean {
    const err = error as {
      name?: string;
      $metadata?: { httpStatusCode?: number };
    };
    return err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404;
  }

  /**
   * Streams `source` to the S3 object `key` via a multipart upload
   * (`@aws-sdk/lib-storage`'s `Upload`). Never buffers the whole object.
   *
   * Size is derived from `Upload`'s own `httpUploadProgress` accounting
   * (cumulative bytes it has already streamed up) rather than a follow-up
   * HeadObject call — the bytes were just sent, so re-fetching them costs a
   * needless extra network round trip. `Upload` only emits progress events
   * once something has subscribed via `.on(...)` (see its `on()` override),
   * so the listener below is what turns that accounting on, for both the
   * single-PutObject and true-multipart code paths.
   */
  async writeStream(
    key: string,
    source: Readable,
    meta?: WriteMeta,
  ): Promise<WriteResult> {
    try {
      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.bucket,
          Key: key,
          Body: source,
          ContentType: meta?.contentType,
        },
      });

      let bytesUploaded = 0;
      upload.on('httpUploadProgress', (progress) => {
        if (typeof progress.loaded === 'number') {
          bytesUploaded = progress.loaded;
        }
      });

      const result = await upload.done();
      return { size: bytesUploaded, etag: result.ETag };
    } catch (error) {
      this.logger.error(`Failed to upload object ${key}:`, error);
      throw error;
    }
  }

  /**
   * Returns a readable stream for the S3 object `key`, optionally scoped to
   * a byte range via the S3 GetObject `Range` parameter (RFC 7233 syntax).
   */
  async getReadStream(key: string, range?: ReadRange): Promise<Readable> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ...(range ? { Range: `bytes=${range.start}-${range.end}` } : {}),
      });
      const response = await this.client.send(command);
      const body = response.Body;
      if (!(body instanceof Readable)) {
        throw new Error(`S3 object ${key} returned no readable body`);
      }
      return body;
    } catch (error) {
      this.logger.error(`Failed to read object ${key}:`, error);
      throw error;
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      this.logger.debug(`Deleted object: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete object ${key}:`, error);
      throw error;
    }
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch (error) {
      if (this.isNotFound(error)) {
        return false;
      }
      throw error;
    }
  }

  async getFileStats(key: string): Promise<FileStats> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const lastModified = result.LastModified ?? new Date(0);
      return {
        size: result.ContentLength ?? 0,
        mtime: lastModified,
        ctime: lastModified,
        contentType: result.ContentType,
        etag: result.ETag,
      };
    } catch (error) {
      this.logger.error(`Failed to stat object ${key}:`, error);
      throw error;
    }
  }

  /**
   * Presigned direct-to-S3 URLs are a possible later optimization (bypasses
   * backend streaming for read-heavy deployments) but are NOT wired into
   * any serve path in this task — the backend always streams object bytes
   * through the FileAuthGuard-protected `/api/file/:id` route so access
   * control stays centralized. Kept for interface parity only.
   */
  getFileUrl(key: string): Promise<string> {
    return Promise.resolve(key);
  }
}
