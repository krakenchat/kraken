import { ChannelType } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { ChannelTypeValues } from '@/common/enums/swagger-enums';

export class ChannelDto {
  id: string;
  name: string;
  communityId: string;
  createdAt: Date;
  @ApiProperty({ enum: ChannelTypeValues })
  type: ChannelType;
  position: number;
  slowmodeSeconds: number;
  isPrivate: boolean;
}
