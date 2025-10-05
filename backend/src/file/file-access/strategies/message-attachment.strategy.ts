import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '@/database/database.service';
import { MembershipService } from '@/membership/membership.service';
import { ChannelMembershipService } from '@/channel-membership/channel-membership.service';
import { IFileAccessStrategy } from './file-access-strategy.interface';

/**
 * Strategy for message attachment files
 * Checks access based on message context (channel or DM group)
 */
@Injectable()
export class MessageAttachmentStrategy implements IFileAccessStrategy {
  private readonly logger = new Logger(MessageAttachmentStrategy.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly membershipService: MembershipService,
    private readonly channelMembershipService: ChannelMembershipService,
  ) {}

  async checkAccess(
    userId: string,
    messageId: string,
    fileId: string,
  ): Promise<boolean> {
    // Fetch the message to determine if it's in a channel or DM
    const message = await this.databaseService.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        channelId: true,
        directMessageGroupId: true,
      },
    });

    if (!message) {
      this.logger.debug(`Message ${messageId} not found for file ${fileId}`);
      throw new NotFoundException('Message not found');
    }

    // Check channel message access
    if (message.channelId) {
      return this.checkChannelMessageAccess(userId, message.channelId, fileId);
    }

    // Check DM group message access
    if (message.directMessageGroupId) {
      return this.checkDmGroupMessageAccess(
        userId,
        message.directMessageGroupId,
        fileId,
      );
    }

    // Message has no channel or DM group
    this.logger.warn(
      `Message ${messageId} has no channel or DM group for file ${fileId}`,
    );
    throw new ForbiddenException('Access denied');
  }

  private async checkChannelMessageAccess(
    userId: string,
    channelId: string,
    fileId: string,
  ): Promise<boolean> {
    // Get channel details
    const channel = await this.databaseService.channel.findUnique({
      where: { id: channelId },
      select: {
        id: true,
        communityId: true,
        isPrivate: true,
      },
    });

    if (!channel) {
      this.logger.debug(`Channel ${channelId} not found for file ${fileId}`);
      throw new NotFoundException('Channel not found');
    }

    // For private channels, check channel membership
    if (channel.isPrivate) {
      const isChannelMember = await this.channelMembershipService.isMember(
        userId,
        channelId,
      );

      if (!isChannelMember) {
        this.logger.debug(
          `User ${userId} is not a member of private channel ${channelId}, denying access to file ${fileId}`,
        );
        throw new ForbiddenException(
          'You must be a member of this private channel to access this file',
        );
      }

      this.logger.debug(
        `User ${userId} is a member of private channel ${channelId}, allowing access to file ${fileId}`,
      );
      return true;
    }

    // For public channels, check community membership
    const isCommunityMember = await this.membershipService.isMember(
      userId,
      channel.communityId,
    );

    if (!isCommunityMember) {
      this.logger.debug(
        `User ${userId} is not a member of community ${channel.communityId}, denying access to file ${fileId}`,
      );
      throw new ForbiddenException(
        'You must be a member of this community to access this file',
      );
    }

    this.logger.debug(
      `User ${userId} is a member of community ${channel.communityId}, allowing access to file ${fileId}`,
    );
    return true;
  }

  private async checkDmGroupMessageAccess(
    userId: string,
    dmGroupId: string,
    fileId: string,
  ): Promise<boolean> {
    // Check if user is a member of the DM group
    const membership =
      await this.databaseService.directMessageGroupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: dmGroupId,
            userId: userId,
          },
        },
      });

    if (!membership) {
      this.logger.debug(
        `User ${userId} is not a member of DM group ${dmGroupId}, denying access to file ${fileId}`,
      );
      throw new ForbiddenException(
        'You must be a member of this conversation to access this file',
      );
    }

    this.logger.debug(
      `User ${userId} is a member of DM group ${dmGroupId}, allowing access to file ${fileId}`,
    );
    return true;
  }
}
