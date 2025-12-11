import { Transform, Type } from 'class-transformer';
import { InstanceInvite } from '@prisma/client';

/**
 * Simplified user info for invite responses
 */
class InviteCreatorDto {
  id: string;
  username: string;
  displayName: string | null;
}

/**
 * Instance invite response DTO that handles nested user serialization
 */
export class InviteResponseDto implements InstanceInvite {
  id: string;
  code: string;
  createdById: string | null;
  defaultCommunityId: string[];
  maxUses: number | null;
  uses: number;
  validUntil: Date | null;
  createdAt: Date;
  usedByIds: string[];
  disabled: boolean;

  @Type(() => InviteCreatorDto)
  createdBy?: InviteCreatorDto | null;

  constructor(partial: Partial<InviteResponseDto>) {
    Object.assign(this, partial);
  }
}
