import { RequiredActions } from '@/auth/rbac-action.decorator';
import {
  RbacResource,
  RbacResourceType,
  ResourceIdSource,
} from '@/auth/rbac-resource.decorator';
import { RbacGuard } from '@/auth/rbac.guard';
import {
  Logger,
  UseFilters,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { WsLoggingExceptionFilter } from '@/websocket/ws-exception.filter';
import { RbacActions } from '@prisma/client';
import { MessagesService } from './messages.service';
import { ReactionsService } from './reactions.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { AddReactionDto } from './dto/add-reaction.dto';
import { RemoveReactionDto } from './dto/remove-reaction.dto';
import { Server, Socket } from 'socket.io';
import { ClientEvents } from '@/websocket/events.enum/client-events.enum';
import { WebsocketService } from '@/websocket/websocket.service';
import { ServerEvents } from '@/websocket/events.enum/server-events.enum';
import { WsJwtAuthGuard } from '@/auth/ws-jwt-auth.guard';
import { NotificationsService } from '@/notifications/notifications.service';
import { ModerationService } from '@/moderation/moderation.service';
import { getSocketUserId } from '@/common/utils/socket.utils';

@UseFilters(WsLoggingExceptionFilter)
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || true,
    credentials: true,
  },
  transports: ['websocket'],
  pingTimeout: 60000,
  pingInterval: 25000,
})
@UsePipes(
  new ValidationPipe({ exceptionFactory: (errors) => new WsException(errors) }),
)
@UseGuards(WsJwtAuthGuard, RbacGuard)
export class MessagesGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagesGateway.name);

  constructor(
    private readonly messagesService: MessagesService,
    private readonly reactionsService: ReactionsService,
    private readonly websocketService: WebsocketService,
    private readonly notificationsService: NotificationsService,
    private readonly moderationService: ModerationService,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  afterInit(_server: Server) {
    this.logger.log('MessagesGateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to MessagesGateway: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from MessagesGateway: ${client.id}`);
  }

  @SubscribeMessage(ClientEvents.SEND_MESSAGE)
  @RequiredActions(RbacActions.CREATE_MESSAGE)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    idKey: 'channelId',
    source: ResourceIdSource.PAYLOAD,
  })
  async handleMessage(
    @MessageBody() payload: CreateMessageDto,
    @ConnectedSocket() client: Socket,
  ): Promise<string> {
    const userId = getSocketUserId(client);

    if (!payload.channelId) {
      throw new WsException('channelId is required for channel messages');
    }

    // Check if user is timed out in this community
    const communityId = await this.moderationService.getCommunityIdFromChannel(
      payload.channelId,
    );
    const timeoutStatus = await this.moderationService.isUserTimedOut(
      communityId,
      userId,
    );
    if (timeoutStatus.isTimedOut) {
      const remainingMs = timeoutStatus.expiresAt
        ? timeoutStatus.expiresAt.getTime() - Date.now()
        : 0;
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      throw new WsException(
        `You are timed out in this community. Time remaining: ${remainingSeconds} seconds`,
      );
    }

    const message = await this.messagesService.create({
      ...payload,
      authorId: userId,
      sentAt: new Date(),
    });

    // Process message for notifications (mentions, etc.)
    // This runs asynchronously and doesn't block message sending
    this.notificationsService
      .processMessageForNotifications(message)
      .catch((error) =>
        this.logger.error('Failed to process notifications for message', error),
      );

    // Enrich message with file metadata before emitting
    const enrichedMessage =
      await this.messagesService.enrichMessageWithFileMetadata(message);

    this.websocketService.sendToRoom(
      payload.channelId,
      ServerEvents.NEW_MESSAGE,
      {
        message: enrichedMessage,
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
  async handleDirectMessageWithRBAC(
    @MessageBody() payload: CreateMessageDto,
    @ConnectedSocket() client: Socket,
  ): Promise<string> {
    const userId = getSocketUserId(client);

    if (!payload.directMessageGroupId) {
      throw new WsException(
        'directMessageGroupId is required for direct messages',
      );
    }

    const message = await this.messagesService.create({
      ...payload,
      authorId: userId,
      sentAt: new Date(),
    });

    // Process message for notifications (mentions, DMs, etc.)
    // This runs asynchronously and doesn't block message sending
    this.notificationsService
      .processMessageForNotifications(message)
      .catch((error) =>
        this.logger.error('Failed to process notifications for DM', error),
      );

    // Enrich message with file metadata before emitting
    const enrichedMessage =
      await this.messagesService.enrichMessageWithFileMetadata(message);

    this.websocketService.sendToRoom(
      payload.directMessageGroupId,
      ServerEvents.NEW_DM,
      {
        message: enrichedMessage,
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
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const userId = getSocketUserId(client);
    const result = await this.reactionsService.addReaction(
      payload.messageId,
      payload.emoji,
      userId,
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
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const userId = getSocketUserId(client);
    const result = await this.reactionsService.removeReaction(
      payload.messageId,
      payload.emoji,
      userId,
    );

    // Broadcast to all users in the channel
    const roomId = result.channelId || result.directMessageGroupId;
    if (roomId) {
      this.websocketService.sendToRoom(roomId, ServerEvents.REACTION_REMOVED, {
        messageId: result.id,
        emoji: payload.emoji,
        reactions: result.reactions,
      });
    }
  }
}
