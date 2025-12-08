import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InstanceInvite, InstanceRole, User, Prisma } from '@prisma/client';
import { AdminUserEntity } from './dto/admin-user-response.dto';
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

    if (updateProfileDto.bio !== undefined) {
      updateData.bio = updateProfileDto.bio.trim() || null;
    }

    if (updateProfileDto.status !== undefined) {
      updateData.status = updateProfileDto.status.trim() || null;
      updateData.statusUpdatedAt = new Date();
    }

    const updatedUser = await this.database.user.update({
      where: { id: userId },
      data: updateData,
    });

    return new UserEntity(updatedUser);
  }

  // ============================================
  // Admin User Management Methods
  // ============================================

  /**
   * Get all users with admin-level details (includes ban status)
   */
  async findAllAdmin(
    limit: number = 50,
    continuationToken?: string,
    filters?: {
      banned?: boolean;
      role?: InstanceRole;
      search?: string;
    },
  ): Promise<{ users: AdminUserEntity[]; continuationToken?: string }> {
    const whereClause: Prisma.UserWhereInput = {};

    if (filters?.banned !== undefined) {
      whereClause.banned = filters.banned;
    }

    if (filters?.role) {
      whereClause.role = filters.role;
    }

    if (filters?.search) {
      whereClause.OR = [
        { username: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { displayName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const query = {
      where: whereClause,
      take: limit + 1, // Fetch one extra to determine if there are more
      orderBy: { createdAt: 'desc' as const },
      ...(continuationToken
        ? { cursor: { id: continuationToken }, skip: 1 }
        : {}),
    };

    const users = await this.database.user.findMany(query);
    const hasMore = users.length > limit;
    const resultUsers = hasMore ? users.slice(0, -1) : users;

    return {
      users: resultUsers.map((u) => new AdminUserEntity(u)),
      continuationToken: hasMore
        ? resultUsers[resultUsers.length - 1].id
        : undefined,
    };
  }

  /**
   * Update a user's instance role (OWNER/USER)
   */
  async updateUserRole(
    targetUserId: string,
    newRole: InstanceRole,
    actingUserId: string,
  ): Promise<AdminUserEntity> {
    const targetUser = await this.findById(targetUserId);
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const actingUser = await this.findById(actingUserId);
    if (!actingUser) {
      throw new NotFoundException('Acting user not found');
    }

    // Only OWNER can change roles
    if (actingUser.role !== InstanceRole.OWNER) {
      throw new ForbiddenException(
        'Only instance owners can change user roles',
      );
    }

    // Prevent demoting yourself if you're the last owner
    if (
      targetUserId === actingUserId &&
      targetUser.role === InstanceRole.OWNER &&
      newRole !== InstanceRole.OWNER
    ) {
      const ownerCount = await this.database.user.count({
        where: { role: InstanceRole.OWNER },
      });
      if (ownerCount <= 1) {
        throw new ForbiddenException(
          'Cannot demote the last owner. Promote another user first.',
        );
      }
    }

    const updatedUser = await this.database.user.update({
      where: { id: targetUserId },
      data: { role: newRole },
    });

    return new AdminUserEntity(updatedUser);
  }

  /**
   * Ban or unban a user
   */
  async setBanStatus(
    targetUserId: string,
    banned: boolean,
    actingUserId: string,
  ): Promise<AdminUserEntity> {
    const targetUser = await this.findById(targetUserId);
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    // Cannot ban yourself
    if (targetUserId === actingUserId) {
      throw new ForbiddenException('Cannot ban yourself');
    }

    // Cannot ban an OWNER
    if (targetUser.role === InstanceRole.OWNER) {
      throw new ForbiddenException('Cannot ban an instance owner');
    }

    const updatedUser = await this.database.user.update({
      where: { id: targetUserId },
      data: {
        banned,
        bannedAt: banned ? new Date() : null,
        bannedById: banned ? actingUserId : null,
      },
    });

    return new AdminUserEntity(updatedUser);
  }

  /**
   * Delete a user account (admin action)
   */
  async deleteUser(targetUserId: string, actingUserId: string): Promise<void> {
    const targetUser = await this.findById(targetUserId);
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const actingUser = await this.findById(actingUserId);
    if (!actingUser) {
      throw new NotFoundException('Acting user not found');
    }

    // Cannot delete yourself
    if (targetUserId === actingUserId) {
      throw new ForbiddenException(
        'Cannot delete your own account through admin panel',
      );
    }

    // Only OWNER can delete users
    if (actingUser.role !== InstanceRole.OWNER) {
      throw new ForbiddenException('Only instance owners can delete users');
    }

    // Cannot delete another OWNER
    if (targetUser.role === InstanceRole.OWNER) {
      throw new ForbiddenException('Cannot delete an instance owner');
    }

    // Delete user and cascade will handle related records
    await this.database.user.delete({
      where: { id: targetUserId },
    });
  }

  /**
   * Get a single user with admin-level details
   */
  async findByIdAdmin(userId: string): Promise<AdminUserEntity | null> {
    const user = await this.findById(userId);
    if (!user) {
      return null;
    }
    return new AdminUserEntity(user);
  }

  // ============================================
  // User Blocking Methods
  // ============================================

  /**
   * Block a user
   */
  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) {
      throw new ForbiddenException('Cannot block yourself');
    }

    const blockedUser = await this.findById(blockedId);
    if (!blockedUser) {
      throw new NotFoundException('User to block not found');
    }

    // Check if already blocked
    const existingBlock = await this.database.userBlock.findUnique({
      where: {
        blockerId_blockedId: { blockerId, blockedId },
      },
    });

    if (existingBlock) {
      return; // Already blocked, no-op
    }

    await this.database.userBlock.create({
      data: { blockerId, blockedId },
    });
  }

  /**
   * Unblock a user
   */
  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    await this.database.userBlock.deleteMany({
      where: { blockerId, blockedId },
    });
  }

  /**
   * Get list of users blocked by a user
   */
  async getBlockedUsers(userId: string): Promise<UserEntity[]> {
    const blocks = await this.database.userBlock.findMany({
      where: { blockerId: userId },
      include: { blocked: true },
    });

    return blocks.map((block) => new UserEntity(block.blocked));
  }

  /**
   * Check if a user is blocked by another user
   */
  async isUserBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const block = await this.database.userBlock.findUnique({
      where: {
        blockerId_blockedId: { blockerId, blockedId },
      },
    });

    return !!block;
  }

  /**
   * Check if either user has blocked the other (bidirectional check)
   */
  async areUsersBlocked(userA: string, userB: string): Promise<boolean> {
    const block = await this.database.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: userA, blockedId: userB },
          { blockerId: userB, blockedId: userA },
        ],
      },
    });

    return !!block;
  }
}
