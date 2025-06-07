import { UserEntity } from '@/user/dto/user-response.dto';
import { Membership, User } from '@prisma/client';

export class MembershipResponseDto {
  id: string;
  user?: UserEntity;
  userId: string;
  communityId: string;
  joinedAt: Date;

  constructor(membership: Membership & { user?: User }) {
    this.id = membership.id;
    if (membership.user) {
      this.user = new UserEntity(membership.user);
    } else {
      this.userId = membership.userId;
    }
    this.communityId = membership.communityId;
    this.joinedAt = membership.joinedAt;
  }
}
