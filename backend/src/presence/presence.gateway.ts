import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RbacGuard } from '@/auth/rbac.guard';
import { UserEntity } from '@/user/dto/user-response.dto';
import { UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  SubscribeMessage,
  WebSocketGateway,
  WsException,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { PresenceService } from './presence.service';
import { ClientEvents } from '@/websocket/events.enum/client-events.enum';

@WebSocketGateway()
@UsePipes(
  new ValidationPipe({ exceptionFactory: (errors) => new WsException(errors) }),
)
@UseGuards(JwtAuthGuard, RbacGuard)
export class PresenceGateway {
  constructor(private readonly presenceService: PresenceService) {}
  @SubscribeMessage(ClientEvents.PRESENCE_ONLINE)
  async handleMessage(
    @ConnectedSocket() client: Socket & { handshake: { user: UserEntity } },
  ): Promise<string> {
    await this.presenceService.setOnline(
      client.handshake.user.id,
      60, // 1 minute TTL
    );

    return 'ACK';
  }
}
