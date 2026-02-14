import { FriendshipStatus, InstanceRole } from '@prisma/client';
import { Exclude } from 'class-transformer';
import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import {
  InstanceRoleValues,
  FriendshipStatusValues,
} from '@/common/enums/swagger-enums';

export class FriendUserDto {
  id: string;
  username: string;

  @Exclude()
  @ApiHideProperty()
  email: string | null;

  @Exclude()
  @ApiHideProperty()
  verified: boolean;

  @ApiProperty({ enum: InstanceRoleValues })
  role: InstanceRole;

  @Exclude()
  @ApiHideProperty()
  createdAt: Date;

  avatarUrl: string | null;
  bannerUrl: string | null;
  lastSeen: Date | null;
  displayName: string | null;
  bio: string | null;
  status: string | null;
  statusUpdatedAt: Date | null;

  @Exclude()
  @ApiHideProperty()
  banned: boolean;

  @Exclude()
  @ApiHideProperty()
  hashedPassword: string;

  @Exclude()
  @ApiHideProperty()
  bannedAt: Date | null;

  @Exclude()
  @ApiHideProperty()
  bannedById: string | null;

  @Exclude()
  @ApiHideProperty()
  storageQuotaBytes: bigint;

  @Exclude()
  @ApiHideProperty()
  storageUsedBytes: bigint;

  constructor(partial: Partial<FriendUserDto>) {
    Object.assign(this, partial);
  }
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
