import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RbacGuard } from '@/auth/rbac.guard';
import { RequiredActions } from '@/auth/rbac-action.decorator';
import { RbacActions } from '@prisma/client';
import {
  RbacResource,
  RbacResourceType,
  ResourceIdSource,
} from '@/auth/rbac-resource.decorator';
import { ParseObjectIdPipe } from 'nestjs-object-id';
import { UserRolesResponseDto, RoleDto } from './dto/user-roles-response.dto';
import { RoleUserDto } from './dto/role-users-response.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CommunityRolesResponseDto } from './dto/community-roles-response.dto';
import { AuthenticatedRequest } from '@/types';

@Controller('roles')
@UseGuards(JwtAuthGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('my/community/:communityId')
  async getMyRolesForCommunity(
    @Param('communityId', ParseObjectIdPipe) communityId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<UserRolesResponseDto> {
    return this.rolesService.getUserRolesForCommunity(req.user.id, communityId);
  }

  @Get('my/channel/:channelId')
  async getMyRolesForChannel(
    @Param('channelId', ParseObjectIdPipe) channelId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<UserRolesResponseDto> {
    return this.rolesService.getUserRolesForChannel(req.user.id, channelId);
  }

  @Get('my/instance')
  async getMyInstanceRoles(
    @Req() req: AuthenticatedRequest,
  ): Promise<UserRolesResponseDto> {
    return this.rolesService.getUserInstanceRoles(req.user.id);
  }

  @Get('user/:userId/community/:communityId')
  @UseGuards(RbacGuard)
  @RequiredActions(RbacActions.READ_MEMBER)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.PARAM,
  })
  async getUserRolesForCommunity(
    @Param('userId', ParseObjectIdPipe) userId: string,
    @Param('communityId', ParseObjectIdPipe) communityId: string,
  ): Promise<UserRolesResponseDto> {
    return this.rolesService.getUserRolesForCommunity(userId, communityId);
  }

  @Get('user/:userId/channel/:channelId')
  @UseGuards(RbacGuard)
  @RequiredActions(RbacActions.READ_MEMBER)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    idKey: 'channelId',
    source: ResourceIdSource.PARAM,
  })
  async getUserRolesForChannel(
    @Param('userId', ParseObjectIdPipe) userId: string,
    @Param('channelId', ParseObjectIdPipe) channelId: string,
  ): Promise<UserRolesResponseDto> {
    return this.rolesService.getUserRolesForChannel(userId, channelId);
  }

  @Get('user/:userId/instance')
  @UseGuards(RbacGuard)
  @RequiredActions(RbacActions.READ_USER)
  @RbacResource({ type: RbacResourceType.INSTANCE })
  async getUserInstanceRoles(
    @Param('userId', ParseObjectIdPipe) userId: string,
  ): Promise<UserRolesResponseDto> {
    return this.rolesService.getUserInstanceRoles(userId);
  }

  // ===== ROLE MANAGEMENT ENDPOINTS =====

  @Get('community/:communityId')
  @UseGuards(RbacGuard)
  @RequiredActions(RbacActions.READ_ROLE)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.PARAM,
  })
  async getCommunityRoles(
    @Param('communityId', ParseObjectIdPipe) communityId: string,
  ): Promise<CommunityRolesResponseDto> {
    return this.rolesService.getCommunityRoles(communityId);
  }

  @Post('community/:communityId')
  @UseGuards(RbacGuard)
  @RequiredActions(RbacActions.CREATE_ROLE)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.PARAM,
  })
  async createCommunityRole(
    @Param('communityId', ParseObjectIdPipe) communityId: string,
    @Body() createRoleDto: CreateRoleDto,
  ): Promise<RoleDto> {
    return this.rolesService.createCommunityRole(communityId, createRoleDto);
  }

  // communityId is required in the route so the RbacGuard can resolve
  // community-scoped permissions before the handler runs (roleId alone
  // would require a DB lookup inside the guard to find the community).
  @Put('community/:communityId/:roleId')
  @UseGuards(RbacGuard)
  @RequiredActions(RbacActions.UPDATE_ROLE)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.PARAM,
  })
  async updateRole(
    @Param('communityId', ParseObjectIdPipe) communityId: string,
    @Param('roleId', ParseObjectIdPipe) roleId: string,
    @Body() updateRoleDto: UpdateRoleDto,
  ): Promise<RoleDto> {
    return this.rolesService.updateRole(roleId, communityId, updateRoleDto);
  }

  @Delete('community/:communityId/:roleId')
  @HttpCode(204)
  @UseGuards(RbacGuard)
  @RequiredActions(RbacActions.DELETE_ROLE)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.PARAM,
  })
  async deleteRole(
    @Param('communityId', ParseObjectIdPipe) communityId: string,
    @Param('roleId', ParseObjectIdPipe) roleId: string,
  ): Promise<void> {
    return this.rolesService.deleteRole(roleId, communityId);
  }

  // ===== USER-ROLE ASSIGNMENT ENDPOINTS =====

  @Post('community/:communityId/assign')
  @UseGuards(RbacGuard)
  @RequiredActions(RbacActions.UPDATE_MEMBER)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.PARAM,
  })
  async assignRoleToUser(
    @Param('communityId', ParseObjectIdPipe) communityId: string,
    @Body() assignRoleDto: AssignRoleDto,
  ): Promise<void> {
    return this.rolesService.assignUserToCommunityRole(
      assignRoleDto.userId,
      communityId,
      assignRoleDto.roleId,
    );
  }

  @Delete('community/:communityId/users/:userId/roles/:roleId')
  @HttpCode(204)
  @UseGuards(RbacGuard)
  @RequiredActions(RbacActions.UPDATE_MEMBER)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.PARAM,
  })
  async removeRoleFromUser(
    @Param('communityId', ParseObjectIdPipe) communityId: string,
    @Param('userId', ParseObjectIdPipe) userId: string,
    @Param('roleId', ParseObjectIdPipe) roleId: string,
  ): Promise<void> {
    return this.rolesService.removeUserFromCommunityRole(
      userId,
      communityId,
      roleId,
    );
  }

  @Get('community/:communityId/:roleId/users')
  @UseGuards(RbacGuard)
  @RequiredActions(RbacActions.READ_ROLE)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.PARAM,
  })
  async getUsersForRole(
    @Param('communityId', ParseObjectIdPipe) communityId: string,
    @Param('roleId', ParseObjectIdPipe) roleId: string,
  ): Promise<RoleUserDto[]> {
    return this.rolesService.getUsersForRole(roleId, communityId);
  }

  // ===== INSTANCE ROLE MANAGEMENT ENDPOINTS =====

  /**
   * Get all instance-level roles
   */
  @Get('instance/all')
  @UseGuards(RbacGuard)
  @RequiredActions(RbacActions.READ_INSTANCE_SETTINGS)
  @RbacResource({ type: RbacResourceType.INSTANCE })
  async getInstanceRoles(): Promise<RoleDto[]> {
    return this.rolesService.getInstanceRoles();
  }

  /**
   * Create a new instance role
   */
  @Post('instance')
  @UseGuards(RbacGuard)
  @RequiredActions(RbacActions.UPDATE_INSTANCE_SETTINGS)
  @RbacResource({ type: RbacResourceType.INSTANCE })
  async createInstanceRole(
    @Body() createRoleDto: CreateRoleDto,
  ): Promise<RoleDto> {
    return this.rolesService.createInstanceRole(
      createRoleDto.name,
      createRoleDto.actions,
    );
  }

  /**
   * Update an instance role
   */
  @Put('instance/:roleId')
  @UseGuards(RbacGuard)
  @RequiredActions(RbacActions.UPDATE_INSTANCE_SETTINGS)
  @RbacResource({ type: RbacResourceType.INSTANCE })
  async updateInstanceRole(
    @Param('roleId', ParseObjectIdPipe) roleId: string,
    @Body() updateRoleDto: UpdateRoleDto,
  ): Promise<RoleDto> {
    return this.rolesService.updateInstanceRole(roleId, updateRoleDto);
  }

  /**
   * Delete an instance role
   */
  @Delete('instance/:roleId')
  @HttpCode(204)
  @UseGuards(RbacGuard)
  @RequiredActions(RbacActions.UPDATE_INSTANCE_SETTINGS)
  @RbacResource({ type: RbacResourceType.INSTANCE })
  async deleteInstanceRole(
    @Param('roleId', ParseObjectIdPipe) roleId: string,
  ): Promise<void> {
    return this.rolesService.deleteInstanceRole(roleId);
  }

  /**
   * Assign an instance role to a user
   */
  @Post('instance/:roleId/assign')
  @UseGuards(RbacGuard)
  @RequiredActions(RbacActions.UPDATE_USER)
  @RbacResource({ type: RbacResourceType.INSTANCE })
  async assignInstanceRole(
    @Param('roleId', ParseObjectIdPipe) roleId: string,
    @Body() body: { userId: string },
  ): Promise<void> {
    return this.rolesService.assignUserToInstanceRole(body.userId, roleId);
  }

  /**
   * Remove an instance role from a user
   */
  @Delete('instance/:roleId/users/:userId')
  @HttpCode(204)
  @UseGuards(RbacGuard)
  @RequiredActions(RbacActions.UPDATE_USER)
  @RbacResource({ type: RbacResourceType.INSTANCE })
  async removeInstanceRole(
    @Param('roleId', ParseObjectIdPipe) roleId: string,
    @Param('userId', ParseObjectIdPipe) userId: string,
  ): Promise<void> {
    return this.rolesService.removeUserFromInstanceRole(userId, roleId);
  }

  /**
   * Get users assigned to an instance role
   */
  @Get('instance/:roleId/users')
  @UseGuards(RbacGuard)
  @RequiredActions(RbacActions.READ_USER)
  @RbacResource({ type: RbacResourceType.INSTANCE })
  async getInstanceRoleUsers(
    @Param('roleId', ParseObjectIdPipe) roleId: string,
  ): Promise<RoleUserDto[]> {
    return this.rolesService.getInstanceRoleUsers(roleId);
  }
}
