import { UserEntity } from '@/user/dto/user-response.dto';
import { Logger, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
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
import { ReadReceiptsService } from './read-receipts.service';
import { MarkAsReadDto } from './dto/mark-as-read.dto';
import { Server, Socket } from 'socket.io';
import { ClientEvents } from '@/websocket/events.enum/client-events.enum';
import { ServerEvents } from '@/websocket/events.enum/server-events.enum';
import { WsJwtAuthGuard } from '@/auth/ws-jwt-auth.guard';

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
@UseGuards(WsJwtAuthGuard)
export class ReadReceiptsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ReadReceiptsGateway.name);

  constructor(private readonly readReceiptsService: ReadReceiptsService) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  afterInit(_server: Server) {
    this.logger.log('ReadReceiptsGateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to ReadReceiptsGateway: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(
      `Client disconnected from ReadReceiptsGateway: ${client.id}`,
    );
  }

  /**
   * Handle mark as read event from client
   * Updates the read receipt and notifies the user's other sessions
   */
  @SubscribeMessage(ClientEvents.MARK_AS_READ)
  async handleMarkAsRead(
    @MessageBody() payload: MarkAsReadDto,
    @ConnectedSocket() client: Socket & { handshake: { user: UserEntity } },
  ): Promise<void> {
    try {
      const userId = client.handshake.user.id;

      // Mark messages as read
      const readReceipt = await this.readReceiptsService.markAsRead(
        userId,
        payload,
      );

      // Emit to all of the user's connected sessions (including this one)
      // This ensures that if the user has the app open on multiple devices,
      // all sessions stay in sync
      const userRoom = `user:${userId}`;
      this.server.to(userRoom).emit(ServerEvents.READ_RECEIPT_UPDATED, {
        channelId: readReceipt.channelId,
        directMessageGroupId: readReceipt.directMessageGroupId,
        lastReadMessageId: readReceipt.lastReadMessageId,
        lastReadAt: readReceipt.lastReadAt,
      });

      this.logger.debug(
        `User ${userId} marked ${readReceipt.channelId || readReceipt.directMessageGroupId} as read`,
      );
    } catch (error) {
      this.logger.error('Error marking messages as read', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to mark messages as read';
      throw new WsException(errorMessage);
    }
  }
}
