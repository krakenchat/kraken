import {
  Injectable,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common';
import { CreateFileUploadDto } from './dto/create-file-upload.dto';
import { DatabaseService } from '@/database/database.service';
import { FileType, StorageType } from '@prisma/client';
import { createHash } from 'crypto';
import { readFile, unlink } from 'fs/promises';
import { ResourceTypeFileValidator } from './validators';
import { UserEntity } from '@/user/dto/user-response.dto';

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async uploadFile(
    file: Express.Multer.File,
    createFileUploadDto: CreateFileUploadDto,
    user: UserEntity,
  ) {
    try {
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
        return await this.databaseService.file.create({
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
      } catch (dbError) {
        // If DB insert fails, clean up the file
        await this.cleanupFile(file.path);
        this.logger.error(`Database error during file upload: ${dbError}`);
        throw dbError;
      }
    } catch (error) {
      // Ensure file is cleaned up on any error
      if (error instanceof UnprocessableEntityException) {
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
      await unlink(filePath);
      this.logger.debug(`Cleaned up file: ${filePath}`);
    } catch (error) {
      this.logger.warn(`Failed to clean up file ${filePath}: ${error}`);
    }
  }

  /**
   * Generate SHA-256 checksum for a file
   */
  private async generateChecksum(filePath: string): Promise<string> {
    const fileBuffer = await readFile(filePath);
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
      mimeType.startsWith('text/')
    ) {
      return FileType.DOCUMENT;
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
