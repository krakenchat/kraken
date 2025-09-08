import { RequiredActions } from '@/auth/rbac-action.decorator';
import {
  RbacResource,
  RbacResourceType,
  ResourceIdSource,
} from '@/auth/rbac-resource.decorator';
import { RbacGuard } from '@/auth/rbac.guard';
import { UserEntity } from '@/user/dto/user-response.dto';
import { UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WsException,
} from '@nestjs/websockets';
import { RbacActions } from '@prisma/client';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { AddReactionDto } from './dto/add-reaction.dto';
import { RemoveReactionDto } from './dto/remove-reaction.dto';
import { Socket } from 'socket.io';
import { ClientEvents } from '@/websocket/events.enum/client-events.enum';
import { WebsocketService } from '@/websocket/websocket.service';
import { ServerEvents } from '@/websocket/events.enum/server-events.enum';
import { WsJwtAuthGuard } from '@/auth/ws-jwt-auth.guard';

@WebSocketGateway()
@UsePipes(
  new ValidationPipe({ exceptionFactory: (errors) => new WsException(errors) }),
)
@UseGuards(WsJwtAuthGuard, RbacGuard)
export class MessagesGateway {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly websocketService: WebsocketService,
  ) {}

  @SubscribeMessage(ClientEvents.SEND_MESSAGE)
  @RequiredActions(RbacActions.CREATE_MESSAGE)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    idKey: 'channelId',
    source: ResourceIdSource.PAYLOAD,
  })
  async handleMessage(
    @MessageBody() payload: CreateMessageDto,
    @ConnectedSocket() client: Socket & { handshake: { user: UserEntity } },
  ): Promise<string> {
    const message = await this.messagesService.create({
      ...payload,
      authorId: client.handshake.user.id,
      sentAt: new Date(),
    });

    this.websocketService.sendToRoom(
      payload.channelId!,
      ServerEvents.NEW_MESSAGE,
      {
        message,
      },
    );

    return message.id;
  }

  @SubscribeMessage(ClientEvents.SEND_DM)
  @RequiredActions(RbacActions.CREATE_MESSAGE)
  @RbacResource({
    type: RbacResourceType.DM_GROUP,
    idKey: 'directMessageGroupId',
    source: ResourceIdSource.PAYLOAD,
  })
  async handleDirectMessage(
    @MessageBody() payload: CreateMessageDto,
    @ConnectedSocket() client: Socket & { handshake: { user: UserEntity } },
  ): Promise<string> {
    const message = await this.messagesService.create({
      ...payload,
      authorId: client.handshake.user.id,
      sentAt: new Date(),
    });

    this.websocketService.sendToRoom(
      payload.directMessageGroupId!,
      ServerEvents.NEW_DM,
      {
        message,
      },
    );

    return message.id;
  }

  @SubscribeMessage(ClientEvents.ADD_REACTION)
  @RequiredActions(RbacActions.CREATE_REACTION)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    idKey: 'messageId',
    source: ResourceIdSource.PAYLOAD,
  })
  async handleAddReaction(
    @MessageBody() payload: AddReactionDto,
    @ConnectedSocket() client: Socket & { handshake: { user: UserEntity } },
  ): Promise<void> {
    const result = await this.messagesService.addReaction(
      payload.messageId,
      payload.emoji,
      client.handshake.user.id,
    );

    // Broadcast to all users in the channel
    const roomId = result.channelId || result.directMessageGroupId;
    if (roomId) {
      const reaction = result.reactions.find((r) => r.emoji === payload.emoji);
      this.websocketService.sendToRoom(roomId, ServerEvents.REACTION_ADDED, {
        messageId: result.id,
        reaction: reaction,
      });
    }
  }

  @SubscribeMessage(ClientEvents.REMOVE_REACTION)
  @RequiredActions(RbacActions.DELETE_REACTION)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    idKey: 'messageId',
    source: ResourceIdSource.PAYLOAD,
  })
  async handleRemoveReaction(
    @MessageBody() payload: RemoveReactionDto,
    @ConnectedSocket() client: Socket & { handshake: { user: UserEntity } },
  ): Promise<void> {
    const result = await this.messagesService.removeReaction(
      payload.messageId,
      payload.emoji,
      client.handshake.user.id,
    );

    // Broadcast to all users in the channel
    const roomId = result.channelId || result.directMessageGroupId;
    if (roomId) {
      this.websocketService.sendToRoom(roomId, ServerEvents.REACTION_REMOVED, {
        messageId: result.id,
        emoji: payload.emoji,
      });
    }
  }
}
