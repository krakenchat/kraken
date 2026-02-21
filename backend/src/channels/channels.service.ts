import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { DatabaseService } from '@/database/database.service';
import { UserEntity } from '@/user/dto/user-response.dto';
import { ChannelType, Prisma } from '@prisma/client';
import { WebsocketService } from '@/websocket/websocket.service';
import { ServerEvents } from '@kraken/shared';
import { isPrismaError } from '@/common/utils/prisma.utils';
import { RoomEvents } from '@/rooms/room-subscription.events';
import { RoomName } from '@/common/utils/room-name.util';

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly websocketService: WebsocketService,
    private readonly eventEmitter: EventEmitter2,
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
      // Emit domain event — the RoomSubscriptionHandler will join sockets
      this.eventEmitter.emit(RoomEvents.CHANNEL_CREATED, {
        channelId: result.id,
        communityId: result.communityId,
        isPrivate: result.isPrivate,
      });

      // Notify all community members about the new channel
      this.websocketService.sendToRoom(
        RoomName.community(result.communityId),
        ServerEvents.CHANNEL_CREATED,
        { communityId: result.communityId, channel: result },
      );

      return result;
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
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

  findAll(communityId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.databaseService;
    return client.channel.findMany({
      where: { communityId },
      orderBy: [
        { type: 'asc' }, // TEXT before VOICE (alphabetically)
        { position: 'asc' },
        { createdAt: 'asc' }, // Tiebreaker for existing channels with position 0
      ],
      take: 500,
    });
  }

  async findOne(id: string) {
    const channel = await this.databaseService.channel.findUnique({
      where: { id },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    return channel;
  }

  async update(id: string, updateChannelDto: UpdateChannelDto) {
    try {
      const updated = await this.databaseService.channel.update({
        where: { id },
        data: updateChannelDto,
      });

      // Notify all community members about the channel update
      this.websocketService.sendToRoom(
        RoomName.community(updated.communityId),
        ServerEvents.CHANNEL_UPDATED,
        { communityId: updated.communityId, channel: updated },
      );

      return updated;
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
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

  async remove(id: string) {
    const channel = await this.databaseService.channel.findUnique({
      where: { id },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    // Notify before deletion so clients still have the room subscription
    this.websocketService.sendToRoom(
      RoomName.community(channel.communityId),
      ServerEvents.CHANNEL_DELETED,
      { communityId: channel.communityId, channelId: id },
    );

    await this.databaseService.$transaction(async (tx) => {
      // Delete records that depend on channel messages
      await tx.notification.deleteMany({
        where: { channelId: id },
      });

      await tx.channelNotificationOverride.deleteMany({
        where: { channelId: id },
      });

      await tx.readReceipt.deleteMany({
        where: { channelId: id },
      });

      await tx.threadSubscriber.deleteMany({
        where: { parentMessage: { channelId: id } },
      });

      await tx.channelMembership.deleteMany({
        where: { channelId: id },
      });

      await tx.message.deleteMany({
        where: { channelId: id },
      });

      await tx.channel.delete({
        where: { id },
      });
    });

    // Emit domain event — the RoomSubscriptionHandler will remove sockets
    this.eventEmitter.emit(RoomEvents.CHANNEL_DELETED, { channelId: id });
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

  async findMentionableChannels(communityId: string, userId: string) {
    return this.databaseService.channel.findMany({
      where: {
        communityId,
        OR: [
          { isPrivate: false },
          {
            isPrivate: true,
            ChannelMembership: {
              some: { userId },
            },
          },
        ],
      },
      orderBy: { name: 'asc' },
    });
  }

  async moveChannelUp(channelId: string, communityId: string) {
    return this.databaseService.$transaction(async (prisma) => {
      await this.normalizePositions(prisma, communityId);

      const channel = await prisma.channel.findUnique({
        where: { id: channelId },
      });

      if (!channel) {
        throw new NotFoundException('Channel not found');
      }

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
        return this.findAll(communityId, prisma);
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

      const updatedChannels = await this.findAll(communityId, prisma);

      // Emit WebSocket event for real-time updates
      this.websocketService.sendToRoom(
        RoomName.community(communityId),
        ServerEvents.CHANNELS_REORDERED,
        { communityId, channels: updatedChannels },
      );

      return updatedChannels;
    });
  }

  async moveChannelDown(channelId: string, communityId: string) {
    return this.databaseService.$transaction(async (prisma) => {
      await this.normalizePositions(prisma, communityId);

      const channel = await prisma.channel.findUnique({
        where: { id: channelId },
      });

      if (!channel) {
        throw new NotFoundException('Channel not found');
      }

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
        return this.findAll(communityId, prisma);
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

      const updatedChannels = await this.findAll(communityId, prisma);

      // Emit WebSocket event for real-time updates
      this.websocketService.sendToRoom(
        RoomName.community(communityId),
        ServerEvents.CHANNELS_REORDERED,
        { communityId, channels: updatedChannels },
      );

      return updatedChannels;
    });
  }

  /**
   * Normalize channel positions for a community.
   * This ensures each channel has a unique position within its type,
   * handling legacy channels that may have position 0.
   */
  private async normalizePositions(
    prisma: Prisma.TransactionClient,
    communityId: string,
  ) {
    // Get all channels grouped by type, ordered by position then createdAt
    for (const type of [ChannelType.TEXT, ChannelType.VOICE]) {
      const channels = await prisma.channel.findMany({
        where: { communityId, type },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      });

      // Check if normalization is needed (duplicate positions)
      const positions = channels.map((c) => c.position);
      const hasDuplicates = positions.length !== new Set(positions).size;

      if (hasDuplicates) {
        // Reassign sequential positions
        for (let i = 0; i < channels.length; i++) {
          if (channels[i].position !== i) {
            await prisma.channel.update({
              where: { id: channels[i].id },
              data: { position: i },
            });
          }
        }
      }
    }
  }
}
