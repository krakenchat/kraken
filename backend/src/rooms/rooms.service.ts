import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { DatabaseService } from '@/database/database.service';

@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);
  constructor(private readonly databaseService: DatabaseService) {}

  async joinAll(
    client: Socket & { handshake: { user: { id: string } } },
    communityId: string,
  ) {
    await client.join(client.handshake.user.id);

    // Get all public channels in the community (user joins automatically if they're a community member)
    const publicChannels = await this.databaseService.channel.findMany({
      where: {
        communityId,
        isPrivate: false,
      },
    });

    // Join all public channels
    for (const channel of publicChannels) {
      await client.join(channel.id);
    }

    // Get private channels the user has explicit membership to
    const privateChannelMemberships =
      await this.databaseService.channelMembership.findMany({
        where: {
          userId: client.handshake.user.id,
          channel: {
            communityId,
            isPrivate: true,
          },
        },
        include: {
          channel: true,
        },
      });

    // Join private channels based on membership
    for (const membership of privateChannelMemberships) {
      await client.join(membership.channelId);
    }

    // Get all direct messages for the user
    const directMessages =
      await this.databaseService.directMessageGroupMember.findMany({
        where: {
          userId: client.handshake.user.id,
        },
      });

    // Join all direct messages
    for (const directMessage of directMessages) {
      await client.join(directMessage.groupId);
    }

    const aliasGroups = await this.databaseService.aliasGroupMember.findMany({
      where: {
        userId: client.handshake.user.id,
      },
    });

    // Join all alias groups
    for (const aliasGroup of aliasGroups) {
      await client.join(aliasGroup.aliasGroupId);
    }

    this.logger.debug(
      `User ${client.handshake.user.id} joined ${client.rooms.size} rooms`,
    );
  }

  async join(client: Socket, id: string) {
    await client.join(id);
  }
}
