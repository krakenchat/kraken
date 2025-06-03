import { RbacResourceType } from '@/auth/rbac-resource.decorator';
import { DatabaseService } from '@/database/database.service';
import { Injectable } from '@nestjs/common';
import { RbacActions } from '@prisma/client';
import { UserRolesResponseDto, RoleDto } from './dto/user-roles-response.dto';

@Injectable()
export class RolesService {
  constructor(private readonly database: DatabaseService) {}

  async verifyActionsForUserAndResource(
    userId: string,
    resourceId: string | undefined,
    resourceType: RbacResourceType | undefined,
    action: RbacActions[],
  ): Promise<boolean> {
    // Logic to check if the user has the required actions on the resource
    const userRoles = await this.database.userRoles.findMany({
      where: {
        userId,
        communityId: resourceId, // TODO: make this dynamic and update the model
        isInstanceRole:
          resourceId === undefined ||
          resourceType === RbacResourceType.INSTANCE,
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
}
