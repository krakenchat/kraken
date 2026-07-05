import { IFileValidationStrategy } from './file-validation-strategy.interface';

/**
 * Validation strategy for soundboard sounds.
 * Short audio clips only, small size cap to keep them snappy and cheap to serve.
 */
export class SoundboardSoundValidationStrategy implements IFileValidationStrategy {
  private readonly MAX_SIZE = 1024 * 1024; // 1MB

  private readonly allowedMimeTypes = [
    'audio/mpeg', // .mp3
    'audio/wav',
    'audio/x-wav',
    'audio/ogg',
    'audio/webm',
    'audio/aac',
  ];

  getAllowedMimeTypes(): string[] {
    return this.allowedMimeTypes;
  }

  getMaxFileSize(): number {
    return this.MAX_SIZE;
  }

  getValidationDescription(): string {
    return 'MP3, WAV, OGG, WebM, or AAC audio only, max 1MB (keep clips short)';
  }
}
