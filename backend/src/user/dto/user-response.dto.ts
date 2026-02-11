import { $Enums, User } from '@prisma/client';
import { Exclude } from 'class-transformer';
import { ApiHideProperty } from '@nestjs/swagger';

export class UserEntity implements User {
  id: string;
  username: string;

  @Exclude()
  @ApiHideProperty()
  email: string | null;

  @Exclude()
  @ApiHideProperty()
  verified: boolean;
  role: $Enums.InstanceRole;

  @Exclude()
  @ApiHideProperty()
  createdAt: Date;

  @Exclude()
  @ApiHideProperty()
  hashedPassword: string;

  avatarUrl: string | null;
  bannerUrl: string | null;
  lastSeen: Date | null;
  displayName: string | null;

  // Profile fields
  bio: string | null;
  status: string | null;

  @Exclude()
  @ApiHideProperty()
  statusUpdatedAt: Date | null;

  @Exclude()
  @ApiHideProperty()
  banned: boolean;

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

  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }
}
