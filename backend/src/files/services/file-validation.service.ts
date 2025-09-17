import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

@Injectable()
export class FileValidationService {
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: string[];

  constructor(private configService: ConfigService) {
    this.maxFileSize = this.configService.get('MAX_FILE_SIZE', 100 * 1024 * 1024); // 100MB
    this.allowedMimeTypes = [
      // Images
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      // Videos
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'video/x-msvideo',
      // Audio
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/aac',
      // Documents
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      // Archives
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
    ];
  }

  validateFile(file: any): ValidationResult {
    const errors: string[] = [];

    // Check file size
    if (file.size > this.maxFileSize) {
      errors.push(`File size exceeds maximum limit of ${this.maxFileSize / (1024 * 1024)}MB`);
    }

    // Check MIME type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      errors.push(`File type '${file.mimetype}' is not allowed`);
    }

    // Check filename
    if (!this.validateFilename(file.originalname)) {
      errors.push('Invalid filename');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  validateFiles(files: any[]): ValidationResult {
    const allErrors: string[] = [];

    if (files.length === 0) {
      return { isValid: false, errors: ['No files provided'] };
    }

    if (files.length > 10) {
      return { isValid: false, errors: ['Too many files (maximum 10)'] };
    }

    files.forEach((file, index) => {
      const result = this.validateFile(file);
      if (!result.isValid) {
        allErrors.push(...result.errors.map(error => `File ${index + 1}: ${error}`));
      }
    });

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
    };
  }

  private validateFilename(filename: string): boolean {
    // Basic filename validation
    if (!filename || filename.length === 0) {
      return false;
    }

    // Check for dangerous characters
    const dangerousChars = /[<>:"|?*\x00-\x1f]/;
    if (dangerousChars.test(filename)) {
      return false;
    }

    // Check for reserved names (Windows)
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
    if (reservedNames.test(filename)) {
      return false;
    }

    // Filename too long
    if (filename.length > 255) {
      return false;
    }

    return true;
  }

  throwIfInvalid(files: any[]): void {
    const result = this.validateFiles(files);
    if (!result.isValid) {
      throw new BadRequestException(result.errors.join(', '));
    }
  }
}