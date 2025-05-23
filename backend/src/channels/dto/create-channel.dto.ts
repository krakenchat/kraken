import { $Enums, Channel } from '@prisma/client';
import { Exclude } from 'class-transformer';
import { IsString, IsNotEmpty, IsEnum, IsBoolean } from 'class-validator';

export class CreateChannelDto implements Channel {
  @IsBoolean()
  @IsNotEmpty()
  isPrivate: boolean;

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
