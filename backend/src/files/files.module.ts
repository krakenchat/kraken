import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { DatabaseModule } from '@/database/database.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { LocalStorageService } from './services/local-storage.service';
import { FileValidationService } from './services/file-validation.service';
import { FileAccessGuard } from './guards/file-access.guard';
import { STORAGE_SERVICE } from './constants';
import * as multer from 'multer';

@Module({
  imports: [
    DatabaseModule,
    MulterModule.register({
      storage: multer.memoryStorage(), // Store in memory for processing
    }),
  ],
  controllers: [FilesController],
  providers: [
    FilesService,
    FileValidationService,
    FileAccessGuard,
    {
      provide: STORAGE_SERVICE,
      useClass: LocalStorageService,
    },
  ],
  exports: [FilesService],
})
export class FilesModule {}
