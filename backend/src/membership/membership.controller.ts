import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  Req,
  ForbiddenException,
  Query,
} from '@nestjs/common';
import { MembershipService } from './membership.service';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { MembershipResponseDto } from './dto/membership-response.dto';
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
import { AuthenticatedRequest } from '@/types';

@Controller('membership')
@UseGuards(JwtAuthGuard, RbacGuard)
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  @Post()
  @HttpCode(201)
  @RequiredActions(RbacActions.CREATE_MEMBER)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.BODY,
  })
  create(
    @Body() createMembershipDto: CreateMembershipDto,
  ): Promise<MembershipResponseDto> {
    return this.membershipService.create(createMembershipDto);
  }

  @Get('/community/:communityId')
  @RequiredActions(RbacActions.READ_MEMBER)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.PARAM,
  })
  findAllForCommunity(
    @Param('communityId', ParseObjectIdPipe) communityId: string,
  ): Promise<MembershipResponseDto[]> {
    return this.membershipService.findAllForCommunity(communityId);
  }

  @Get('/community/:communityId/search')
  @RequiredActions(RbacActions.READ_MEMBER)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.PARAM,
  })
  searchCommunityMembers(
    @Param('communityId', ParseObjectIdPipe) communityId: string,
    @Query('query') query: string,
    @Query('limit') limit?: string,
  ): Promise<MembershipResponseDto[]> {
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    return this.membershipService.searchMembers(
      communityId,
      query || '',
      limitNumber,
    );
  }

  @Get('/user/:userId')
  @RequiredActions(RbacActions.READ_MEMBER)
  findAllForUser(
    @Param('userId', ParseObjectIdPipe) userId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<MembershipResponseDto[]> {
    // Users can only view their own memberships unless they have additional permissions
    if (userId !== req.user.id) {
      // Could add additional RBAC check here for viewing other users' memberships
      // For now, only allow users to view their own memberships
      throw new ForbiddenException('Cannot view other users memberships');
    }
    return this.membershipService.findAllForUser(userId);
  }

  @Get('/my')
  @RequiredActions(RbacActions.READ_MEMBER)
  findMyMemberships(
    @Req() req: AuthenticatedRequest,
  ): Promise<MembershipResponseDto[]> {
    return this.membershipService.findAllForUser(req.user.id);
  }

  @Get('/community/:communityId/user/:userId')
  @RequiredActions(RbacActions.READ_MEMBER)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.PARAM,
  })
  findOne(
    @Param('userId', ParseObjectIdPipe) userId: string,
    @Param('communityId', ParseObjectIdPipe) communityId: string,
  ): Promise<MembershipResponseDto> {
    return this.membershipService.findOne(userId, communityId);
  }

  @Delete('/community/:communityId/user/:userId')
  @HttpCode(204)
  @RequiredActions(RbacActions.DELETE_MEMBER)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.PARAM,
  })
  remove(
    @Param('userId', ParseObjectIdPipe) userId: string,
    @Param('communityId', ParseObjectIdPipe) communityId: string,
  ): Promise<void> {
    return this.membershipService.remove(userId, communityId);
  }

  @Delete('/leave/:communityId')
  @HttpCode(204)
  leaveCommunity(
    @Param('communityId', ParseObjectIdPipe) communityId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    return this.membershipService.remove(req.user.id, communityId);
  }
}
