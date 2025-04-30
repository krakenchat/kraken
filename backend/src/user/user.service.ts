import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InstanceInvite, InstanceRole, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../database/database.service';
import { InviteService } from '../invite/invite.service';

@Injectable()
export class UserService {
  constructor(
    private database: DatabaseService,
    private instanceInviteService: InviteService,
  ) {}

  async findByUsername(username: string): Promise<User | null> {
    return this.database.user.findUnique({
      where: { username },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.database.user.findUnique({
      where: { id },
    });
  }

  async createUser(
    code: string,
    username: string,
    password: string,
    email?: string,
  ): Promise<User> {
    await this.checkForFieldConflicts(username, email);
    const invite = await this.getInvite(code);
    if (!invite) {
      throw new NotFoundException('No invite found for the provided code.');
    }

    const userCount = await this.database.user.count();
    const role = userCount === 0 ? InstanceRole.OWNER : InstanceRole.USER;
    const verified = userCount === 0;
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.database.$transaction(async (tx) => {
      const lowerName = username.toLowerCase();
      const createdUser = await tx.user.create({
        data: {
          username: lowerName,
          displayName: lowerName,
          email,
          hashedPassword,
          verified,
          role,
        },
      });

      const upatedInvite = await this.instanceInviteService.redeemInviteWithTx(
        tx,
        invite.code,
        createdUser.id,
      );

      if (!upatedInvite) {
        throw new NotFoundException('Failed to redeem invite.');
      }

      // TODO: get the appropriate default community IDs and put them in there
      if (upatedInvite.defaultCommunityId.length > 0) {
        await tx.membership.createMany({
          data: upatedInvite.defaultCommunityId.map((communityId) => ({
            userId: createdUser.id,
            communityId,
          })),
        });
      }

      return createdUser;
    });

    return user;
  }

  async getInvite(code: string): Promise<InstanceInvite | null> {
    return this.instanceInviteService.validateInviteCode(code);
  }

  async checkForFieldConflicts(
    username?: string,
    email?: string,
  ): Promise<void> {
    const existingUser = await this.database.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existingUser) {
      const conflictField =
        existingUser.username === username ? 'username' : 'email';
      throw new ConflictException(
        `A user with this ${conflictField} already exists.`,
      );
    }
  }
}
