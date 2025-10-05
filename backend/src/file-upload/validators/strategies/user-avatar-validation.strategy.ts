import { IFileValidationStrategy } from './file-validation-strategy.interface';

/**
 * Validation strategy for user avatars
 * Images only, smaller size limit, square dimensions preferred
 */
export class UserAvatarValidationStrategy implements IFileValidationStrategy {
  private readonly MAX_SIZE = 10 * 1024 * 1024; // 10MB

  private readonly allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
  ];

  getAllowedMimeTypes(): string[] {
    return this.allowedMimeTypes;
  }

  getMaxFileSize(): number {
    return this.MAX_SIZE;
  }

  getValidationDescription(): string {
    return 'Images only (JPEG, PNG, GIF, WebP), max 10MB';
  }
}
