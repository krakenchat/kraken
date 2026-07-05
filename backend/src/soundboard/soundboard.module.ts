import { Module } from '@nestjs/common';
import { SoundboardController } from './soundboard.controller';
import { SoundboardService } from './soundboard.service';
import { DatabaseModule } from '@/database/database.module';
import { RolesModule } from '@/roles/roles.module';
import { FileUploadModule } from '@/file-upload/file-upload.module';

@Module({
  imports: [DatabaseModule, RolesModule, FileUploadModule],
  controllers: [SoundboardController],
  providers: [SoundboardService],
  exports: [SoundboardService],
})
export class SoundboardModule {}
