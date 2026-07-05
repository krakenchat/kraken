import { Module } from '@nestjs/common';
import { SoundboardController } from './soundboard.controller';
import { SoundboardService } from './soundboard.service';
import { DatabaseModule } from '@/database/database.module';
import { RolesModule } from '@/roles/roles.module';

@Module({
  imports: [DatabaseModule, RolesModule],
  controllers: [SoundboardController],
  providers: [SoundboardService],
  exports: [SoundboardService],
})
export class SoundboardModule {}
