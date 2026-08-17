import { DatabaseService } from '@/database/database.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RoomEvents } from '@/rooms/room-subscription.events';
import {
  EpochBump,
  PermissionsCacheService,
} from './permissions-cache.service';
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { RbacActions, Prisma } from '@prisma/client';
import { UserRolesResponseDto, RoleDto } from './dto/user-roles-response.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { CommunityRolesResponseDto } from './dto/community-roles-response.dto';
import {
  getDefaultCommunityRoles,
  DEFAULT_ADMIN_ROLE,
  DEFAULT_MEMBER_ROLE,
} from './default-roles.config';

@Injectable()
export class CommunityRolesService {
  private readonly logger = new Logger(CommunityRolesService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly eventEmitter: EventEmitter2,
    private readonly permissionsCacheService: PermissionsCacheService,
  ) {}

  async getUserRolesForCommunity(
    userId: string,
    communityId: string,
  ): Promise<UserRolesResponseDto> {
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

    const roles: RoleDto[] = userRoles.map((ur) => ({
      id: ur.role.id,
      name: ur.role.name,
      actions: ur.role.actions,
      createdAt: ur.role.createdAt,
      isDefault: ur.role.isDefault,
      position: ur.role.position,
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
    const channel = await this.databaseService.channel.findUnique({
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
    const userRoles = await this.databaseService.userRoles.findMany({
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
      isDefault: ur.role.isDefault,
      position: ur.role.position,
    }));

    return {
      userId,
      resourceId: channelId,
      resourceType: 'CHANNEL',
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
    pendingBumps?: EpochBump[],
  ): Promise<string> {
    const database = tx || this.databaseService;
    const defaultRoles = getDefaultCommunityRoles();

    let adminRoleId: string;

    for (const defaultRole of defaultRoles) {
      const role = await database.role.create({
        data: {
          name: defaultRole.name,
          communityId,
          isDefault: true,
          position: defaultRole.position,
          actions: defaultRole.actions,
        },
      });

      // Store admin role ID to return it
      if (defaultRole.name === DEFAULT_ADMIN_ROLE.name) {
        adminRoleId = role.id;
      }
    }

    // Role definitions changed for this community (bump deferred to after
    // commit when running inside a caller-owned transaction).
    await this.permissionsCacheService.bumpNowOrDefer(
      { kind: 'community', communityId },
      tx,
      pendingBumps,
    );

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
    pendingBumps?: EpochBump[],
  ): Promise<void> {
    const database = tx || this.databaseService;

    // Verify the role belongs to this community
    const role = await database.role.findUnique({ where: { id: roleId } });
    if (!role || role.communityId !== communityId) {
      throw new NotFoundException('Role not found in this community');
    }

    await database.userRoles.create({
      data: {
        userId,
        communityId,
        roleId,
        isInstanceRole: false,
      },
    });

    // Role assignment changed for this user. Like the event emission below,
    // the bump must not happen while a caller-owned transaction is still
    // open — see PermissionsCacheService.bumpNowOrDefer for the pre-commit
    // race this avoids.
    await this.permissionsCacheService.bumpNowOrDefer(
      { kind: 'user', userId },
      tx,
      pendingBumps,
    );

    // Only emit when not called within a transaction (e.g., community creation)
    if (!tx) {
      this.eventEmitter.emit(RoomEvents.ROLE_ASSIGNED, {
        communityId,
        userId,
        roleId,
        roleName: role.name,
      });
    }
  }

  /**
   * Gets the admin role for a specific community
   */
  async getCommunityAdminRole(communityId: string): Promise<RoleDto | null> {
    const role = await this.databaseService.role.findFirst({
      where: {
        name: DEFAULT_ADMIN_ROLE.name,
        communityId,
      },
    });

    if (!role) return null;

    return {
      id: role.id,
      name: role.name,
      actions: role.actions,
      createdAt: role.createdAt,
      isDefault: role.isDefault,
      position: role.position,
    };
  }

  /**
   * Gets the moderator role for a specific community
   */
  async getCommunityModeratorRole(
    communityId: string,
  ): Promise<RoleDto | null> {
    const role = await this.databaseService.role.findFirst({
      where: {
        name: 'Moderator',
        communityId,
      },
    });

    if (!role) return null;

    return {
      id: role.id,
      name: role.name,
      actions: role.actions,
      createdAt: role.createdAt,
      isDefault: role.isDefault,
      position: role.position,
    };
  }

  /**
   * Gets the member role for a specific community
   */
  async getCommunityMemberRole(communityId: string): Promise<RoleDto | null> {
    const role = await this.databaseService.role.findFirst({
      where: {
        name: DEFAULT_MEMBER_ROLE.name,
        communityId,
      },
    });

    if (!role) return null;

    return {
      id: role.id,
      name: role.name,
      actions: role.actions,
      createdAt: role.createdAt,
      isDefault: role.isDefault,
      position: role.position,
    };
  }

  /**
   * Creates just the Member role for a community (used for runtime creation)
   */
  async createMemberRoleForCommunity(
    communityId: string,
    tx?: Prisma.TransactionClient,
    pendingBumps?: EpochBump[],
  ): Promise<string> {
    const database = tx || this.databaseService;

    const role = await database.role.create({
      data: {
        name: DEFAULT_MEMBER_ROLE.name,
        communityId,
        isDefault: true,
        position: DEFAULT_MEMBER_ROLE.position,
        actions: DEFAULT_MEMBER_ROLE.actions,
      },
    });

    await this.permissionsCacheService.bumpNowOrDefer(
      { kind: 'community', communityId },
      tx,
      pendingBumps,
    );

    return role.id;
  }

  /**
   * Reset default community roles to their default permissions.
   * Creates missing default roles and resets permissions on existing ones.
   * Preserves user assignments and custom roles.
   */
  async resetDefaultCommunityRoles(
    communityId: string,
  ): Promise<CommunityRolesResponseDto> {
    const defaultRoles = getDefaultCommunityRoles();

    await this.databaseService.$transaction(async (tx) => {
      for (const defaultRole of defaultRoles) {
        const existing = await tx.role.findFirst({
          where: { name: defaultRole.name, communityId },
        });

        if (existing) {
          await tx.role.update({
            where: { id: existing.id },
            data: {
              actions: defaultRole.actions,
              isDefault: true,
              position: defaultRole.position,
            },
          });
        } else {
          await tx.role.create({
            data: {
              name: defaultRole.name,
              communityId,
              isDefault: true,
              position: defaultRole.position,
              actions: defaultRole.actions,
            },
          });
        }
      }
    });

    await this.permissionsCacheService.bumpCommunityEpoch(communityId);

    this.logger.log(`Reset default roles for community ${communityId}`);
    return this.getCommunityRoles(communityId);
  }

  /**
   * Get all roles for a community
   */
  async getCommunityRoles(
    communityId: string,
  ): Promise<CommunityRolesResponseDto> {
    const roles = await this.databaseService.role.findMany({
      where: { communityId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      // Community role tables are small in practice; cap defensively so a
      // pathological community can't return an unbounded list.
      take: 200,
    });

    const roleDtos: RoleDto[] = roles.map((role) => ({
      id: role.id,
      name: role.name,
      actions: role.actions,
      createdAt: role.createdAt,
      isDefault: role.isDefault,
      position: role.position,
    }));

    return {
      communityId,
      roles: roleDtos,
    };
  }

  /**
   * Reorder roles for a community.
   * Accepts an ordered array of role IDs.
   * Sets position = index * 10 + 10 for each (first=10, second=20, etc.).
   * The "Member" default role is always last (position 100).
   */
  async reorderRoles(
    communityId: string,
    roleIds: string[],
  ): Promise<RoleDto[]> {
    // Fetch all roles for this community
    const communityRoles = await this.databaseService.role.findMany({
      where: { communityId },
    });

    // Validate all roleIds belong to this community
    const communityRoleIds = new Set(communityRoles.map((r) => r.id));
    const communityRoleMap = new Map(communityRoles.map((r) => [r.id, r]));
    const memberRole = communityRoles.find(
      (r) => r.name === DEFAULT_MEMBER_ROLE.name && r.isDefault,
    );

    // Validate no duplicates
    if (new Set(roleIds).size !== roleIds.length) {
      throw new BadRequestException('Duplicate role IDs in reorder list');
    }

    for (const roleId of roleIds) {
      if (!communityRoleIds.has(roleId)) {
        throw new BadRequestException(
          `Role ${roleId} does not belong to community ${communityId}`,
        );
      }
    }

    // Filter out the Member role from the reorder list — it's always last
    const reorderableIds = roleIds.filter(
      (id) => !memberRole || id !== memberRole.id,
    );

    // Validate completeness: all non-Member roles must be included
    const expectedReorderableIds = communityRoles
      .filter((r) => !memberRole || r.id !== memberRole.id)
      .map((r) => r.id);
    if (reorderableIds.length !== expectedReorderableIds.length) {
      throw new BadRequestException(
        'All non-Member roles must be included in the reorder list',
      );
    }

    await this.databaseService.$transaction(async (tx) => {
      for (let i = 0; i < reorderableIds.length; i++) {
        await tx.role.update({
          where: { id: reorderableIds[i] },
          data: { position: (i + 1) * 10 },
        });
      }

      // Ensure the Member role is always at position 100
      if (memberRole) {
        await tx.role.update({
          where: { id: memberRole.id },
          data: { position: 100 },
        });
      }
    });

    this.logger.log(`Reordered roles for community ${communityId}`);

    await this.permissionsCacheService.bumpCommunityEpoch(communityId);

    // Emit per-role events with correct payload shape
    for (const roleId of reorderableIds) {
      const role = communityRoleMap.get(roleId);
      if (role) {
        this.eventEmitter.emit(RoomEvents.ROLE_UPDATED, {
          communityId,
          roleId: role.id,
          roleName: role.name,
        });
      }
    }

    return (await this.getCommunityRoles(communityId)).roles;
  }

  /**
   * Create a custom role for a community
   */
  async createCommunityRole(
    communityId: string,
    createRoleDto: CreateRoleDto,
    userId?: string,
    userInstanceRole?: string,
    tx?: Prisma.TransactionClient,
    pendingBumps?: EpochBump[],
  ): Promise<RoleDto> {
    const database = tx || this.databaseService;

    // Check if role with this name already exists for the community
    const existingRole = await database.role.findFirst({
      where: {
        name: createRoleDto.name,
        communityId,
      },
    });

    if (existingRole) {
      throw new ConflictException(
        `Role with name "${createRoleDto.name}" already exists in this community`,
      );
    }

    // Validate that all actions are valid
    const validActions = Object.values(RbacActions);
    const invalidActions = createRoleDto.actions.filter(
      (action) => !validActions.includes(action),
    );

    if (invalidActions.length > 0) {
      throw new BadRequestException(
        `Invalid actions: ${invalidActions.join(', ')}`,
      );
    }

    // Privilege escalation prevention: user cannot grant permissions they don't have
    // Instance OWNERs bypass RBAC entirely, so skip this check for them
    if (userId && userInstanceRole !== 'OWNER') {
      const userRolesResponse = await this.getUserRolesForCommunity(
        userId,
        communityId,
      );
      const userActions = new Set(
        userRolesResponse.roles.flatMap((r) => r.actions),
      );
      const unauthorizedActions = createRoleDto.actions.filter(
        (action) => !userActions.has(action),
      );

      if (unauthorizedActions.length > 0) {
        throw new ForbiddenException(
          `Cannot grant permissions you do not have: ${unauthorizedActions.join(', ')}`,
        );
      }
    }

    // Auto-assign position if not provided: use max position among non-Member roles + 1
    let position = createRoleDto.position;
    if (position === undefined) {
      const maxPositionResult = await database.role.aggregate({
        where: {
          communityId,
          name: { not: DEFAULT_MEMBER_ROLE.name },
        },
        _max: { position: true },
      });
      position = (maxPositionResult._max.position ?? 0) + 1;
      // Ensure position stays below the Member role position (100)
      if (position >= 100) {
        position = 99;
      }
    }

    const role = await database.role.create({
      data: {
        name: createRoleDto.name,
        communityId,
        isDefault: false,
        position,
        actions: createRoleDto.actions,
      },
    });

    this.logger.log(
      `Created custom role "${createRoleDto.name}" for community ${communityId}`,
    );

    await this.permissionsCacheService.bumpNowOrDefer(
      { kind: 'community', communityId },
      tx,
      pendingBumps,
    );

    // Only emit when not called within a transaction (e.g., community creation)
    if (!tx) {
      this.eventEmitter.emit(RoomEvents.ROLE_CREATED, {
        communityId,
        roleId: role.id,
        roleName: role.name,
      });
    }

    return {
      id: role.id,
      name: role.name,
      actions: role.actions,
      createdAt: role.createdAt,
      isDefault: role.isDefault,
      position: role.position,
    };
  }

  /**
   * Update a role's permissions
   */
  async updateRole(
    roleId: string,
    communityId: string,
    updateRoleDto: UpdateRoleDto,
    userId?: string,
    userInstanceRole?: string,
    tx?: Prisma.TransactionClient,
    pendingBumps?: EpochBump[],
  ): Promise<RoleDto> {
    const database = tx || this.databaseService;

    // Check if role exists
    const existingRole = await database.role.findUnique({
      where: { id: roleId },
    });

    if (!existingRole) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    // Verify the role belongs to this community
    if (existingRole.communityId !== communityId) {
      throw new NotFoundException(
        `Role with ID ${roleId} not found in this community`,
      );
    }

    // Check if this is a default role and prevent name changes (but allow permission changes)
    if (
      existingRole.isDefault &&
      updateRoleDto.name &&
      updateRoleDto.name.trim() !== existingRole.name.trim()
    ) {
      throw new BadRequestException(
        'Cannot change the name of default roles. Only permissions can be modified.',
      );
    }

    // Validate actions if provided
    if (updateRoleDto.actions) {
      const validActions = Object.values(RbacActions);
      const invalidActions = updateRoleDto.actions.filter(
        (action) => !validActions.includes(action),
      );

      if (invalidActions.length > 0) {
        throw new BadRequestException(
          `Invalid actions: ${invalidActions.join(', ')}`,
        );
      }

      // Privilege escalation prevention: user cannot grant permissions they don't have
      // Instance OWNERs bypass RBAC entirely, so skip this check for them
      if (userId && userInstanceRole !== 'OWNER') {
        const userRolesResponse = await this.getUserRolesForCommunity(
          userId,
          communityId,
        );
        const userActions = new Set(
          userRolesResponse.roles.flatMap((r) => r.actions),
        );
        const unauthorizedActions = updateRoleDto.actions.filter(
          (action) => !userActions.has(action),
        );

        if (unauthorizedActions.length > 0) {
          throw new ForbiddenException(
            `Cannot grant permissions you do not have: ${unauthorizedActions.join(', ')}`,
          );
        }
      }
    }

    // If name is being updated, check for conflicts
    let newName = existingRole.name;
    if (updateRoleDto.name) {
      newName = updateRoleDto.name;

      const conflictingRole = await database.role.findFirst({
        where: {
          name: newName,
          communityId: existingRole.communityId,
          id: { not: roleId },
        },
      });

      if (conflictingRole) {
        throw new ConflictException(
          `Role with name "${updateRoleDto.name}" already exists in this community`,
        );
      }
    }

    const updatedRole = await database.role.update({
      where: { id: roleId },
      data: {
        name: newName,
        actions: updateRoleDto.actions,
        ...(updateRoleDto.position !== undefined && {
          position: updateRoleDto.position,
        }),
      },
    });

    this.logger.log(`Updated role ${roleId}`);

    await this.permissionsCacheService.bumpNowOrDefer(
      { kind: 'community', communityId },
      tx,
      pendingBumps,
    );

    if (!tx) {
      this.eventEmitter.emit(RoomEvents.ROLE_UPDATED, {
        communityId,
        roleId,
        roleName: updatedRole.name,
      });
    }

    return {
      id: updatedRole.id,
      name: updatedRole.name,
      actions: updatedRole.actions,
      createdAt: updatedRole.createdAt,
      isDefault: updatedRole.isDefault,
      position: updatedRole.position,
    };
  }

  /**
   * Delete a custom role
   */
  async deleteRole(
    roleId: string,
    communityId: string,
    tx?: Prisma.TransactionClient,
    pendingBumps?: EpochBump[],
  ): Promise<void> {
    const database = tx || this.databaseService;

    // Check if role exists
    const existingRole = await database.role.findUnique({
      where: { id: roleId },
      include: {
        UserRoles: true,
      },
    });

    if (!existingRole) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    // Verify the role belongs to this community
    if (existingRole.communityId !== communityId) {
      throw new NotFoundException(
        `Role with ID ${roleId} not found in this community`,
      );
    }

    // Prevent deleting default roles
    if (existingRole.isDefault) {
      throw new BadRequestException('Cannot delete default roles.');
    }

    // Check if role is assigned to any users
    if (existingRole.UserRoles.length > 0) {
      throw new BadRequestException(
        `Cannot delete role "${existingRole.name}" because it is assigned to ${existingRole.UserRoles.length} user(s). Remove all role assignments first.`,
      );
    }

    await database.role.delete({
      where: { id: roleId },
    });

    this.logger.log(`Deleted role ${roleId}`);

    await this.permissionsCacheService.bumpNowOrDefer(
      { kind: 'community', communityId },
      tx,
      pendingBumps,
    );

    if (!tx) {
      this.eventEmitter.emit(RoomEvents.ROLE_DELETED, {
        communityId,
        roleId,
      });
    }
  }

  /**
   * Remove a user from a role in a community
   */
  async removeUserFromCommunityRole(
    userId: string,
    communityId: string,
    roleId: string,
    tx?: Prisma.TransactionClient,
    pendingBumps?: EpochBump[],
  ): Promise<void> {
    const database = tx || this.databaseService;

    // Find and delete the user role assignment
    const userRole = await database.userRoles.findFirst({
      where: {
        userId,
        communityId,
        roleId,
        isInstanceRole: false,
      },
    });

    if (!userRole) {
      throw new NotFoundException('User role assignment not found');
    }

    await database.userRoles.delete({
      where: { id: userRole.id },
    });

    this.logger.log(
      `Removed user ${userId} from role ${roleId} in community ${communityId}`,
    );

    await this.permissionsCacheService.bumpNowOrDefer(
      { kind: 'user', userId },
      tx,
      pendingBumps,
    );

    if (!tx) {
      this.eventEmitter.emit(RoomEvents.ROLE_UNASSIGNED, {
        communityId,
        userId,
        roleId,
      });
    }
  }

  /**
   * Get all users assigned to a specific role
   */
  async getUsersForRole(
    roleId: string,
    communityId?: string,
  ): Promise<
    Array<{ userId: string; username: string; displayName?: string }>
  > {
    const userRoles = await this.databaseService.userRoles.findMany({
      where: {
        roleId,
        communityId,
        isInstanceRole: communityId === undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    });

    return userRoles.map((ur) => ({
      userId: ur.user.id,
      username: ur.user.username,
      displayName: ur.user.displayName || undefined,
    }));
  }
}
