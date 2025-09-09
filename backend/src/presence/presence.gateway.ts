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

    // Check if user was previously offline
    const wasOnline = await this.presenceService.isOnline(userId);

    // Set user as online
    await this.presenceService.setOnline(userId, 60); // 1 minute TTL

    // If user was offline and is now online, broadcast the presence change
    if (!wasOnline) {
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
   * Handle user disconnection - mark them as offline
   */
  async handleDisconnect(
    client: Socket & { handshake: { user: UserEntity } },
  ): Promise<void> {
    if (client.handshake?.user?.id) {
      const userId = client.handshake.user.id;

      // Set user as offline
      await this.presenceService.setOffline(userId);

      // Broadcast offline status
      this.websocketService.sendToAll(ServerEvents.USER_OFFLINE, {
        userId,
        username: client.handshake.user.username,
        displayName: client.handshake.user.displayName,
        avatarUrl: client.handshake.user.avatarUrl,
      });
    }
  }
}
