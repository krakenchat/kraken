import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DatabaseService } from '@/database/database.service';
import { UserEntity } from '@/user/dto/user-response.dto';
import { InstanceInvite, Prisma } from '@prisma/client';

@Injectable()
export class InviteService {
  private readonly logger = new Logger(InviteService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async createInvite(
    creator: UserEntity,
    maxUses?: number,
    validUntil?: Date,
    communityIds: string[] = [],
  ): Promise<InstanceInvite> {
    // generate a short code for the invite
    let shortCode = this.generateInviteCode();
    // Check if the short code already exists
    while (
      await this.databaseService.instanceInvite.findFirst({
        where: { code: shortCode },
      })
    ) {
      // If it does, generate a new one
      this.logger.warn(`Short code ${shortCode} collision! Generating new one`);
      shortCode = this.generateInviteCode();
    }

    // Logic to create an invite for a user to join an instance
    return this.databaseService.instanceInvite.create({
      data: {
        code: shortCode,
        createdById: creator.id,
        maxUses,
        validUntil,
        defaultCommunityId: communityIds,
      },
    });
  }

  async validateInviteCode(inviteCode: string): Promise<InstanceInvite | null> {
    const invite = await this.databaseService.instanceInvite.findUnique({
      where: { code: inviteCode },
    });
    if (!invite) return null;
    const now = new Date();

    // Validation conditions
    if (
      invite.disabled ||
      (invite.validUntil && now > invite.validUntil) ||
      (invite.maxUses !== null && invite.uses >= invite.maxUses)
    ) {
      return null;
    }
    return invite;
  }

  async redeemInviteWithTx(
    tx: Prisma.TransactionClient,
    inviteCode: string,
    userId: string,
  ): Promise<InstanceInvite | null> {
    // Use a transaction for safety
    const invite = await tx.instanceInvite.findUnique({
      where: { code: inviteCode },
    });

    if (!invite) {
      this.logger.warn(`Invalid invite code: ${inviteCode}`);
      return null;
    }

    const now = new Date();
    if (
      invite.disabled ||
      (invite.validUntil && now > invite.validUntil) ||
      (invite.maxUses !== null && invite.uses >= invite.maxUses) ||
      invite.usedByIds.includes(userId)
    ) {
      this.logger.warn(`Invalid or already used invite: ${invite.code}`);
      return null;
    }

    // Update uses and usedByIds atomically
    const updated = await tx.instanceInvite.update({
      where: { code: inviteCode },
      data: {
        uses: { increment: 1 },
        usedByIds: { push: userId },
        disabled: invite.maxUses !== null && invite.uses + 1 >= invite.maxUses,
      },
    });

    return updated;
  }

  async getInvites(user: UserEntity): Promise<InstanceInvite[]> {
    return this.databaseService.instanceInvite.findMany({
      where: { createdById: user.id },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInviteByCode(code: string): Promise<InstanceInvite | null> {
    return this.databaseService.instanceInvite.findUnique({
      where: { code },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    });
  }

  async deleteInvite(user: UserEntity, code: string): Promise<void> {
    const invite = await this.databaseService.instanceInvite.findUnique({
      where: { code },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    // Only allow the creator to delete the invite (admins bypass via RBAC)
    if (invite.createdById !== user.id) {
      throw new ForbiddenException('Unauthorized to delete this invite');
    }

    await this.databaseService.instanceInvite.delete({
      where: { code },
    });
  }

  private generateInviteCode(length: number = 12) {
    return randomBytes(length).toString('base64url').slice(0, length);
  }
}
