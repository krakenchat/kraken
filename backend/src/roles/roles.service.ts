import { RbacResourceType } from '@/auth/rbac-resource.decorator';
import { DatabaseService } from '@/database/database.service';
import { Injectable, Logger } from '@nestjs/common';
import { RbacActions, Prisma } from '@prisma/client';
import { UserRolesResponseDto, RoleDto } from './dto/user-roles-response.dto';
import {
  getDefaultCommunityRoles,
  DEFAULT_ADMIN_ROLE,
  DEFAULT_MEMBER_ROLE,
} from './default-roles.config';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);
  
  constructor(private readonly database: DatabaseService) {}

  async verifyActionsForUserAndResource(
    userId: string,
    resourceId: string | undefined,
    resourceType: RbacResourceType | undefined,
    action: RbacActions[],
  ): Promise<boolean> {
    // Handle instance-level permissions
    if (resourceId === undefined || resourceType === RbacResourceType.INSTANCE) {
      const userRoles = await this.database.userRoles.findMany({
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
      // Get the channel to find its community
      const channel = await this.database.channel.findUnique({
        where: { id: resourceId },
        select: { communityId: true },
      });
      
      if (!channel) {
        this.logger.warn(`Channel not found for RBAC check: ${resourceId}`);
        return false; // Channel doesn't exist
      }
      
      communityId = channel.communityId;
    } else if (resourceType === RbacResourceType.MESSAGE) {
      // Get the message to find its channel, then the channel's community
      const message = await this.database.message.findUnique({
        where: { id: resourceId },
        select: { 
          channelId: true,
          directMessageGroupId: true,
          channel: {
            select: { communityId: true }
          }
        },
      });
      
      if (!message) {
        this.logger.warn(`Message not found for RBAC check: ${resourceId}`);
        return false; // Message doesn't exist
      }
      
      if (message.directMessageGroupId) {
        // This is a DM message - check if user is member of the DM group
        const dmMembership = await this.database.directMessageGroupMember.findFirst({
          where: {
            userId,
            groupId: message.directMessageGroupId,
          },
        });
        
        if (dmMembership) {
          this.logger.debug(`DM message access granted: ${resourceId} for user: ${userId}`);
          return true;
        } else {
          this.logger.debug(`DM message access denied - user not in group: ${resourceId} for user: ${userId}`);
          return false;
        }
      }
      
      if (!message.channel) {
        this.logger.warn(`Message has no associated channel: ${resourceId}`);
        return false; // Message has no associated channel
      }
      
      communityId = message.channel.communityId;
    } else if (resourceType === RbacResourceType.DM_GROUP) {
      // For DM groups, check if the user is a member of the DM group
      const dmMembership = await this.database.directMessageGroupMember.findFirst({
        where: {
          userId,
          groupId: resourceId,
        },
      });
      
      // For DM groups, we allow access if the user is a member
      // All DM group members have full permissions within their group
      if (dmMembership) {
        this.logger.debug(`DM group access granted for member: ${userId} in group: ${resourceId}`);
        return true;
      } else {
        this.logger.debug(`DM group access denied - user not a member: ${userId} in group: ${resourceId}`);
        return false;
      }
    } else {
      this.logger.error(`Unknown resource type: ${resourceType} for resource: ${resourceId}`);
      return false; // Unknown resource type
    }

    // Check user roles in the resolved community
    const userRoles = await this.database.userRoles.findMany({
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

  async getUserRolesForCommunity(
    userId: string,
    communityId: string,
  ): Promise<UserRolesResponseDto> {
    const userRoles = await this.database.userRoles.findMany({
      where: {
        userId,
        communityId,
        isInstanceRole: false,
      },
      include: {
        role: true,
      },
    });

    const roles: RoleDto[] = userRoles.map((ur) => ({
      id: ur.role.id,
      name: ur.role.name,
      actions: ur.role.actions,
      createdAt: ur.role.createdAt,
    }));

    return {
      userId,
      resourceId: communityId,
      resourceType: 'COMMUNITY',
      roles,
    };
  }

  async getUserRolesForChannel(
    userId: string,
    channelId: string,
  ): Promise<UserRolesResponseDto> {
    // First, get the channel to find its community
    const channel = await this.database.channel.findUnique({
      where: { id: channelId },
      select: { communityId: true },
    });

    if (!channel) {
      // Return empty roles if channel doesn't exist or user has no access
      return {
        userId,
        resourceId: channelId,
        resourceType: 'CHANNEL',
        roles: [],
      };
    }

    // For channels, we inherit roles from the community
    // In the future, you might want to add channel-specific roles
    const userRoles = await this.database.userRoles.findMany({
      where: {
        userId,
        communityId: channel.communityId,
        isInstanceRole: false,
      },
      include: {
        role: true,
      },
    });

    const roles: RoleDto[] = userRoles.map((ur) => ({
      id: ur.role.id,
      name: ur.role.name,
      actions: ur.role.actions,
      createdAt: ur.role.createdAt,
    }));

    return {
      userId,
      resourceId: channelId,
      resourceType: 'CHANNEL',
      roles,
    };
  }

  async getUserInstanceRoles(userId: string): Promise<UserRolesResponseDto> {
    const userRoles = await this.database.userRoles.findMany({
      where: {
        userId,
        isInstanceRole: true,
      },
      include: {
        role: true,
      },
    });

    const roles: RoleDto[] = userRoles.map((ur) => ({
      id: ur.role.id,
      name: ur.role.name,
      actions: ur.role.actions,
      createdAt: ur.role.createdAt,
    }));

    return {
      userId,
      resourceId: null,
      resourceType: 'INSTANCE',
      roles,
    };
  }

  /**
   * Creates default roles for a new community
   * Returns the admin role ID for assigning to the creator
   */
  async createDefaultCommunityRoles(
    communityId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const database = tx || this.database;
    const defaultRoles = getDefaultCommunityRoles();

    let adminRoleId: string;

    for (const defaultRole of defaultRoles) {
      const role = await database.role.create({
        data: {
          name: `${defaultRole.name} - ${communityId}`, // Make role names unique per community
          actions: defaultRole.actions,
        },
      });

      // Store admin role ID to return it
      if (defaultRole.name === DEFAULT_ADMIN_ROLE.name) {
        adminRoleId = role.id;
      }
    }

    return adminRoleId!;
  }

  /**
   * Assigns a user to a role in a community
   */
  async assignUserToCommunityRole(
    userId: string,
    communityId: string,
    roleId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const database = tx || this.database;

    await database.userRoles.create({
      data: {
        userId,
        communityId,
        roleId,
        isInstanceRole: false,
      },
    });
  }

  /**
   * Gets the admin role for a specific community
   */
  async getCommunityAdminRole(communityId: string): Promise<RoleDto | null> {
    const adminRoleName = `${DEFAULT_ADMIN_ROLE.name} - ${communityId}`;

    const role = await this.database.role.findFirst({
      where: {
        name: adminRoleName,
      },
    });

    if (!role) return null;

    return {
      id: role.id,
      name: role.name,
      actions: role.actions,
      createdAt: role.createdAt,
    };
  }

  /**
   * Gets the moderator role for a specific community
   */
  async getCommunityModeratorRole(
    communityId: string,
  ): Promise<RoleDto | null> {
    const modRoleName = `Moderator - ${communityId}`;

    const role = await this.database.role.findFirst({
      where: {
        name: modRoleName,
      },
    });

    if (!role) return null;

    return {
      id: role.id,
      name: role.name,
      actions: role.actions,
      createdAt: role.createdAt,
    };
  }

  /**
   * Gets the member role for a specific community
   */
  async getCommunityMemberRole(communityId: string): Promise<RoleDto | null> {
    const memberRoleName = `${DEFAULT_MEMBER_ROLE.name} - ${communityId}`;

    const role = await this.database.role.findFirst({
      where: {
        name: memberRoleName,
      },
    });

    if (!role) return null;

    return {
      id: role.id,
      name: role.name,
      actions: role.actions,
      createdAt: role.createdAt,
    };
  }

  /**
   * Creates just the Member role for a community (used for runtime creation)
   */
  async createMemberRoleForCommunity(
    communityId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const database = tx || this.database;

    const role = await database.role.create({
      data: {
        name: `${DEFAULT_MEMBER_ROLE.name} - ${communityId}`,
        actions: DEFAULT_MEMBER_ROLE.actions,
      },
    });

    return role.id;
  }
}
