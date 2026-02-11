import { ApiProperty } from '@nestjs/swagger';
import { RegistrationModeValues } from '@/common/enums/swagger-enums';

export class PublicSettingsResponseDto {
  @ApiProperty({ enum: RegistrationModeValues })
  registrationMode: string;
}

export class InstanceStatsResponseDto {
  totalUsers: number;
  totalCommunities: number;
  totalChannels: number;
  totalMessages: number;
  activeInvites: number;
  bannedUsers: number;
}
