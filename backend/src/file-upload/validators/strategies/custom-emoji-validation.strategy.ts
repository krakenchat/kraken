import { IFileValidationStrategy } from './file-validation-strategy.interface';

/**
 * Validation strategy for custom emojis
 * PNG/GIF only, very small size, square dimensions
 */
export class CustomEmojiValidationStrategy implements IFileValidationStrategy {
  private readonly MAX_SIZE = 256 * 1024; // 256KB

  private readonly allowedMimeTypes = [
    'image/png',
    'image/gif',
    'image/webp', // For animated emojis
  ];

  getAllowedMimeTypes(): string[] {
    return this.allowedMimeTypes;
  }

  getMaxFileSize(): number {
    return this.MAX_SIZE;
  }

  getValidationDescription(): string {
    return 'PNG, GIF, or WebP only, max 256KB, small square dimensions recommended';
  }
}
