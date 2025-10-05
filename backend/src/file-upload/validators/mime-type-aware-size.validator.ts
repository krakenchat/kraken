import { FileValidator } from '@nestjs/common';

/**
 * Custom file validator that applies different size limits based on MIME type
 * Used in controller decorators for basic upload validation
 */
export class MimeTypeAwareSizeValidator extends FileValidator<
  Record<string, never>
> {
  private readonly MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
  private readonly MAX_IMAGE_SIZE = 25 * 1024 * 1024; // 25MB
  private readonly MAX_DOCUMENT_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50MB

  isValid(file?: Express.Multer.File): boolean {
    if (!file) {
      return false;
    }

    const maxSize = this.getMaxSizeForMimeType(file.mimetype);
    return file.size <= maxSize;
  }

  buildErrorMessage(file: Express.Multer.File): string {
    const maxSize = this.getMaxSizeForMimeType(file.mimetype);
    const maxSizeMB = (maxSize / 1024 / 1024).toFixed(2);
    const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);

    return `File too large (${fileSizeMB}MB). Maximum allowed size for ${file.mimetype} is ${maxSizeMB}MB`;
  }

  private getMaxSizeForMimeType(mimeType: string): number {
    if (mimeType.startsWith('video/')) {
      return this.MAX_VIDEO_SIZE;
    }
    if (mimeType.startsWith('image/')) {
      return this.MAX_IMAGE_SIZE;
    }
    if (mimeType.startsWith('audio/')) {
      return this.MAX_AUDIO_SIZE;
    }
    // Documents and other types
    return this.MAX_DOCUMENT_SIZE;
  }
}
