import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateChannelMembershipDto } from './dto/create-channel-membership.dto';
import { ChannelMembershipResponseDto } from './dto/channel-membership-response.dto';
import { DatabaseService } from '@/database/database.service';
import { PUBLIC_USER_SELECT } from '@/common/constants/user-select.constant';

@Injectable()
export class ChannelMembershipService {
  private readonly logger = new Logger(ChannelMembershipService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async create(
    createChannelMembershipDto: CreateChannelMembershipDto,
    addedById?: string,
  ): Promise<ChannelMembershipResponseDto> {
    const { userId, channelId } = createChannelMembershipDto;

    // Check if channel exists and get its details
    const channel = await this.databaseService.channel.findUnique({
      where: { id: channelId },
      include: { community: true },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    // Only allow adding members to private channels
    if (!channel.isPrivate) {
      throw new ForbiddenException(
        'Cannot manage membership for public channels - users automatically join public channels when they join the community',
      );
    }

    // Check if user exists
    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user is a member of the community
    const communityMembership =
      await this.databaseService.membership.findUnique({
        where: {
          userId_communityId: {
            userId,
            communityId: channel.communityId,
          },
        },
      });

    if (!communityMembership) {
      throw new ForbiddenException(
        'User must be a member of the community before being added to a private channel',
      );
    }

    // Check if membership already exists
    const existingMembership =
      await this.databaseService.channelMembership.findUnique({
        where: {
          userId_channelId: {
            userId,
            channelId,
          },
        },
      });

    if (existingMembership) {
      throw new ConflictException('User is already a member of this channel');
    }

    const channelMembership =
      await this.databaseService.channelMembership.create({
        data: {
          userId,
          channelId,
          addedBy: addedById,
        },
      });

    this.logger.log(
      `Added user ${userId} to private channel ${channelId}${addedById ? ` by ${addedById}` : ''}`,
    );

    return new ChannelMembershipResponseDto(channelMembership);
  }

  async findAllForChannel(
    channelId: string,
  ): Promise<ChannelMembershipResponseDto[]> {
    // Check if channel exists and is private
    const channel = await this.databaseService.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    if (!channel.isPrivate) {
      throw new ForbiddenException(
        'This endpoint is only for private channels. Public channel members are managed automatically through community membership.',
      );
    }

    const memberships = await this.databaseService.channelMembership.findMany({
      where: { channelId },
      include: {
        user: { select: PUBLIC_USER_SELECT },
      },
    });

    return memberships.map(
      (membership) => new ChannelMembershipResponseDto(membership),
    );
  }

  async findAllForUser(
    userId: string,
  ): Promise<ChannelMembershipResponseDto[]> {
    const memberships = await this.databaseService.channelMembership.findMany({
      where: {
        userId,
        channel: {
          isPrivate: true,
        },
      },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            communityId: true,
            isPrivate: true,
          },
        },
      },
    });

    return memberships.map(
      (membership) => new ChannelMembershipResponseDto(membership),
    );
  }

  async findOne(
    userId: string,
    channelId: string,
  ): Promise<ChannelMembershipResponseDto> {
    const membership = await this.databaseService.channelMembership.findUnique({
      where: {
        userId_channelId: {
          userId,
          channelId,
        },
      },
      include: {
        channel: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('Channel membership not found');
    }

    // Only return memberships for private channels
    if (!membership.channel.isPrivate) {
      throw new ForbiddenException(
        'This endpoint is only for private channels',
      );
    }

    return new ChannelMembershipResponseDto(membership);
  }

  async remove(userId: string, channelId: string): Promise<void> {
    // Check if channel exists and is private
    const channel = await this.databaseService.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    if (!channel.isPrivate) {
      throw new ForbiddenException(
        'Cannot remove users from public channels - users automatically leave public channels when they leave the community',
      );
    }

    // Check if membership exists
    const membership = await this.databaseService.channelMembership.findUnique({
      where: {
        userId_channelId: {
          userId,
          channelId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Channel membership not found');
    }

    // Remove the membership
    await this.databaseService.channelMembership.delete({
      where: {
        userId_channelId: {
          userId,
          channelId,
        },
      },
    });

    this.logger.log(`Removed user ${userId} from private channel ${channelId}`);
  }

  // Helper method to check if user is member of private channel
  async isMember(userId: string, channelId: string): Promise<boolean> {
    try {
      const membership =
        await this.databaseService.channelMembership.findUnique({
          where: {
            userId_channelId: {
              userId,
              channelId,
            },
          },
          include: {
            channel: {
              select: {
                isPrivate: true,
              },
            },
          },
        });

      // For public channels, check community membership instead
      if (membership?.channel && !membership.channel.isPrivate) {
        const channel = await this.databaseService.channel.findUnique({
          where: { id: channelId },
          select: { communityId: true },
        });

        if (channel) {
          const communityMembership =
            await this.databaseService.membership.findUnique({
              where: {
                userId_communityId: {
                  userId,
                  communityId: channel.communityId,
                },
              },
            });
          return !!communityMembership;
        }
      }

      return !!membership;
    } catch (error) {
      this.logger.error(
        `Error checking channel membership for user ${userId} in channel ${channelId}`,
        error,
      );
      return false;
    }
  }
}
