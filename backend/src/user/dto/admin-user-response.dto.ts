import { Exclude, Transform } from 'class-transformer';
import { $Enums, User } from '@prisma/client';

/**
 * Admin-level user response that includes ban status and other sensitive fields
 */
export class AdminUserEntity implements User {
  id: string;
  username: string;
  email: string | null;
  verified: boolean;
  role: $Enums.InstanceRole;
  createdAt: Date;
  avatarUrl: string | null;
  bannerUrl: string | null;
  lastSeen: Date | null;
  displayName: string | null;

  // Profile fields
  bio: string | null;
  status: string | null;
  statusUpdatedAt: Date | null;

  // Ban status (visible to admins)
  banned: boolean;
  bannedAt: Date | null;
  bannedById: string | null;

  // Storage quota (visible to admins) - Transform BigInt to Number for JSON serialization
  @Transform(({ value }) => (value ? Number(value) : 0))
  storageQuotaBytes: bigint;

  @Transform(({ value }) => (value ? Number(value) : 0))
  storageUsedBytes: bigint;

  @Exclude()
  hashedPassword: string;

  constructor(partial: Partial<AdminUserEntity>) {
    Object.assign(this, partial);
  }
}
