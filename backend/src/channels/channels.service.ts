import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { DatabaseService } from '@/database/database.service';
import { UserEntity } from '@/user/dto/user-response.dto';
import { ChannelType, Prisma } from '@prisma/client';
import { WebsocketService } from '@/websocket/websocket.service';
import { ServerEvents } from '@/websocket/events.enum/server-events.enum';

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly websocketService: WebsocketService,
  ) {}

  async create(createChannelDto: CreateChannelDto, user: UserEntity) {
    try {
      // Use a transaction to create the channel and the membership
      const result = await this.databaseService.$transaction(async (prisma) => {
        // Get max position for this channel type in the community
        const maxPosition = await prisma.channel.aggregate({
          where: {
            communityId: createChannelDto.communityId,
            type: createChannelDto.type,
          },
          _max: { position: true },
        });

        const newPosition = (maxPosition._max.position ?? -1) + 1;

        const channel = await prisma.channel.create({
          data: {
            ...createChannelDto,
            position: newPosition,
          },
        });
        await prisma.channelMembership.create({
          data: {
            userId: user.id,
            channelId: channel.id,
          },
        });
        return channel;
      });
      return result;
    } catch (error) {
      // Check if error is a Prisma error with a code property
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        this.logger.warn(
          'Channel already exists with the same name in this community',
        );
        throw new ConflictException(
          'Channel with this name already exists in the community',
        );
      }
      this.logger.error('Error creating channel', error);
      throw error;
    }
  }

  findAll(communityId: string) {
    return this.databaseService.channel.findMany({
      where: { communityId },
      orderBy: [
        { type: 'asc' }, // TEXT before VOICE (alphabetically)
        { position: 'asc' },
        { createdAt: 'asc' }, // Tiebreaker for existing channels with position 0
      ],
    });
  }

  async findOne(id: string) {
    try {
      return await this.databaseService.channel.findUniqueOrThrow({
        where: { id },
      });
    } catch (error) {
      this.logger.error('Error finding channel', error);
      throw new NotFoundException('Channel not found');
    }
  }

  async update(id: string, updateChannelDto: UpdateChannelDto) {
    try {
      return await this.databaseService.channel.update({
        where: { id },
        data: updateChannelDto,
      });
    } catch (error) {
      // Check if error is a Prisma error with a code property
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        this.logger.warn(
          'Channel already exists with the same name in this community',
        );
        throw new ConflictException(
          'Channel with this name already exists in the community',
        );
      }
      this.logger.error('Error updating channel', error);
      throw error;
    }
  }

  remove(id: string) {
    return this.databaseService.channel.delete({
      where: { id },
    });
  }

  async createDefaultGeneralChannel(
    communityId: string,
    userId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const prisma = tx || this.databaseService;

    try {
      const channel = await prisma.channel.create({
        data: {
          name: 'general',
          communityId,
          type: ChannelType.TEXT,
          isPrivate: false,
        },
      });

      await prisma.channelMembership.create({
        data: {
          userId,
          channelId: channel.id,
        },
      });

      return channel;
    } catch (error) {
      this.logger.error('Error creating default general channel', error);
      throw error;
    }
  }

  async addUserToGeneralChannel(communityId: string, userId: string) {
    try {
      // Find the general channel in the community
      const generalChannel = await this.databaseService.channel.findFirst({
        where: {
          communityId,
          name: 'general',
        },
      });

      if (!generalChannel) {
        this.logger.warn(
          `No general channel found for community ${communityId}`,
        );
        return;
      }

      // Check if user is already a member
      const existingMembership =
        await this.databaseService.channelMembership.findFirst({
          where: {
            userId,
            channelId: generalChannel.id,
          },
        });

      if (existingMembership) {
        this.logger.debug(
          `User ${userId} is already a member of general channel`,
        );
        return;
      }

      // Add user to the general channel
      await this.databaseService.channelMembership.create({
        data: {
          userId,
          channelId: generalChannel.id,
        },
      });

      this.logger.debug(
        `Added user ${userId} to general channel in community ${communityId}`,
      );
    } catch (error) {
      this.logger.error('Error adding user to general channel', error);
      throw error;
    }
  }

  // Get mentionable channels for a user in a community
  async findMentionableChannels(communityId: string, userId: string) {
    try {
      // Get channels that are either:
      // 1. Public channels in the community
      // 2. Private channels where the user is a member
      const channels = await this.databaseService.channel.findMany({
        where: {
          communityId,
          OR: [
            { isPrivate: false },
            {
              isPrivate: true,
              ChannelMembership: {
                some: {
                  userId,
                },
              },
            },
          ],
        },
        orderBy: {
          name: 'asc',
        },
      });

      return channels;
    } catch (error) {
      this.logger.error(
        `Error finding mentionable channels for user ${userId} in community ${communityId}`,
        error,
      );
      throw error;
    }
  }

  async moveChannelUp(channelId: string, communityId: string) {
    return this.databaseService.$transaction(async (prisma) => {
      const channel = await prisma.channel.findUniqueOrThrow({
        where: { id: channelId },
      });

      // Find the channel above with the same type and lower position
      const channelAbove = await prisma.channel.findFirst({
        where: {
          communityId,
          type: channel.type,
          position: { lt: channel.position },
        },
        orderBy: { position: 'desc' },
      });

      if (!channelAbove) {
        // Already at the top, return current list
        return this.findAll(communityId);
      }

      // Swap positions
      await prisma.channel.update({
        where: { id: channel.id },
        data: { position: channelAbove.position },
      });
      await prisma.channel.update({
        where: { id: channelAbove.id },
        data: { position: channel.position },
      });

      const updatedChannels = await this.findAll(communityId);

      // Emit WebSocket event for real-time updates
      this.websocketService.sendToRoom(
        `community:${communityId}`,
        ServerEvents.CHANNELS_REORDERED,
        { communityId, channels: updatedChannels },
      );

      return updatedChannels;
    });
  }

  async moveChannelDown(channelId: string, communityId: string) {
    return this.databaseService.$transaction(async (prisma) => {
      const channel = await prisma.channel.findUniqueOrThrow({
        where: { id: channelId },
      });

      // Find the channel below with the same type and higher position
      const channelBelow = await prisma.channel.findFirst({
        where: {
          communityId,
          type: channel.type,
          position: { gt: channel.position },
        },
        orderBy: { position: 'asc' },
      });

      if (!channelBelow) {
        // Already at the bottom, return current list
        return this.findAll(communityId);
      }

      // Swap positions
      await prisma.channel.update({
        where: { id: channel.id },
        data: { position: channelBelow.position },
      });
      await prisma.channel.update({
        where: { id: channelBelow.id },
        data: { position: channel.position },
      });

      const updatedChannels = await this.findAll(communityId);

      // Emit WebSocket event for real-time updates
      this.websocketService.sendToRoom(
        `community:${communityId}`,
        ServerEvents.CHANNELS_REORDERED,
        { communityId, channels: updatedChannels },
      );

      return updatedChannels;
    });
  }
}
