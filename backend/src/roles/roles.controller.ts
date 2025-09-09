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
import { UserEntity } from '@/user/dto/user-response.dto';
import { UserRolesResponseDto } from './dto/user-roles-response.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CommunityRolesResponseDto } from './dto/community-roles-response.dto';

@Controller('roles')
@UseGuards(JwtAuthGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('my/community/:communityId')
  async getMyRolesForCommunity(
    @Param('communityId', ParseObjectIdPipe) communityId: string,
    @Req() req: { user: UserEntity },
  ): Promise<UserRolesResponseDto> {
    return this.rolesService.getUserRolesForCommunity(req.user.id, communityId);
  }

  @Get('my/channel/:channelId')
  async getMyRolesForChannel(
    @Param('channelId', ParseObjectIdPipe) channelId: string,
    @Req() req: { user: UserEntity },
  ): Promise<UserRolesResponseDto> {
    return this.rolesService.getUserRolesForChannel(req.user.id, channelId);
  }

  @Get('my/instance')
  async getMyInstanceRoles(
    @Req() req: { user: UserEntity },
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
  ) {
    return this.rolesService.createCommunityRole(communityId, createRoleDto);
  }

  @Put(':roleId')
  @UseGuards(RbacGuard)
  @RequiredActions(RbacActions.UPDATE_ROLE)
  async updateRole(
    @Param('roleId', ParseObjectIdPipe) roleId: string,
    @Body() updateRoleDto: UpdateRoleDto,
  ) {
    return this.rolesService.updateRole(roleId, updateRoleDto);
  }

  @Delete(':roleId')
  @HttpCode(204)
  @UseGuards(RbacGuard)
  @RequiredActions(RbacActions.DELETE_ROLE)
  async deleteRole(
    @Param('roleId', ParseObjectIdPipe) roleId: string,
  ): Promise<void> {
    return this.rolesService.deleteRole(roleId);
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

  @Get(':roleId/users')
  @UseGuards(RbacGuard)
  @RequiredActions(RbacActions.READ_ROLE)
  async getUsersForRole(
    @Param('roleId', ParseObjectIdPipe) roleId: string,
    @Req() req: { query: { communityId?: string } },
  ) {
    const communityId = req.query.communityId;
    return this.rolesService.getUsersForRole(roleId, communityId);
  }
}
