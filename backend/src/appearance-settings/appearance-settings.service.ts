import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/database/database.service';
import { UserAppearanceSettings } from '@prisma/client';
import { UpdateAppearanceSettingsDto } from './dto/update-appearance-settings.dto';

@Injectable()
export class AppearanceSettingsService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Get user appearance settings (creates default if missing)
   */
  async getUserSettings(userId: string): Promise<UserAppearanceSettings> {
    return this.databaseService.userAppearanceSettings.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  /**
   * Update user appearance settings
   */
  async updateUserSettings(
    userId: string,
    dto: UpdateAppearanceSettingsDto,
  ): Promise<UserAppearanceSettings> {
    return this.databaseService.userAppearanceSettings.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: dto,
    });
  }
}
