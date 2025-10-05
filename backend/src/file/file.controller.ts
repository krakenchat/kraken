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

  @Get(':id')
  @UseGuards(JwtAuthGuard, FileAccessGuard)
  async getFile(
    @Param('id', ParseObjectIdPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const file = await this.fileService.findOne(id);
      if (file?.storageType !== StorageType.LOCAL) {
        throw new NotImplementedException(
          'Only local file storage is supported at this time',
        );
      }

      const stream = createReadStream(file.storagePath);

      res.set({
        'Content-Type': file.mimeType,
        'Content-Disposition': `inline; filename="${file.filename}"`,
      });

      return new StreamableFile(stream);
    } catch (error) {
      console.error('Error fetching file:', error);
      throw new NotFoundException('File not found');
    }
  }
}
