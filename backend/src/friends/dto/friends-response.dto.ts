import { FriendshipStatus, InstanceRole } from '@prisma/client';

export class FriendUserDto {
  id: string;
  username: string;
  email: string | null;
  verified: boolean;
  role: InstanceRole;
  createdAt: Date;
  avatarUrl: string | null;
  bannerUrl: string | null;
  lastSeen: Date | null;
  displayName: string | null;
  bio: string | null;
  status: string | null;
  statusUpdatedAt: Date | null;
  banned: boolean;
}

export class FriendshipDto {
  id: string;
  userAId: string;
  userBId: string;
  status: FriendshipStatus;
  createdAt: Date;
}

export class FriendshipWithUsersDto {
  id: string;
  userAId: string;
  userBId: string;
  status: FriendshipStatus;
  createdAt: Date;
  userA: FriendUserDto;
  userB: FriendUserDto;
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
