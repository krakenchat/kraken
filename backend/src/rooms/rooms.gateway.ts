import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  OnGatewayConnection,
  WsException,
  ConnectedSocket,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { RoomsService } from './rooms.service';
import { Server, Socket } from 'socket.io';
import { UserEntity } from '@/user/dto/user-response.dto';
import { Logger, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RbacGuard } from '@/auth/rbac.guard';
import { WebsocketService } from '@/websocket/websocket.service';
import { ServerEvents } from '@/websocket/events.enum/server-events.enum';
import { ClientEvents } from '@/websocket/events.enum/client-events.enum';
import { RequiredActions } from '@/auth/rbac-action.decorator';
import { RbacActions } from '@prisma/client';
import {
  RbacResource,
  RbacResourceType,
  ResourceIdSource,
} from '@/auth/rbac-resource.decorator';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway()
@UsePipes(
  new ValidationPipe({ exceptionFactory: (errors) => new WsException(errors) }),
)
@UseGuards(JwtAuthGuard, RbacGuard)
@WebSocketGateway()
export class RoomsGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  private readonly logger = new Logger(RoomsGateway.name);

  constructor(
    private readonly roomsService: RoomsService,
    private readonly websocketService: WebsocketService,
    private readonly jwtService: JwtService,
  ) {}

  afterInit(server: Server) {
    this.websocketService.setServer(server);
  }

  handleDisconnect(client: Socket) {
    const userId = this.getUserIdFromClient(client);
    this.websocketService.sendToAll(ServerEvents.USER_OFFLINE, {
      userId,
    });
  }

  async handleConnection(client: Socket) {
    const userId = this.getUserIdFromClient(client);

    if (!userId) {
      return client.disconnect(true);
    }

    // Join a room just to receive user-specific messages (server events)
    await client.join(userId);

    this.websocketService.sendToAll(ServerEvents.USER_ONLINE, {
      userId,
    });
  }

  private getUserIdFromClient(client: Socket) {
    // Try to get token from Socket.IO handshake auth first, then headers
    const authToken =
      typeof client.handshake.auth?.token === 'string'
        ? client.handshake.auth.token
        : undefined;
    const headerToken =
      typeof client.handshake.headers.authorization === 'string'
        ? client.handshake.headers.authorization
        : undefined;
    const token =
      (authToken ? authToken.split(' ')[1] : undefined) ||
      (headerToken ? headerToken.split(' ')[1] : undefined);

    if (!token) {
      this.logger.warn('No token provided');
      return undefined;
    }

    const { sub: userId } = this.jwtService.verify<{ sub: string }>(token);
    if (!userId) {
      this.logger.warn('No user id provided');
      return undefined;
    }

    return userId;
  }

  @SubscribeMessage(ClientEvents.JOIN_ALL)
  joinAll(
    @ConnectedSocket() client: Socket & { handshake: { user: UserEntity } },
    @MessageBody() communityId: string,
  ) {
    return this.roomsService.joinAll(client, communityId);
  }

  @SubscribeMessage(ClientEvents.JOIN_ROOM)
  @RequiredActions(RbacActions.CREATE_MESSAGE)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    source: ResourceIdSource.TEXT_PAYLOAD,
  })
  findOne(
    @ConnectedSocket() client: Socket & { handshake: { user: UserEntity } },
    @MessageBody() id: string,
  ) {
    return this.roomsService.join(client, id);
  }
}
