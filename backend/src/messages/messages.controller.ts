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
  Query,
  Req,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RbacGuard } from '@/auth/rbac.guard';
import { MessageOwnershipGuard } from '@/auth/message-ownership.guard';
import { RequiredActions } from '@/auth/rbac-action.decorator';
import { RbacActions } from '@prisma/client';
import {
  RbacResource,
  RbacResourceType,
  ResourceIdSource,
} from '@/auth/rbac-resource.decorator';
import { ParseObjectIdPipe } from 'nestjs-object-id';
import { UserEntity } from '@/user/dto/user-response.dto';
import { WebsocketService } from '@/websocket/websocket.service';
import { ServerEvents } from '@/websocket/events.enum/server-events.enum';

@Controller('messages')
@UseGuards(JwtAuthGuard, RbacGuard)
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly websocketService: WebsocketService,
  ) {}

  @Post()
  @HttpCode(201)
  @RequiredActions(RbacActions.CREATE_MESSAGE)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    idKey: 'channelId',
    source: ResourceIdSource.BODY,
  })
  create(
    @Req() req: { user: UserEntity },
    @Body() createMessageDto: CreateMessageDto,
  ) {
    return this.messagesService.create({
      ...createMessageDto,
      authorId: req.user.id,
      sentAt: new Date(),
    });
  }

  @Get('/group/:groupId')
  @RequiredActions(RbacActions.READ_MESSAGE)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    idKey: 'channelId',
    source: ResourceIdSource.PARAM,
  })
  findAllForGroup(
    @Param('groupId', ParseObjectIdPipe) groupId: string,
    @Query('limit') limit?: string,
    @Query('continuationToken') continuationToken?: string,
  ) {
    // Parse limit to number, fallback to default if not provided
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.messagesService.findAllForDirectMessageGroup(
      groupId,
      parsedLimit,
      continuationToken,
    );
  }

  @Get('/channel/:channelId')
  @RequiredActions(RbacActions.READ_MESSAGE)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    idKey: 'channelId',
    source: ResourceIdSource.PARAM,
  })
  findAllForChannel(
    @Param('channelId', ParseObjectIdPipe) channelId: string,
    @Query('limit') limit?: string,
    @Query('continuationToken') continuationToken?: string,
  ) {
    // Parse limit to number, fallback to default if not provided
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.messagesService.findAllForChannel(
      channelId,
      parsedLimit,
      continuationToken,
    );
  }

  @Get(':id')
  @RequiredActions(RbacActions.READ_MESSAGE)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    idKey: 'id',
  })
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.messagesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, MessageOwnershipGuard)
  @RequiredActions(RbacActions.UPDATE_MESSAGE)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    idKey: 'id',
  })
  async update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: { user: UserEntity },
    @Body() updateMessageDto: UpdateMessageDto,
  ) {
    // First get the original message to know which channel to notify
    const originalMessage = await this.messagesService.findOne(id);

    // Update the message
    const updatedMessage = await this.messagesService.update(
      id,
      updateMessageDto,
    );

    // Emit WebSocket event to the channel room
    const roomId =
      originalMessage.channelId || originalMessage.directMessageGroupId;
    if (roomId) {
      this.websocketService.sendToRoom(roomId, ServerEvents.UPDATE_MESSAGE, {
        message: updatedMessage,
      });
    }

    return updatedMessage;
  }

  @HttpCode(204)
  @Delete(':id')
  @UseGuards(JwtAuthGuard, MessageOwnershipGuard)
  @RequiredActions(RbacActions.DELETE_MESSAGE)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    idKey: 'id',
  })
  async remove(@Param('id', ParseObjectIdPipe) id: string) {
    // First get the message to know which channel to notify
    const messageToDelete = await this.messagesService.findOne(id);

    // Delete the message
    await this.messagesService.remove(id);

    // Emit WebSocket event to the channel room
    const roomId =
      messageToDelete.channelId || messageToDelete.directMessageGroupId;
    if (roomId) {
      this.websocketService.sendToRoom(roomId, ServerEvents.DELETE_MESSAGE, {
        messageId: id,
        channelId: messageToDelete.channelId,
        directMessageGroupId: messageToDelete.directMessageGroupId,
      });
    }
  }
}
