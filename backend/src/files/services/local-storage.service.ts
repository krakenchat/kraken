import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { IStorageService, StorageResult } from '../interfaces/storage.interface';

@Injectable()
export class LocalStorageService implements IStorageService {
  private readonly uploadPath: string;

  constructor(private configService: ConfigService) {
    this.uploadPath = this.configService.get('UPLOAD_PATH', './uploads');
    this.ensureUploadDirectory();
  }

  async upload(file: any, fileId: string): Promise<StorageResult> {
    const extension = this.getFileExtension(file.originalname);
    const filePath = this.generatePath(fileId, extension);
    const fullPath = path.join(process.cwd(), filePath);

    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Write file to disk
    await fs.writeFile(fullPath, file.buffer);

    // Get actual file size
    const stats = await fs.stat(fullPath);

    return {
      path: filePath,
      size: stats.size,
    };
  }

  async download(fileId: string, extension: string): Promise<Buffer> {
    const filePath = this.generatePath(fileId, extension);
    const fullPath = path.join(process.cwd(), filePath);

    try {
      return await fs.readFile(fullPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error('File not found');
      }
      throw error;
    }
  }

  async delete(fileId: string, extension: string): Promise<void> {
    const filePath = this.generatePath(fileId, extension);
    const fullPath = path.join(process.cwd(), filePath);

    try {
      await fs.unlink(fullPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      // File doesn't exist, consider it already deleted
    }
  }

  async exists(fileId: string, extension: string): Promise<boolean> {
    const filePath = this.generatePath(fileId, extension);
    const fullPath = path.join(process.cwd(), filePath);

    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  generatePath(fileId: string, extension: string): string {
    const cleanExtension = extension.startsWith('.') ? extension : `.${extension}`;
    return path.join(this.uploadPath, `${fileId}${cleanExtension}`);
  }

  getFileExtension(filename: string): string {
    const ext = path.extname(filename);
    return ext || '.bin'; // Default extension for files without one
  }

  private async ensureUploadDirectory(): Promise<void> {
    const fullPath = path.join(process.cwd(), this.uploadPath);
    try {
      await fs.mkdir(fullPath, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }
}