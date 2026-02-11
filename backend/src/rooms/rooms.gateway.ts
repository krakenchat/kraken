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
import { ClientEvents } from '@kraken/shared';
import { RequiredActions } from '@/auth/rbac-action.decorator';
import { RbacActions } from '@prisma/client';
import {
  RbacResource,
  RbacResourceType,
  ResourceIdSource,
} from '@/auth/rbac-resource.decorator';
import { WsLoggingExceptionFilter } from '@/websocket/ws-exception.filter';
import { WsJwtAuthGuard } from '@/auth/ws-jwt-auth.guard';
import { WsThrottleGuard } from '@/auth/ws-throttle.guard';
import {
  getSocketUser,
  getSocketUserId,
  AuthenticatedSocket,
} from '@/common/utils/socket.utils';

@UseFilters(WsLoggingExceptionFilter)
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
@UseGuards(WsThrottleGuard, WsJwtAuthGuard, RbacGuard)
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
    this.logger.debug(`Client disconnected: ${client.id}`);
    // Note: USER_ONLINE/USER_OFFLINE events are handled by PresenceGateway
    // with proper connection counting to avoid duplicate events
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
    this.logger.debug(
      `User ${user.id} joined all rooms with communityId ${communityId}`,
    );

    // Note: USER_ONLINE events are handled by PresenceGateway
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
