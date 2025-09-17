import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { DatabaseService } from '@/database/database.service';
import { IStorageService } from './interfaces/storage.interface';
import { FileMetadataDto } from './dto/file-metadata.dto';
import { UploadFileDto } from './dto/upload-file.dto';
import { STORAGE_SERVICE } from './files.module';

@Injectable()
export class FilesService {
  constructor(
    private readonly database: DatabaseService,
    @Inject(STORAGE_SERVICE) private readonly storageService: IStorageService,
  ) {}

  async uploadFiles(
    files: any[],
    uploadDto: UploadFileDto,
    uploadedById: string,
  ): Promise<FileMetadataDto[]> {
    const uploadedFiles: FileMetadataDto[] = [];

    for (const file of files) {
      // Create file record in database first to get ID
      const fileRecord = await this.database.file.create({
        data: {
          filename: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          isPublic: uploadDto.isPublic || false,
          uploadedById,
        },
      });

      try {
        // Upload file to storage using the generated ID
        const extension = this.storageService.getFileExtension(file.originalname);
        await this.storageService.upload(file, fileRecord.id);

        // Convert to DTO
        const fileMetadata = this.toFileMetadataDto(fileRecord);
        uploadedFiles.push(fileMetadata);
      } catch (error) {
        // If storage upload fails, clean up database record
        await this.database.file.delete({
          where: { id: fileRecord.id },
        });
        throw error;
      }
    }

    return uploadedFiles;
  }

  async findById(fileId: string): Promise<FileMetadataDto | null> {
    const file = await this.database.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return null;
    }

    return this.toFileMetadataDto(file);
  }

  async downloadFile(fileId: string): Promise<{ buffer: Buffer; metadata: FileMetadataDto }> {
    const file = await this.findById(fileId);
    if (!file) {
      throw new NotFoundException('File not found');
    }

    const extension = this.storageService.getFileExtension(file.filename);
    const buffer = await this.storageService.download(fileId, extension);

    return { buffer, metadata: file };
  }

  async deleteFile(fileId: string, userId: string): Promise<void> {
    const file = await this.database.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Only owner can delete (for now - will be enhanced with RBAC later)
    if (file.uploadedById !== userId) {
      throw new ForbiddenException('You can only delete your own files');
    }

    // Delete from storage
    const extension = this.storageService.getFileExtension(file.filename);
    await this.storageService.delete(fileId, extension);

    // Delete from database
    await this.database.file.delete({
      where: { id: fileId },
    });
  }

  async checkFileAccess(fileId: string, userId: string): Promise<boolean> {
    const file = await this.database.file.findUnique({
      where: { id: fileId },
      include: {
        attachments: {
          include: {
            message: {
              include: {
                channel: true,
                directMessageGroup: {
                  include: {
                    members: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!file) {
      return false;
    }

    // Public files are accessible to any authenticated user
    if (file.isPublic) {
      return true;
    }

    // File owner can always access
    if (file.uploadedById === userId) {
      return true;
    }

    // Check message attachment permissions
    for (const attachment of file.attachments) {
      const message = attachment.message;

      if (message.channelId) {
        // Channel message - simplified access check (will be enhanced with RBAC)
        // For now, assume user has access if they can see the channel
        return true;
      } else if (message.directMessageGroupId) {
        // DM message - check if user is a member
        const dmGroup = message.directMessageGroup;
        const isMember = dmGroup?.members.some(member => member.userId === userId);
        if (isMember) {
          return true;
        }
      }
    }

    return false;
  }

  async findAttachmentsByMessageId(messageId: string): Promise<FileMetadataDto[]> {
    const attachments = await this.database.attachment.findMany({
      where: { messageId },
      include: { file: true },
      orderBy: { order: 'asc' },
    });

    return attachments.map(attachment => this.toFileMetadataDto(attachment.file));
  }

  async createAttachments(messageId: string, fileIds: string[]): Promise<void> {
    const attachmentData = fileIds.map((fileId, index) => ({
      fileId,
      messageId,
      order: index,
    }));

    await this.database.attachment.createMany({
      data: attachmentData,
    });
  }

  private toFileMetadataDto(file: any): FileMetadataDto {
    return {
      id: file.id,
      filename: file.filename,
      mimeType: file.mimeType,
      size: file.size,
      isPublic: file.isPublic,
      uploadedById: file.uploadedById,
      createdAt: file.createdAt,
      downloadUrl: `/files/${file.id}/download`,
    };
  }
}