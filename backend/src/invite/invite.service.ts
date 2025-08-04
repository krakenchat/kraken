import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { UserEntity } from '../user/dto/user-response.dto';
import { InstanceInvite, Prisma } from '@prisma/client';

@Injectable()
export class InviteService {
  constructor(private readonly database: DatabaseService) {}

  async createInvite(
    creator: UserEntity,
    maxUses?: number,
    validUntil?: Date,
    communityIds: string[] = [],
  ): Promise<InstanceInvite> {
    // TODO: allow users to just create a code?

    // generate a short code for the invite
    let shortCode = this.generateInviteCode();
    // Check if the short code already exists
    while (
      await this.database.instanceInvite.findFirst({
        where: { code: shortCode },
      })
    ) {
      // If it does, generate a new one
      console.warn(`Short code ${shortCode} collision! Generating new one`);
      shortCode = this.generateInviteCode();
    }

    // Logic to create an invite for a user to join an instance
    return this.database.instanceInvite.create({
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
    const invite = await this.database.instanceInvite.findUnique({
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
      console.warn('Invalid invite code', inviteCode);
      return null;
    }

    const now = new Date();
    if (
      invite.disabled ||
      (invite.validUntil && now > invite.validUntil) ||
      (invite.maxUses !== null && invite.uses >= invite.maxUses) ||
      invite.usedByIds.includes(userId)
    ) {
      console.warn('Invalid or already used invite', invite);
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
    return this.database.instanceInvite.findMany({
      where: { createdById: user.id },
      include: { createdBy: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInviteByCode(code: string): Promise<InstanceInvite | null> {
    return this.database.instanceInvite.findUnique({
      where: { code },
      include: { createdBy: true },
    });
  }

  async deleteInvite(user: UserEntity, code: string): Promise<void> {
    const invite = await this.database.instanceInvite.findUnique({
      where: { code },
    });

    if (!invite) {
      throw new Error('Invite not found');
    }

    // Only allow the creator or an admin to delete the invite
    if (invite.createdById !== user.id) {
      // TODO: Check if user has admin permissions
      throw new Error('Unauthorized to delete this invite');
    }

    await this.database.instanceInvite.delete({
      where: { code },
    });
  }

  private generateInviteCode(length: number = 6) {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
