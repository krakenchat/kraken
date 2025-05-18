import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { DatabaseService } from '@/database/database.service';

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async create(createChannelDto: CreateChannelDto) {
    try {
      return await this.databaseService.channel.create({
        data: createChannelDto,
      });
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (error.code === 'P2002') {
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (error.code === 'P2002') {
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
}
