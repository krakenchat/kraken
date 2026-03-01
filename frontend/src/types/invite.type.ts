import { User } from './auth.type';

export interface InstanceInvite {
  id: string;
  code: string;
  createdById?: string;
  createdBy?: User;
  defaultCommunities: Array<{ id: string; inviteId: string; communityId: string }>;
  maxUses?: number;
  uses: number;
  validUntil?: Date;
  createdAt: Date;
  usages: Array<{ id: string; inviteId: string; userId: string; usedAt: Date }>;
  disabled: boolean;
}

export interface CreateInviteDto {
  maxUses?: number;
  validUntil?: Date;
  communityIds: string[];
}