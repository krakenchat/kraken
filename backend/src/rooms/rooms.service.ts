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
    // Get all channels for the user
    const channelMemberships =
      await this.databaseService.channelMembership.findMany({
        where: {
          userId: client.handshake.user.id,
          channel: {
            communityId,
          },
        },
        include: {
          channel: true,
        },
      });

    // Join all channels
    for (const channelMembership of channelMemberships) {
      await client.join(channelMembership.channelId);
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
    console.log(client.rooms);
  }

  async join(client: Socket, id: string) {
    await client.join(id);
  }
}
