import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { DatabaseService } from '@/database/database.service';
import { ChannelsService } from '@/channels/channels.service';
import { RolesService } from '@/roles/roles.service';
import { isPrismaError } from '@/common/utils/prisma.utils';

@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly channelsService: ChannelsService,
    private readonly rolesService: RolesService,
  ) {}
  async create(createCommunityDto: CreateCommunityDto, creatorId: string) {
    try {
      return await this.databaseService.$transaction(async (tx) => {
        const community = await tx.community.create({
          data: createCommunityDto,
        });

        await tx.membership.create({
          data: {
            userId: creatorId,
            communityId: community.id,
          },
        });

        // Create default "general" channel and add creator as member
        await this.channelsService.createDefaultGeneralChannel(
          community.id,
          creatorId,
          tx,
        );

        // Create default roles for the community
        const adminRoleId = await this.rolesService.createDefaultCommunityRoles(
          community.id,
          tx,
        );

        // Assign the creator as admin of the community
        await this.rolesService.assignUserToCommunityRole(
          creatorId,
          community.id,
          adminRoleId,
          tx,
        );

        return community;
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw new ConflictException('Duplicate community name');
      }
      this.logger.error('Error creating community', error);
      throw error;
    }
  }

  async findAll(userId?: string) {
    if (userId) {
      const communities = await this.databaseService.membership.findMany({
        where: { userId },
        include: { community: true },
      });

      return communities.map((membership) => membership.community);
    } else {
      return this.databaseService.community.findMany({ take: 100 });
    }
  }

  async findOne(id: string) {
    const community = await this.databaseService.community.findUnique({
      where: { id },
    });

    if (!community) {
      throw new NotFoundException('Community not found');
    }

    return community;
  }

  async update(id: string, updateCommunityDto: UpdateCommunityDto) {
    return this.databaseService.$transaction(async (tx) => {
      const currentCommunity = await tx.community.findUnique({
        where: { id },
      });

      if (!currentCommunity) {
        throw new NotFoundException('Community not found');
      }

      // Mark old avatar for deletion if being replaced
      if (
        updateCommunityDto.avatar &&
        currentCommunity.avatar &&
        updateCommunityDto.avatar !== currentCommunity.avatar
      ) {
        await tx.file.update({
          where: { id: currentCommunity.avatar },
          data: { deletedAt: new Date() },
        });
      }

      // Mark old banner for deletion if being replaced
      if (
        updateCommunityDto.banner &&
        currentCommunity.banner &&
        updateCommunityDto.banner !== currentCommunity.banner
      ) {
        await tx.file.update({
          where: { id: currentCommunity.banner },
          data: { deletedAt: new Date() },
        });
      }

      return tx.community.update({
        where: { id },
        data: updateCommunityDto,
      });
    });
  }

  async addMemberToGeneralChannel(communityId: string, userId: string) {
    try {
      await this.channelsService.addUserToGeneralChannel(communityId, userId);
    } catch (error) {
      this.logger.error(
        `Failed to add user ${userId} to general channel in community ${communityId}`,
        error,
      );
      // Don't throw error to avoid breaking membership creation
    }
  }

  async remove(id: string) {
    const community = await this.databaseService.community.findUnique({
      where: { id },
    });

    if (!community) {
      throw new NotFoundException('Community not found');
    }

    await this.cascadeDeleteCommunity(id);
  }

  // ============================================
  // Admin Community Management Methods
  // ============================================

  /**
   * Get all communities with stats for admin dashboard
   */
  async findAllWithStats(
    limit: number = 50,
    continuationToken?: string,
    search?: string,
  ): Promise<{
    communities: Array<{
      id: string;
      name: string;
      description: string | null;
      avatar: string | null;
      banner: string | null;
      createdAt: Date;
      memberCount: number;
      channelCount: number;
    }>;
    continuationToken?: string;
  }> {
    const whereClause: { name?: { contains: string; mode: 'insensitive' } } =
      {};

    if (search) {
      whereClause.name = { contains: search, mode: 'insensitive' };
    }

    const communities = await this.databaseService.community.findMany({
      where: whereClause,
      take: limit + 1,
      orderBy: { createdAt: 'desc' },
      ...(continuationToken
        ? { cursor: { id: continuationToken }, skip: 1 }
        : {}),
      include: {
        _count: {
          select: {
            memberships: true,
            channels: true,
          },
        },
      },
    });

    const hasMore = communities.length > limit;
    const resultCommunities = hasMore ? communities.slice(0, -1) : communities;

    return {
      communities: resultCommunities.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        avatar: c.avatar,
        banner: c.banner,
        createdAt: c.createdAt,
        memberCount: c._count.memberships,
        channelCount: c._count.channels,
      })),
      continuationToken: hasMore
        ? resultCommunities[resultCommunities.length - 1].id
        : undefined,
    };
  }

  /**
   * Get a single community with detailed stats for admin
   */
  async findOneWithStats(id: string): Promise<{
    id: string;
    name: string;
    description: string | null;
    avatar: string | null;
    banner: string | null;
    createdAt: Date;
    memberCount: number;
    channelCount: number;
    messageCount: number;
  }> {
    const community = await this.databaseService.community.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            memberships: true,
            channels: true,
          },
        },
      },
    });

    if (!community) {
      throw new NotFoundException('Community not found');
    }

    // Get message count for this community
    const messageCount = await this.databaseService.message.count({
      where: {
        channel: {
          communityId: id,
        },
        deletedAt: null,
      },
    });

    return {
      id: community.id,
      name: community.name,
      description: community.description,
      avatar: community.avatar,
      banner: community.banner,
      createdAt: community.createdAt,
      memberCount: community._count.memberships,
      channelCount: community._count.channels,
      messageCount,
    };
  }

  /**
   * Force delete a community (admin action - bypasses ownership check)
   */
  async forceRemove(id: string): Promise<void> {
    const community = await this.databaseService.community.findUnique({
      where: { id },
    });

    if (!community) {
      throw new NotFoundException('Community not found');
    }

    await this.cascadeDeleteCommunity(id);
  }

  /**
   * Delete a community and all associated records in a transaction.
   */
  private async cascadeDeleteCommunity(id: string): Promise<void> {
    await this.databaseService.$transaction(async (tx) => {
      // Get all channel IDs for this community (needed for dependent record cleanup)
      const channels = await tx.channel.findMany({
        where: { communityId: id },
        select: { id: true },
      });
      const channelIds = channels.map((c) => c.id);

      // Delete records that depend on channels/messages
      if (channelIds.length > 0) {
        await tx.notification.deleteMany({
          where: { channelId: { in: channelIds } },
        });

        await tx.channelNotificationOverride.deleteMany({
          where: { channelId: { in: channelIds } },
        });

        await tx.readReceipt.deleteMany({
          where: { channelId: { in: channelIds } },
        });

        await tx.threadSubscriber.deleteMany({
          where: { parentMessage: { channelId: { in: channelIds } } },
        });
      }

      await tx.channelMembership.deleteMany({
        where: { channel: { communityId: id } },
      });

      await tx.message.deleteMany({
        where: { channel: { communityId: id } },
      });

      await tx.channel.deleteMany({
        where: { communityId: id },
      });

      // Delete community-level records
      await tx.communityBan.deleteMany({
        where: { communityId: id },
      });

      await tx.communityTimeout.deleteMany({
        where: { communityId: id },
      });

      await tx.moderationLog.deleteMany({
        where: { communityId: id },
      });

      await tx.aliasGroupMember.deleteMany({
        where: { aliasGroup: { communityId: id } },
      });

      await tx.aliasGroup.deleteMany({
        where: { communityId: id },
      });

      await tx.role.deleteMany({
        where: { communityId: id },
      });

      await tx.userRoles.deleteMany({
        where: { communityId: id },
      });

      await tx.membership.deleteMany({
        where: { communityId: id },
      });

      await tx.community.delete({
        where: { id },
      });
    });
  }
}
