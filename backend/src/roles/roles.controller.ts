import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
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
}
