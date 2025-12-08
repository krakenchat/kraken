import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/database/database.module';
import { AppearanceSettingsController } from './appearance-settings.controller';
import { AppearanceSettingsService } from './appearance-settings.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AppearanceSettingsController],
  providers: [AppearanceSettingsService],
  exports: [AppearanceSettingsService],
})
export class AppearanceSettingsModule {}
