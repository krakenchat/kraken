import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Res,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { FilesService } from './files.service';
import { FileValidationService } from './services/file-validation.service';
import { FileAccessGuard } from './guards/file-access.guard';
import { UploadFileDto } from './dto/upload-file.dto';
import { FileMetadataDto } from './dto/file-metadata.dto';

@Controller('files')
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly fileValidationService: FileValidationService,
  ) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
    }),
  )
  async uploadFiles(
    @UploadedFiles() files: any[],
    @Body() uploadDto: UploadFileDto,
    @Request() req: { user: { id: string } },
  ): Promise<FileMetadataDto[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    // Validate files
    this.fileValidationService.throwIfInvalid(files);

    // Upload files
    return this.filesService.uploadFiles(files, uploadDto, req.user.id);
  }

  @Get(':id/metadata')
  @UseGuards(JwtAuthGuard, FileAccessGuard)
  async getFileMetadata(@Param('id') fileId: string): Promise<FileMetadataDto> {
    const file = await this.filesService.findById(fileId);
    if (!file) {
      throw new BadRequestException('File not found');
    }
    return file;
  }

  @Get(':id/download')
  @UseGuards(JwtAuthGuard, FileAccessGuard)
  async downloadFile(@Param('id') fileId: string, @Res() res: Response): Promise<void> {
    const { buffer, metadata } = await this.filesService.downloadFile(fileId);

    res.set({
      'Content-Type': metadata.mimeType,
      'Content-Length': buffer.length.toString(),
      'Content-Disposition': `attachment; filename="${metadata.filename}"`,
      'Cache-Control': 'private, max-age=3600',
    });

    res.send(buffer);
  }

  @Get('public/:id')
  async servePublicFile(@Param('id') fileId: string, @Res() res: Response): Promise<void> {
    const file = await this.filesService.findById(fileId);
    if (!file || !file.isPublic) {
      res.status(404).send('File not found');
      return;
    }

    const { buffer, metadata } = await this.filesService.downloadFile(fileId);

    res.set({
      'Content-Type': metadata.mimeType,
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'public, max-age=86400', // 24 hours for public files
    });

    res.send(buffer);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, FileAccessGuard)
  async deleteFile(
    @Param('id') fileId: string,
    @Request() req: { user: { id: string } }
  ): Promise<void> {
    await this.filesService.deleteFile(fileId, req.user.id);
  }
}