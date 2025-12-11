import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/database/database.service';
import { InstanceSettings, RegistrationMode } from '@prisma/client';
import { UpdateInstanceSettingsDto } from './dto/update-instance-settings.dto';

@Injectable()
export class InstanceService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Get or create instance settings (singleton pattern)
   */
  async getSettings(): Promise<InstanceSettings> {
    // Try to find existing settings
    let settings = await this.db.instanceSettings.findFirst();

    // Create default settings if none exist
    if (!settings) {
      settings = await this.db.instanceSettings.create({
        data: {
          name: 'Kraken',
          description: null,
          registrationMode: RegistrationMode.INVITE_ONLY,
        },
      });
    }

    return settings;
  }

  /**
   * Update instance settings
   */
  async updateSettings(
    dto: UpdateInstanceSettingsDto,
  ): Promise<InstanceSettings> {
    // Ensure settings exist
    const existing = await this.getSettings();

    return this.db.instanceSettings.update({
      where: { id: existing.id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.registrationMode !== undefined && {
          registrationMode: dto.registrationMode,
        }),
        ...(dto.defaultStorageQuotaBytes !== undefined && {
          defaultStorageQuotaBytes: BigInt(dto.defaultStorageQuotaBytes),
        }),
        ...(dto.maxFileSizeBytes !== undefined && {
          maxFileSizeBytes: BigInt(dto.maxFileSizeBytes),
        }),
      },
    });
  }

  /**
   * Get instance statistics for admin dashboard
   */
  async getStats(): Promise<{
    totalUsers: number;
    totalCommunities: number;
    totalChannels: number;
    totalMessages: number;
    activeInvites: number;
    bannedUsers: number;
  }> {
    const [
      totalUsers,
      totalCommunities,
      totalChannels,
      totalMessages,
      activeInvites,
      bannedUsers,
    ] = await Promise.all([
      this.db.user.count(),
      this.db.community.count(),
      this.db.channel.count(),
      this.db.message.count({ where: { deletedAt: null } }),
      this.db.instanceInvite.count({
        where: {
          disabled: false,
          OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
        },
      }),
      this.db.user.count({ where: { banned: true } }),
    ]);

    return {
      totalUsers,
      totalCommunities,
      totalChannels,
      totalMessages,
      activeInvites,
      bannedUsers,
    };
  }
}
