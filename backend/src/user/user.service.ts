import {
  ConflictException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InstanceInvite, InstanceRole, User, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../database/database.service';
import { InviteService } from '../invite/invite.service';
import { ChannelsService } from '../channels/channels.service';
import { RolesService } from '../roles/roles.service';
import { UserEntity } from './dto/user-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private database: DatabaseService,
    private instanceInviteService: InviteService,
    private channelsService: ChannelsService,
    private rolesService: RolesService,
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

      // Add user to default communities specified in the invite
      if (upatedInvite.defaultCommunityId.length > 0) {
        await tx.membership.createMany({
          data: upatedInvite.defaultCommunityId.map((communityId) => ({
            userId: createdUser.id,
            communityId,
          })),
        });

        // Add user to general channel and assign Member role in each community
        for (const communityId of upatedInvite.defaultCommunityId) {
          try {
            // Add to general channel
            await this.channelsService.addUserToGeneralChannel(
              communityId,
              createdUser.id,
            );
          } catch (error) {
            // Log error but don't fail user creation
            this.logger.warn(
              `Failed to add user ${createdUser.id} to general channel in community ${communityId}:`,
              error,
            );
          }

          try {
            // Assign Member role to the user
            let memberRole =
              await this.rolesService.getCommunityMemberRole(communityId);

            // If Member role doesn't exist for this community, create it
            if (!memberRole) {
              this.logger.log(
                `Member role not found for community ${communityId}, creating it...`,
              );
              await this.rolesService.createMemberRoleForCommunity(
                communityId,
                tx,
              );
              memberRole =
                await this.rolesService.getCommunityMemberRole(communityId);
            }

            if (memberRole) {
              await this.rolesService.assignUserToCommunityRole(
                createdUser.id,
                communityId,
                memberRole.id,
                tx,
              );
              this.logger.log(
                `Assigned Member role to user ${createdUser.id} in community ${communityId}`,
              );
            } else {
              this.logger.error(
                `Failed to create or find member role for community ${communityId}`,
              );
            }
          } catch (error) {
            this.logger.warn(
              `Failed to assign default member role to user ${createdUser.id} in community ${communityId}`,
              error,
            );
            // Don't fail user creation for this
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
      orderBy: { username: 'asc' as const },
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

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<UserEntity> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateData: Prisma.UserUpdateInput = {};

    if (updateProfileDto.displayName !== undefined) {
      updateData.displayName = updateProfileDto.displayName.trim();
    }

    if (updateProfileDto.avatar !== undefined) {
      updateData.avatarUrl = updateProfileDto.avatar;
    }

    if (updateProfileDto.banner !== undefined) {
      updateData.bannerUrl = updateProfileDto.banner;
    }

    const updatedUser = await this.database.user.update({
      where: { id: userId },
      data: updateData,
    });

    return new UserEntity(updatedUser);
  }
}
