import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ChannelMembershipRole } from '@prisma/client';

export class CreateChannelMembershipDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  channelId: string;

  @IsOptional()
  @IsEnum(ChannelMembershipRole)
  role?: ChannelMembershipRole;

  @IsOptional()
  @IsString()
  addedBy?: string;
}
