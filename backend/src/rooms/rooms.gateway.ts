import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WsException,
  ConnectedSocket,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { RoomsService } from './rooms.service';
import { Server, Socket } from 'socket.io';
import { UserEntity } from '@/user/dto/user-response.dto';
import {
  Logger,
  UseGuards,
  UsePipes,
  ValidationPipe,
  UseFilters,
} from '@nestjs/common';
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
import { WsLoggingExceptionFilter } from '../websocket/ws-exception.filter';
import { WsJwtAuthGuard } from '@/auth/ws-jwt-auth.guard';

@UseFilters(WsLoggingExceptionFilter)
@WebSocketGateway()
@UsePipes(
  new ValidationPipe({ exceptionFactory: (errors) => new WsException(errors) }),
)
@UseGuards(WsJwtAuthGuard, RbacGuard)
@WebSocketGateway()
export class RoomsGateway implements OnGatewayDisconnect, OnGatewayInit {
  private readonly logger = new Logger(RoomsGateway.name);

  constructor(
    private readonly roomsService: RoomsService,
    private readonly websocketService: WebsocketService,
  ) {}

  afterInit(server: Server) {
    this.websocketService.setServer(server);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const user = (client.handshake as { user?: UserEntity }).user;
    this.websocketService.sendToAll(ServerEvents.USER_OFFLINE, {
      userId: user?.id,
    });
  }

  @SubscribeMessage(ClientEvents.JOIN_ALL)
  @RequiredActions(RbacActions.READ_COMMUNITY)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    source: ResourceIdSource.TEXT_PAYLOAD,
  })
  async joinAll(
    @ConnectedSocket() client: Socket & { handshake: { user: UserEntity } },
    @MessageBody() communityId: string,
  ) {
    const user = client.handshake.user;
    this.logger.log(
      `User ${client.handshake.user.id} joined all rooms with communityId ${communityId}`,
    );

    this.websocketService.sendToAll(ServerEvents.USER_ONLINE, {
      userId: user.id,
    });
    return this.roomsService.joinAll(client, communityId);
  }

  @SubscribeMessage(ClientEvents.JOIN_ROOM)
  @RequiredActions(RbacActions.READ_COMMUNITY)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    source: ResourceIdSource.TEXT_PAYLOAD,
  })
  async findOne(
    @ConnectedSocket() client: Socket & { handshake: { user: UserEntity } },
    @MessageBody() id: string,
  ) {
    return this.roomsService.join(client, id);
  }

  @SubscribeMessage(ClientEvents.JOIN_DM_ROOM)
  @RequiredActions(RbacActions.READ_MESSAGE)
  @RbacResource({
    type: RbacResourceType.DM_GROUP,
    source: ResourceIdSource.TEXT_PAYLOAD,
  })
  async joinDmRoom(
    @ConnectedSocket() client: Socket & { handshake: { user: UserEntity } },
    @MessageBody() dmGroupId: string,
  ) {
    this.logger.log(
      `User ${client.handshake.user.id} joining DM room: ${dmGroupId}`,
    );
    return this.roomsService.join(client, dmGroupId);
  }

  @SubscribeMessage(ClientEvents.LEAVE_ROOM)
  async leaveRoom(
    @ConnectedSocket() client: Socket & { handshake: { user: UserEntity } },
    @MessageBody() id: string,
  ) {
    this.logger.log(`User ${client.handshake.user.id} leaving room: ${id}`);
    return this.roomsService.leave(client, id);
  }

  @SubscribeMessage(ClientEvents.LEAVE_ALL)
  @RequiredActions(RbacActions.READ_COMMUNITY)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    source: ResourceIdSource.TEXT_PAYLOAD,
  })
  async leaveAll(
    @ConnectedSocket() client: Socket & { handshake: { user: UserEntity } },
    @MessageBody() communityId: string,
  ) {
    this.logger.log(
      `User ${client.handshake.user.id} leaving all rooms for community ${communityId}`,
    );
    return this.roomsService.leaveAll(client, communityId);
  }

  @SubscribeMessage(ClientEvents.LEAVE_DM_ROOM)
  @RequiredActions(RbacActions.READ_MESSAGE)
  @RbacResource({
    type: RbacResourceType.DM_GROUP,
    source: ResourceIdSource.TEXT_PAYLOAD,
  })
  async leaveDmRoom(
    @ConnectedSocket() client: Socket & { handshake: { user: UserEntity } },
    @MessageBody() dmGroupId: string,
  ) {
    this.logger.log(
      `User ${client.handshake.user.id} leaving DM room: ${dmGroupId}`,
    );
    return this.roomsService.leave(client, dmGroupId);
  }
}
