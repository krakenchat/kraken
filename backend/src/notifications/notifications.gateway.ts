import { Logger, UseGuards, UseFilters } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { NewNotificationPayload, ServerEvents } from '@semaphore-chat/shared';
import { Notification } from '@prisma/client';
import { WsJwtAuthGuard } from '@/auth/ws-jwt-auth.guard';
import { WsThrottleGuard } from '@/auth/ws-throttle.guard';
import { WsLoggingExceptionFilter } from '@/websocket/ws-exception.filter';
import { RoomName } from '@/common/utils/room-name.util';
import { SpanDto } from '@/messages/dto/message-response.dto';
import { WebsocketService } from '@/websocket/websocket.service';

/**
 * Gateway for sending real-time notification events to clients
 * Note: This gateway is primarily used for emitting events, not receiving them
 * Notification creation happens in the MessagesGateway when messages are processed
 */
@UseFilters(WsLoggingExceptionFilter)
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
    credentials: true,
  },
  transports: ['websocket'],
  pingTimeout: 60000,
  pingInterval: 25000,
})
@UseGuards(WsThrottleGuard, WsJwtAuthGuard)
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(private readonly websocketService: WebsocketService) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  afterInit(_server: Server) {
    this.logger.log('NotificationsGateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected to NotificationsGateway: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(
      `Client disconnected from NotificationsGateway: ${client.id}`,
    );
  }

  /**
   * Emit a new notification to a specific user
   * This is called by the NotificationsService after creating a notification
   */
  emitNotificationToUser(
    userId: string,
    notification: Notification & {
      author?: {
        id: string;
        username: string;
        displayName: string | null;
        avatarUrl: string | null;
      } | null;
      message?: {
        id: string;
        // Message.spans is a MessageSpan[] relation (Prisma), not the shared
        // `Span[]` DTO shape — Prisma's nullable columns come back as
        // `T | null`, not `T | undefined` (`Span`'s convention), so the
        // shared type doesn't structurally match without a lossy cast.
        // SpanDto already models the Prisma-nullable shape (see
        // DmGroupLastMessageDto for the same pattern).
        spans: SpanDto[];
        channelId: string | null;
        directMessageGroupId: string | null;
      } | null;
      channel?: {
        id: string;
        name: string;
        communityId: string;
      } | null;
    },
  ): void {
    const userRoom = RoomName.user(userId);

    this.websocketService.sendToRoom(userRoom, ServerEvents.NEW_NOTIFICATION, {
      notificationId: notification.id,
      // Cast, not converted: Prisma's `NotificationType` enum and the
      // shared string-literal enum have identical runtime values but are
      // structurally distinct TS types — pure relabeling, no value change.
      type: notification.type as unknown as NewNotificationPayload['type'],
      messageId: notification.messageId,
      channelId: notification.channelId,
      communityId: notification.channel?.communityId ?? null,
      channelName: notification.channel?.name ?? null,
      directMessageGroupId: notification.directMessageGroupId,
      authorId: notification.authorId,
      // Cast, not converted: Prisma's nullable relations come back as
      // `T | null`, not `T | undefined` (the shared DTO's convention) —
      // same structural-mismatch pattern as `message` below (see the
      // SpanDto doc comment above).
      author:
        notification.author as unknown as NewNotificationPayload['author'],
      message:
        notification.message as unknown as NewNotificationPayload['message'],
      // Cast, not converted: the wire type's declared shape is the
      // post-serialization ISO string, but this hands the raw Date
      // straight through — WebsocketService.sendToRoom() normalizes
      // every payload to JSON wire form (Date -> ISO string) right
      // before `.emit()`, so the runtime already matches this cast. See
      // toWirePayload in @/websocket/websocket-wire.util. Fixes #440.
      createdAt: notification.createdAt as unknown as string,
      read: notification.read,
    });

    this.logger.debug(`Notification ${notification.id} sent to user ${userId}`);
  }

  /**
   * Emit notification read status update to user
   */
  emitNotificationRead(userId: string, notificationId: string): void {
    const userRoom = RoomName.user(userId);

    this.websocketService.sendToRoom(userRoom, ServerEvents.NOTIFICATION_READ, {
      notificationId,
    });

    this.logger.debug(
      `Notification ${notificationId} marked as read for user ${userId}`,
    );
  }
}
