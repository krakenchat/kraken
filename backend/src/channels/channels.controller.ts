import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  Req,
} from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { MoveChannelDto } from './dto/move-channel.dto';
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
import { Channel } from '@prisma/client';

@Controller('channels')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Post()
  @HttpCode(201)
  @RequiredActions(RbacActions.CREATE_CHANNEL)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.BODY,
  })
  create(
    @Body() createChannelDto: CreateChannelDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<Channel> {
    return this.channelsService.create(createChannelDto, req.user);
  }

  @Get('/community/:communityId')
  @RequiredActions(RbacActions.READ_CHANNEL)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.PARAM,
  })
  findAllForCommunity(
    @Param('communityId', ParseObjectIdPipe) communityId: string,
  ): Promise<Channel[]> {
    return this.channelsService.findAll(communityId);
  }

  @Get('/community/:communityId/mentionable')
  @RequiredActions(RbacActions.READ_CHANNEL)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.PARAM,
  })
  getMentionableChannels(
    @Param('communityId', ParseObjectIdPipe) communityId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<Channel[]> {
    return this.channelsService.findMentionableChannels(
      communityId,
      req.user.id,
    );
  }

  @Get(':id')
  @RequiredActions(RbacActions.READ_CHANNEL)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    idKey: 'id',
    source: ResourceIdSource.PARAM,
  })
  findOne(@Param('id', ParseObjectIdPipe) id: string): Promise<Channel> {
    return this.channelsService.findOne(id);
  }

  @Patch(':id')
  @RequiredActions(RbacActions.UPDATE_CHANNEL)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    idKey: 'id',
    source: ResourceIdSource.PARAM,
  })
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() updateChannelDto: UpdateChannelDto,
  ): Promise<Channel> {
    return this.channelsService.update(id, updateChannelDto);
  }

  @HttpCode(204)
  @Delete(':id')
  @RequiredActions(RbacActions.DELETE_CHANNEL)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    idKey: 'id',
    source: ResourceIdSource.PARAM,
  })
  remove(@Param('id', ParseObjectIdPipe) id: string): Promise<void> {
    return this.channelsService.remove(id);
  }

  @Post(':id/move-up')
  @HttpCode(200)
  @RequiredActions(RbacActions.UPDATE_CHANNEL)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.BODY,
  })
  moveUp(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() moveChannelDto: MoveChannelDto,
  ): Promise<Channel[]> {
    return this.channelsService.moveChannelUp(id, moveChannelDto.communityId);
  }

  @Post(':id/move-down')
  @HttpCode(200)
  @RequiredActions(RbacActions.UPDATE_CHANNEL)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.BODY,
  })
  moveDown(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() moveChannelDto: MoveChannelDto,
  ): Promise<Channel[]> {
    return this.channelsService.moveChannelDown(id, moveChannelDto.communityId);
  }
}
