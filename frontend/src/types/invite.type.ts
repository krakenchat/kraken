import { User } from './auth.type';

export interface InstanceInvite {
  id: string;
  code: string;
  createdById?: string;
  createdBy?: User;
  defaultCommunityId: string[];
  maxUses?: number;
  uses: number;
  validUntil?: Date;
  createdAt: Date;
  usedByIds: string[];
  disabled: boolean;
}

export interface CreateInviteDto {
  maxUses?: number;
  validUntil?: Date;
  communityIds: string[];
}