import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RbacGuard } from '@/auth/rbac.guard';
import { RequiredActions } from '@/auth/rbac-action.decorator';
import {
  RbacResource,
  RbacResourceType,
  ResourceIdSource,
} from '@/auth/rbac-resource.decorator';
import { RbacActions } from '@prisma/client';
import {
  AliasGroupsService,
  AliasGroupWithMembers,
  AliasGroupSummary,
} from './alias-groups.service';
import { CreateAliasGroupDto } from './dto/create-alias-group.dto';
import { UpdateAliasGroupDto } from './dto/update-alias-group.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMembersDto } from './dto/update-members.dto';

@Controller('alias-groups')
@UseGuards(JwtAuthGuard, RbacGuard)
export class AliasGroupsController {
  constructor(private readonly aliasGroupsService: AliasGroupsService) {}

  /**
   * Get all alias groups for a community
   */
  @Get('community/:communityId')
  @RequiredActions(RbacActions.READ_ALIAS_GROUP)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.PARAM,
  })
  async getCommunityAliasGroups(
    @Param('communityId') communityId: string,
  ): Promise<AliasGroupSummary[]> {
    return this.aliasGroupsService.getCommunityAliasGroups(communityId);
  }

  /**
   * Create a new alias group
   */
  @Post('community/:communityId')
  @RequiredActions(RbacActions.CREATE_ALIAS_GROUP)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.PARAM,
  })
  async createAliasGroup(
    @Param('communityId') communityId: string,
    @Body() dto: CreateAliasGroupDto,
  ): Promise<AliasGroupWithMembers> {
    return this.aliasGroupsService.createAliasGroup(communityId, dto);
  }

  /**
   * Get a single alias group with full member details
   */
  @Get(':groupId')
  @RequiredActions(RbacActions.READ_ALIAS_GROUP)
  @RbacResource({
    type: RbacResourceType.ALIAS_GROUP,
    idKey: 'groupId',
    source: ResourceIdSource.PARAM,
  })
  async getAliasGroup(
    @Param('groupId') groupId: string,
  ): Promise<AliasGroupWithMembers> {
    return this.aliasGroupsService.getAliasGroup(groupId);
  }

  /**
   * Update an alias group's name
   */
  @Put(':groupId')
  @RequiredActions(RbacActions.UPDATE_ALIAS_GROUP)
  @RbacResource({
    type: RbacResourceType.ALIAS_GROUP,
    idKey: 'groupId',
    source: ResourceIdSource.PARAM,
  })
  async updateAliasGroup(
    @Param('groupId') groupId: string,
    @Body() dto: UpdateAliasGroupDto,
  ): Promise<AliasGroupWithMembers> {
    return this.aliasGroupsService.updateAliasGroup(groupId, dto);
  }

  /**
   * Delete an alias group
   */
  @Delete(':groupId')
  @RequiredActions(RbacActions.DELETE_ALIAS_GROUP)
  @RbacResource({
    type: RbacResourceType.ALIAS_GROUP,
    idKey: 'groupId',
    source: ResourceIdSource.PARAM,
  })
  async deleteAliasGroup(@Param('groupId') groupId: string): Promise<void> {
    return this.aliasGroupsService.deleteAliasGroup(groupId);
  }

  /**
   * Add a member to an alias group
   */
  @Post(':groupId/members')
  @RequiredActions(RbacActions.CREATE_ALIAS_GROUP_MEMBER)
  @RbacResource({
    type: RbacResourceType.ALIAS_GROUP,
    idKey: 'groupId',
    source: ResourceIdSource.PARAM,
  })
  async addMember(
    @Param('groupId') groupId: string,
    @Body() dto: AddMemberDto,
  ): Promise<void> {
    return this.aliasGroupsService.addMember(groupId, dto.userId);
  }

  /**
   * Remove a member from an alias group
   */
  @Delete(':groupId/members/:userId')
  @RequiredActions(RbacActions.DELETE_ALIAS_GROUP_MEMBER)
  @RbacResource({
    type: RbacResourceType.ALIAS_GROUP,
    idKey: 'groupId',
    source: ResourceIdSource.PARAM,
  })
  async removeMember(
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    return this.aliasGroupsService.removeMember(groupId, userId);
  }

  /**
   * Replace all members of an alias group
   */
  @Put(':groupId/members')
  @RequiredActions(RbacActions.UPDATE_ALIAS_GROUP_MEMBER)
  @RbacResource({
    type: RbacResourceType.ALIAS_GROUP,
    idKey: 'groupId',
    source: ResourceIdSource.PARAM,
  })
  async updateMembers(
    @Param('groupId') groupId: string,
    @Body() dto: UpdateMembersDto,
  ): Promise<void> {
    return this.aliasGroupsService.updateMembers(groupId, dto.memberIds);
  }
}
