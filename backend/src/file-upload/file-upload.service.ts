import {
  Injectable,
  UnprocessableEntityException,
  PayloadTooLargeException,
  Logger,
} from '@nestjs/common';
import { CreateFileUploadDto } from './dto/create-file-upload.dto';
import { DatabaseService } from '@/database/database.service';
import { FileType, StorageType } from '@prisma/client';
import { createHash } from 'crypto';
import { StorageService } from '@/storage/storage.service';
import { StorageQuotaService } from '@/storage-quota/storage-quota.service';
import { ResourceTypeFileValidator } from './validators';
import { UserEntity } from '@/user/dto/user-response.dto';

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
    private readonly storageQuotaService: StorageQuotaService,
  ) {}

  async uploadFile(
    file: Express.Multer.File,
    createFileUploadDto: CreateFileUploadDto,
    user: UserEntity,
  ) {
    try {
      // Check storage quota before processing
      const quotaCheck = await this.storageQuotaService.canUploadFile(
        user.id,
        file.size,
      );

      if (!quotaCheck.canUpload) {
        // Delete file from disk before throwing error
        await this.cleanupFile(file.path);
        throw new PayloadTooLargeException(
          quotaCheck.message || 'Storage quota exceeded',
        );
      }

      // Validate file using strategy pattern
      const validator = new ResourceTypeFileValidator({
        resourceType: createFileUploadDto.resourceType,
      });

      const isValid = await validator.isValid(file);
      if (!isValid) {
        // Delete file from disk before throwing error
        await this.cleanupFile(file.path);
        throw new UnprocessableEntityException(
          validator.buildErrorMessage(file),
        );
      }

      // Generate checksum
      const checksum = await this.generateChecksum(file.path);

      // Determine file type from MIME type
      const fileType = this.getFileTypeFromMimeType(file.mimetype);

      // Create database record
      try {
        const fileRecord = await this.databaseService.file.create({
          data: {
            ...createFileUploadDto,
            filename: file.originalname,
            mimeType: file.mimetype,
            fileType,
            size: file.size,
            checksum,
            uploadedById: user.id,
            storageType: StorageType.LOCAL,
            storagePath: file.path,
          },
        });

        // Increment user's storage usage
        await this.storageQuotaService.incrementUserStorage(user.id, file.size);

        return fileRecord;
      } catch (dbError) {
        // If DB insert fails, clean up the file
        await this.cleanupFile(file.path);
        this.logger.error(`Database error during file upload: ${dbError}`);
        throw dbError;
      }
    } catch (error) {
      // Ensure file is cleaned up on any error
      if (
        error instanceof UnprocessableEntityException ||
        error instanceof PayloadTooLargeException
      ) {
        throw error; // Already cleaned up and has proper message
      }

      // For unexpected errors (not already handled), clean up and re-throw
      this.logger.error(`Error processing file upload: ${error}`);
      throw error;
    }
  }

  /**
   * Delete a file from disk
   */
  private async cleanupFile(filePath: string): Promise<void> {
    try {
      await this.storageService.deleteFile(filePath);
      this.logger.debug(`Cleaned up file: ${filePath}`);
    } catch (error) {
      this.logger.warn(`Failed to clean up file ${filePath}: ${error}`);
    }
  }

  /**
   * Generate SHA-256 checksum for a file
   */
  private async generateChecksum(filePath: string): Promise<string> {
    const fileBuffer = await this.storageService.readFile(filePath);
    return createHash('sha256').update(fileBuffer).digest('hex');
  }

  /**
   * Determine FileType enum from MIME type
   */
  private getFileTypeFromMimeType(mimeType: string): FileType {
    if (mimeType.startsWith('image/')) {
      return FileType.IMAGE;
    }
    if (mimeType.startsWith('video/')) {
      return FileType.VIDEO;
    }
    if (mimeType.startsWith('audio/')) {
      return FileType.AUDIO;
    }
    if (
      mimeType.startsWith('application/pdf') ||
      mimeType.startsWith('application/msword') ||
      mimeType.startsWith(
        'application/vnd.openxmlformats-officedocument.wordprocessingml',
      ) ||
      mimeType.startsWith('application/vnd.ms-excel') ||
      mimeType.startsWith(
        'application/vnd.openxmlformats-officedocument.spreadsheetml',
      ) ||
      mimeType.startsWith('application/vnd.ms-powerpoint') ||
      mimeType.startsWith(
        'application/vnd.openxmlformats-officedocument.presentationml',
      ) ||
      mimeType.startsWith('text/')
    ) {
      return FileType.DOCUMENT;
    }
    // Archives and other application types
    if (
      mimeType.includes('zip') ||
      mimeType.includes('rar') ||
      mimeType.includes('7z') ||
      mimeType.includes('tar') ||
      mimeType.includes('gzip') ||
      mimeType.includes('bzip') ||
      mimeType === 'application/octet-stream'
    ) {
      return FileType.OTHER;
    }
    return FileType.OTHER;
  }

  remove(id: string) {
    return this.databaseService.file.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
