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
  lastSeen: Date | null;

  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }
}
