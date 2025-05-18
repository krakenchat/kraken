import { $Enums, Channel } from '@prisma/client';
import { Exclude } from 'class-transformer';
import { IsString, IsNotEmpty, IsEnum } from 'class-validator';

export class CreateChannelDto implements Channel {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  communityId: string;

  @IsEnum($Enums.ChannelType)
  type: $Enums.ChannelType;

  @Exclude()
  id: string;

  @Exclude()
  createdAt: Date;
}
