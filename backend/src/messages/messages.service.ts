import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { DatabaseService } from '@/database/database.service';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async create(createMessageDto: CreateMessageDto) {
    return this.databaseService.message.create({
      data: {
        ...createMessageDto,
      },
    });
  }

  async findOne(id: string) {
    try {
      return await this.databaseService.message.findUniqueOrThrow({
        where: { id },
      });
    } catch (error) {
      this.logger.error('Error finding message', error);
      throw new NotFoundException('Message not found');
    }
  }

  async update(id: string, updateMessageDto: UpdateMessageDto) {
    try {
      return await this.databaseService.message.update({
        where: { id },
        data: updateMessageDto,
      });
    } catch (error) {
      this.logger.error('Error updating message', error);
      throw error;
    }
  }

  async remove(id: string) {
    try {
      return await this.databaseService.message.delete({
        where: { id },
      });
    } catch (error) {
      this.logger.error('Error deleting message', error);
      // probably 404
      throw error;
    }
  }

  async findAllForChannel(
    channelId: string,
    limit = 50,
    continuationToken?: string,
  ) {
    if (!channelId) {
      throw new NotFoundException('No channelId provided');
    }
    return this.findAllByField(
      'channelId',
      channelId,
      limit,
      continuationToken,
    );
  }

  async findAllForDirectMessageGroup(
    directMessageGroupId: string,
    limit = 50,
    continuationToken?: string,
  ) {
    if (!directMessageGroupId) {
      throw new NotFoundException('No directMessageGroupId provided');
    }
    return this.findAllByField(
      'directMessageGroupId',
      directMessageGroupId,
      limit,
      continuationToken,
    );
  }

  private async findAllByField(
    field: 'channelId' | 'directMessageGroupId',
    value: string,
    limit = 50,
    continuationToken?: string,
  ) {
    const where = { [field]: value };
    const query = {
      where,
      orderBy: { sentAt: 'desc' as const },
      take: limit,
      ...(continuationToken
        ? { cursor: { id: continuationToken }, skip: 1 }
        : {}),
    };
    const messages = await this.databaseService.message.findMany(query);
    const nextToken =
      messages.length === limit ? messages[messages.length - 1].id : undefined;
    return { messages, continuationToken: nextToken };
  }
}
