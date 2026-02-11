import { ChannelType } from '@prisma/client';

export class ChannelDto {
  id: string;
  name: string;
  communityId: string;
  createdAt: Date;
  type: ChannelType;
  position: number;
  slowmodeSeconds: number;
  isPrivate: boolean;
}
