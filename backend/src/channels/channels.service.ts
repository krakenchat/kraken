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

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async create(createChannelDto: CreateChannelDto, user: UserEntity) {
    try {
      // Use a transaction to create the channel and the membership
      const result = await this.databaseService.$transaction(async (prisma) => {
        const channel = await prisma.channel.create({
          data: createChannelDto,
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
        error.code === 'P2002'
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
        error.code === 'P2002'
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
}
