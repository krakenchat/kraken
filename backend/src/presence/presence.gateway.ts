import { RbacGuard } from '@/auth/rbac.guard';
import { UserEntity } from '@/user/dto/user-response.dto';
import { UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  SubscribeMessage,
  WebSocketGateway,
  WsException,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { PresenceService } from './presence.service';
import { ClientEvents } from '@/websocket/events.enum/client-events.enum';
import { ServerEvents } from '@/websocket/events.enum/server-events.enum';
import { WebsocketService } from '@/websocket/websocket.service';
import { WsJwtAuthGuard } from '@/auth/ws-jwt-auth.guard';

@WebSocketGateway()
@UsePipes(
  new ValidationPipe({ exceptionFactory: (errors) => new WsException(errors) }),
)
@UseGuards(WsJwtAuthGuard, RbacGuard)
export class PresenceGateway implements OnGatewayDisconnect {
  constructor(
    private readonly presenceService: PresenceService,
    private readonly websocketService: WebsocketService,
  ) {}
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
