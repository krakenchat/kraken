import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/database/database.module';
import { RolesModule } from '@/roles/roles.module';
import { CustomEmojiController } from './custom-emoji.controller';
import { CustomEmojiService } from './custom-emoji.service';

@Module({
  imports: [DatabaseModule, RolesModule],
  controllers: [CustomEmojiController],
  providers: [CustomEmojiService],
  exports: [CustomEmojiService],
})
export class CustomEmojiModule {}
