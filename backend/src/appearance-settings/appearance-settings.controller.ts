import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { AppearanceSettingsService } from './appearance-settings.service';
import { UpdateAppearanceSettingsDto } from './dto/update-appearance-settings.dto';
import { AppearanceSettingsResponseDto } from './dto/appearance-settings-response.dto';

@Controller('appearance-settings')
@UseGuards(JwtAuthGuard)
export class AppearanceSettingsController {
  constructor(
    private readonly appearanceSettingsService: AppearanceSettingsService,
  ) {}

  /**
   * Get current user's appearance settings
   */
  @Get()
  async getSettings(
    @Request() req: { user: { id: string } },
  ): Promise<AppearanceSettingsResponseDto> {
    return this.appearanceSettingsService.getUserSettings(req.user.id);
  }

  /**
   * Update current user's appearance settings
   */
  @Patch()
  async updateSettings(
    @Request() req: { user: { id: string } },
    @Body() dto: UpdateAppearanceSettingsDto,
  ): Promise<AppearanceSettingsResponseDto> {
    return this.appearanceSettingsService.updateUserSettings(req.user.id, dto);
  }
}
