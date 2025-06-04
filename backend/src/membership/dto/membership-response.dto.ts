import { Membership } from '@prisma/client';

export class MembershipResponseDto {
  id: string;
  userId: string;
  communityId: string;
  joinedAt: Date;

  constructor(membership: Membership) {
    this.id = membership.id;
    this.userId = membership.userId;
    this.communityId = membership.communityId;
    this.joinedAt = membership.joinedAt;
  }
}
