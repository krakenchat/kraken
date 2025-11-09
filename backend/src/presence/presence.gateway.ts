import { RbacGuard } from '@/auth/rbac.guard';
import { UserEntity } from '@/user/dto/user-response.dto';
import { Logger, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PresenceService } from './presence.service';
import { ClientEvents } from '@/websocket/events.enum/client-events.enum';
import { ServerEvents } from '@/websocket/events.enum/server-events.enum';
import { WebsocketService } from '@/websocket/websocket.service';
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
@UseGuards(WsJwtAuthGuard, RbacGuard)
export class PresenceGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PresenceGateway.name);

  constructor(
    private readonly presenceService: PresenceService,
    private readonly websocketService: WebsocketService,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  afterInit(_server: Server) {
    this.logger.log('PresenceGateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to PresenceGateway: ${client.id}`);
  }
  @SubscribeMessage(ClientEvents.PRESENCE_ONLINE)
  async handleMessage(
    @ConnectedSocket() client: Socket & { handshake: { user: UserEntity } },
  ): Promise<string> {
    const userId = client.handshake.user.id;
    const connectionId = client.id;

    // Add this connection and check if user went from offline to online
    const wentOnline = await this.presenceService.addConnection(
      userId,
      connectionId,
      60, // 1 minute TTL
    );

    // Only broadcast if this is the user's first connection
    if (wentOnline) {
      this.websocketService.sendToAll(ServerEvents.USER_ONLINE, {
        userId,
        username: client.handshake.user.username,
        displayName: client.handshake.user.displayName,
        avatarUrl: client.handshake.user.avatarUrl,
      });
    }

    return 'ACK';
  }

  /**
   * Handle user disconnection - only mark offline if this was their last connection
   */
  async handleDisconnect(
    client: Socket & { handshake: { user: UserEntity } },
  ): Promise<void> {
    this.logger.log(`Client disconnected from PresenceGateway: ${client.id}`);
    if (client.handshake?.user?.id) {
      const userId = client.handshake.user.id;
      const connectionId = client.id;

      // Remove this connection and check if user went from online to offline
      const wentOffline = await this.presenceService.removeConnection(
        userId,
        connectionId,
      );

      // Only broadcast if this was the user's last connection
      if (wentOffline) {
        this.websocketService.sendToAll(ServerEvents.USER_OFFLINE, {
          userId,
          username: client.handshake.user.username,
          displayName: client.handshake.user.displayName,
          avatarUrl: client.handshake.user.avatarUrl,
        });
      }
    }
  }
}
