import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { DatabaseModule } from '@/database/database.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { LocalStorageService } from './services/local-storage.service';
import { FileValidationService } from './services/file-validation.service';
import { FileAccessGuard } from './guards/file-access.guard';
import { IStorageService } from './interfaces/storage.interface';

export const STORAGE_SERVICE = 'STORAGE_SERVICE';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    MulterModule.register({
      storage: require('multer').memoryStorage(), // Store in memory for processing
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