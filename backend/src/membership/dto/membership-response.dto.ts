import { UserEntity } from '@/user/dto/user-response.dto';
import { Community, Membership, User } from '@prisma/client';

export class CommunityInfoDto {
  id: string;
  name: string;
  description: string | null;
  avatar: string | null;
}

export class MembershipResponseDto {
  id: string;
  user?: UserEntity;
  community?: CommunityInfoDto;
  userId: string;
  communityId: string;
  joinedAt: Date;

  constructor(
    membership: Membership & {
      user?: Partial<User>;
      community?: Partial<Community>;
    },
  ) {
    this.id = membership.id;
    this.userId = membership.userId;
    this.communityId = membership.communityId;
    this.joinedAt = membership.joinedAt;

    if (membership.user) {
      this.user = new UserEntity(membership.user);
    }

    if (membership.community) {
      this.community = {
        id: membership.community.id!,
        name: membership.community.name!,
        description: membership.community.description ?? null,
        avatar: membership.community.avatar ?? null,
      };
    }
  }
}
