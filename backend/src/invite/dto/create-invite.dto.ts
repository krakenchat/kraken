export class CreateInviteDto {
  maxUses?: number;
  validUntil?: Date;
  communityIds: string[];
}
