import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '@/database/database.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { unlink } from 'fs/promises';

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);
  constructor(private readonly databaseService: DatabaseService) {}

  findOne(id: string) {
    return this.databaseService.file.findUniqueOrThrow({
      where: { id },
    });
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async cleanupOldFiles() {
    this.logger.debug('Running cleanup of old files...');
    const deletedFiles = await this.databaseService.file.findMany({
      where: {
        deletedAt: { not: null },
      },
    });

    this.logger.debug(`Found ${deletedFiles.length} files to delete.`);

    for (const file of deletedFiles) {
      try {
        if (file.storageType === 'LOCAL' && file.storagePath) {
          // Delete file from local storage
          await this.cleanupFile(file.storagePath);
          await this.databaseService.file.delete({
            where: { id: file.id },
          });
        }
      } catch (error) {
        // Log error but continue with next file
        console.error(`Failed to delete file with ID ${file.id}:`, error);
      }
    }
  }

  private async cleanupFile(filePath: string): Promise<void> {
    try {
      await unlink(filePath);
      this.logger.debug(`Cleaned up file: ${filePath}`);
    } catch (error) {
      this.logger.warn(`Failed to clean up file ${filePath}: ${error}`);
      throw error;
    }
  }
}
