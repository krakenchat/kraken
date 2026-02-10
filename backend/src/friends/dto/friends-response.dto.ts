import { FriendshipStatus, User } from '@prisma/client';

export class FriendshipWithUsersDto {
  id: string;
  userAId: string;
  userBId: string;
  status: FriendshipStatus;
  createdAt: Date;
  userA: User;
  userB: User;
}

export class PendingRequestsDto {
  sent: FriendshipWithUsersDto[];
  received: FriendshipWithUsersDto[];
}

export class FriendshipStatusDto {
  status: FriendshipStatus | null;
  friendshipId: string | null;
  direction: 'sent' | 'received' | null;
}
