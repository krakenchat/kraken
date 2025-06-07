import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InstanceInvite, InstanceRole, User, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../database/database.service';
import { InviteService } from '../invite/invite.service';
import { ChannelsService } from '../channels/channels.service';
import { UserEntity } from './dto/user-response.dto';

@Injectable()
export class UserService {
  constructor(
    private database: DatabaseService,
    private instanceInviteService: InviteService,
    private channelsService: ChannelsService,
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

        // Add user to general channel in each community they joined
        for (const communityId of upatedInvite.defaultCommunityId) {
          try {
            await this.channelsService.addUserToGeneralChannel(
              communityId,
              createdUser.id,
            );
          } catch (error) {
            // Log error but don't fail user creation
            console.warn(
              `Failed to add user ${createdUser.id} to general channel in community ${communityId}:`,
              error,
            );
          }
        }
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

  async findAll(limit: number = 50, continuationToken?: string) {
    const query = {
      where: {},
      take: limit,
      orderBy: { createdAt: 'desc' as const },
      ...(continuationToken ? { cursor: { id: continuationToken } } : {}),
    };

    const users = (await this.database.user.findMany(query)).map(
      (u) => new UserEntity(u),
    );
    const nextToken =
      users.length === limit ? users[users.length - 1].id : undefined;

    return { users, continuationToken: nextToken };
  }

  async searchUsers(
    query: string,
    communityId?: string,
    limit: number = 50,
  ): Promise<UserEntity[]> {
    const whereClause: Prisma.UserWhereInput = {
      OR: [
        { username: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
      ],
    };

    // If communityId is provided, filter to users who are NOT already members
    if (communityId) {
      whereClause.NOT = {
        memberships: {
          some: {
            communityId: communityId,
          },
        },
      };
    }

    const users = await this.database.user.findMany({
      where: whereClause,
      take: limit,
      orderBy: { username: 'asc' },
    });

    return users.map((u) => new UserEntity(u));
  }
}
