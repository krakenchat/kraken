import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Req,
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
import { DirectMessagesService } from './direct-messages.service';
import { CreateDmGroupDto } from './dto/create-dm-group.dto';
import { AddMembersDto } from './dto/add-members.dto';
import { DmGroupResponseDto } from './dto/dm-group-response.dto';
import { MessagesService } from '@/messages/messages.service';

@Controller('direct-messages')
@UseGuards(JwtAuthGuard, RbacGuard)
export class DirectMessagesController {
  constructor(
    private readonly directMessagesService: DirectMessagesService,
    private readonly messagesService: MessagesService,
  ) {}

  @Get()
  async findUserDmGroups(
    @Req() req: { user: { id: string } },
  ): Promise<DmGroupResponseDto[]> {
    return this.directMessagesService.findUserDmGroups(req.user.id);
  }

  @Post()
  // No RBAC required - creating DMs is a basic user action available to all authenticated users
  // The JwtAuthGuard already ensures the user is authenticated
  async createDmGroup(
    @Body() createDmGroupDto: CreateDmGroupDto,
    @Req() req: { user: { id: string } },
  ): Promise<DmGroupResponseDto> {
    return this.directMessagesService.createDmGroup(
      createDmGroupDto,
      req.user.id,
    );
  }

  @Get(':id')
  @RequiredActions(RbacActions.READ_MESSAGE)
  @RbacResource({
    type: RbacResourceType.DM_GROUP,
    idKey: 'id',
    source: ResourceIdSource.PARAM,
  })
  async findDmGroup(
    @Param('id') id: string,
    @Req() req: { user: { id: string } },
  ): Promise<DmGroupResponseDto> {
    return this.directMessagesService.findDmGroup(id, req.user.id);
  }

  @Get(':id/messages')
  @RequiredActions(RbacActions.READ_MESSAGE)
  @RbacResource({
    type: RbacResourceType.DM_GROUP,
    idKey: 'id',
    source: ResourceIdSource.PARAM,
  })
  async getDmMessages(
    @Param('id') id: string,
    @Req() req: { user: { id: string } },
  ) {
    // First verify user is a member of this DM group
    await this.directMessagesService.findDmGroup(id, req.user.id);

    // Then get the messages
    return this.messagesService.findAllForDirectMessageGroup(id);
  }

  @Post(':id/members')
  @RequiredActions(RbacActions.CREATE_MESSAGE)
  @RbacResource({
    type: RbacResourceType.DM_GROUP,
    idKey: 'id',
    source: ResourceIdSource.PARAM,
  })
  async addMembers(
    @Param('id') id: string,
    @Body() addMembersDto: AddMembersDto,
    @Req() req: { user: { id: string } },
  ): Promise<DmGroupResponseDto> {
    return this.directMessagesService.addMembers(
      id,
      addMembersDto,
      req.user.id,
    );
  }

  @Delete(':id/members/me')
  @RequiredActions(RbacActions.DELETE_MESSAGE)
  @RbacResource({
    type: RbacResourceType.DM_GROUP,
    idKey: 'id',
    source: ResourceIdSource.PARAM,
  })
  async leaveDmGroup(
    @Param('id') id: string,
    @Req() req: { user: { id: string } },
  ): Promise<void> {
    return this.directMessagesService.leaveDmGroup(id, req.user.id);
  }
}
