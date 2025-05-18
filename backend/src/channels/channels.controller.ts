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
} from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RbacGuard } from '@/auth/rbac.guard';
import { RequiredActions } from '@/auth/rbac-action.decorator';
import { RbacActions } from '@prisma/client';
import { RbacResource, RbacResourceType } from '@/auth/rbac-resource.decorator';
import { ParseObjectIdPipe } from 'nestjs-object-id';

@Controller('channels')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Post()
  @HttpCode(201)
  @RequiredActions(RbacActions.CREATE_CHANNEL)
  @RbacResource({ type: RbacResourceType.COMMUNITY, idKey: 'id' })
  create(@Body() createChannelDto: CreateChannelDto) {
    return this.channelsService.create(createChannelDto);
  }

  @Get('/community/:communityId')
  @RequiredActions(RbacActions.READ_CHANNEL)
  findAllForCommunity(
    @Param('communityId', ParseObjectIdPipe) communityId: string,
  ) {
    return this.channelsService.findAll(communityId);
  }

  @Get(':id')
  @RequiredActions(RbacActions.READ_CHANNEL)
  @RbacResource({ type: RbacResourceType.CHANNEL, idKey: 'id' })
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.channelsService.findOne(id);
  }

  @Patch(':id')
  @RequiredActions(RbacActions.UPDATE_CHANNEL)
  @RbacResource({ type: RbacResourceType.CHANNEL, idKey: 'id' })
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() updateChannelDto: UpdateChannelDto,
  ) {
    return this.channelsService.update(id, updateChannelDto);
  }

  @HttpCode(204)
  @Delete(':id')
  @RequiredActions(RbacActions.DELETE_CHANNEL)
  @RbacResource({ type: RbacResourceType.CHANNEL, idKey: 'id' })
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.channelsService.remove(id);
  }
}
