import { $Enums, User } from '@prisma/client';
import { Exclude } from 'class-transformer';

export class UserEntity implements User {
  id: string;
  username: string;

  @Exclude()
  email: string | null;

  @Exclude()
  verified: boolean;
  role: $Enums.InstanceRole;

  @Exclude()
  createdAt: Date;

  @Exclude()
  hashedPassword: string;

  avatarUrl: string | null;
  bannerUrl: string | null;
  lastSeen: Date | null;
  displayName: string | null;

  // Profile fields
  bio: string | null;
  status: string | null;

  @Exclude()
  statusUpdatedAt: Date | null;

  // Ban status (excluded from public responses by default)
  @Exclude()
  banned: boolean;

  @Exclude()
  bannedAt: Date | null;

  @Exclude()
  bannedById: string | null;

  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }
}
