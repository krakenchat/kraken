import { Module } from '@nestjs/common';
import { FileUploadService } from './file-upload.service';
import { FileUploadController } from './file-upload.controller';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '@/database/database.module';
import { StorageModule } from '@/storage/storage.module';
import { StorageQuotaModule } from '@/storage-quota/storage-quota.module';

@Module({
  controllers: [FileUploadController],
  providers: [FileUploadService],
  imports: [
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        dest: configService.get<string>('FILE_UPLOAD_DEST') || './uploads',
        limits: {
          fileSize: 500 * 1024 * 1024, // 500MB hard limit (prevents DOS)
        },
      }),
      inject: [ConfigService],
    }),
    DatabaseModule,
    StorageModule,
    StorageQuotaModule,
  ],
})
export class FileUploadModule {}
