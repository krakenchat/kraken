import { ChannelMembership, ChannelMembershipRole } from '@prisma/client';

export class ChannelMembershipResponseDto {
  id: string;
  userId: string;
  channelId: string;
  joinedAt: Date;
  role: ChannelMembershipRole;
  addedBy?: string;

  constructor(channelMembership: ChannelMembership) {
    this.id = channelMembership.id;
    this.userId = channelMembership.userId;
    this.channelId = channelMembership.channelId;
    this.joinedAt = channelMembership.joinedAt;
    this.role = channelMembership.role;
    this.addedBy = channelMembership.addedBy || undefined;
  }
}
