import { UserEntity } from '@/user/dto/user-response.dto';
import { ChannelMembership, User } from '@prisma/client';

export class ChannelMembershipResponseDto {
  id: string;
  userId: string;
  user?: UserEntity;
  channelId: string;
  joinedAt: Date;
  addedBy?: string;

  constructor(channelMembership: ChannelMembership & { user?: Partial<User> }) {
    this.id = channelMembership.id;
    this.userId = channelMembership.userId;
    this.channelId = channelMembership.channelId;
    this.joinedAt = channelMembership.joinedAt;
    this.addedBy = channelMembership.addedBy || undefined;
    if (channelMembership.user) {
      this.user = new UserEntity(channelMembership.user);
    }
  }
}
