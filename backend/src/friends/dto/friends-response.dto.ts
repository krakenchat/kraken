import { FriendshipStatus, InstanceRole } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import {
  InstanceRoleValues,
  FriendshipStatusValues,
} from '@/common/enums/swagger-enums';

export class FriendUserDto {
  id: string;
  username: string;
  email: string | null;
  verified: boolean;
  @ApiProperty({ enum: InstanceRoleValues })
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
  @ApiProperty({ enum: FriendshipStatusValues })
  status: FriendshipStatus;
  createdAt: Date;
}

export class FriendshipWithUsersDto {
  id: string;
  userAId: string;
  userBId: string;
  @ApiProperty({ enum: FriendshipStatusValues })
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
  @ApiProperty({ enum: FriendshipStatusValues, nullable: true })
  status: FriendshipStatus | null;
  friendshipId: string | null;
  @ApiProperty({ enum: ['sent', 'received'], nullable: true })
  direction: 'sent' | 'received' | null;
}
