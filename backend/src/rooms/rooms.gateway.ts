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
import {
  getSocketUser,
  getSocketUserId,
  isAuthenticated,
  AuthenticatedSocket,
} from '@/common/utils/socket.utils';

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
    if (isAuthenticated(client)) {
      this.websocketService.sendToAll(ServerEvents.USER_OFFLINE, {
        userId: client.handshake.user.id,
      });
    }
  }

  @SubscribeMessage(ClientEvents.JOIN_ALL)
  @RequiredActions(RbacActions.READ_COMMUNITY)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    source: ResourceIdSource.TEXT_PAYLOAD,
  })
  async joinAll(
    @ConnectedSocket() client: Socket,
    @MessageBody() communityId: string,
  ) {
    const user = getSocketUser(client);
    this.logger.log(
      `User ${user.id} joined all rooms with communityId ${communityId}`,
    );

    this.websocketService.sendToAll(ServerEvents.USER_ONLINE, {
      userId: user.id,
    });
    // Cast is safe here as WsJwtAuthGuard ensures authentication
    return this.roomsService.joinAll(
      client as AuthenticatedSocket,
      communityId,
    );
  }

  @SubscribeMessage(ClientEvents.JOIN_ROOM)
  @RequiredActions(RbacActions.READ_COMMUNITY)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    source: ResourceIdSource.TEXT_PAYLOAD,
  })
  async findOne(@ConnectedSocket() client: Socket, @MessageBody() id: string) {
    return this.roomsService.join(client, id);
  }

  @SubscribeMessage(ClientEvents.JOIN_DM_ROOM)
  @RequiredActions(RbacActions.READ_MESSAGE)
  @RbacResource({
    type: RbacResourceType.DM_GROUP,
    source: ResourceIdSource.TEXT_PAYLOAD,
  })
  async joinDmRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() dmGroupId: string,
  ) {
    const userId = getSocketUserId(client);
    this.logger.log(`User ${userId} joining DM room: ${dmGroupId}`);
    return this.roomsService.join(client, dmGroupId);
  }

  @SubscribeMessage(ClientEvents.LEAVE_ROOM)
  async leaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() id: string,
  ) {
    const userId = getSocketUserId(client);
    this.logger.log(`User ${userId} leaving room: ${id}`);
    return this.roomsService.leave(client, id);
  }

  @SubscribeMessage(ClientEvents.LEAVE_ALL)
  @RequiredActions(RbacActions.READ_COMMUNITY)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    source: ResourceIdSource.TEXT_PAYLOAD,
  })
  async leaveAll(
    @ConnectedSocket() client: Socket,
    @MessageBody() communityId: string,
  ) {
    const userId = getSocketUserId(client);
    this.logger.log(
      `User ${userId} leaving all rooms for community ${communityId}`,
    );
    // Cast is safe here as WsJwtAuthGuard ensures authentication
    return this.roomsService.leaveAll(
      client as AuthenticatedSocket,
      communityId,
    );
  }

  @SubscribeMessage(ClientEvents.LEAVE_DM_ROOM)
  @RequiredActions(RbacActions.READ_MESSAGE)
  @RbacResource({
    type: RbacResourceType.DM_GROUP,
    source: ResourceIdSource.TEXT_PAYLOAD,
  })
  async leaveDmRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() dmGroupId: string,
  ) {
    const userId = getSocketUserId(client);
    this.logger.log(`User ${userId} leaving DM room: ${dmGroupId}`);
    return this.roomsService.leave(client, dmGroupId);
  }
}
