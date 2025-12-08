import { $Enums, Channel } from '@prisma/client';
import { Exclude } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

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

  @IsNumber()
  @IsOptional()
  position: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(21600) // Max 6 hours
  slowmodeSeconds: number;

  @Exclude()
  id: string;

  @Exclude()
  createdAt: Date;
}
