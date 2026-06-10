import { RbacResourceType } from '@/auth/rbac-resource.decorator';
import { DatabaseService } from '@/database/database.service';
import { Injectable, Logger } from '@nestjs/common';
import { RbacActions } from '@prisma/client';

/**
 * RBAC permission verification (hot path — runs on every guarded request).
 *
 * Extracted from RolesService so that verification is separate from role
 * management (CRUD, default-role setup), which remains in RolesService.
 */
@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async verifyActionsForUserAndResource(
    userId: string,
    resourceId: string | undefined,
    resourceType: RbacResourceType | undefined,
    action: RbacActions[],
  ): Promise<boolean> {
    // Handle instance-level permissions
    if (
      resourceId === undefined ||
      resourceType === RbacResourceType.INSTANCE
    ) {
      const userRoles = await this.databaseService.userRoles.findMany({
        where: {
          userId,
          isInstanceRole: true,
        },
        include: {
          role: true,
        },
      });

      const roles = userRoles.map((ur) => ur.role);
      const allActions = roles.flatMap((role) => role.actions);
      return action.every((a) => allActions.includes(a));
    }

    // Resolve the community ID based on resource type
    let communityId: string;

    if (resourceType === RbacResourceType.COMMUNITY) {
      communityId = resourceId!;
    } else if (resourceType === RbacResourceType.CHANNEL) {
      // Get the channel to find its community and privacy status
      const channel = await this.databaseService.channel.findUnique({
        where: { id: resourceId },
        select: { communityId: true, isPrivate: true },
      });

      if (!channel) {
        this.logger.warn(`Channel not found for RBAC check: ${resourceId}`);
        return false; // Channel doesn't exist
      }

      // Private channels require explicit channel membership
      if (channel.isPrivate) {
        const channelMembership =
          await this.databaseService.channelMembership.findUnique({
            where: { userId_channelId: { userId, channelId: resourceId } },
          });

        if (!channelMembership) {
          return false;
        }
      }

      communityId = channel.communityId;
    } else if (resourceType === RbacResourceType.MESSAGE) {
      // Get the message to find its channel, then the channel's community
      const message = await this.databaseService.message.findUnique({
        where: { id: resourceId },
        select: {
          channelId: true,
          directMessageGroupId: true,
          channel: {
            select: { communityId: true, isPrivate: true },
          },
        },
      });

      if (!message) {
        this.logger.warn(`Message not found for RBAC check: ${resourceId}`);
        return false; // Message doesn't exist
      }

      if (message.directMessageGroupId) {
        // This is a DM message - check if user is member of the DM group
        const dmMembership =
          await this.databaseService.directMessageGroupMember.findFirst({
            where: {
              userId,
              groupId: message.directMessageGroupId,
            },
          });

        if (dmMembership) {
          this.logger.debug(
            `DM message access granted: ${resourceId} for user: ${userId}`,
          );
          return true;
        } else {
          this.logger.debug(
            `DM message access denied - user not in group: ${resourceId} for user: ${userId}`,
          );
          return false;
        }
      }

      if (!message.channel) {
        this.logger.warn(`Message has no associated channel: ${resourceId}`);
        return false; // Message has no associated channel
      }

      // Private channels require explicit channel membership
      if (message.channel.isPrivate && message.channelId) {
        const channelMembership =
          await this.databaseService.channelMembership.findUnique({
            where: {
              userId_channelId: { userId, channelId: message.channelId },
            },
          });

        if (!channelMembership) {
          return false;
        }
      }

      communityId = message.channel.communityId;
    } else if (resourceType === RbacResourceType.DM_GROUP) {
      // For DM groups, check if the user is a member of the DM group
      const dmMembership =
        await this.databaseService.directMessageGroupMember.findFirst({
          where: {
            userId,
            groupId: resourceId,
          },
        });

      // For DM groups, we allow access if the user is a member
      // All DM group members have full permissions within their group
      if (dmMembership) {
        this.logger.debug(
          `DM group access granted for member: ${userId} in group: ${resourceId}`,
        );
        return true;
      } else {
        this.logger.debug(
          `DM group access denied - user not a member: ${userId} in group: ${resourceId}`,
        );
        return false;
      }
    } else if (resourceType === RbacResourceType.ALIAS_GROUP) {
      // Get the alias group to find its community
      const aliasGroup = await this.databaseService.aliasGroup.findUnique({
        where: { id: resourceId },
        select: { communityId: true },
      });

      if (!aliasGroup) {
        this.logger.warn(`Alias group not found for RBAC check: ${resourceId}`);
        return false;
      }

      communityId = aliasGroup.communityId;
    } else {
      this.logger.error(
        `Unknown resource type: ${resourceType} for resource: ${resourceId}`,
      );
      return false; // Unknown resource type
    }

    // Check user roles in the resolved community
    const userRoles = await this.databaseService.userRoles.findMany({
      where: {
        userId,
        communityId,
        isInstanceRole: false,
      },
      include: {
        role: true,
      },
    });

    const roles = userRoles.map((ur) => ur.role);
    const allActions = roles.flatMap((role) => role.actions);

    // Check if the user has all the required actions
    return action.every((a) => allActions.includes(a));
  }
}
