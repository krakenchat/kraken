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
import type { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Injectable()
export class ChannelMembershipService {
  private readonly logger = new Logger(ChannelMembershipService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async create(
    createChannelMembershipDto: CreateChannelMembershipDto,
    addedById?: string,
  ): Promise<ChannelMembershipResponseDto> {
    const { userId, channelId, role } = createChannelMembershipDto;

    try {
      // Check if channel exists and get its details
      const channel = await this.databaseService.channel.findUniqueOrThrow({
        where: { id: channelId },
        include: { community: true },
      });

      // Only allow adding members to private channels
      if (!channel.isPrivate) {
        throw new ForbiddenException(
          'Cannot manage membership for public channels - users automatically join public channels when they join the community',
        );
      }

      // Check if user exists
      await this.databaseService.user.findUniqueOrThrow({
        where: { id: userId },
      });

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
            role: role || 'MEMBER',
            addedBy: addedById,
          },
        });

      this.logger.log(
        `Added user ${userId} to private channel ${channelId}${addedById ? ` by ${addedById}` : ''}`,
      );

      return new ChannelMembershipResponseDto(channelMembership);
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      this.logger.error('Error creating channel membership', error);

      // Handle Prisma errors
      const prismaError = error as PrismaClientKnownRequestError;
      if (prismaError.code === 'P2002') {
        throw new ConflictException('User is already a member of this channel');
      }
      if (prismaError.code === 'P2025') {
        throw new NotFoundException('User or channel not found');
      }

      throw error;
    }
  }

  async findAllForChannel(
    channelId: string,
  ): Promise<ChannelMembershipResponseDto[]> {
    try {
      // Check if channel exists and is private
      const channel = await this.databaseService.channel.findUniqueOrThrow({
        where: { id: channelId },
      });

      if (!channel.isPrivate) {
        throw new ForbiddenException(
          'This endpoint is only for private channels. Public channel members are managed automatically through community membership.',
        );
      }

      const memberships = await this.databaseService.channelMembership.findMany(
        {
          where: { channelId },
          include: {
            user: true,
          },
        },
      );

      return memberships.map(
        (membership) => new ChannelMembershipResponseDto(membership),
      );
    } catch (error) {
      this.logger.error(
        `Error finding memberships for channel ${channelId}`,
        error,
      );
      throw error;
    }
  }

  async findAllForUser(
    userId: string,
  ): Promise<ChannelMembershipResponseDto[]> {
    try {
      const memberships = await this.databaseService.channelMembership.findMany(
        {
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
        },
      );

      return memberships.map(
        (membership) => new ChannelMembershipResponseDto(membership),
      );
    } catch (error) {
      this.logger.error(
        `Error finding channel memberships for user ${userId}`,
        error,
      );
      throw error;
    }
  }

  async findOne(
    userId: string,
    channelId: string,
  ): Promise<ChannelMembershipResponseDto> {
    try {
      const membership =
        await this.databaseService.channelMembership.findUniqueOrThrow({
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

      // Only return memberships for private channels
      if (!membership.channel.isPrivate) {
        throw new ForbiddenException(
          'This endpoint is only for private channels',
        );
      }

      return new ChannelMembershipResponseDto(membership);
    } catch (error) {
      this.logger.error(
        `Error finding channel membership for user ${userId} in channel ${channelId}`,
        error,
      );
      throw new NotFoundException('Channel membership not found');
    }
  }

  async remove(userId: string, channelId: string): Promise<void> {
    try {
      // Check if channel exists and is private
      const channel = await this.databaseService.channel.findUniqueOrThrow({
        where: { id: channelId },
      });

      if (!channel.isPrivate) {
        throw new ForbiddenException(
          'Cannot remove users from public channels - users automatically leave public channels when they leave the community',
        );
      }

      // Check if membership exists
      await this.databaseService.channelMembership.findUniqueOrThrow({
        where: {
          userId_channelId: {
            userId,
            channelId,
          },
        },
      });

      // Remove the membership
      await this.databaseService.channelMembership.delete({
        where: {
          userId_channelId: {
            userId,
            channelId,
          },
        },
      });

      this.logger.log(
        `Removed user ${userId} from private channel ${channelId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error removing channel membership for user ${userId} from channel ${channelId}`,
        error,
      );

      const prismaError = error as PrismaClientKnownRequestError;
      if (prismaError.code === 'P2025') {
        throw new NotFoundException('Channel membership not found');
      }

      if (error instanceof ForbiddenException) {
        throw error;
      }

      throw error;
    }
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
