/**
 * Simplified user info for invite responses
 */
class InviteCreatorDto {
  id: string;
  username: string;
  displayName: string | null;
}

/**
 * Instance invite response DTO
 */
export class InviteResponseDto {
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
  createdBy?: InviteCreatorDto | null;
}
