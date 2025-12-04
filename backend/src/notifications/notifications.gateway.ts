import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ServerEvents } from '@/websocket/events.enum/server-events.enum';
import { Notification } from '@prisma/client';

/**
 * Gateway for sending real-time notification events to clients
 * Note: This gateway is primarily used for emitting events, not receiving them
 * Notification creation happens in the MessagesGateway when messages are processed
 */
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || true,
    credentials: true,
  },
  transports: ['websocket'],
  pingTimeout: 60000,
  pingInterval: 25000,
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  afterInit(_server: Server) {
    this.logger.log('NotificationsGateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to NotificationsGateway: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(
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
        spans: any[];
      } | null;
      channel?: {
        id: string;
        name: string;
        communityId: string;
      } | null;
    },
  ): void {
    const userRoom = `user:${userId}`;

    this.server.to(userRoom).emit(ServerEvents.NEW_NOTIFICATION, {
      notificationId: notification.id,
      type: notification.type,
      messageId: notification.messageId,
      channelId: notification.channelId,
      communityId: notification.channel?.communityId ?? null,
      channelName: notification.channel?.name ?? null,
      directMessageGroupId: notification.directMessageGroupId,
      authorId: notification.authorId,
      author: notification.author,
      message: notification.message,
      createdAt: notification.createdAt,
      read: notification.read,
    });

    this.logger.debug(`Notification ${notification.id} sent to user ${userId}`);
  }

  /**
   * Emit notification read status update to user
   */
  emitNotificationRead(userId: string, notificationId: string): void {
    const userRoom = `user:${userId}`;

    this.server.to(userRoom).emit(ServerEvents.NOTIFICATION_READ, {
      notificationId,
    });

    this.logger.debug(
      `Notification ${notificationId} marked as read for user ${userId}`,
    );
  }
}
