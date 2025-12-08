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
    let settings =
      await this.databaseService.userAppearanceSettings.findUnique({
        where: { userId },
      });

    if (!settings) {
      // Create default settings
      settings = await this.databaseService.userAppearanceSettings.create({
        data: { userId },
      });
    }

    return settings;
  }

  /**
   * Update user appearance settings
   */
  async updateUserSettings(
    userId: string,
    dto: UpdateAppearanceSettingsDto,
  ): Promise<UserAppearanceSettings> {
    // Ensure settings exist first
    await this.getUserSettings(userId);

    return this.databaseService.userAppearanceSettings.update({
      where: { userId },
      data: dto,
    });
  }
}
