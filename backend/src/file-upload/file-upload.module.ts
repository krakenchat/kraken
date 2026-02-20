import { Module } from '@nestjs/common';
import { FileUploadService } from './file-upload.service';
import { FileUploadController } from './file-upload.controller';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '@/database/database.module';
import { StorageModule } from '@/storage/storage.module';
import { StorageQuotaModule } from '@/storage-quota/storage-quota.module';
import { LivekitModule } from '@/livekit/livekit.module';
import { ThumbnailService } from '@/file/thumbnail.service';

@Module({
  controllers: [FileUploadController],
  providers: [FileUploadService, ThumbnailService],
  imports: [
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        dest: configService.get<string>('FILE_UPLOAD_DEST') || './uploads',
        limits: {
          fileSize: 1024 * 1024 * 1024, // 1GB hard limit (per-type limits enforced by validation strategies)
        },
      }),
      inject: [ConfigService],
    }),
    ConfigModule,
    DatabaseModule,
    StorageModule,
    StorageQuotaModule,
    LivekitModule,
  ],
})
export class FileUploadModule {}
