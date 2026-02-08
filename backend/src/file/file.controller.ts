import {
  Controller,
  Get,
  NotFoundException,
  NotImplementedException,
  Param,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { FileService } from './file.service';
import { StorageType } from '@prisma/client';
import { createReadStream } from 'fs';
import { ParseObjectIdPipe } from 'nestjs-object-id';
import { FileAccessGuard } from '@/file/file-access/file-access.guard';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';

@Controller('file')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Get(':id/metadata')
  @UseGuards(JwtAuthGuard, FileAccessGuard)
  async getFileMetadata(@Param('id', ParseObjectIdPipe) id: string) {
    const file = await this.fileService.findOne(id);
    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Return only metadata, not the file content
    return {
      id: file.id,
      filename: file.filename,
      mimeType: file.mimeType,
      fileType: file.fileType,
      size: file.size,
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, FileAccessGuard)
  async getFile(
    @Param('id', ParseObjectIdPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.fileService.findOne(id);
    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (file.storageType !== StorageType.LOCAL) {
      throw new NotImplementedException(
        'Only local file storage is supported at this time',
      );
    }

    const stream = createReadStream(file.storagePath);

    // Sanitize filename for Content-Disposition header (RFC 5987)
    const sanitizedFilename = file.filename.replace(/["\\\n\r]/g, '_');
    const encodedFilename = encodeURIComponent(file.filename);

    res.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': `inline; filename="${sanitizedFilename}"; filename*=UTF-8''${encodedFilename}`,
    });

    return new StreamableFile(stream);
  }
}
