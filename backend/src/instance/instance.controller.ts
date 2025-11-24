import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { InstanceService } from './instance.service';
import { InstanceSettings, RbacActions } from '@prisma/client';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RbacGuard } from '@/auth/rbac.guard';
import { RequiredActions } from '@/auth/rbac-action.decorator';
import { RbacResource, RbacResourceType } from '@/auth/rbac-resource.decorator';
import { UpdateInstanceSettingsDto } from './dto/update-instance-settings.dto';

@Controller('instance')
export class InstanceController {
  constructor(private readonly instanceService: InstanceService) {}

  /**
   * Get instance settings (public - needed for registration mode)
   */
  @Get('settings/public')
  async getPublicSettings(): Promise<{ registrationMode: string }> {
    const settings = await this.instanceService.getSettings();
    return { registrationMode: settings.registrationMode };
  }

  /**
   * Get full instance settings (admin only)
   */
  @Get('settings')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequiredActions(RbacActions.READ_INSTANCE_SETTINGS)
  @RbacResource({ type: RbacResourceType.INSTANCE })
  async getSettings(): Promise<InstanceSettings> {
    return this.instanceService.getSettings();
  }

  /**
   * Update instance settings (admin only)
   */
  @Patch('settings')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequiredActions(RbacActions.UPDATE_INSTANCE_SETTINGS)
  @RbacResource({ type: RbacResourceType.INSTANCE })
  async updateSettings(
    @Body() dto: UpdateInstanceSettingsDto,
  ): Promise<InstanceSettings> {
    return this.instanceService.updateSettings(dto);
  }

  /**
   * Get instance statistics (admin only)
   */
  @Get('stats')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequiredActions(RbacActions.READ_INSTANCE_STATS)
  @RbacResource({ type: RbacResourceType.INSTANCE })
  async getStats(): Promise<{
    totalUsers: number;
    totalCommunities: number;
    totalChannels: number;
    totalMessages: number;
    activeInvites: number;
    bannedUsers: number;
  }> {
    return this.instanceService.getStats();
  }
}
